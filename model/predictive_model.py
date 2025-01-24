import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from geopy.distance import geodesic
import osmnx as ox
import folium
from typing import Tuple, List, Dict
from shapely.geometry import Point
import networkx as nx
from scipy.stats import gaussian_kde
from branca import colormap as cm
from sklearn.preprocessing import MinMaxScaler
from scipy.stats import gaussian_kde
from sklearn.cluster import MeanShift
from scipy.spatial import cKDTree

CENTER = None
RADIUS = None

def init(center_lat: float, center_lon: float, radius_km: float):
    global CENTER, RADIUS
    CENTER = (center_lat, center_lon)
    RADIUS = radius_km

def haversine_distances(grid, nodes):
    R = 6371  # Earth's radius in km

    # Convert to radians
    grid_rad = np.radians(grid)
    nodes_rad = np.radians(nodes)

    # Differences in coordinates
    dlat = grid_rad[:, np.newaxis, 0] - nodes_rad[np.newaxis, :, 0]
    dlon = grid_rad[:, np.newaxis, 1] - nodes_rad[np.newaxis, :, 1]

    # Haversine formula
    a = np.sin(dlat/2)**2 + np.cos(grid_rad[:, np.newaxis, 0]) * np.cos(nodes_rad[np.newaxis, :, 0]) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))

    return R * c

def get_area_data() -> Tuple[Dict, pd.DataFrame]:
   # Fetch data with 30% larger radius for edge correction
   buffer_radius = RADIUS * 1.7

   networks = {
       'drive': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, network_type='drive'),
       'bus': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, custom_filter='["bus"~"yes|designated"]'),
       'rail': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, custom_filter='["railway"~"rail"]'),
       'subway': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, custom_filter='["railway"~"subway|tram"]')
   }

   charging_stations = ox.features_from_point(
       CENTER,
       tags={'amenity': 'charging_station'},
       dist=buffer_radius * 1000
   )

   return networks, charging_stations

def calculate_transit_density(networks: Dict, existing_stations: pd.DataFrame) -> np.ndarray:
    buffer = 0.17  # 70% buffer
    lat_range = np.linspace(CENTER[0] - buffer, CENTER[0] + buffer, 100)
    lon_range = np.linspace(CENTER[1] - buffer, CENTER[1] + buffer, 100)
    lat_grid, lon_grid = np.meshgrid(lat_range, lon_range)
    grid = np.column_stack((lat_grid.ravel(), lon_grid.ravel()))

    density_scores = np.zeros(len(grid))
    weights = {'bus': 0.2, 'rail': 0.4, 'subway': 0.3, 'charging': 0.1}

    for mode, network in networks.items():
        if mode != 'drive':
            nodes = pd.DataFrame({
                'lat': nx.get_node_attributes(network, 'y'),
                'lon': nx.get_node_attributes(network, 'x')
            }).values

            if len(nodes) > 0:
                distances = haversine_distances(grid, nodes)
                min_distances = np.min(distances, axis=1)
                density_scores += weights.get(mode, 0) * np.exp(-min_distances)

    if not existing_stations.empty:
        charging_coords = []
        for _, row in existing_stations.iterrows():
            if isinstance(row.geometry, Point):
                charging_coords.append([row.geometry.y, row.geometry.x])
            else:
                centroid = row.geometry.centroid
                charging_coords.append([centroid.y, centroid.x])

        charging_nodes = np.array(charging_coords)
        if len(charging_nodes) > 0:
            distances = haversine_distances(grid, charging_nodes)
            min_distances = np.min(distances, axis=1)
            density_scores += weights['charging'] * np.exp(-min_distances)

    kde = gaussian_kde(grid.T, weights=density_scores, bw_method='scott')
    density_scores = kde.evaluate(grid.T)
    density_scores = (density_scores - np.min(density_scores)) / (np.max(density_scores) - np.min(density_scores))

    center_distances = haversine_distances(grid, np.array([CENTER]))
    edge_penalty = np.exp(-0.5 * (center_distances.ravel() / RADIUS))
    density_scores *= edge_penalty

    # Filter points within original radius
    mask = center_distances.ravel() <= RADIUS

    return grid[mask], density_scores[mask]

def identify_low_transit_areas(grid: np.ndarray, density_scores: np.ndarray) -> List[Tuple[float, float]]:
   threshold = np.percentile(density_scores, 25)
   low_transit_mask = density_scores < threshold
   clustering = DBSCAN(eps=0.01, min_samples=15).fit(grid[low_transit_mask])

   low_transit_centers = []
   for label in set(clustering.labels_):
       if label != -1:
           mask = clustering.labels_ == label
           center = grid[low_transit_mask][mask].mean(axis=0)
           low_transit_centers.append(tuple(center))

   return low_transit_centers

def optimize_locations(low_transit_centers: List[Tuple[float, float]],
                    existing_stations: pd.DataFrame,
                    networks: Dict) -> List[Tuple[float, float]]:
   drive_network = networks['drive']
   proposed_locations = []

   for center in low_transit_centers:
       # Get nearest node from road network
       nearest_node = ox.nearest_nodes(drive_network, center[1], center[0])
       node_coords = (drive_network.nodes[nearest_node]['y'],
                     drive_network.nodes[nearest_node]['x'])

       # Check minimum distance from existing stations
       if not existing_stations.empty:
           existing_coords = []
           for _, row in existing_stations.iterrows():
               if isinstance(row.geometry, Point):
                   existing_coords.append((row.geometry.y, row.geometry.x))
               else:
                   centroid = row.geometry.centroid
                   existing_coords.append((centroid.y, centroid.x))

           distances = [geodesic(node_coords, ex_station).km for ex_station in existing_coords]
           if not distances or min(distances) > 1.0:
               proposed_locations.append(node_coords)
       else:
           proposed_locations.append(node_coords)

   return proposed_locations

def normalize(array: np.ndarray) -> np.ndarray:
   scaler = MinMaxScaler()
   return scaler.fit_transform(array.reshape(-1, 1)).ravel()

def cluster_network_points(networks: Dict) -> Dict:
    clustered_networks = {}
    for mode, network in networks.items():
        if mode != 'drive':
            points = np.array([(network.nodes[n]['y'], network.nodes[n]['x'])
                             for n in network.nodes()])
            if len(points) > 0:
                ms = MeanShift(bandwidth=0.01)  # Adjust bandwidth as needed
                ms.fit(points)
                clustered_networks[mode] = ms.cluster_centers_
    return clustered_networks

def get_area_data() -> Tuple[Dict, pd.DataFrame]:
    buffer_radius = RADIUS * 1.7
    n_samples = int(10 * RADIUS)  # Scale samples with radius

    networks = {
        'drive': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, network_type='drive'),
        'bus': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, custom_filter='["bus"~"yes|designated"]'),
        'rail': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, custom_filter='["railway"~"rail"]'),
        'subway': ox.graph_from_point(CENTER, dist=buffer_radius * 1000, custom_filter='["railway"~"subway|tram"]')
    }

    # Sample nodes from each network
    for mode, network in networks.items():
        if mode != 'drive':
            nodes = list(network.nodes())
            if len(nodes) > n_samples:
                sampled_nodes = np.random.choice(nodes, n_samples, replace=False)
                networks[mode] = network.subgraph(sampled_nodes)

    charging_stations = ox.features_from_point(
        CENTER,
        tags={'amenity': 'charging_station'},
        dist=buffer_radius * 1000
    )

    return networks, charging_stations

def get_land_use() -> Dict:
   """
   Fetch land use data from OSM
   Returns dict with arrays of coordinates for each land use type
   """
   buffer_radius = RADIUS * 1.1
   tags = {
       'green_area': ['leisure=park', 'landuse=forest', 'natural=wood'],
       'urban_area': ['landuse=residential', 'landuse=commercial', 'landuse=industrial'],
       'water': ['natural=water', 'waterway=river'],
       'available_space': ['landuse=grass', 'landuse=meadow', 'landuse=farmland']
   }

   land_use = {}
   for category, tag_list in tags.items():
       features = []
       for tag in tag_list:
           key, value = tag.split('=')
           filter_query = f'["{key}"="{value}"]'
           try:
               gdf = ox.features_from_point(CENTER, {key: value}, dist=buffer_radius * 1000)
               if not gdf.empty:
                   features.extend([geom.centroid.coords[0] for geom in gdf.geometry])
           except:
               continue
       land_use[category] = np.array(features)

   return land_use

def calculate_transit_density(networks: Dict, existing_stations: pd.DataFrame) -> np.ndarray:
   grid = create_grid()
   density_scores = calculate_network_density(grid, networks)
   density_scores = add_charging_density(grid, density_scores, existing_stations)
   density_scores = apply_edge_penalty(grid, density_scores)
   return filter_by_radius(grid, density_scores)

def create_grid() -> np.ndarray:
   buffer = 0.17
   lat_range = np.linspace(CENTER[0] - buffer, CENTER[0] + buffer, 100)
   lon_range = np.linspace(CENTER[1] - buffer, CENTER[1] + buffer, 100)
   lat_grid, lon_grid = np.meshgrid(lat_range, lon_range)
   return np.column_stack((lat_grid.ravel(), lon_grid.ravel()))

def calculate_network_density(grid: np.ndarray, networks: Dict) -> np.ndarray:
   weights = {'bus': 0.2, 'rail': 0.4, 'subway': 0.3}
   density_scores = np.zeros(len(grid))
   clustered_networks = cluster_network_points(networks)

   for mode, points in clustered_networks.items():
       if len(points) > 0:
           min_distances = np.min(haversine_distances(grid, points), axis=1)
           density_scores += weights.get(mode, 0) * np.exp(-min_distances)
   return density_scores

def add_charging_density(grid: np.ndarray, density_scores: np.ndarray,
                       stations: np.ndarray) -> np.ndarray:
   if not isinstance(stations, pd.DataFrame):
       charging_points = stations
   else:
       charging_points = np.array([[row.geometry.centroid.y, row.geometry.centroid.x]
                                 if not isinstance(row.geometry, Point)
                                 else [row.geometry.y, row.geometry.x]
                                 for _, row in stations.iterrows()])

   if len(charging_points) == 0:
       return density_scores

   clustered_charging = MeanShift(bandwidth=0.01).fit(charging_points).cluster_centers_
   min_distances = np.min(haversine_distances(grid, clustered_charging), axis=1)
   return density_scores + 0.2 * np.exp(-min_distances)

def apply_edge_penalty(grid: np.ndarray, density_scores: np.ndarray) -> np.ndarray:
   center_distances = haversine_distances(grid, np.array([CENTER]))
   edge_penalty = np.exp(-0.5 * (center_distances.ravel() / RADIUS))
   return density_scores * edge_penalty

def filter_by_radius(grid: np.ndarray, density_scores: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
   mask = haversine_distances(grid, np.array([CENTER])).ravel() <= RADIUS
   return grid[mask], density_scores[mask]

def calculate_population_density(grid: np.ndarray) -> np.ndarray:
   cities = get_city_data(CENTER, RADIUS * 1.3)

   if not cities:
       return np.zeros(len(grid))

   city_points = np.array([city['location'] for city in cities])
   populations = np.array([city['population'] for city in cities])

   # Use population as weights for KDE
   weights = populations / populations.max()
   kde = gaussian_kde(city_points.T, weights=weights, bw_method='scott')

   # Evaluate KDE on grid
   density = kde.evaluate(grid.T)
   return normalize(density)

def get_city_data(center: tuple, radius: float) -> List[Dict]:
   city_data = ox.features_from_point(center, {'place': ['city', 'town']}, dist=radius*1000)
   cities = []
   for _, row in city_data.iterrows():
       try:
           pop = int(row.get('population', 0))
           if pop > 0:
               cities.append({
                   'location': (row.geometry.y, row.geometry.x),
                   'population': pop
               })
       except:
           continue
   return cities

def calculate_neighborhood_density(grid: np.ndarray, land_use: Dict) -> np.ndarray:
    density = np.zeros(len(grid))
    factors = {
        'green_area': 0.5,
        'urban_area': -0.6,
        'water': -0.1,
        'available_space': 0.8
    }

    for factor, weight in factors.items():
        points = land_use[factor][:,[1,0]]  # Swap lat/lon
        if len(points) > 1:
            kde = gaussian_kde(points.T, bw_method='scott')
            factor_density = kde.evaluate(grid.T)
            density += -1 * weight * factor_density

    return normalize(density)

def identify_low_transit_areas(grid: np.ndarray, density_scores: np.ndarray) -> List[Tuple[float, float]]:
   threshold = np.percentile(density_scores, 25)
   low_transit_mask = density_scores < threshold
   clustering = DBSCAN(eps=0.01, min_samples=15).fit(grid[low_transit_mask])

   low_transit_centers = []
   for label in set(clustering.labels_):
       if label != -1:
           mask = clustering.labels_ == label
           center = grid[low_transit_mask][mask].mean(axis=0)
           low_transit_centers.append(tuple(center))

   return low_transit_centers

def within_radius(point):
   return haversine_distances(np.array([point]), np.array([CENTER]))[0][0] <= RADIUS

def preprocess_road_network(network):
    secondary_edges = []
    for u, v, d in network.edges(data=True):
        if d.get('highway') == 'secondary':
            u_coords = (network.nodes[u]['y'], network.nodes[u]['x'])
            v_coords = (network.nodes[v]['y'], network.nodes[v]['x'])
            if within_radius(u_coords) or within_radius(v_coords):
                secondary_edges.append((u_coords, v_coords))
    return secondary_edges


def calculate_combined_density(grid: np.ndarray,
                            networks: Dict,
                            solar_data: np.ndarray,
                            land_use: Dict,
                            traffic_data: np.ndarray,
                            weights: Dict) -> np.ndarray:

   # Get individual densities
   grid_mask, infra_density = calculate_transit_density(networks, grid)
   #solar_density = calculate_solar_density(solar_data, grid_mask)
   neighborhood_density = calculate_neighborhood_density(grid_mask, land_use)
   traffic_density = calculate_population_density(grid_mask)

   # Convert to numpy arrays
   infra_density = np.array(infra_density)
   neighborhood_density = np.array(neighborhood_density)
   traffic_density = np.array(traffic_density)

   # Combine densities
   total_density = (weights['infrastructure'] * infra_density +
                   #weights['solar'] * solar_density +
                   weights['neighborhood'] * neighborhood_density +
                   weights['traffic'] * traffic_density
                   )

   return total_density
