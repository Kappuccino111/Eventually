import requests
import pandas as pd

def fetch_and_print_annual_data(latitude, longitude):
    """
    Fetch and print annual GHI and DNI data from NASA POWER for the years 2005 to 2020
    for the specified latitude and longitude.
    """
    start_year = 2005
    end_year = 2020

    for year in range(start_year, end_year + 1):
        start_date = f"{year}0101"
        end_date = f"{year}1231"

        try:
            url = "https://power.larc.nasa.gov/api/temporal/daily/point"
            parameters = "ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI"
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
            ghi_data = daily_parameters["ALLSKY_SFC_SW_DWN"]
            dni_data = daily_parameters["ALLSKY_SFC_SW_DNI"]

            df = pd.DataFrame({
                "GHI": ghi_data,
                "DNI": dni_data
            })
            df.index = pd.to_datetime(list(ghi_data.keys()), format='%Y%m%d')

            annual_ghi = df["GHI"].sum()
            annual_dni = df["DNI"].sum()

            print(f"Year: {year}, Latitude: {latitude}, Longitude: {longitude}, Annual GHI: {annual_ghi:.2f} kWh/m², Annual DNI: {annual_dni:.2f} kWh/m²")

        except Exception as e:
            print(f"Failed to fetch data for {latitude}, {longitude} in {year}: {e}")

# # Example usage
# latitude = 48.7758  # Example latitude (Stuttgart)
# longitude = 9.1829  # Example longitude (Stuttgart)
# fetch_and_print_annual_data(latitude, longitude)

def fetch_and_return_solar_data(latitude, longitude):
    start_year = 2005
    end_year = 2006

    results = []

    for year in range(start_year, end_year + 1):
        start_date = f"{year}0101"
        end_date = f"{year}1231"

        try:
            url = "https://power.larc.nasa.gov/api/temporal/daily/point"
            parameters = "ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI"
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
            ghi_data = daily_parameters["ALLSKY_SFC_SW_DWN"]
            dni_data = daily_parameters["ALLSKY_SFC_SW_DNI"]

            df = pd.DataFrame({
                "GHI": ghi_data,
                "DNI": dni_data
            })
            df.index = pd.to_datetime(list(ghi_data.keys()), format='%Y%m%d')

            annual_ghi = df["GHI"].sum()
            annual_dni = df["DNI"].sum()

            results.append({
                "year": year,
                "ghi": annual_ghi,
                "dni": annual_dni,
            })

        except Exception as e:
            print(f"Failed to fetch solar data: {e}")
            results.append({"year": year, "error": str(e)})

    # Calculate 15-year average
    avg_ghi = sum([x["ghi"] for x in results if "ghi" in x]) / len(results)
    avg_dni = sum([x["dni"] for x in results if "dni" in x]) / len(results)

    return {"data": results, "avg_ghi": avg_ghi, "avg_dni": avg_dni}
