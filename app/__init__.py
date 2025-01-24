# from flask import Flask
# from config import Config

# def create_app(config_class=Config):
#     app = Flask(__name__)
#     app.config.from_object(config_class)

#     from app.routes import main
#     app.register_blueprint(main)

#     return app

from flask import Flask
from flask_caching import Cache  # Import the Flask-Caching library
from config import Config

# Initialize the Cache object globally
cache = Cache()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Configure Redis-based caching
    app.config['CACHE_TYPE'] = 'RedisCache'
    app.config['CACHE_REDIS_HOST'] = 'localhost'  # Redis server host
    app.config['CACHE_REDIS_PORT'] = 6379         # Redis server port
    app.config['CACHE_REDIS_DB'] = 0              # Redis database index
    app.config['CACHE_DEFAULT_TIMEOUT'] = 3600    # Default cache timeout (1 hour)

    # Initialize cache with the app
    cache.init_app(app)

    # Register your routes
    from app.routes import main
    app.register_blueprint(main)

    return app