from flask import Blueprint, render_template, jsonify, request
import requests

main = Blueprint('main', __name__)

# Route for the homepage
@main.route('/')
def index():
    return render_template('index.html')

# Route for fetching power substations
# @main.route('/power-stations', methods=['GET'])
# def get_power_stations():
#     lat = request.args.get('lat')
#     lon = request.args.get('lon')
#     radius = request.args.get('radius', 20000)  # Default radius 20 km

#     overpass_url = "http://overpass-api.de/api/interpreter"
#     overpass_query = f"""
#     [out:json];
#     node
#       [power=substation]
#       (around:{radius},{lat},{lon});
#     out body;
#     """

#     response = requests.get(overpass_url, params={'data': overpass_query})

#     if response.status_code != 200:
#         return jsonify({"error": "Failed to fetch power stations"}), 500

#     data = response.json()

#     power_stations = []
#     for element in data['elements']:
#         power_station = {
#             "name": element.get('tags', {}).get('name', 'Unnamed Substation'),
#             "lat": element['lat'],
#             "lon": element['lon']
#         }
#         power_stations.append(power_station)

#     return jsonify(power_stations)

# # Route for fetching EV charging stations
# @main.route('/ev-stations', methods=['GET'])
# def get_ev_stations():
#     lat = request.args.get('lat')
#     lon = request.args.get('lon')
#     radius = request.args.get('radius', 20000)  # Default radius 20 km

#     overpass_url = "http://overpass-api.de/api/interpreter"
#     overpass_query = f"""
#     [out:json];
#     node
#       [amenity=charging_station]
#       (around:{radius},{lat},{lon});
#     out body;
#     """

#     response = requests.get(overpass_url, params={'data': overpass_query})

#     if response.status_code != 200:
#         return jsonify({"error": "Failed to fetch EV stations"}), 500

#     data = response.json()

#     ev_stations = []
#     for element in data['elements']:
#         ev_station = {
#             "name": element.get('tags', {}).get('name', 'Unnamed EV Station'),
#             "lat": element['lat'],
#             "lon": element['lon']
#         }
#         ev_stations.append(ev_station)

#     return jsonify(ev_stations)
