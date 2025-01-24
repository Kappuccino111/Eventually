from flask import Blueprint, render_template, jsonify, request
from fetch_wind_data import fetch_and_return_wind_data
from fetch_solar_data import fetch_and_return_solar_data
from model.predictive_model import (
    init,
    get_area_data,
    calculate_transit_density,
    identify_low_transit_areas,
    optimize_locations
)
from app import cache  # Import the cache object from __init__.py

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

@main.route("/api/model-results", methods=["GET"])
def model_results():
    # 1) parse lat/lon/radius from query params
    lat = request.args.get('latitude', type=float)
    lon = request.args.get('longitude', type=float)
    radius = request.args.get('radius', type=float)

    if lat is None or lon is None or radius is None:
        return jsonify({"error": "latitude, longitude, and radius are required"}), 400

    try:
        # 2) run the pipeline
        init(lat, lon, radius)
        networks, existing_stations = get_area_data()
        grid, density_scores = calculate_transit_density(networks, existing_stations)
        low_transit_centers = identify_low_transit_areas(grid, density_scores)
        proposed_locations = optimize_locations(low_transit_centers, existing_stations, networks)

        # 3) Return as JSON (list of [lat, lon] pairs, for example)
        return jsonify({
            "low_transit_centers": low_transit_centers,
            "proposed_locations": proposed_locations
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Optional route to clear cache (for debugging or testing)
@main.route('/clear-cache', methods=['GET', 'POST'])
def clear_cache():
    cache.clear()
    return "All cache cleared!"