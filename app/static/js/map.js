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

    // Function to generate dynamic points arranged in a grid within the circle
    function generateDynamicPoints(lat, lon, radiusKm) {
        var numPoints = radiusKm * 4;
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

                    dynamicMarkers.push(pointMarker);
                    pointsPlaced++;
                }
            }
        }

        console.log(`Placed ${pointsPlaced} points within the circle.`);
    }

    // Function to update dynamic points based on checkbox state
    function updateDynamicPoints() {
        if (checkbox.checked) {
            if (lastSearchedLat && lastSearchedLon && circle) {
                var radiusKm = parseInt(radiusInput.value);
                generateDynamicPoints(lastSearchedLat, lastSearchedLon, radiusKm);
            }
        } else {
            // Remove dynamic markers if checkbox is unchecked
            dynamicMarkers.forEach(marker => map.removeLayer(marker));
            dynamicMarkers = [];
        }
    }

    // Function to convert meters to degrees
    function metersToDegrees(meters, type, lat = 0) {
        var degrees;
        if (type === 'lat') {
            degrees = meters / 111320; // Approximation for latitude
        } else if (type === 'lon') {
            degrees = meters / (40075000 * Math.cos(toRadians(lat)) / 360);
        }
        return degrees;
    }

    // Function to calculate distance between two lat/lon points in km using Haversine formula
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

    function toDegrees(radians) {
        return radians * 180 / Math.PI;
    }
});

// document.addEventListener('DOMContentLoaded', function () {
//     console.log("map.js is loaded");

//     var map = L.map('map').setView([51.1657, 10.4515], 6);

//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//     }).addTo(map);

//     var marker;
//     var circle;

//     var searchInput = document.getElementById('search-input');
//     var searchButton = document.getElementById('search-button');

//     var radiusInput = document.getElementById('radius-input');

//     var lastSearchedLat, lastSearchedLon;

//     searchButton.addEventListener('click', performSearch);
//     searchInput.addEventListener('keypress', function (e) {
//         if (e.key === 'Enter') {
//             performSearch();
//         }
//     });

//     function performSearch() {
//         var query = searchInput.value.trim();
//         if (query === '') return;

//         // Check if input is in the form of "latitude,longitude"
//         var latLonRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
//         var match = query.match(latLonRegex);

//         if (match) {
//             var lat = parseFloat(match[1]);
//             var lon = parseFloat(match[3]);

//             console.log("Performing search with coordinates:", lat, lon);

//             lastSearchedLat = lat;
//             lastSearchedLon = lon;
//             map.setView([lat, lon], 10);

//             console.log("Map view set to:", lat, lon);

//             if (marker) map.removeLayer(marker);
//             marker = L.marker([lat, lon]).addTo(map)
//                 .bindPopup(`Latitude: ${lat}, Longitude: ${lon}`)
//                 .openPopup();

//             // Add circle with dotted lines
//             addRadiusCircle(lat, lon);
//         } else {
//             // Treat input as a text query
//             query += ', Germany';
//             console.log("Performing search with query:", query);

//             fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
//                 .then(response => response.json())
//                 .then(data => {
//                     console.log("Search results from Nominatim:", data);
//                     if (data.length > 0) {
//                         var lat = parseFloat(data[0].lat);
//                         var lon = parseFloat(data[0].lon);
//                         lastSearchedLat = lat;
//                         lastSearchedLon = lon;
//                         map.setView([lat, lon], 10);

//                         console.log("Map view set to:", lat, lon);

//                         if (marker) map.removeLayer(marker);
//                         marker = L.marker([lat, lon]).addTo(map)
//                             .bindPopup(data[0].display_name)
//                             .openPopup();

//                         // Add circle with dotted lines
//                         addRadiusCircle(lat, lon);
//                     } else {
//                         alert('Location not found in Germany');
//                     }
//                 })
//                 .catch(error => console.error('Error fetching search results:', error));
//         }
//     }

//     function addRadiusCircle(lat, lon) {
//         var radiusKm = parseInt(radiusInput.value) * 100;

//         if (circle) map.removeLayer(circle);

//         circle = L.circle([lat, lon], {
//             color: 'Black',
//             weight: 2,
//             dashArray: '5, 5', // Dotted line style
//             fillOpacity: 0.0,
//             radius: radiusKm
//         }).addTo(map);

//         console.log("Circle added with radius:", radiusKm, "meters");
//     }
// });