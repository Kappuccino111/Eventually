document.addEventListener('DOMContentLoaded', async function () {
    console.log("map.js is loaded");

    // ----------------------------------
    //  1) INITIALIZE THE MAP
    // ----------------------------------
    var map = L.map('map').setView([51.1657, 10.4515], 6);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const markers = L.markerClusterGroup();

    var myStyle = {
        "color": "#ff7800",
        "weight": 5,
        "opacity": 0.65
    };

    var slider1Input = document.getElementById('slider1');
    var slider2Input = document.getElementById('slider2');
    var slider3Input = document.getElementById('slider3');
    var slider4Input = document.getElementById('slider4');


    var slider1Val = 0.25
    var slider2Val = 0.25
    var slider3Val = 0.25
    var slider4Val = 0.25

    function updateSliders() {
        const total = slider1Val + slider2Val + slider3Val + slider4Val;

        // Adjust sliders to make sure the sum is 1
        if (total !== 1) {
            const diff = 1 - total;

            slider1Val += diff * (slider1Val / total);
            slider2Val += diff * (slider2Val / total);
            slider3Val += diff * (slider3Val / total);
            slider4Val += diff * (slider4Val / total);

            slider1Input.value = slider1Val.toFixed(2);
            slider2Input.value = slider2Val.toFixed(2);
            slider3Input.value = slider3Val.toFixed(2);
            slider4Input.value = slider4Val.toFixed(2);
        }
    }

    slider1Input.addEventListener('input', function () {
        slider1Val = parseFloat(slider1Input.value)
        updateSliders()
    })

    slider2Input.addEventListener('input', function () {
        slider2Val = parseFloat(slider2Input.value)
        updateSliders()
    })

    slider3Input.addEventListener('input', function () {
        slider3Val = parseFloat(slider3Input.value)
        updateSliders()
    })

    slider4Input.addEventListener('input', function () {
        slider4Val = parseFloat(slider4Input.value)
        updateSliders()
        console.log("slider4Val", slider4Val);
    })


    let roadHeatmapV3Layer = L.layerGroup([]);

    // b) Get the checkbox and set up a listener
    const roadHeatmapV3Checkbox = document.getElementById('road_heatmap_v3_checkbox');
    roadHeatmapV3Checkbox.addEventListener('change', function () {
        if (this.checked) {
            map.addLayer(roadHeatmapV3Layer);
        } else {
            map.removeLayer(roadHeatmapV3Layer);
        }
    });

    // c) We'll store the “finetuned” road lines data in memory
    let roadHeatmapV3Data = [];
    function fetchCompleteModelResultsV3(lat, lon, radiusKm) {

        const infraVal = parseFloat(slider1Input.value);
        const solarVal = parseFloat(slider2Input.value);
        const neighborhoodVal = parseFloat(slider3Input.value);
        const trafficVal = parseFloat(slider4Input.value);

        // 2) Build a query string
        // example: /api/complete-model-results-v3?latitude=...&longitude=...&radius=...&infra=0.2&solar=0.3&neighbor=0.3&traffic=0.2
        const url = `/api/complete-model-results-v3?latitude=${lat}&longitude=${lon}&radius=${radiusKm}`
            + `&infra=${infraVal}&solar=${solarVal}&neighborhood=${neighborhoodVal}&traffic=${trafficVal}`;

        console.log("Fetching V3 data from", url);


        console.log("Fetching V3 data from", url);
        fetch(url)
            .then(resp => resp.json())
            .then(data => {
                if (data.error) {
                    console.error("V3 error:", data.error);
                    return;
                }
                // data.road_heatmap_v3 is array of { coords: [[lat,lon],[lat2,lon2]], score: 0..1 }
                buildRoadHeatmapV3Layer(data.road_heatmap_v3);
                // If user already had the checkbox checked, show it
                if (roadHeatmapV3Checkbox.checked) {
                    map.addLayer(roadHeatmapV3Layer);
                }
            })
            .catch(err => console.error("V3 fetch error:", err));
    }

    function buildRoadHeatmapV3Layer(roadLines) {
        roadHeatmapV3Layer.clearLayers();
        roadLines.forEach(line => {
            let coords = line.coords;   // [[lat1, lon1], [lat2, lon2]]
            let score = line.score;     // 0..1
            // color from red(high) to blue(low) is: #RRGGBB
            // example: red=score, blue=1-score
            // let's replicate your code: color = f'#{int(255*score):02x}00{int(255*(1-score)):02x}'
            let r = Math.round(255 * score);
            let g = 0;
            let b = Math.round(255 * (1 - score));
            let color = `rgb(${r},${g},${b})`;

            let poly = L.polyline(coords, { color, weight: 3 });
            roadHeatmapV3Layer.addLayer(poly);
        });
    }


    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_cgn/{z}/{x}/{y}.pbf', {
    //     rendererFactory: L.canvas.tile,
    //     vectorTileLayerStyles: {
    //       roads: { color: 'blue', weight: 2 }
    //     }
    //   }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_detmold/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_ddorf/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_cgn/{z}/{x}/{y}.pbf', {
    //     rendererFactory: L.canvas.tile,
    //     vectorTileLayerStyles: {
    //       roads: { color: 'blue', weight: 2 }
    //     }
    //   }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_detmold/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_ddorf/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_cgn/{z}/{x}/{y}.pbf', {
    //     rendererFactory: L.canvas.tile,
    //     vectorTileLayerStyles: {
    //       roads: { color: 'blue', weight: 2 }
    //     }
    //   }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_detmold/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_ddorf/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_cgn/{z}/{x}/{y}.pbf', {
    //     rendererFactory: L.canvas.tile,
    //     vectorTileLayerStyles: {
    //       roads: { color: 'blue', weight: 2 }
    //     }
    //   }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_detmold/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);

    // L.vectorGrid.protobuf('http://localhost:8080/data/primary_roads_ddorf/{z}/{x}/{y}.pbf', {
    // rendererFactory: L.canvas.tile,
    // vectorTileLayerStyles: {
    //     roads: { color: 'blue', weight: 2 }
    // }
    // }).addTo(map);


    L.control.layers(null, {
        "Clustered EV-Markers": markers,
    }).addTo(map);

    let transportLayer = L.layerGroup([]);
    let existingStationsLayer = L.layerGroup([]);
    let lowTransitLayer = L.layerGroup([]);
    let proposedLayer = L.layerGroup([]);
    let roadHeatmapLayer = L.layerGroup([]);

    const transportCheckbox = document.getElementById('transport_checkbox');
    const existingCheckbox = document.getElementById('existing_checkbox');
    const lowTransitCheckbox = document.getElementById('low_transit_checkbox');
    const proposedCheckbox = document.getElementById('proposed_checkbox');
    const roadHeatmapCheckbox = document.getElementById('road_heatmap_checkbox');

    transportCheckbox.addEventListener('change', () => toggleLayer(transportCheckbox, transportLayer));
    existingCheckbox.addEventListener('change', () => toggleLayer(existingCheckbox, existingStationsLayer));
    lowTransitCheckbox.addEventListener('change', () => toggleLayer(lowTransitCheckbox, lowTransitLayer));
    proposedCheckbox.addEventListener('change', () => toggleLayer(proposedCheckbox, proposedLayer));
    roadHeatmapCheckbox.addEventListener('change', () => toggleLayer(roadHeatmapCheckbox, roadHeatmapLayer));

    function toggleLayer(checkbox, layerGroup) {
        if (checkbox.checked) {
            map.addLayer(layerGroup);
        } else {
            map.removeLayer(layerGroup);
        }
    }

    // ----------------------------------
    //  2) DOM ELEMENTS & VARIABLES
    // ----------------------------------
    var marker;          // main marker for search location
    var circle;          // circle for radius
    var dynamicMarkers = [];  // array of dynamic circleMarkers
    var filteredMarkers = []; // array of "filtered" overlays (green circles)
    var totAvgValues = [];    // keep track of totAvg across all dynamic points
    var averageTotAvg = 0;    // the average totAvg across points

    var searchInput = document.getElementById('search-input');
    var searchButton = document.getElementById('search-button');
    var radiusInput = document.getElementById('radius-input');
    var checkboxInitial = document.getElementById('initial_points');  // show/hide dynamic points
    var checkboxFiltered = document.getElementById('filtered_points'); // show/hide “filtered” points
    var hullCheckbox = document.getElementById('hull_points');     // show/hide convex hull

    var lastSearchedLat, lastSearchedLon;

    // Our data cache: Map with key "lat,lon" => { status, value, ...}
    const dataCache = new Map();

    // ----------------------------------
    //  3) HULL-LAYER VARIABLES
    // ----------------------------------
    let blueHullLayer = null;
    let redHullLayer = null;

    // ----------------------------------
    //  4) EVENT LISTENERS
    // ----------------------------------
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    const fetchEVStations = async (south, west, north, east) => {
        const endpoint = "https://overpass-api.de/api/interpreter";

        const query = `
          [out:json][timeout:60];
          node["amenity"="charging_station"](${south},${west},${north},${east});
          out body;
          >;
          out skel qt;
        `;

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ data: query }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();
          console.log(data); // Log the EV charging station data
          return data
        } catch (error) {
          console.error("Error fetching EV stations:", error);
        }
      };


    checkboxInitial.addEventListener('change', updateDynamicPoints);
    checkboxFiltered.addEventListener('change', toggleFilteredPoints);
    hullCheckbox.addEventListener('change', toggleHullPolygons);

    radiusInput.addEventListener('input', async function () {
        console.log("Radius input changed.");

        // If we have a circle, remove it and re-add with new radius
        if (circle && lastSearchedLat && lastSearchedLon) {
            map.removeLayer(circle);
            addRadiusCircle(lastSearchedLat, lastSearchedLon);
        }

        // Re-generate dynamic points if needed
        if (checkboxInitial.checked) {
            updateDynamicPoints();
        }

        // Re-evaluate filtered markers
        if (checkboxFiltered.checked) {
            removeFilteredMarkers();
            addFilteredMarkers();
        }

        // Re-draw hull if needed
        if (hullCheckbox.checked) {
            toggleHullPolygons(); // re-run the hull logic
        }
    });

    // ----------------------------------
    //  5) SEARCH LOGIC
    // ----------------------------------
    async function performSearch() {
        var query = searchInput.value.trim();
        if (query === '') return;

        console.log("Performing search for:", query);

        // Check if input is "lat,lon"
        var latLonRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
        var match = query.match(latLonRegex);

        if (match) {
            // user typed coordinates
            var lat = parseFloat(match[1]);
            var lon = parseFloat(match[3]);
            handleSearchResult(lat, lon, `Latitude: ${lat}, Longitude: ${lon}`);
            let bbox = calculateBoundingBox(lastSearchedLat, lastSearchedLon)
            let stations = await fetchEVStations(bbox.south, bbox.west, bbox.north, bbox.east)

            stations.elements.forEach((s) => {
                const marker = L.marker([s.lat, s.lon]);
                markers.addLayer(marker)
            })
            markers.addTo(map)
        } else {
            // treat as a textual query
            // e.g., append ", Germany" for searching
            query += ', Germany';

            fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
            )
                .then(response => response.json())
                .then(async (data) => {
                    console.log("Search results from Nominatim:", data);
                    if (data.length > 0) {
                        var lat = parseFloat(data[0].lat);
                        var lon = parseFloat(data[0].lon);
                        handleSearchResult(lat, lon, data[0].display_name);

                        let bbox = calculateBoundingBox(lastSearchedLat, lastSearchedLon)
                        let stations = await fetchEVStations(bbox.south, bbox.west, bbox.north, bbox.east)

                        stations.elements.forEach((s) => {
                            const marker = L.marker([s.lat, s.lon]);
                            markers.addLayer(marker)
                        })
                        markers.addTo(map)
                    } else {
                        alert('Location not found in Germany');
                    }
                })
                .catch(error => console.error('Error fetching search results:', error));
        }
    }

    // Helper for setting map center, marker, circle, etc.
    function handleSearchResult(lat, lon, popupMsg) {
        lastSearchedLat = lat;
        lastSearchedLon = lon;
        map.setView([lat, lon], 10);

        // Move the single search marker
        if (marker) map.removeLayer(marker);
        marker = L.marker([lat, lon]).addTo(map).bindPopup(popupMsg).openPopup();

        // Add circle with dotted lines
        addRadiusCircle(lat, lon);

        let radiusKm = parseInt(radiusInput.value) || 20;
        fetchCompleteModelResults(lat, lon, radiusKm);
        // fetchCompleteModelResultsV3(lat, lon, radiusKm);
    }

    // ----------------------------------
    //  6) RADIUS CIRCLE
    // ----------------------------------
    function addRadiusCircle(lat, lon) {
        var radiusKm = parseInt(radiusInput.value) || 0;
        var radiusMeters = radiusKm * 1000;

        if (circle) map.removeLayer(circle);
        circle = L.circle([lat, lon], {
            color: 'Black',
            weight: 2,
            dashArray: '5, 5', // dotted
            fillOpacity: 0.0,
            radius: radiusMeters
        }).addTo(map);

        // If initial points checkbox is checked, generate dynamic points
        if (checkboxInitial.checked) {
            generateDynamicPoints(lat, lon, radiusKm);
        }
    }

    function calculateBoundingBox(lat, lon) {
        radiusKm = radiusInput.value
        const EARTH_RADIUS = 6371; // Earth's radius in km
        const radiusRad = radiusKm / EARTH_RADIUS; // Convert radius to radians

        const latNorth = lat + (radiusRad * (180 / Math.PI)); // Convert radians to degrees
        const latSouth = lat - (radiusRad * (180 / Math.PI));

        const lonEast = lon + (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);
        const lonWest = lon - (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);

        return {
            north: latNorth,
            south: latSouth,
            east: lonEast,
            west: lonWest
        };
    }



    function calculateBoundingBox(lat, lon) {
        radiusKm = radiusInput.value
        const EARTH_RADIUS = 6371; // Earth's radius in km
        const radiusRad = radiusKm / EARTH_RADIUS; // Convert radius to radians

        const latNorth = lat + (radiusRad * (180 / Math.PI)); // Convert radians to degrees
        const latSouth = lat - (radiusRad * (180 / Math.PI));

        const lonEast = lon + (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);
        const lonWest = lon - (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);

        return {
            north: latNorth,
            south: latSouth,
            east: lonEast,
            west: lonWest
        };
    }



    function calculateBoundingBox(lat, lon) {
        radiusKm = radiusInput.value
        const EARTH_RADIUS = 6371; // Earth's radius in km
        const radiusRad = radiusKm / EARTH_RADIUS; // Convert radius to radians

        const latNorth = lat + (radiusRad * (180 / Math.PI)); // Convert radians to degrees
        const latSouth = lat - (radiusRad * (180 / Math.PI));

        const lonEast = lon + (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);
        const lonWest = lon - (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);

        return {
            north: latNorth,
            south: latSouth,
            east: lonEast,
            west: lonWest
        };
    }



    function calculateBoundingBox(lat, lon) {
        radiusKm = radiusInput.value
        const EARTH_RADIUS = 6371; // Earth's radius in km
        const radiusRad = radiusKm / EARTH_RADIUS; // Convert radius to radians

        const latNorth = lat + (radiusRad * (180 / Math.PI)); // Convert radians to degrees
        const latSouth = lat - (radiusRad * (180 / Math.PI));

        const lonEast = lon + (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);
        const lonWest = lon - (radiusRad * (180 / Math.PI)) / Math.cos(lat * Math.PI / 180);

        return {
            north: latNorth,
            south: latSouth,
            east: lonEast,
            west: lonWest
        };
    }



    // ----------------------------------
    //  7) DYNAMIC POINTS & TOTAVG LOGIC
    // ----------------------------------
    function generateDynamicPoints(lat, lon, radiusKm) {
        var numPoints = radiusKm * 2; // e.g., 2 points per km
        console.log(`Generating ${numPoints} dynamic points within the circle.`);

        // Remove any existing dynamic markers
        dynamicMarkers.forEach(m => map.removeLayer(m));
        dynamicMarkers = [];
        totAvgValues = [];

        if (numPoints === 0) return;

        // We'll place points in a rough grid
        var gridSize = Math.ceil(Math.sqrt(numPoints));
        var step = (2 * radiusKm * 1000) / gridSize; // meters per step
        var stepLat = metersToDegrees(step, 'lat');
        var stepLon = metersToDegrees(step, 'lon', lat);

        var halfGrid = Math.floor(gridSize / 2);
        var pointsPlaced = 0;

        for (var i = -halfGrid; i <= halfGrid && pointsPlaced < numPoints; i++) {
            for (var j = -halfGrid; j <= halfGrid && pointsPlaced < numPoints; j++) {
                var offsetLat = i * stepLat;
                var offsetLon = j * stepLon;
                var pointLat = lat + offsetLat;
                var pointLon = lon + offsetLon;

                var distance = getDistanceFromLatLonInKm(lat, lon, pointLat, pointLon);
                if (distance <= radiusKm) {
                    // Add a circleMarker
                    var pointMarker = L.circleMarker([pointLat, pointLon], {
                        radius: 5,
                        color: 'red',
                        fillColor: '#f03',
                        fillOpacity: 0.5
                    })
                        .addTo(map)
                        .bindPopup(
                            `Point ${pointsPlaced + 1}: (${pointLat.toFixed(5)}, ${pointLon.toFixed(5)})`
                        );

                    dynamicMarkers.push(pointMarker);
                    pointsPlaced++;

                    // Fetch data in the background
                    fetchAndCacheData(pointLat, pointLon)
                        .then(data => {
                            totAvgValues.push(data.totAvg);
                            computeAverageTotAvg();
                            // If "filtered points" is checked, possibly add green circle
                            if (checkboxFiltered.checked) {
                                evaluateAndAddFilteredMarker(pointLat, pointLon, data.totAvg);
                            }

                            // If hull is checked, re-draw hull polygons
                            if (hullCheckbox.checked) {
                                toggleHullPolygons();
                            }
                        })
                        .catch(error => {
                            console.error(
                                `Error fetching data for point (${pointLat}, ${pointLon}):`,
                                error
                            );
                        });
                }
            }
        }

        console.log(`Placed ${pointsPlaced} points within the circle.`);
        attachClickHandlers(); // let them show popups when clicked
    }

    function computeAverageTotAvg() {
        if (totAvgValues.length === 0) {
            averageTotAvg = 0;
            return;
        }
        const sum = totAvgValues.reduce((acc, val) => acc + val, 0);
        averageTotAvg = sum / totAvgValues.length;
        console.log(`Computed average totAvg: ${averageTotAvg.toFixed(2)}`);

        // If Filtered Points checkbox is checked, update
        if (checkboxFiltered.checked) {
            removeFilteredMarkers();
            addFilteredMarkers();
        }
    }

    // ----------------------------------
    //  8) DISTANCE/CONVERSION HELPERS
    // ----------------------------------
    function metersToDegrees(meters, type, lat = 0) {
        if (type === 'lat') {
            return meters / 111320; // approximate
        } else if (type === 'lon') {
            // approximate for the given latitude
            return meters / (40075000 * Math.cos(toRadians(lat)) / 360);
        }
        return 0;
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // earth radius in km
        var dLat = toRadians(lat2 - lat1);
        var dLon = toRadians(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toRadians(deg) {
        return (deg * Math.PI) / 180;
    }

    // ----------------------------------
    //  9) MARKER CLICK → DISPLAY POPUP
    // ----------------------------------
    // function onPointClick(lat, lon) {
    //     console.log(`Point clicked at lat: ${lat}, lon: ${lon}`);

    //     const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    //     if (dataCache.has(cacheKey)) {
    //         const cachedEntry = dataCache.get(cacheKey);
    //         if (cachedEntry.status === 'fulfilled') {
    //             displayDataPopup(lat, lon, cachedEntry.value);
    //         } else if (cachedEntry.status === 'rejected') {
    //             displayErrorPopup(lat, lon, cachedEntry.reason);
    //         } else if (cachedEntry.status === 'pending') {
    //             // Data is being fetched, show loading and wait
    //             const loadingPopup = L.popup({ maxWidth: 600 })
    //                 .setLatLng([lat, lon])
    //                 .setContent(`<p>Loading data for (${lat.toFixed(5)}, ${lon.toFixed(5)})...</p>`)
    //                 .openOn(map);

    //     // Fetch data from the API
    //     fetch(`/api/wind-solar-data?latitude=${lat}&longitude=${lon}`)
    //         .then(response => {
    //             console.log("API Response Status:", response.status);
    //             return response.json();
    //         })
    //         .then(data => {
    //             console.log("Received data:", data);

    //             if (data.error) {
    //                 // Update popup with error message
    //                 loadingPopup.setContent(`<p>Error fetching data: ${data.error}</p>`);
    //                 return;
    //             }

    //             // Extract wind and solar data
    //             const windData = data.wind_data.data;
    //             const solarData = data.solar_data.data;

    //             // Averages
    //             const avgWind10m = data.wind_data.avg_10m.toFixed(2);
    //             const avgWind50m = data.wind_data.avg_50m.toFixed(2);
    //             const avgGHI = data.solar_data.avg_ghi.toFixed(2);
    //             const avgDNI = data.solar_data.avg_dni.toFixed(2);

    //             // Generate the table content
    //             let tableHtml = `
    //             <table border="1" style="border-collapse: collapse; width: 100%; text-align: center;">
    //                 <tr>
    //                     <th>Year</th>
    //                     <th>Wind Energy (10m)</th>
    //                     <th>Wind Energy (50m)</th>
    //                     <th>GHI</th>
    //                     <th>DNI</th>
    //                 </tr>
    //         `;

    //             windData.forEach((item, index) => {
    //                 const solar = solarData[index];
    //                 tableHtml += `
    //                 <tr>
    //                     <td>${item.year}</td>
    //                     <td>${item.wind_energy_10m.toFixed(2)} kWh/m²</td>
    //                     <td>${item.wind_energy_50m.toFixed(2)} kWh/m²</td>
    //                     <td>${solar.ghi.toFixed(2)} kWh/m²</td>
    //                     <td>${solar.dni.toFixed(2)} kWh/m²</td>
    //                 </tr>
    //             `;
    //             });

    //             tableHtml += `
    //             <tr style="font-weight: bold;">
    //                 <td>15-Year Avg</td>
    //                 <td>${avgWind10m} kWh/m²</td>
    //                 <td>${avgWind50m} kWh/m²</td>
    //                 <td>${avgGHI} kWh/m²</td>
    //                 <td>${avgDNI} kWh/m²</td>
    //             </tr>
    //         </table>
    //         `;

    //             // Update the popup with the table
    //             loadingPopup.setContent(`
    //             <h4>Data for (${lat.toFixed(5)}, ${lon.toFixed(5)})</h4>
    //             ${tableHtml}
    //         `);
    //         })
    //         .catch(error => {
    //             console.error('Error fetching wind/solar data:', error);
    //             // Update popup with error message
    //             loadingPopup.setContent(`<p>Error fetching data: ${error.message}</p>`);
    //         });
    // }

    function onPointClick(lat, lon) {
        console.log(`Point clicked at lat: ${lat}, lon: ${lon}`);
        const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;

        if (!dataCache.has(cacheKey)) {
            // Not in cache, fetch now
            showLoadingPopup(lat, lon);
            fetchAndCacheData(lat, lon)
                .then(data => displayDataPopup(lat, lon, data))
                .catch(error => displayErrorPopup(lat, lon, error.message));
            return;
        }

        const entry = dataCache.get(cacheKey);
        if (entry.status === 'fulfilled') {
            displayDataPopup(lat, lon, entry.value);
        } else if (entry.status === 'rejected') {
            displayErrorPopup(lat, lon, entry.reason);
        } else if (entry.status === 'pending') {
            showLoadingPopup(lat, lon);
            entry.promise
                .then(data => displayDataPopup(lat, lon, data))
                .catch(error => displayErrorPopup(lat, lon, error.message));
        }
    }

    function showLoadingPopup(lat, lon) {
        L.popup({ maxWidth: 600 })
            .setLatLng([lat, lon])
            .setContent(`<p>Loading data for (${lat.toFixed(5)}, ${lon.toFixed(5)})...</p>`)
            .openOn(map);
    }

    function attachClickHandlers() {
        dynamicMarkers.forEach(marker => {
            marker.on('click', () => {
                const { lat, lng } = marker.getLatLng();
                onPointClick(lat, lng);
            });
        });
    }

    // ----------------------------------
    // 10) FETCH & CACHE WIND-SOLAR DATA
    // ----------------------------------
    async function fetchAndCacheData(lat, lon) {
        const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
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

        // create a promise to fetch
        const fetchPromise = fetch(`/api/wind-solar-data?latitude=${lat}&longitude=${lon}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }

                // Example: compute totAvg
                const wind10m = data.wind_data.avg_10m;
                const wind50m = data.wind_data.avg_50m;
                const ghi = data.solar_data.avg_ghi;
                const dni = data.solar_data.avg_dni;
                const totAvg = (wind10m + wind50m + ghi + dni) / 4;
                data.totAvg = totAvg;

                // EXAMPLE: Suppose your API also returns "normalized" (0 or 1)
                // If not, you can define your own logic to set data.normalized
                data.normalized = totAvg > averageTotAvg ? 1 : 0;

                // Mark this fetch as fulfilled in the cache
                dataCache.set(cacheKey, { status: 'fulfilled', value: data });
                return data;
            })
            .catch(error => {
                dataCache.set(cacheKey, { status: 'rejected', reason: error });
                throw error;
            });

        dataCache.set(cacheKey, { status: 'pending', promise: fetchPromise });
        return fetchPromise;
    }

    // ----------------------------------
    // 11) DISPLAY POPUPS
    // ----------------------------------
    function displayDataPopup(lat, lon, data) {
        const dataPopup = L.popup({ maxWidth: 600 })
            .setLatLng([lat, lon])
            .setContent(`<p>Loading data for (${lat.toFixed(5)}, ${lon.toFixed(5)})...</p>`)
            .openOn(map);

        // Extract arrays
        const windData = data.wind_data.data;
        const solarData = data.solar_data.data;

        // Averages
        const avgWind10m = data.wind_data.avg_10m.toFixed(2);
        const avgWind50m = data.wind_data.avg_50m.toFixed(2);
        const avgGHI = data.solar_data.avg_ghi.toFixed(2);
        const avgDNI = data.solar_data.avg_dni.toFixed(2);

        // Combine them into a small table
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
                <td style="border: 1px solid #ddd; padding: 8px;">${item.wind_energy_10m.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.wind_energy_50m.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${solar.ghi.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${solar.dni.toFixed(2)}</td>
              </tr>
            `;
        });

        // 2-year average + total average
        const totalAvg = (
            parseFloat(avgWind10m) +
            parseFloat(avgWind50m) +
            parseFloat(avgGHI) +
            parseFloat(avgDNI)
        ) / 4;

        tableHtml += `
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">2-Year Avg</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgWind10m}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgWind50m}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgGHI}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgDNI}</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">Total Average</td>
              <td style="border: 1px solid #ddd; padding: 8px;" colspan="4">${totalAvg.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        `;

        dataPopup.setContent(`
          <h4>Data for (${lat.toFixed(5)}, ${lon.toFixed(5)})</h4>
          ${tableHtml}
        `);
    }

    function displayErrorPopup(lat, lon, errorMsg) {
        L.popup({ maxWidth: 600 })
            .setLatLng([lat, lon])
            .setContent(
                `<p>Error fetching data for (${lat.toFixed(5)}, ${lon.toFixed(5)}): ${errorMsg}</p>`
            )
            .openOn(map);
    }

    // ----------------------------------
    // 12) "FILTERED POINTS" LOGIC
    // ----------------------------------
    function toggleFilteredPoints() {
        console.log("Filtered Points checkbox state changed.");
        if (checkboxFiltered.checked) {
            addFilteredMarkers();
        } else {
            removeFilteredMarkers();
        }
    }

    function addFilteredMarkers() {
        dynamicMarkers.forEach(marker => {
            const { lat, lng } = marker.getLatLng();
            const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            if (!dataCache.has(cacheKey)) return;

            const entry = dataCache.get(cacheKey);
            if (entry.status === 'fulfilled') {
                const totAvg = entry.value.totAvg;
                if (totAvg > averageTotAvg) {
                    // a bigger green circle
                    const greenCircle = L.circle([lat, lng], {
                        color: 'green',
                        fillColor: 'green',
                        fillOpacity: 0.3,
                        radius: 200
                    })
                        .addTo(map)
                        .bindPopup(
                            `Filtered Point: (${lat.toFixed(5)}, ${lng.toFixed(5)})<br>totAvg: ${totAvg.toFixed(
                                2
                            )}`
                        );
                    filteredMarkers.push(greenCircle);
                }
            }
        });
    }

    function removeFilteredMarkers() {
        filteredMarkers.forEach(m => map.removeLayer(m));
        filteredMarkers = [];
    }

    function evaluateAndAddFilteredMarker(lat, lon, totAvg) {
        if (totAvg >= averageTotAvg) {
            const greenCircle = L.circle([lat, lon], {
                color: 'green',
                fillColor: 'green',
                fillOpacity: 0.3,
                radius: 20
            })
                .addTo(map)
                .bindPopup(
                    `Filtered Point: (${lat.toFixed(5)}, ${lon.toFixed(5)})<br>totAvg: ${totAvg.toFixed(2)}`
                );
            filteredMarkers.push(greenCircle);
        }
    }

    // ----------------------------------
    // 13) CONVEX HULL LOGIC (BLUE vs. RED)
    // ----------------------------------
    function toggleHullPolygons() {
        if (!hullCheckbox.checked) {
            // remove hull layers if present
            if (blueHullLayer) {
                map.removeLayer(blueHullLayer);
                blueHullLayer = null;
            }
            if (redHullLayer) {
                map.removeLayer(redHullLayer);
                redHullLayer = null;
            }
            return;
        }

        // Gather points for each set
        const bluePoints = [];
        const redPoints = [];

        // We'll classify them by "entry.value.normalized == 0 => blue, 1 => red"
        dynamicMarkers.forEach(marker => {
            const { lat, lng } = marker.getLatLng();
            const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            if (dataCache.has(cacheKey)) {
                const entry = dataCache.get(cacheKey);
                if (entry.status === 'fulfilled') {
                    const val = entry.value.normalized; // Adjust if your data uses a different property
                    if (val === 0) {
                        // Blue group
                        bluePoints.push([lng, lat]); // note [lng, lat] for turf
                    } else if (val === 1) {
                        // Red group
                        redPoints.push([lng, lat]);
                    }
                }
            }
        });

        // Compute hull for each group
        const blueHull = computeHull(bluePoints);
        const redHull = computeHull(redPoints);

        // Remove existing hull layers so we don't stack them up
        if (blueHullLayer) {
            map.removeLayer(blueHullLayer);
            blueHullLayer = null;
        }
        if (redHullLayer) {
            map.removeLayer(redHullLayer);
            redHullLayer = null;
        }

        // Add them to the map
        if (blueHull) {
            blueHullLayer = L.geoJSON(blueHull, {
                style: {
                    color: 'blue',
                    fillColor: 'blue',
                    fillOpacity: 0.2
                }
            }).addTo(map);
        }

        if (redHull) {
            redHullLayer = L.geoJSON(redHull, {
                style: {
                    color: 'red',
                    fillColor: 'red',
                    fillOpacity: 0.2
                }
            }).addTo(map);
        }
    }

    // Helper to do the turf convex
    function computeHull(coordsArray) {
        if (!coordsArray || coordsArray.length < 3) {
            return null; // can't form polygon with < 3 points
        }
        // Convert to a FeatureCollection of points
        const pointsFC = turf.featureCollection(
            coordsArray.map(c => turf.point(c))
        );
        // Let turf compute the convex polygon
        return turf.convex(pointsFC);
    }

    function fetchCompleteModelResults(lat, lon, radiusKm) {
        let url = `/api/complete-model-results?latitude=${lat}&longitude=${lon}&radius=${radiusKm}`;
        fetch(url)
            .then(resp => resp.json())
            .then(data => {
                if (data.error) {
                    console.error("Model error:", data.error);
                    return;
                }
                // data has transport_data, existing_stations, etc.
                buildTransportLayer(data.transport_data);
                buildExistingStationsLayer(data.existing_stations);
                buildLowTransitLayer(data.low_transit_centers);
                buildProposedLayer(data.proposed_locations);
                buildRoadHeatmapLayer(data.road_heatmap);

                // If any checkboxes are checked, ensure those layers appear
                if (transportCheckbox.checked) map.addLayer(transportLayer);
                if (existingCheckbox.checked) map.addLayer(existingStationsLayer);
                if (lowTransitCheckbox.checked) map.addLayer(lowTransitLayer);
                if (proposedCheckbox.checked) map.addLayer(proposedLayer);
                if (roadHeatmapCheckbox.checked) map.addLayer(roadHeatmapLayer);
            })
            .catch(err => console.error("Network or JSON error:", err));
    }

    function buildTransportLayer(transportData) {
        // Clear existing
        transportLayer.clearLayers();

        // transportData = { bus: [[lat, lon], ...], rail: [...], subway: [...], ...}
        // We can add them all to a single layer group, or separate them if you prefer
        let colorMap = {
            "bus": "green",
            "rail": "red",
            "subway": "orange"
        };
        Object.keys(transportData).forEach(mode => {
            let coordsList = transportData[mode]; // e.g. [[lat, lon], ...]
            let color = colorMap[mode] || "gray";
            coordsList.forEach(([lat, lon]) => {
                let marker = L.circleMarker([lat, lon], {
                    radius: 3,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.9
                }).bindPopup(`${mode} stop`);
                transportLayer.addLayer(marker);
            });
        });
    }

    function buildExistingStationsLayer(coordsList) {
        existingStationsLayer.clearLayers();
        coordsList.forEach(([lat, lon]) => {
            let marker = L.circleMarker([lat, lon], {
                radius: 3,
                color: 'blue',
                fillColor: 'blue',
                fillOpacity: 0.3,
                borderOpacity: 0.3,
            }).bindPopup('Existing Station');
            existingStationsLayer.addLayer(marker);
        });
    }

    function buildLowTransitLayer(lowCenters) {
        lowTransitLayer.clearLayers();
        lowCenters.forEach(([lat, lon]) => {
            let marker = L.circleMarker([lat, lon], {
                radius: 5,
                color: 'yellow',
                fillColor: 'yellow',
                fillOpacity: 0.8
            }).bindPopup('Low Transit Area');
            lowTransitLayer.addLayer(marker);
        });
    }

    function buildProposedLayer(proposedLocs) {
        proposedLayer.clearLayers();
        proposedLocs.forEach(([lat, lon]) => {
            let marker = L.circleMarker([lat, lon], {
                radius: 8,
                color: 'black',
                fillColor: 'black',
                fillOpacity: 0.9
            }).bindPopup('Proposed Station');
            proposedLayer.addLayer(marker);
        });
    }

    function buildRoadHeatmapLayer(roadLines) {
        roadHeatmapLayer.clearLayers();
        // roadLines is an array: [{coords: [[lat1, lon1], [lat2, lon2]], score: 0.XX}, ...]
        roadLines.forEach(line => {
            let coords = line.coords;  // e.g. [[lat, lon], [lat, lon]]
            let score = line.score;    // 0 to 1
            let color = scoreToHexColor(score);
            let poly = L.polyline(coords, {
                color: color,
                weight: 3
            });
            roadHeatmapLayer.addLayer(poly);
        });
    }

    function scoreToHexColor(score) {
        // Same logic as in your Folium: #RRGGBB, transitioning from e.g. blue to red
        // or green to red. In your code you had:
        // color = f'#{int(255*(1-score)):02x}00{int(255*score):02x}'
        // Let's replicate that logic in JS
        let r = Math.round(255 * (1 - score));
        let g = 0;
        let b = Math.round(255 * score);
        // Convert to hex
        let rh = r.toString(16).padStart(2, '0');
        let gh = g.toString(16).padStart(2, '0');
        let bh = b.toString(16).padStart(2, '0');
        return `#${rh}${gh}${bh}`;
    }



    // ----------------------------------
    // 14) SHOW / HIDE DYNAMIC POINTS
    // ----------------------------------
    function updateDynamicPoints() {
        console.log("Initial Points checkbox state changed.");
        if (checkboxInitial.checked) {
            if (lastSearchedLat && lastSearchedLon && circle) {
                var radiusKm = parseInt(radiusInput.value) || 0;
                generateDynamicPoints(lastSearchedLat, lastSearchedLon, radiusKm);
            }
        } else {
            // Remove dynamic & filtered markers
            dynamicMarkers.forEach(m => map.removeLayer(m));
            dynamicMarkers = [];
            removeFilteredMarkers();

            // Remove hull polygons
            if (blueHullLayer) {
                map.removeLayer(blueHullLayer);
                blueHullLayer = null;
            }
            if (redHullLayer) {
                map.removeLayer(redHullLayer);
                redHullLayer = null;
            }
        }
    }
});
