// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {

    const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN;  // Replace with your Mapbox token
    const csrfToken = "{{ csrf_token }}";
    let allData = [];
    let slider;  // Declare slider variable outside of fetch
    let sliderIntensity;  // Declare slider variable outside of fetch

    // Initialize the Deck.gl map
    const deckgl = new deck.DeckGL({
        container: 'map-container',
        mapboxApiAccessToken: MAPBOX_ACCESS_TOKEN,
        mapStyle: 'mapbox://styles/mapbox/light-v9',
        // mapStyle: 'mapbox://styles/frasanz/cm22xixvn002501o20b0ehcdw',
        initialViewState: {
            longitude: -0.88,
            latitude: 41.64,
            zoom: 12,
            pitch: 45,
            bearing: 0
        },
        controller: true
    });

    // Function to fetch data from API
    function fetchData() {
        return fetch('/api/measurements/', {
            headers: {
                'Accept': 'application/json',
                'X-CSRFToken': csrfToken
            }
        })
            .then(response => response.json())
            .then(data => {
                console.log(data[3].weather);
                // Convert dateTime to timestamp for easier comparison
                allData = data.map(item => ({
                    ...item,
                    dateTime: new Date(item.dateTime).getTime()
                }));

                if (!slider) {
                    // Initialize slider if it's the first time data is loaded
                    setSliderRange(allData);
                }

                if (!sliderIntensity) {
                    setSliderIntensity(allData);
                }

                // Apply filter based on current slider range
                const [startTimestamp, endTimestamp] = slider.noUiSlider.get().map(v => new Date(v).getTime());
                const filteredData = filterDataByTimestamp(startTimestamp, endTimestamp);
                updateMap(filteredData);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    }

    // Function to filter data by timestamp
    function filterDataByTimestamp(startTimestamp, endTimestamp) {
        return allData.filter(measurement => {
            return measurement.dateTime >= startTimestamp && measurement.dateTime <= endTimestamp;
        });
    }

    // Function to filter data by radiation value
    function filterDataByRadiation(startRadiation, endRadiation) {
        return allData.filter(measurement => {
            return measurement.values.radiation >= startRadiation && measurement.values.radiation <= endRadiation;
        });
    }

    function filterDataByRegion(latMin, latMax, lonMin, lonMax) {
        return allData.filter(measurement => {
            return measurement.latitude >= latMin && measurement.latitude <= latMax &&
                   measurement.longitude >= lonMin && measurement.longitude <= lonMax;
        });
    }
    

    function downloadCSV(data) {
        if (data.length === 0) {
            alert("No data available for the selected region.");
            return;
        }
    
        // Crear encabezados del CSV
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID;Device;User;Latitude;Longitude;Value;Unit;Mean;DateTime;Weather\n";
    
        // Agregar filas con los datos
        data.forEach(measurement => {
            let row = [
                measurement.id,
                measurement.device,
                measurement.user,
                measurement.latitude,
                measurement.longitude,
                JSON.stringify(measurement.values),
                measurement.unit,
                measurement.values.mean,
                new Date(measurement.dateTime).toISOString(),  // Convertir fecha a formato legible
                JSON.stringify(measurement.weather)  // Guardar info meteorológica como JSON en el CSV
            ].join(";");
            csvContent += row + "\n";
        });
    
        // Crear enlace de descarga
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "filtered_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    document.getElementById("downloadCSV").addEventListener("click", function () {
        const latMin = parseFloat(document.getElementById("latMinInput").value);
        const latMax = parseFloat(document.getElementById("latMaxInput").value);
        const lonMin = parseFloat(document.getElementById("lonMinInput").value);
        const lonMax = parseFloat(document.getElementById("lonMaxInput").value);
    
        // Validar que los valores sean correctos
        if (isNaN(latMin) || isNaN(latMax) || isNaN(lonMin) || isNaN(lonMax)) {
            alert("Please enter valid latitude and longitude values.");
            return;
        }
    
        const filteredData = filterDataByRegion(latMin, latMax, lonMin, lonMax);
        downloadCSV(filteredData);
    });

    document.getElementById("updateMap").addEventListener("click", function () {
        const latMin = parseFloat(document.getElementById("latMinInput").value);
        const latMax = parseFloat(document.getElementById("latMaxInput").value);
        const lonMin = parseFloat(document.getElementById("lonMinInput").value);
        const lonMax = parseFloat(document.getElementById("lonMaxInput").value);
    
        // Validar que los valores sean correctos
        if (isNaN(latMin) || isNaN(latMax) || isNaN(lonMin) || isNaN(lonMax)) {
            alert("Please enter valid latitude and longitude values.");
            return;
        }
    
        // Filtrar los datos
        const filteredData = filterDataByRegion(latMin, latMax, lonMin, lonMax);
    
        // Actualizar el mapa con los datos filtrados
        updateMap(filteredData);
    });
    
    
    

    // Function to update the map with data
    // Function to update the map with data and color gradient based on radiation value
    function updateMap(data) {
        const points = data.map(measurement => {
            // Define the radiation value range
            const minRadiation = 0;
            const maxRadiation = 5;  // Radiation over 80 will be fully red

            // Clamp the radiation value to stay within the range
            const radiation = Math.max(minRadiation, Math.min(maxRadiation, measurement.values.radiation));

            // Calculate the interpolation factor (0 means fully green, 1 means fully red)
            const t = (radiation - minRadiation) / (maxRadiation - minRadiation);

            // Interpolate between green and red
            const color = [
                Math.round(t * 155 + 100),  // Red channel (100 to 255)
                Math.round((1 - t) * 155 + 100),  // Green channel (255 to 100)
                100  // Blue channel is constant (100)
            ];

            return {
                
                position: [measurement.longitude, measurement.latitude],
                values: measurement.values,
                dateTime: measurement.dateTime,
                unit: measurement.unit,
                accuracy : measurement.accuracy,
                device : measurement.device,
                id : measurement.id,
                measurement_id : measurement.measurement_id,
                notes : measurement.notes,
                user : measurement.user,
                weather : measurement.weather,
                size: 10,
                color: color  // Use the interpolated color
            };
        });

        const scatterplotLayer = new deck.ScatterplotLayer({
            id: 'scatterplot-layer',
            data: points,
            getPosition: d => d.position,
            getRadius: d => d.size,
            getFillColor: d => d.color,
            radiusMinPixels: 5,
            radiusMaxPixels: 10,
            pickable: true,
            onHover: ({ object, x, y }) => handleHover(object, x, y)
        });

        deckgl.setProps({
            layers: [scatterplotLayer]
        });
    }

    // Initialize the datetime range slider
    const startValueEl = document.getElementById('start-value');
    const endValueEl = document.getElementById('end-value');

    function setSliderRange(data) {
        // Get the minimum and maximum timestamp from the data
        const minTimestamp = Math.min(...data.map(item => item.dateTime));
        // For maxTimestamp, we want 6 hours from the current time
        const maxTimestamp = new Date().getTime() + 6 * 60 * 60 * 1000;
        slider = document.getElementById('slider');  // Initialize slider

        noUiSlider.create(slider, {
            start: [minTimestamp, maxTimestamp],
            connect: true,
            range: {
                min: minTimestamp,
                max: maxTimestamp
            },
            tooltips: false,
            format: {
                to: value => new Date(value), // Display as readable datetime
                from: value => value
            }
        });

        // Update slider labels and filter data
        slider.noUiSlider.on('update', function (values, handle) {
            const startTimestamp = new Date(values[0]).getTime();
            const endTimestamp = new Date(values[1]).getTime();

            // Update labels
            startValueEl.innerHTML = new Date(startTimestamp).toLocaleString();
            endValueEl.innerHTML = new Date(endTimestamp).toLocaleString();

            // Filter data and update the map
            const filteredData = filterDataByTimestamp(startTimestamp, endTimestamp);
            updateMap(filteredData);
        });
    }

    // Initialize the intensity range slider
    const intensityStartValueEl = document.getElementById('intensity-start-value');
    const intensityEndValueEl = document.getElementById('intensity-end-value');

    // function setSliderIntensity(data) {
    //     // Get the minimum and maximum timestamp from the data
    //     const minRadiation = 0;
    //     const maxRadiation = 1000;
    //     sliderIntensity = document.getElementById('slider-intensity');  // Initialize slider
    //     console.log(minRadiation, maxRadiation);
    //     console.log("sliderIntensity", sliderIntensity);
    //     noUiSlider.create(sliderIntensity, {
    //         start: [minRadiation, maxRadiation],
    //         connect: true,
    //         range: {
    //             min: minRadiation,
    //             max: maxRadiation
    //         },
    //         tooltips: false,
    //         format: {
    //             to: value => value, // Display as readable datetime
    //             from: value => value
    //         }
    //     });

    //     // Update slider labels and filter data
    //     sliderIntensity.noUiSlider.on('update', function (values, handle) {
    //         const startRadiation = values[0];
    //         const endRadiation = values[1];

    //         // Update labels
    //         intensityStartValueEl.innerHTML = startRadiation;
    //         intensityEndValueEl.innerHTML = endRadiation;

    //         // Filter data and update the map
    //         const filteredData = filterDataByRadiation(startRadiation, endRadiation);
    //         updateMap(filteredData);
    //     });
    // }
    function setSliderIntensity() {
        const minRadiation = 0;
        const maxRadiation = 100;
    
        const sliderIntensity = document.getElementById('slider-intensity');
        const intensityStartInput = document.getElementById('intensityStartInput');
        const intensityEndInput = document.getElementById('intensityEndInput');
    
        noUiSlider.create(sliderIntensity, {
            start: [minRadiation, maxRadiation],
            connect: true,
            range: { min: minRadiation, max: maxRadiation }
        });
    
        // Actualizar inputs cuando el slider cambia
        sliderIntensity.noUiSlider.on('update', function (values, handle) {
            if (handle === 0) {
                intensityStartInput.value = Math.round(values[0]);
            } else {
                intensityEndInput.value = Math.round(values[1]);
            }
        });
    
        // Función para actualizar el slider y el mapa desde los inputs
        function updateSliderAndMap() {
            const startValue = parseFloat(intensityStartInput.value) || minRadiation;
            const endValue = parseFloat(intensityEndInput.value) || maxRadiation;
            
            // Asegurar que los valores sean válidos
            if (startValue < minRadiation || endValue > maxRadiation || startValue > endValue) {
                return;
            }
    
            // Actualizar el slider
            sliderIntensity.noUiSlider.set([startValue, endValue]);
    
            // Actualizar el mapa
            updateMap(filterDataByRadiation(startValue, endValue));
        }
    
        // Escuchar cambios en los inputs y actualizar el slider y el mapa
        intensityStartInput.addEventListener('change', updateSliderAndMap);
        intensityEndInput.addEventListener('change', updateSliderAndMap);
    
        // Filtro inicial basado en el slider
        sliderIntensity.noUiSlider.on('change', function (values) {
            updateMap(filterDataByRadiation(values[0], values[1]));
        });
    }
    
    // Llamar la función después de cargar el DOM
    document.addEventListener('DOMContentLoaded', function () {
        setSliderIntensity();
    });
    
    

    function handleHover(object, x, y) {
        const popup = document.getElementById('popup');
        const popupContent = document.getElementById('popup-content');
    
        if (object) {
            if (!object.values) {
                object.values = {};
            }
            let radiationColor;

            switch (true) {
                case (object.values.radiation <= 0.05):
                    radiationColor = '#008000'; break;
                case (object.values.radiation <= 0.1):
                    radiationColor = '#00A000'; break;
                case (object.values.radiation <= 0.15):
                    radiationColor = '#909000'; break;
                case (object.values.radiation <= 0.2):
                    radiationColor = '#D0A000'; break;
                case (object.values.radiation <= 0.25):
                    radiationColor = '#FF8000'; break;
                case (object.values.radiation <= 0.3):
                    radiationColor = '#FF0000'; break;
                case (object.values.radiation <= 0.5):
                    radiationColor = '#B00080'; break;
                default:
                    radiationColor = '#603000'; break;
            }

            geographicString = object.position[0] && object.position[1] ?
                `${object.position[0] > 0 ? object.position[0] + ' N, ' : -object.position[0] + ' S, '} ${object.position[1] > 0 ? object.position[1] + ' E' : -object.position[1] + ' W'}` :
                'No geographic data available';
    
            // Inicializamos el contenido del popup
            popupContent.innerHTML = `
                <div align=center>
                    <strong style='font-size: 175%; color: ${radiationColor}' text-align=center>${object.values.placeName}</strong><br/>
                    <text style='font-size: 75%; text-align: center'>${geographicString}</text><br style='display:block; margin: 7px'/>
                    <table style='margin-top: 10px'><tr>
                        <td style='font-size:80%; text-align:right; padding-right:5px;'><strong>Radiación<strong></td>
                        <td style='background-color:${radiationColor}; padding-left:7px; padding-right:7px; border-radius:7px; font-size:150%; color:white'><strong>${object.values.radiation}</strong></td>
                        <td style='padding-left:5px'; padding-left:7px;>${object.unit}</td>
                    </tr></table>
                    <text style='font-size:80%'><strong>Media Rea:</strong> ${object.values.mean || 'N/A'}</text><br/>
                    <text style='font-size:80%'><i>${new Date(object.dateTime).toLocaleString()}</i></text><br style='display:block; margin-bottom: 10px'/>
                </div>
                <button id="show-more-details" style="margin-top: 10px; margin: 0; padding: 5px 0px; border-radius:7px; border-width:0; background:aquamarine; cursor: pointer;">Detalles temperatura</button>
            `;
    
            // Event listener para el botón "Mostrar más detalles"
            document.getElementById('show-more-details').addEventListener('click', function () {
                popupContent.innerHTML = `
                    <div align=center>
                        <strong style='font-size: 125%;'>Valores del tiempo</strong><br/>
                        <strong>Presión:</strong> ${object.weather.presion_mb || 'N/A'}<br/>
                        <strong>Precipitación:</strong> ${object.weather.precip_mm || '0'}<br/>
                        <strong>Temperatura:</strong> ${object.weather.temp_c || 'N/A'}<br/>
                        <strong>Humedad:</strong> ${object.weather.humedad || 'N/A'}<br/>
                        <strong>Vel. viento:</strong> ${object.weather.viento_kph || 'N/A'}<br/> 
                        <strong>Áng. viento:</strong> ${object.weather.viento_grad || 'N/A'}<br/>
                        <button id="hide-details" style="margin-top: 10px; padding: 5px 10px; border-radius:7px; border-width:0; background:aquamarine; cursor: pointer;">Ocultar detalles</button>
                    </div>
                `;
                // Event listener para el botón "Ocultar detalles"
                document.getElementById('hide-details').addEventListener('click', function () {
                    handleHover(object, x, y);
                });
            });
    
            // Posicionar el popup cerca del ratón
            popup.style.left = `${x}px`;
            popup.style.top = `${y}px`;
            popup.style.display = 'block';  // Mostrar el popup
        } else {
            console.log('No object');
            popup.style.display = 'none';  // Ocultar el popup cuando no se pasa el ratón
        }
    }
    
    

    // Fetch data every 10 seconds
    setInterval(fetchData, 10000);

    // Fetch data initially when the page loads
    fetchData();
}); // End of DOMContentLoaded