from flask import Blueprint, render_template, jsonify, request
import requests

main = Blueprint('main', __name__)

# Route for the homepage
@main.route('/')
def index():
    return render_template('index.html')
