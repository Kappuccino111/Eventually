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

