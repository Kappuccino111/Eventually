from flask import Blueprint, render_template, jsonify, request
from fetch_wind_data import fetch_and_return_wind_data
from fetch_solar_data import fetch_and_return_solar_data
import requests

main = Blueprint('main', __name__)

# Route for the homepage
@main.route('/')
def index():
    return render_template('index.html')

# Route to fetch wind and solar data for a specific latitude and longitude
@main.route('/api/wind-solar-data', methods=['GET'])
def get_wind_solar_data():
    latitude = request.args.get('latitude', type=float)
    longitude = request.args.get('longitude', type=float)

    # Validate latitude and longitude
    if latitude is None or longitude is None:
        return jsonify({"error": "Latitude and longitude are required."}), 400

    try:
        # Fetch wind data
        wind_data = fetch_and_return_wind_data(latitude, longitude)

        # Fetch solar data
        solar_data = fetch_and_return_solar_data(latitude, longitude)

        # Return the combined data
        return jsonify({
            "wind_data": wind_data,
            "solar_data": solar_data
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500