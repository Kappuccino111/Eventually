import requests
import pandas as pd

def fetch_and_print_annual_wind_data(latitude, longitude):
    """
    Fetch and print annual wind power density and wind speed data from NASA POWER for the years 2005 to 2020
    for the specified latitude and longitude.
    """
    start_year = 2005
    end_year = 2020
    air_density = 1.225  # kg/m³ (standard air density at sea level)
    hours_in_a_year = 365 * 24  # Total hours in a year

    for year in range(start_year, end_year + 1):
        start_date = f"{year}0101"
        end_date = f"{year}1231"

        try:
            url = "https://power.larc.nasa.gov/api/temporal/daily/point"
            parameters = "WS10M,WS50M"
            query_params = {
                "start": start_date,
                "end": end_date,
                "latitude": latitude,
                "longitude": longitude,
                "parameters": parameters,
                "community": "RE",
                "format": "JSON"
            }
            response = requests.get(url, params=query_params)
            response.raise_for_status()
            data_json = response.json()

            daily_parameters = data_json["properties"]["parameter"]
            wind_10m_data = daily_parameters["WS10M"]
            wind_50m_data = daily_parameters["WS50M"]

            df = pd.DataFrame({
                "WindSpeed10m": wind_10m_data,
                "WindSpeed50m": wind_50m_data
            })
            df.index = pd.to_datetime(list(wind_10m_data.keys()), format='%Y%m%d')

            annual_wind_10m = df["WindSpeed10m"].mean()
            annual_wind_50m = df["WindSpeed50m"].mean()

            # Calculate wind power density (W/m²) for 10m and 50m
            power_density_10m = 0.5 * air_density * (annual_wind_10m ** 3)
            power_density_50m = 0.5 * air_density * (annual_wind_50m ** 3)

            # Convert power density to energy density (kWh/m²) for the year
            energy_density_10m = (power_density_10m * hours_in_a_year) / 1000  # kWh/m²
            energy_density_50m = (power_density_50m * hours_in_a_year) / 1000  # kWh/m²

            print(f"Year: {year}, Latitude: {latitude}, Longitude: {longitude}, \
                  Average Wind Speed at 10m: {annual_wind_10m:.2f} m/s, Average Wind Speed at 50m: {annual_wind_50m:.2f} m/s, \
                  Energy Density at 10m: {energy_density_10m:.2f} kWh/m², Energy Density at 50m: {energy_density_50m:.2f} kWh/m²")

        except Exception as e:
            print(f"Failed to fetch data for {latitude}, {longitude} in {year}: {e}")

# Example usage
latitude = 48.7758  # Example latitude (Stuttgart)
longitude = 9.1829  # Example longitude (Stuttgart)
fetch_and_print_annual_wind_data(latitude, longitude)
