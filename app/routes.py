from flask import Blueprint, render_template, jsonify, request
from fetch_wind_data import fetch_and_return_wind_data
from fetch_solar_data import fetch_and_return_solar_data
from model.predictive_model import *
import pandas as pd
import networkx as nx
from shapely.geometry import Point
import numpy as np
from app import cache  # Import the cache object from __init__.py
import numpy as np
from scipy.spatial import cKDTree

main = Blueprint('main', __name__)

# Route for the homepage
@main.route('/')
def index():
    return render_template('index.html')

# Cached fetch function
@cache.memoize(timeout=3600)  # Cache results for 1 hour
def fetch_cached_data(lat, lon):
    print(f"Fetching fresh data for lat: {lat}, lon: {lon}...")
    wind_data = fetch_and_return_wind_data(lat, lon)
    solar_data = fetch_and_return_solar_data(lat, lon)
    return {"wind_data": wind_data, "solar_data": solar_data}

# Route to fetch wind and solar data for a specific latitude and longitude
@main.route('/api/wind-solar-data', methods=['GET'])
def get_wind_solar_data():
    latitude = request.args.get('latitude', type=float)
    longitude = request.args.get('longitude', type=float)

    # Validate latitude and longitude
    if latitude is None or longitude is None:
        return jsonify({"error": "Latitude and longitude are required."}), 400

    try:
        # Fetch data using the cached function
        data = fetch_cached_data(latitude, longitude)
        return jsonify(data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@main.route("/api/complete-model-results", methods=["GET"])
def complete_model_results():
    """
    Returns JSON with all the data needed to replicate the Folium layers
    (Public transport stops, low transit areas, proposed stations,
     existing charging stations, road heatmap lines).
    """
    lat = float(request.args.get("latitude", 50.733334))
    lon = float(request.args.get("longitude", 7.100000))
    radius = float(request.args.get("radius", 25))
    CENTER = (lat, lon)
    RADIUS = radius
    try:
        # 1) Run the pipeline
        init(lat, lon, radius)
        networks, existing_stations = get_area_data()
        grid, density_scores = calculate_transit_density(networks, existing_stations)
        low_transit_centers = identify_low_transit_areas(grid, density_scores)
        proposed_locations = optimize_locations(low_transit_centers, existing_stations, networks)

        # 2) Build transport data (bus, rail, subway)
        #    We'll return these as arrays of lat/lon points.
        transport_data = {}
        colors = {'bus': 'green', 'rail': 'red', 'subway': 'orange'}
        for mode, network in networks.items():
            if mode == "drive":
                continue
            # Build a list of [lat, lon] for each node
            nodes_df = pd.DataFrame({
                "lat": nx.get_node_attributes(network, 'y'),
                "lon": nx.get_node_attributes(network, 'x')
            })
            # Filter out nodes outside the radius (optional)
            valid_nodes = []
            for _, row in nodes_df.iterrows():
                dist = haversine_distances(np.array([[row.lat, row.lon]]),
                                           np.array([CENTER]))[0][0]
                if dist <= RADIUS:
                    valid_nodes.append([row.lat, row.lon])
            transport_data[mode] = valid_nodes

        # 3) Existing stations
        existing_coords = []
        if not existing_stations.empty:
            for _, row in existing_stations.iterrows():
                if isinstance(row.geometry, Point):
                    coords = (row.geometry.y, row.geometry.x)
                else:
                    centroid = row.geometry.centroid
                    coords = (centroid.y, centroid.x)
                # Check distance if you want
                dist = haversine_distances(np.array([coords]),
                                           np.array([CENTER]))[0][0]
                if dist <= RADIUS:
                    existing_coords.append(coords)  # (lat, lon)

        # 4) Build road heatmap lines
        road_heat_data = []
        drive_network = networks["drive"]
        edges = [(u, v, d) for u, v, _, d in drive_network.edges(keys=True, data=True)
                 if d.get('highway') == 'secondary']

        edge_scores = []
        filtered_edges = []
        for u, v, _ in edges:
            u_coords = (drive_network.nodes[u]['y'], drive_network.nodes[u]['x'])
            v_coords = (drive_network.nodes[v]['y'], drive_network.nodes[v]['x'])
            mid_point = np.array([(u_coords[0] + v_coords[0]) / 2,
                                  (u_coords[1] + v_coords[1]) / 2])
            # Check if midpoint is within radius
            dist = haversine_distances(np.array([mid_point]), np.array([CENTER]))[0][0]
            if dist <= RADIUS:
                # sample 10 points along the edge to get a "score"
                points = np.linspace([u_coords[0], u_coords[1]],
                                     [v_coords[0], v_coords[1]], num=10)
                sub_scores = []
                for point in points:
                    distances = haversine_distances(grid, point.reshape(1, 2))
                    sub_scores.append(density_scores[np.argmin(distances)])
                edge_avg = np.mean(sub_scores)
                edge_scores.append(edge_avg)
                filtered_edges.append((u_coords, v_coords))

        if edge_scores:
            edge_scores = np.array(edge_scores)
            norm = (edge_scores - np.min(edge_scores)) / (np.max(edge_scores) - np.min(edge_scores))
            for i, (u_coords, v_coords) in enumerate(filtered_edges):
                score = norm[i]
                # Store the line coordinates + the normalized score
                road_heat_data.append({
                    "coords": [
                        [u_coords[0], u_coords[1]],  # lat, lon
                        [v_coords[0], v_coords[1]]
                    ],
                    "score": float(score)
                })

        # 5) Return JSON
        return jsonify({
            "transport_data": transport_data,   # e.g. { "bus": [[lat, lon], ...], "rail": [...], ...}
            "existing_stations": existing_coords,  # [[lat, lon], ...]
            "low_transit_centers": low_transit_centers,  # [[lat, lon], ...]
            "proposed_locations": proposed_locations,     # [[lat, lon], ...]
            "road_heatmap": road_heat_data,     # [ {coords: [[lat, lon], [lat, lon]], score: 0.XX}, ... ]
            "center": CENTER,                   # (lat, lon)
            "radius": RADIUS
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@main.route("/api/complete-model-results-v3", methods=["GET"])
def complete_model_results_v3():
    lat = float(request.args.get("latitude", 52.519595266877936))
    lon = float(request.args.get("longitude", 13.406919626977658))
    radius = float(request.args.get("radius", 15))

    infra_val = float(request.args.get("infra", 0.25))
    solar_val = float(request.args.get("solar", 0.25))
    neighborhood_val = float(request.args.get("neighborhood", 0.25))
    traffic_val = float(request.args.get("traffic", 0.25))

    try:
        # 1) init + fetch data
        init(lat, lon, radius)
        networks, existing_stations = get_area_data()
        grid, density_scores = calculate_transit_density(networks, existing_stations)

        # 2) land use + combined density
        land_use = get_land_use()
        weights = {
            'infrastructure': infra_val,
            'solar': solar_val,
            'neighborhood': neighborhood_val,
            'traffic': traffic_val
        }
        total_density = calculate_combined_density(
            grid=grid,
            land_use=land_use,
            networks=networks,
            solar_data=None,
            traffic_data=None,
            weights=weights
        )

        # 3) Build "road_heatmap_v3" data by sampling each secondary road segment
        #    just like create_road_heatmap_v3 does, but store it in JSON form.
        mask = haversine_distances(grid, np.array([[lat, lon]])).ravel() <= radius
        grid_masked = grid[mask]
        tree = cKDTree(grid_masked)

        secondary_edges = preprocess_road_network(networks['drive'])
        road_heatmap_v3 = []
        for u_coords, v_coords in secondary_edges:
            # sample points along the edge
            points = np.linspace([u_coords[0], u_coords[1]],
                                 [v_coords[0], v_coords[1]],
                                 num=10)
            _, indices = tree.query(points)
            score = float(np.mean(total_density[indices]))
            # We'll store 0..1 in "score"
            # The front-end can do color = #??
            road_heatmap_v3.append({
                "coords": [
                    [u_coords[0], u_coords[1]],
                    [v_coords[0], v_coords[1]]
                ],
                "score": score
            })

        # 4) Return as JSON
        return jsonify({
            "road_heatmap_v3": road_heatmap_v3
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Optional route to clear cache (for debugging or testing)
@main.route('/clear-cache', methods=['GET', 'POST'])
def clear_cache():
    cache.clear()
    return "All cache cleared!"