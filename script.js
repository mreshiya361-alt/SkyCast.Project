const API = "https://api.open-meteo.com/v1/forecast";
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const $ = (id) => document.getElementById(id);

const state = {
  place: { name: "Rajkot", admin1: "Gujarat", country: "India", latitude: 22.3039, longitude: 70.8022, timezone: "Asia/Kolkata" },
  weather: null,
  unit: localStorage.getItem("skycast-unit") || "celsius",
  favorites: JSON.parse(localStorage.getItem("skycast-favorites") || "[]"),
  recents: JSON.parse(localStorage.getItem("skycast-recents") || "[]"),
  isFavorite: false,
  debounce: null
};

const weatherCodes = {
  0:["Clear sky","sun"],1:["Mainly clear","sun"],2:["Partly cloudy","cloud-sun"],3:["Overcast","cloud"],
  45:["Fog","cloud-fog"],48:["Depositing rime fog","cloud-fog"],51:["Light drizzle","cloud-drizzle"],53:["Drizzle","cloud-drizzle"],55:["Dense drizzle","cloud-drizzle"],
  56:["Freezing drizzle","cloud-snow"],57:["Freezing drizzle","cloud-snow"],61:["Slight rain","cloud-rain"],63:["Rain","cloud-rain"],65:["Heavy rain","cloud-rain"],
  66:["Freezing rain","cloud-snow"],67:["Heavy freezing rain","cloud-snow"],71:["Slight snow","cloud-snow"],73:["Snow","cloud-snow"],75:["Heavy snow","cloud-snow"],77:["Snow grains","cloud-snow"],
  80:["Rain showers","cloud-rain"],81:["Rain showers","cloud-rain"],82:["Violent rain showers","cloud-rain"],85:["Snow showers","cloud-snow"],86:["Heavy snow showers","cloud-snow"],
  95:["Thunderstorm","cloud-lightning"],96:["Thunderstorm with hail","cloud-lightning"],99:["Thunderstorm with hail","cloud-lightning"]
};
const iconFor = code => (weatherCodes[code] || ["Unknown","cloud"])[1];
const labelFor = code => (weatherCodes[code] || ["Variable conditions","cloud"])[0];
const temp = c => Math.round(state.unit === "fahrenheit" ? c * 9/5 + 32 : c);
const degree = () => state.unit === "fahrenheit" ? "°F" : "°C";
const windUnit = () => "km/h";
const formatTime = value => value ? new Date(value).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "--:--";
const formatDay = value => new Date(value + "T12:00:00").toLocaleDateString([], {weekday:"short"});
const safe = value => value == null ? "--" : value;

function showError(message) {
  $("errorBox").textContent = message;
  $("errorBox").classList.remove("hidden");
}
function clearError() { $("errorBox").classList.add("hidden"); }
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2300);
}
function setLoading(on) {
  document.body.classList.toggle("loading", on);
  if (on) {
    $("conditionText").textContent = "Refreshing conditions…";
  }
}
function updateUnitButton() { $("unitLabel").textContent = state.unit === "celsius" ? "°C" : "°F"; }

async function geocode(query) {
  const url = `${GEO_API}?name=${encodeURIComponent(query)}&count=7&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("City search is temporarily unavailable.");
  const data = await response.json();
  return data.results || [];
}
function makePlace(item) {
  return {
    name:item.name, admin1:item.admin1 || "", country:item.country || "",
    latitude:item.latitude, longitude:item.longitude, timezone:item.timezone || "auto"
  };
}
function placeLabel(place) { return [place.name, place.admin1, place.country].filter(Boolean).join(", "); }

async function loadWeather(place, saveRecent = true) {
  clearError(); setLoading(true);
  try {
    const params = new URLSearchParams({
      latitude:place.latitude, longitude:place.longitude, timezone:place.timezone || "auto",
      forecast_days:7,
      current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m",
      hourly:"temperature_2m,precipitation_probability,weather_code",
      daily:"weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max"
    });
    const response = await fetch(`${API}?${params}`);
    if (!response.ok) throw new Error("Could not load weather data. Please try again.");
    const data = await response.json();
    if (!data.current || !data.daily) throw new Error("Weather data is not available for this location.");
    state.place = place; state.weather = data;
    renderWeather();
    await Promise.allSettled([loadAirQuality(place), updateWeatherMap(place), renderWeatherAlerts()]);
    if (saveRecent) addRecent(place);
  } catch (error) {
    showError(error.message || "Something went wrong. Please try another city.");
  } finally { setLoading(false); }
}
function renderWeather() {
  const {place,weather} = state, c = weather.current, d = weather.daily;
  $("cityName").textContent = place.name;
  $("locationMeta").innerHTML = `${escapeHTML([place.admin1,place.country].filter(Boolean).join(", ") || "Local forecast")} <span>•</span> ${escapeHTML(weather.timezone || "Local time")}`;
  $("temperature").textContent = temp(c.temperature_2m);
  $("degree").textContent = degree();
  $("conditionText").textContent = labelFor(c.weather_code);
  $("feelsLike").textContent = `${temp(c.apparent_temperature)}${degree()}`;
  $("windSpeed").textContent = `${Math.round(c.wind_speed_10m)} ${windUnit()}`;
  $("windDirection").textContent = `${direction(c.wind_direction_10m)} direction`;
  $("humidity").textContent = `${c.relative_humidity_2m}%`;
  $("pressure").textContent = `${Math.round(c.pressure_msl)} hPa`;
  $("visibility").textContent = "—";
  $("uvIndex").textContent = safe(d.uv_index_max?.[0]?.toFixed(1));
  $("uvLabel").textContent = uvDescription(d.uv_index_max?.[0]);
  $("cloudCover").textContent = `${c.cloud_cover}%`;
  $("sunrise").textContent = formatTime(d.sunrise?.[0]);
  $("sunset").textContent = formatTime(d.sunset?.[0]);
  $("daylightDuration").textContent = daylightDuration(d.sunrise?.[0], d.sunset?.[0]);
  $("todayDate").textContent = new Date().toLocaleDateString([], {month:"short",day:"numeric"});
  $("updatedAt").textContent = `Updated ${formatTime(c.time)}`;
  const art = $("weatherArt");
  art.className = "weather-art";
  if ([0,1].includes(c.weather_code)) art.classList.add("clear");
  if ([51,53,55,61,63,65,80,81,82].includes(c.weather_code)) art.classList.add("rain");
  setWeatherEffect(c.weather_code);
  $("favoriteBtn").classList.toggle("active", isFavorite(place));
  $("favoriteBtn").setAttribute("aria-label", isFavorite(place) ? "Remove favorite city" : "Save favorite city");
  renderHourly(); renderDaily(); renderRecent(); renderFavorites(); updateUnitButton();
}

function daylightDuration(sunrise, sunset) {
  if (!sunrise || !sunset) return "--";
  const minutes = Math.max(0, Math.round((new Date(sunset) - new Date(sunrise)) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function setWeatherEffect(code) {
  document.body.classList.remove("weather-clear","weather-rain","weather-snow","weather-storm","weather-clouds");
  let effect = "weather-clouds";
  if ([0,1].includes(code)) effect = "weather-clear";
  else if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) effect = "weather-rain";
  else if ([71,73,75,77,85,86].includes(code)) effect = "weather-snow";
  else if ([95,96,99].includes(code)) effect = "weather-storm";
  document.body.classList.add(effect);
}
async function loadAirQuality(place) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude}&longitude=${place.longitude}&current=us_aqi,european_aqi,pm2_5,pm10&timezone=${encodeURIComponent(place.timezone || "auto")}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Air quality unavailable");
  const data = await response.json();
  const a = data.current || {};
  const value = a.us_aqi;
  $("aqiValue").textContent = value == null ? "--" : Math.round(value);
  $("pm25").textContent = a.pm2_5 == null ? "--" : Number(a.pm2_5).toFixed(1);
  $("pm10").textContent = a.pm10 == null ? "--" : Number(a.pm10).toFixed(1);
  $("euAqi").textContent = a.european_aqi == null ? "--" : Math.round(a.european_aqi);
  let status = "Unavailable", advice = "Air quality data could not be retrieved.", color = "#91a0b9";
  if (value != null) {
    if (value <= 50) { status = "Good"; advice = "Air quality is considered satisfactory."; color = "#4cdb9c"; }
    else if (value <= 100) { status = "Moderate"; advice = "Sensitive people may wish to limit prolonged outdoor exertion."; color = "#d6d94d"; }
    else if (value <= 150) { status = "Unhealthy for sensitive groups"; advice = "Sensitive groups should reduce prolonged outdoor exertion."; color = "#f4a340"; }
    else if (value <= 200) { status = "Unhealthy"; advice = "Consider reducing prolonged outdoor activity."; color = "#ef6262"; }
    else if (value <= 300) { status = "Very unhealthy"; advice = "Avoid prolonged outdoor exertion where possible."; color = "#a56de2"; }
    else { status = "Hazardous"; advice = "Avoid outdoor exertion and follow local health guidance."; color = "#9b3548"; }
  }
  $("aqiStatus").textContent = status;
  $("aqiAdvice").textContent = advice;
  $("aqiScore")?.style?.setProperty("--aqi-angle", `${Math.min(360, Math.max(4, (Number(value) || 0) / 500 * 360))}deg`);
  const score = document.querySelector(".aqi-score");
  if (score) score.style.background = `conic-gradient(${color} ${Math.min(360, Math.max(4, (Number(value) || 0) / 500 * 360))}deg, rgba(255,255,255,.08) 0)`;
  $("aqiBar").style.width = `${Math.min(100, (Number(value) || 0) / 500 * 100)}%`;
}
let weatherMap = null;
let weatherMarker = null;
async function updateWeatherMap(place) {
  $("mapLocationLabel").textContent = place.name;
  if (!window.L) {
    $("weatherMap").innerHTML = '<p class="muted" style="padding:18px">Map library could not load. Check your internet connection.</p>';
    return;
  }
  if (!weatherMap) {
    weatherMap = L.map("weatherMap", {scrollWheelZoom:false}).setView([place.latitude, place.longitude], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
    }).addTo(weatherMap);
  }
  weatherMap.setView([place.latitude, place.longitude], 10);
  if (weatherMarker) weatherMap.removeLayer(weatherMarker);
  const current = state.weather?.current;
  const popup = `<div class="map-popup"><strong>${escapeHTML(place.name)}</strong><br>${current ? `${temp(current.temperature_2m)}${degree()} · ${labelFor(current.weather_code)}` : "Selected location"}</div>`;
  weatherMarker = L.marker([place.latitude, place.longitude]).addTo(weatherMap).bindPopup(popup).openPopup();
  setTimeout(() => weatherMap.invalidateSize(), 150);
}
function renderWeatherAlerts() {
  const current = state.weather?.current;
  const daily = state.weather?.daily;
  const alerts = [];
  if (!current || !daily) return;
  const code = current.weather_code;
  const rainChance = daily.precipitation_probability_max?.[0] ?? 0;
  const wind = current.wind_speed_10m ?? 0;
  const uv = daily.uv_index_max?.[0] ?? 0;
  if ([95,96,99].includes(code)) alerts.push({level:"danger",icon:"cloud-lightning",title:"Thunderstorm conditions",message:"Thunderstorm conditions are currently reported. Stay indoors if thunder is nearby."});
  if (rainChance >= 70) alerts.push({level:"warning",icon:"cloud-rain",title:"High chance of rain",message:`Today's forecast shows a ${rainChance}% chance of precipitation. Consider carrying rain protection.`});
  if (wind >= 50) alerts.push({level:"warning",icon:"wind",title:"Strong winds",message:`Current wind speed is ${Math.round(wind)} km/h. Take care around exposed areas.`});
  if (uv >= 8) alerts.push({level:"warning",icon:"sun",title:"Very high UV index",message:`Today's peak UV index is ${uv.toFixed(1)}. Seek shade and use sun protection.`});
  if (current.temperature_2m >= 40) alerts.push({level:"danger",icon:"thermometer-sun",title:"Very high temperature",message:"The current temperature is 40°C or higher. Stay hydrated and avoid excessive heat exposure."});
  if (current.temperature_2m <= 3) alerts.push({level:"warning",icon:"snowflake",title:"Low temperature",message:"It is very cold. Dress warmly and take care outdoors."});
  $("weatherAlerts").innerHTML = alerts.length ? alerts.map(a=>`<div class="alert-item ${a.level}"><i data-lucide="${a.icon}"></i><div><strong>${a.title}</strong><span>${a.message}</span></div></div>`).join("") : '<div class="alert-clear">✓ No notable weather heads-up for the current forecast.</div>';
  refreshIcons();
}
const comparePlaces = [];
async function addComparisonCity() {
  const input = $("compareInput");
  const query = input.value.trim();
  if (!query) { toast("Enter a city to compare"); return; }
  if (comparePlaces.length >= 3) { toast("You can compare up to 3 cities"); return; }
  $("addCompareBtn").disabled = true;
  try {
    const matches = await geocode(query);
    if (!matches.length) { toast("City not found. Try another name."); return; }
    const place = makePlace(matches[0]);
    if (comparePlaces.some(p => p.latitude === place.latitude && p.longitude === place.longitude) ||
        (state.place.latitude === place.latitude && state.place.longitude === place.longitude)) {
      toast("That city is already on the dashboard"); return;
    }
    const url = `${API}?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=${encodeURIComponent(place.timezone)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not load this city's weather");
    const data = await response.json();
    comparePlaces.push({place, current:data.current});
    input.value = "";
    renderComparisons();
  } catch (error) { toast(error.message || "Unable to compare this city"); }
  finally { $("addCompareBtn").disabled = false; }
}
function renderComparisons() {
  const box = $("compareCities");
  if (!comparePlaces.length) { box.innerHTML = '<p class="muted">Add cities to compare their current weather.</p>'; return; }
  box.innerHTML = comparePlaces.map((item,index)=>`<article class="compare-card">
    <button class="compare-remove" data-remove-compare="${index}" aria-label="Remove ${escapeHTML(item.place.name)}">×</button>
    <h4>${escapeHTML(item.place.name)}</h4><div class="compare-country">${escapeHTML([item.place.admin1,item.place.country].filter(Boolean).join(", "))}</div>
    <div class="compare-temp">${temp(item.current.temperature_2m)}${degree()}</div>
    <div class="compare-condition">${labelFor(item.current.weather_code)}</div>
    <div class="compare-stats"><span>💧 ${item.current.relative_humidity_2m}%</span><span>↗ ${Math.round(item.current.wind_speed_10m)} km/h</span></div>
  </article>`).join("");
  box.querySelectorAll("[data-remove-compare]").forEach(button=>button.addEventListener("click",()=>{
    comparePlaces.splice(Number(button.dataset.removeCompare),1); renderComparisons();
  }));
}

function direction(deg) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg/45)%8];
}
function uvDescription(value) {
  if (value == null) return "Today's peak";
  if (value < 3) return "Low exposure";
  if (value < 6) return "Moderate exposure";
  if (value < 8) return "High exposure";
  if (value < 11) return "Very high exposure";
  return "Extreme exposure";
}
function renderHourly() {
  const h = state.weather.hourly, now = new Date(state.weather.current.time);
  let start = h.time.findIndex(t => new Date(t) >= now);
  if (start < 0) start = 0;
  const entries = h.time.slice(start,start+24);
  $("hourlyForecast").innerHTML = entries.map((time,i) => {
    const index = start+i, code = h.weather_code[index], chance = h.precipitation_probability[index] ?? 0;
    const hourLabel = i === 0 ? "Now" : new Date(time).toLocaleTimeString([], {hour:"numeric"});
    return `<div class="hour-item ${i===0?"now":""}"><span class="hour-time">${hourLabel}</span><i class="hour-icon" data-lucide="${iconFor(code)}"></i><strong class="hour-temp">${temp(h.temperature_2m[index])}${degree()}</strong><span class="hour-rain">${chance}% rain</span></div>`;
  }).join("");
  refreshIcons();
}
function renderDaily() {
  const d = state.weather.daily;
  $("dailyForecast").innerHTML = d.time.map((date,i) => `
    <div class="daily-row">
      <span class="daily-day">${i===0?"Today":formatDay(date)}</span>
      <span class="daily-condition"><i data-lucide="${iconFor(d.weather_code[i])}"></i>${labelFor(d.weather_code[i])}</span>
      <span class="daily-rain">☂ ${d.precipitation_probability_max?.[i] ?? 0}%</span>
      <span class="daily-temps">${temp(d.temperature_2m_max[i])}${degree()} <span>${temp(d.temperature_2m_min[i])}${degree()}</span></span>
    </div>`).join("");
  refreshIcons();
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function addRecent(place) {
  state.recents = [place,...state.recents.filter(p => !(p.name===place.name && p.latitude===place.latitude))].slice(0,6);
  localStorage.setItem("skycast-recents",JSON.stringify(state.recents)); renderRecent();
}
function isFavorite(place) { return state.favorites.some(p => p.latitude===place.latitude && p.longitude===place.longitude); }
function renderRecent() {
  $("recentCities").innerHTML = state.recents.length ? state.recents.map((p,i)=>`<button class="city-chip" data-recent="${i}">${escapeHTML(p.name)}</button>`).join("") : '<span class="muted">Your searched cities will appear here.</span>';
  document.querySelectorAll("[data-recent]").forEach(btn=>btn.addEventListener("click",()=>loadWeather(state.recents[Number(btn.dataset.recent)])));
}
function renderFavorites() {
  $("favoriteCities").innerHTML = state.favorites.length ? state.favorites.map((p,i)=>`<button class="city-chip" data-favorite="${i}">${escapeHTML(p.name)} · ×</button>`).join("") : '<span class="muted">Save a city with the heart icon.</span>';
  document.querySelectorAll("[data-favorite]").forEach(btn=>btn.addEventListener("click",()=>loadWeather(state.favorites[Number(btn.dataset.favorite)])));
}
function toggleFavorite() {
  if (isFavorite(state.place)) {
    state.favorites = state.favorites.filter(p=>!(p.latitude===state.place.latitude && p.longitude===state.place.longitude));
    toast("Removed from favorites");
  } else {
    state.favorites.unshift(state.place);
    toast("Added to your favorite places");
  }
  state.favorites = state.favorites.slice(0,8);
  localStorage.setItem("skycast-favorites",JSON.stringify(state.favorites));
  $("favoriteBtn").classList.toggle("active",isFavorite(state.place));
  renderFavorites();
}
async function searchCity(query) {
  const value = query.trim();
  if (!value) { showError("Enter a city name to search."); return; }
  try {
    clearError(); $("searchBtn").disabled = true;
    const results = await geocode(value);
    if (!results.length) { showError(`No places found for “${value}”. Try another city name.`); return; }
    await loadWeather(makePlace(results[0]));
    $("cityInput").value = "";
    $("suggestions").classList.add("hidden");
  } catch(e) { showError(e.message || "Unable to search for that city."); }
  finally { $("searchBtn").disabled = false; }
}
function renderSuggestions(results) {
  const box = $("suggestions");
  if (!results.length) { box.classList.add("hidden"); return; }
  box.innerHTML = results.slice(0,5).map((r,i)=>`<div class="suggestion" data-suggest="${i}"><span>${escapeHTML(r.name)}</span><small>${escapeHTML([r.admin1,r.country].filter(Boolean).join(", "))}</small></div>`).join("");
  box.classList.remove("hidden");
  box.querySelectorAll("[data-suggest]").forEach(btn=>btn.addEventListener("click",()=> {
    const item = results[Number(btn.dataset.suggest)];
    $("cityInput").value = "";
    box.classList.add("hidden");
    loadWeather(makePlace(item));
  }));
}
async function locateMe() {
  clearError();
  if (!navigator.geolocation) { showError("Your browser does not support location access. Search for a city instead."); return; }
  $("locationBtn").disabled = true;
  $("locationBtn").querySelector("span").textContent = "Finding location…";
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const {latitude,longitude} = pos.coords;
      const reverse = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`);
      const result = await reverse.json();
      const item = result.results?.[0];
      await loadWeather(item ? makePlace(item) : {name:"Your location",admin1:"",country:"",latitude,longitude,timezone:"auto"});
    } catch { await loadWeather({name:"Your location",admin1:"",country:"",latitude:pos.coords.latitude,longitude:pos.coords.longitude,timezone:"auto"}); }
    finally { $("locationBtn").disabled=false; $("locationBtn").querySelector("span").textContent="Use my location"; }
  }, err => {
    const messages = {1:"Location permission was denied. Allow access in your browser or search for a city.",2:"Your location could not be determined. Try searching for a city.",3:"Location request timed out. Please try again."};
    showError(messages[err.code] || "Unable to access your location.");
    $("locationBtn").disabled=false; $("locationBtn").querySelector("span").textContent="Use my location";
  }, {enableHighAccuracy:false,timeout:10000,maximumAge:300000});
}
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

$("searchBtn").addEventListener("click",()=>searchCity($("cityInput").value));
$("cityInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchCity(e.target.value);});
$("cityInput").addEventListener("input",e=>{
  $("clearSearch").classList.toggle("show",!!e.target.value);
  clearTimeout(state.debounce);
  const value=e.target.value.trim();
  if(value.length<2){$("suggestions").classList.add("hidden");return;}
  state.debounce=setTimeout(async()=>{try{renderSuggestions(await geocode(value));}catch{}},350);
});
$("clearSearch").addEventListener("click",()=>{$("cityInput").value="";$("clearSearch").classList.remove("show");$("suggestions").classList.add("hidden");$("cityInput").focus();});
$("locationBtn").addEventListener("click",locateMe);
$("favoriteBtn").addEventListener("click",toggleFavorite);
$("addCompareBtn").addEventListener("click",addComparisonCity);
$("compareInput").addEventListener("keydown",e=>{if(e.key==="Enter")addComparisonCity();});
$("unitToggle").addEventListener("click",()=>{
  state.unit=state.unit==="celsius"?"fahrenheit":"celsius";
  localStorage.setItem("skycast-unit",state.unit);
  if(state.weather)renderWeather();else updateUnitButton();
  renderComparisons();
});
$("themeToggle").addEventListener("click",()=>{
  document.body.classList.toggle("light-mode");
  localStorage.setItem("skycast-theme",document.body.classList.contains("light-mode")?"light":"dark");
});
$("clearRecent").addEventListener("click",()=>{
  state.recents=[];localStorage.removeItem("skycast-recents");renderRecent();toast("Recent places cleared");
});
document.addEventListener("click",e=>{if(!e.target.closest(".search-panel"))$("suggestions").classList.add("hidden");});

if(localStorage.getItem("skycast-theme")==="light")document.body.classList.add("light-mode");
$("year").textContent=new Date().getFullYear();
updateUnitButton();renderRecent();renderFavorites();renderComparisons();refreshIcons();
const weatherFx = document.createElement("div"); weatherFx.className = "weather-fx"; weatherFx.setAttribute("aria-hidden","true"); document.body.prepend(weatherFx);
loadWeather(state.place,false);
