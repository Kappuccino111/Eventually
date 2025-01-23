document.addEventListener('DOMContentLoaded', function () {
    console.log("map.js is loaded");

    var map = L.map('map').setView([51.1657, 10.4515], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var marker;
    var circle;

    var searchInput = document.getElementById('search-input');
    var searchButton = document.getElementById('search-button');

    var radiusInput = document.getElementById('radius-input');

    var checkbox = document.getElementById('initial_points'); // Updated to match the checkbox ID

    var lastSearchedLat, lastSearchedLon;

    // New variables to manage dynamic points
    var dynamicMarkers = [];

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Event listeners for checkbox and radius input
    checkbox.addEventListener('change', updateDynamicPoints);
    radiusInput.addEventListener('input', function () {
        console.log("Radius input changed.");
        // Update circle radius
        if (circle && lastSearchedLat && lastSearchedLon) {
            map.removeLayer(circle);
            addRadiusCircle(lastSearchedLat, lastSearchedLon);
        }
        // Update dynamic points if checkbox is checked
        if (checkbox.checked) {
            updateDynamicPoints();
        }
    });

    function performSearch() {
        var query = searchInput.value.trim();
        if (query === '') return;

        console.log("Performing search for:", query);

        // Check if input is in the form of "latitude,longitude"
        var latLonRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
        var match = query.match(latLonRegex);

        if (match) {
            var lat = parseFloat(match[1]);
            var lon = parseFloat(match[3]);

            console.log("Performing search with coordinates:", lat, lon);

            lastSearchedLat = lat;
            lastSearchedLon = lon;
            map.setView([lat, lon], 10);

            console.log("Map view set to:", lat, lon);

            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lon]).addTo(map)
                .bindPopup(`Latitude: ${lat}, Longitude: ${lon}`)
                .openPopup();

            // Add circle with dotted lines
            addRadiusCircle(lat, lon);
        } else {
            // Treat input as a text query
            query += ', Germany';
            console.log("Performing search with query:", query);

            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(data => {
                    console.log("Search results from Nominatim:", data);
                    if (data.length > 0) {
                        var lat = parseFloat(data[0].lat);
                        var lon = parseFloat(data[0].lon);
                        lastSearchedLat = lat;
                        lastSearchedLon = lon;
                        map.setView([lat, lon], 10);

                        console.log("Map view set to:", lat, lon);

                        if (marker) map.removeLayer(marker);
                        marker = L.marker([lat, lon]).addTo(map)
                            .bindPopup(data[0].display_name)
                            .openPopup();

                        // Add circle with dotted lines
                        addRadiusCircle(lat, lon);
                    } else {
                        alert('Location not found in Germany');
                    }
                })
                .catch(error => console.error('Error fetching search results:', error));
        }
    }

    function addRadiusCircle(lat, lon) {
        var radiusKm = parseInt(radiusInput.value);
        var radiusMeters = radiusKm * 1000; // Convert km to meters

        console.log(`Adding radius circle of ${radiusKm} km around (${lat}, ${lon})`);

        if (circle) map.removeLayer(circle);

        circle = L.circle([lat, lon], {
            color: 'Black',
            weight: 2,
            dashArray: '5, 5', // Dotted line style
            fillOpacity: 0.0,
            radius: radiusMeters
        }).addTo(map);

        console.log("Circle added with radius:", radiusMeters, "meters");

        // If checkbox is checked, generate dynamic points
        if (checkbox.checked) {
            generateDynamicPoints(lat, lon, radiusKm);
        }
    }

    function generateDynamicPoints(lat, lon, radiusKm) {
        var numPoints = radiusKm * 2;
        console.log(`Generating ${numPoints} dynamic points within the circle.`);

        // Remove existing dynamic markers
        dynamicMarkers.forEach(marker => map.removeLayer(marker));
        dynamicMarkers = [];

        if (numPoints === 0) return;

        // Determine grid dimensions
        var gridSize = Math.ceil(Math.sqrt(numPoints)); // Number of points per axis
        var step = (2 * radiusKm * 1000) / gridSize; // Step in meters

        // Convert step from meters to degrees approximately
        var stepLat = metersToDegrees(step, 'lat');
        var stepLon = metersToDegrees(step, 'lon', lat);

        var halfGrid = Math.floor(gridSize / 2);

        var pointsPlaced = 0;

        for (var i = -halfGrid; i <= halfGrid && pointsPlaced < numPoints; i++) {
            for (var j = -halfGrid; j <= halfGrid && pointsPlaced < numPoints; j++) {
                // Calculate offset in degrees
                var offsetLat = i * stepLat;
                var offsetLon = j * stepLon;

                var pointLat = lat + offsetLat;
                var pointLon = lon + offsetLon;

                // Calculate distance from center
                var distance = getDistanceFromLatLonInKm(lat, lon, pointLat, pointLon);

                if (distance <= radiusKm) {
                    var pointMarker = L.circleMarker([pointLat, pointLon], {
                        radius: 5,
                        color: 'red',
                        fillColor: '#f03',
                        fillOpacity: 0.5
                    }).addTo(map)
                        .bindPopup(`Point ${pointsPlaced + 1}: (${pointLat.toFixed(5)}, ${pointLon.toFixed(5)})`);

                    console.log(`Point added at: (${pointLat}, ${pointLon})`);
                    dynamicMarkers.push(pointMarker);
                    pointsPlaced++;
                }
            }
        }

        console.log(`Placed ${pointsPlaced} points within the circle.`);

        // Attach click handlers to all markers
        attachClickHandlers();
    }

    function attachClickHandlers() {
        dynamicMarkers.forEach(marker => {
            console.log("Attaching click event to marker:", marker.getLatLng());
            marker.on('click', () => onPointClick(marker.getLatLng().lat, marker.getLatLng().lng));
        });
    }

    function updateDynamicPoints() {
        console.log("Updating dynamic points.");
        if (checkbox.checked) {
            if (lastSearchedLat && lastSearchedLon && circle) {
                var radiusKm = parseInt(radiusInput.value);
                generateDynamicPoints(lastSearchedLat, lastSearchedLon, radiusKm);
            }
        } else {
            // Remove dynamic markers if checkbox is unchecked
            console.log("Removing dynamic markers as checkbox is unchecked.");
            dynamicMarkers.forEach(marker => map.removeLayer(marker));
            dynamicMarkers = [];
        }
    }

    function metersToDegrees(meters, type, lat = 0) {
        var degrees;
        if (type === 'lat') {
            degrees = meters / 111320; // Approximation for latitude
        } else if (type === 'lon') {
            degrees = meters / (40075000 * Math.cos(toRadians(lat)) / 360);
        }
        return degrees;
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = toRadians(lat2 - lat1);
        var dLon = toRadians(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d;
    }

    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function onPointClick(lat, lon) {
        console.log(`Fetching wind-solar data for lat: ${lat}, lon: ${lon}`);

        // Create a popup with a loading message and custom maxWidth
        const loadingPopup = L.popup({ maxWidth: 600 }) // Increase maxWidth to fit the table
            .setLatLng([lat, lon])
            .setContent(`<p>Loading data for (${lat.toFixed(5)}, ${lon.toFixed(5)})...</p>`)
            .openOn(map);

        // Fetch data from the API
        fetch(`/api/wind-solar-data?latitude=${lat}&longitude=${lon}`)
            .then(response => {
                console.log("API Response Status:", response.status);
                return response.json();
            })
            .then(data => {
                console.log("Received data:", data);

                if (data.error) {
                    // Update popup with error message
                    loadingPopup.setContent(`<p>Error fetching data: ${data.error}</p>`);
                    return;
                }

                // Extract wind and solar data
                const windData = data.wind_data.data;
                const solarData = data.solar_data.data;

                // Averages
                const avgWind10m = data.wind_data.avg_10m.toFixed(2);
                const avgWind50m = data.wind_data.avg_50m.toFixed(2);
                const avgGHI = data.solar_data.avg_ghi.toFixed(2);
                const avgDNI = data.solar_data.avg_dni.toFixed(2);

                const totalAvg = (parseFloat(avgWind10m) + parseFloat(avgWind50m) + parseFloat(avgGHI) + parseFloat(avgDNI)) / 4;

                // Generate the table content
                let tableHtml = `
                <table style="border-collapse: collapse; width: 100%; text-align: center;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px;">Year</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Wind Energy (10m)</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Wind Energy (50m)</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">GHI</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">DNI</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

                windData.forEach((item, index) => {
                    const solar = solarData[index];
                    tableHtml += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${item.year}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${item.wind_energy_10m.toFixed(2)} kWh/m²</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${item.wind_energy_50m.toFixed(2)} kWh/m²</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${solar.ghi.toFixed(2)} kWh/m²</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${solar.dni.toFixed(2)} kWh/m²</td>
                    </tr>
                `;
                });

                tableHtml += `
                    <tr style="font-weight: bold;">
                        <td style="border: 1px solid #ddd; padding: 8px;">2-Year Avg</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${avgWind10m} kWh/m²</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${avgWind50m} kWh/m²</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${avgGHI} kWh/m²</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${avgDNI} kWh/m²</td>
                    </tr>
                    <tr style="font-weight: bold;">
                        <td style="border: 1px solid #ddd; padding: 8px;">Total Average</td>
                        <td style="border: 1px solid #ddd; padding: 8px;" colspan="4">${totalAvg.toFixed(2)} kWh/m²</td>
                    </tr>
                    </tbody>
                </table>
            `;


                // Update the popup with the table
                loadingPopup.setContent(`
                <h4>Data for (${lat.toFixed(5)}, ${lon.toFixed(5)})</h4>
                ${tableHtml}
            `);
            })
            .catch(error => {
                console.error('Error fetching wind/solar data:', error);
                // Update popup with error message
                loadingPopup.setContent(`<p>Error fetching data: ${error.message}</p>`);
            });
    }
});