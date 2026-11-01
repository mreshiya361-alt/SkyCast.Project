# SkyCast — Premium Weather Dashboard

A responsive weather dashboard built with **HTML, CSS and vanilla JavaScript**. It uses the free Open-Meteo APIs, so no API key or backend is required.

## Features

- Search cities worldwide with live suggestions
- Current weather conditions and feels-like temperature
- Hourly forecast for the next 24 hours
- 7-day forecast with daily highs/lows and precipitation chance
- Wind, humidity, pressure, UV index and cloud cover highlights
- Browser geolocation (permission required)
- Celsius / Fahrenheit toggle
- Dark / light appearance toggle
- Favorite cities and recent searches saved in LocalStorage
- Responsive layout for desktop, tablet and mobile
- Loading states, error messages and toast feedback

## Project structure

```text
SkyCast_Weather_App/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Run locally

1. Extract the ZIP file.
2. Open the folder in VS Code.
3. Recommended: install the **Live Server** extension.
4. Right-click `index.html` → **Open with Live Server**.
5. Search for a city, or choose **Use my location** and allow browser location permission.

You can also open `index.html` directly in a modern browser. Live Server is recommended for the best development experience.

## APIs and attribution

- Geocoding and reverse geocoding: https://open-meteo.com/en/docs/geocoding-api
- Forecast data: https://open-meteo.com/en/docs

Open-Meteo provides free non-commercial access without an API key. Review its current terms if you deploy this for commercial use.

## Notes

- Internet access is required because weather data, Google Fonts and Lucide icons are loaded online.
- Geolocation works on `localhost` or a secure HTTPS website in supported browsers.
- Visibility is shown as an em dash because the selected forecast endpoint does not return a visibility field in this implementation.


## New features in this upgrade
- Air Quality Index (US AQI, European AQI, PM2.5 and PM10) using the Open-Meteo Air Quality API.
- Sunrise, sunset and calculated daylight duration.
- Interactive OpenStreetMap map with a marker and current weather popup for the selected city.
- Weather-condition ambience animations for clear, cloudy, rainy, snowy and thunderstorm conditions.
- Compare up to three additional cities with current temperature, condition, humidity and wind.
- Forecast-based weather heads-up messages for thunderstorms, rain probability, strong winds, UV, heat and cold.

### Notes
- Internet access is required for weather data, fonts, icons, Leaflet and map tiles.
- The map uses OpenStreetMap tiles and Leaflet.
- Weather heads-up messages are generated from forecast thresholds. They are not official government or emergency alerts.
- Air quality is model-based informational data and should not replace local public-health guidance.
