from flask import Blueprint, render_template, jsonify, request
from fetch_wind_data import fetch_and_return_wind_data
from fetch_solar_data import fetch_and_return_solar_data
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

# Optional route to clear cache (for debugging or testing)
@main.route('/clear-cache', methods=['GET', 'POST'])
def clear_cache():
    cache.clear()
    return "All cache cleared!"