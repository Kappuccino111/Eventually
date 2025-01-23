import requests
import pandas as pd
import os

def fetch_nasa_power_data(latitude, longitude, start_date, end_date):
    """
    Fetch daily GHI and DNI data from NASA POWER for the specified location and date range.
    """
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
    return df

def process_region_data(region, coordinates, start_year, end_year):
    """
    Fetch and save GHI and DNI data for a specific region and range of years.
    """
    for year in range(start_year, end_year + 1):
        start_date = f"{year}0101"
        end_date = f"{year}1231"
        region_data = []
        for lat, lon in coordinates:
            try:
                df = fetch_nasa_power_data(lat, lon, start_date, end_date)
                annual_data = {
                    "Latitude": lat,
                    "Longitude": lon,
                    "Annual GHI (kWh/m²)": df["GHI"].sum(),
                    "Annual DNI (kWh/m²)": df["DNI"].sum()
                }
                region_data.append(annual_data)
            except Exception as e:
                print(f"Failed to fetch data for {region} ({lat}, {lon}) in {year}: {e}")
        # Save to CSV
        output_dir = "./irradiation_data"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{region}_{year}.csv")
        pd.DataFrame(region_data).to_csv(output_path, index=False)
        print(f"Saved data for {region} in {year} to {output_path}")

# Representative coordinates (lat, lon) for the top cities/places in each region
region_cities = {
    "Baden-Württemberg": [
        (48.7758, 9.1829),  # Stuttgart
        (49.0069, 8.4037),  # Karlsruhe
        (47.9990, 7.8421),  # Freiburg
        (49.3988, 8.6724),  # Heidelberg
        (48.4011, 9.9876)   # Ulm
    ],
    "Bayern": [
        (48.1351, 11.5820),  # Munich
        (49.4521, 11.0767),  # Nuremberg
        (49.0134, 12.1016),  # Regensburg
        (48.5667, 13.4319),  # Passau
        (50.0739, 12.1480)   # Hof
    ],
    "Berlin": [
        (52.5200, 13.4050)   # Berlin
    ],
    "Brandenburg": [
        (52.3915, 13.0645),  # Potsdam
        (52.7374, 13.8220),  # Oranienburg
        (52.3933, 14.5289),  # Frankfurt (Oder)
        (52.8508, 14.6183),  # Eisenhüttenstadt
        (51.8504, 14.6903)   # Cottbus
    ]
    # Add other regions here...
}

# Fetch and save data for all regions for the years 2010 and 2011
for region, coords in region_cities.items():
    process_region_data(region, coords, 2010, 2011)