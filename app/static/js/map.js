document.addEventListener('DOMContentLoaded', function () {
    console.log("map.js is loaded");

    // Initialize the map
    var map = L.map('map').setView([51.1657, 10.4515], 6);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initialize variables
    var marker;
    var circle;

    var searchInput = document.getElementById('search-input');
    var searchButton = document.getElementById('search-button');
    var radiusInput = document.getElementById('radius-input');
    var checkboxInitial = document.getElementById('initial_points'); // Checkbox for dynamic points
    var checkboxFiltered = document.getElementById('filtered_points'); // Checkbox for filtered points

    var lastSearchedLat, lastSearchedLon;

    // Arrays to hold dynamic and filtered markers
    var dynamicMarkers = [];
    var filteredMarkers = [];

    // Array to store totAvg values
    var totAvgValues = [];

    // Variable to store the average totAvg of all points
    var averageTotAvg = 0;

    // Data cache: Map with key as "lat,lon" and value as fetched data
    const dataCache = new Map();

    // Event listeners
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    checkboxInitial.addEventListener('change', updateDynamicPoints);
    checkboxFiltered.addEventListener('change', toggleFilteredPoints);
    radiusInput.addEventListener('input', function () {
        console.log("Radius input changed.");
        // Update circle radius
        if (circle && lastSearchedLat && lastSearchedLon) {
            map.removeLayer(circle);
            addRadiusCircle(lastSearchedLat, lastSearchedLon);
        }
        // Update dynamic points if initial points checkbox is checked
        if (checkboxInitial.checked) {
            updateDynamicPoints();
        }

        // Re-evaluate filtered markers
        if (checkboxFiltered.checked) {
            removeFilteredMarkers();
            addFilteredMarkers();
        }
    });

    /**
     * Performs search based on user input.
     */
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

    /**
     * Adds a radius circle to the map.
     * @param {number} lat - Latitude of the center.
     * @param {number} lon - Longitude of the center.
     */
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

        // If initial points checkbox is checked, generate dynamic points
        if (checkboxInitial.checked) {
            generateDynamicPoints(lat, lon, radiusKm);
        }
    }

    /**
     * Generates dynamic points within the specified radius.
     * @param {number} lat - Latitude of the center.
     * @param {number} lon - Longitude of the center.
     * @param {number} radiusKm - Radius in kilometers.
     */
    function generateDynamicPoints(lat, lon, radiusKm) {
        var numPoints = radiusKm * 2;
        console.log(`Generating ${numPoints} dynamic points within the circle.`);

        // Remove existing dynamic markers
        dynamicMarkers.forEach(marker => map.removeLayer(marker));
        dynamicMarkers = [];

        // Clear previous totAvg values
        totAvgValues = [];

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

                    // Initiate background data fetching for this point
                    fetchAndCacheData(pointLat, pointLon).then(data => {
                        totAvgValues.push(data.totAvg);
                        computeAverageTotAvg();
                        // If Filtered Points checkbox is checked, evaluate and possibly add green circle
                        if (checkboxFiltered.checked) {
                            evaluateAndAddFilteredMarker(pointLat, pointLon, data.totAvg);
                        }
                    }).catch(error => {
                        console.error(`Error fetching data for point (${pointLat}, ${pointLon}):`, error);
                    });
                }
            }
        }

        console.log(`Placed ${pointsPlaced} points within the circle.`);

        // Attach click handlers to all markers
        attachClickHandlers();
    }

    /**
     * Computes the average totAvg across all points.
     */
    function computeAverageTotAvg() {
        if (totAvgValues.length === 0) {
            averageTotAvg = 0;
            return;
        }
        const sum = totAvgValues.reduce((acc, val) => acc + val, 0);
        averageTotAvg = sum / totAvgValues.length;
        console.log(`Computed average totAvg: ${averageTotAvg.toFixed(2)}`);

        // If Filtered Points checkbox is checked, update filtered markers
        if (checkboxFiltered.checked) {
            removeFilteredMarkers();
            addFilteredMarkers();
        }
    }

    /**
     * Converts meters to degrees.
     * @param {number} meters - Distance in meters.
     * @param {string} type - 'lat' or 'lon'.
     * @param {number} [lat=0] - Latitude for longitude conversion.
     * @returns {number} Degrees.
     */
    function metersToDegrees(meters, type, lat = 0) {
        var degrees;
        if (type === 'lat') {
            degrees = meters / 111320; // Approximation for latitude
        } else if (type === 'lon') {
            degrees = meters / (40075000 * Math.cos(toRadians(lat)) / 360);
        }
        return degrees;
    }

    /**
     * Calculates the distance between two lat/lon points in kilometers.
     * @param {number} lat1 - Latitude of the first point.
     * @param {number} lon1 - Longitude of the first point.
     * @param {number} lat2 - Latitude of the second point.
     * @param {number} lon2 - Longitude of the second point.
     * @returns {number} Distance in kilometers.
     */
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

    /**
     * Converts degrees to radians.
     * @param {number} degrees - Degrees.
     * @returns {number} Radians.
     */
    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Handles the click event on a dynamic point.
     * @param {number} lat - Latitude of the point.
     * @param {number} lon - Longitude of the point.
     */
    function onPointClick(lat, lon) {
        console.log(`Point clicked at lat: ${lat}, lon: ${lon}`);

        const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        if (dataCache.has(cacheKey)) {
            const cachedEntry = dataCache.get(cacheKey);
            if (cachedEntry.status === 'fulfilled') {
                displayDataPopup(lat, lon, cachedEntry.value);
            } else if (cachedEntry.status === 'rejected') {
                displayErrorPopup(lat, lon, cachedEntry.reason);
            } else if (cachedEntry.status === 'pending') {
                // Data is being fetched, show loading and wait
                const loadingPopup = L.popup({ maxWidth: 600 })
                    .setLatLng([lat, lon])
                    .setContent(`<p>Loading data for (${lat.toFixed(5)}, ${lon.toFixed(5)})...</p>`)
                    .openOn(map);

                cachedEntry.promise.then(data => {
                    displayDataPopup(lat, lon, data);
                }).catch(error => {
                    displayErrorPopup(lat, lon, error.message);
                });
            }
        } else {
            console.log("Data not in cache, fetching now.");
            // Show loading popup
            const loadingPopup = L.popup({ maxWidth: 600 })
                .setLatLng([lat, lon])
                .setContent(`<p>Loading data for (${lat.toFixed(5)}, ${lon.toFixed(5)})...</p>`)
                .openOn(map);

            // Fetch data and update the cache
            fetchAndCacheData(lat, lon).then(data => {
                if (data) {
                    displayDataPopup(lat, lon, data);
                } else {
                    displayErrorPopup(lat, lon, 'No data available.');
                }
            }).catch(error => {
                console.error('Error fetching wind/solar data:', error);
                displayErrorPopup(lat, lon, error.message);
            });
        }
    }

    /**
     * Attaches click event handlers to all dynamic markers.
     */
    function attachClickHandlers() {
        dynamicMarkers.forEach(marker => {
            console.log("Attaching click event to marker:", marker.getLatLng());
            marker.on('click', () => {
                const { lat, lng } = marker.getLatLng();
                onPointClick(lat, lng);
            });
        });
    }

    /**
     * Fetches data from the API and caches it.
     * @param {number} lat - Latitude of the point.
     * @param {number} lon - Longitude of the point.
     * @returns {Promise<Object>} The fetched data.
     */
    async function fetchAndCacheData(lat, lon) {
        const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;

        // If already fetching or fetched, return the existing promise or data
        if (dataCache.has(cacheKey)) {
            const existingEntry = dataCache.get(cacheKey);
            if (existingEntry.status === 'pending') {
                return existingEntry.promise;
            } else if (existingEntry.status === 'fulfilled') {
                return existingEntry.value;
            } else {
                throw existingEntry.reason;
            }
        }

        // Create a promise for the fetch operation
        const fetchPromise = fetch(`/api/wind-solar-data?latitude=${lat}&longitude=${lon}`)
            .then(response => {
                console.log("API Response Status:", response.status);
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Received data:", data);
                if (data.error) {
                    throw new Error(data.error);
                }

                // Calculate totAvg
                const wind10m = data.wind_data.avg_10m;
                const wind50m = data.wind_data.avg_50m;
                const ghi = data.solar_data.avg_ghi;
                const dni = data.solar_data.avg_dni;
                const totAvg = (wind10m + wind50m + ghi + dni) / 4;

                // Attach totAvg to the data object
                data.totAvg = totAvg;

                // Cache the fulfilled data with totAvg
                dataCache.set(cacheKey, { status: 'fulfilled', value: data });
                return data;
            })
            .catch(error => {
                console.error('Error fetching wind/solar data:', error);
                // Cache the rejected state
                dataCache.set(cacheKey, { status: 'rejected', reason: error });
                throw error;
            });

        // Cache the pending promise
        dataCache.set(cacheKey, { status: 'pending', promise: fetchPromise });

        return fetchPromise;
    }

    /**
     * Displays the data in a popup.
     * @param {number} lat - Latitude of the point.
     * @param {number} lon - Longitude of the point.
     * @param {Object} data - The data to display.
     */
    function displayDataPopup(lat, lon, data) {
        // Create a popup with a loading message and custom maxWidth
        const dataPopup = L.popup({ maxWidth: 600 }) // Increase maxWidth to fit the table
            .setLatLng([lat, lon])
            .setContent(`<p>Loading data for (${lat.toFixed(5)}, ${lon.toFixed(5)})...</p>`)
            .openOn(map);

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
        dataPopup.setContent(`
        <h4>Data for (${lat.toFixed(5)}, ${lon.toFixed(5)})</h4>
        ${tableHtml}
    `);
    }

    /**
     * Displays an error message in a popup.
     * @param {number} lat - Latitude of the point.
     * @param {number} lon - Longitude of the point.
     * @param {string} errorMsg - The error message to display.
     */
    function displayErrorPopup(lat, lon, errorMsg) {
        // Create a popup with the error message
        const errorPopup = L.popup({ maxWidth: 600 })
            .setLatLng([lat, lon])
            .setContent(`<p>Error fetching data for (${lat.toFixed(5)}, ${lon.toFixed(5)}): ${errorMsg}</p>`)
            .openOn(map);
    }

    /**
     * Toggles the display of filtered points based on the checkbox state.
     */
    function toggleFilteredPoints() {
        console.log("Filtered Points checkbox state changed.");
        if (checkboxFiltered.checked) {
            // Add green circles for points with totAvg > averageTotAvg
            addFilteredMarkers();
        } else {
            // Remove all filtered markers
            removeFilteredMarkers();
        }
    }

    /**
     * Adds green circle overlays for points with totAvg greater than averageTotAvg.
     */
    function addFilteredMarkers() {
        console.log("Adding filtered markers.");
        dynamicMarkers.forEach(marker => {
            const { lat, lng } = marker.getLatLng();
            const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            if (dataCache.has(cacheKey)) {
                const cachedEntry = dataCache.get(cacheKey);
                if (cachedEntry.status === 'fulfilled') {
                    const totAvg = cachedEntry.value.totAvg;
                    if (totAvg > averageTotAvg) {
                        // Add green circle
                        const greenCircle = L.circle([lat, lng], {
                            color: 'green',
                            fillColor: 'green',
                            fillOpacity: 0.3,
                            radius: 20 // Adjust radius as needed
                        }).addTo(map)
                            .bindPopup(`Filtered Point: (${lat.toFixed(5)}, ${lng.toFixed(5)})<br>totAvg: ${totAvg.toFixed(2)}`);
                        filteredMarkers.push(greenCircle);
                        console.log(`Added green circle for point (${lat}, ${lng}) with totAvg ${totAvg}`);
                    }
                }
            }
        });
    }

    /**
     * Removes all green circle overlays for filtered points.
     */
    function removeFilteredMarkers() {
        console.log("Removing filtered markers.");
        filteredMarkers.forEach(marker => map.removeLayer(marker));
        filteredMarkers = [];
    }

    /**
     * Evaluates a single point's totAvg and adds a green circle if it exceeds the average.
     * @param {number} lat - Latitude of the point.
     * @param {number} lon - Longitude of the point.
     * @param {number} totAvg - totAvg of the point.
     */
    function evaluateAndAddFilteredMarker(lat, lon, totAvg) {
        if (totAvg >= averageTotAvg) {
            const greenCircle = L.circle([lat, lon], {
                color: 'green',
                fillColor: 'green',
                fillOpacity: 0.3,
                radius: 20 // Adjust radius as needed
            }).addTo(map)
                .bindPopup(`Filtered Point: (${lat.toFixed(5)}, ${lon.toFixed(5)})<br>totAvg: ${totAvg.toFixed(2)}`);
            filteredMarkers.push(greenCircle);
            console.log(`Added green circle for point (${lat}, ${lon}) with totAvg ${totAvg}`);
        }
    }

    /**
     * Updates dynamic points based on the Initial Points checkbox state.
     */
    function updateDynamicPoints() {
        console.log("Initial Points checkbox state changed.");
        if (checkboxInitial.checked) {
            if (lastSearchedLat && lastSearchedLon && circle) {
                var radiusKm = parseInt(radiusInput.value);
                generateDynamicPoints(lastSearchedLat, lastSearchedLon, radiusKm);
            }
        } else {
            // Remove dynamic markers and filtered markers if Initial Points checkbox is unchecked
            console.log("Removing dynamic markers as Initial Points checkbox is unchecked.");
            dynamicMarkers.forEach(marker => map.removeLayer(marker));
            dynamicMarkers = [];

            // Also remove filtered markers
            removeFilteredMarkers();
        }
    }
});