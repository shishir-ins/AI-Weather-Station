// -----------------------------
// Theme toggle
// -----------------------------
document.addEventListener("DOMContentLoaded", function () {
  const toggle = document.getElementById("themeToggle");

  toggle.addEventListener("click", function () {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
      // dark mode active
      toggle.innerHTML = "☀️";
    } else {
      toggle.innerHTML = "🌙";
    }
  });
});

// -----------------------------
// Tabs
// -----------------------------
function showTab(tab) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.add("hidden");
  });

  const el = document.getElementById(tab);
  if (el) el.classList.remove("hidden");
}

// make available to inline onclick in HTML
window.showTab = showTab;

// -----------------------------
// Firebase (BACKEND – unchanged)
// -----------------------------
var firebaseConfig = {
  apiKey: "AIzaSyBrHiF3lIhmeGtgdsIzWKiQHIsmYakfbDs",
  authDomain: "ai-weather-station-cbdc9.firebaseapp.com",
  databaseURL:
    "https://ai-weather-station-cbdc9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-weather-station-cbdc9",
  storageBucket: "ai-weather-station-cbdc9.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();

// simple live bindings for main dashboard numbers
db.ref("weather/temperature").on("value", snap => {
  document.getElementById("temp").innerText = snap.val() + " °C";
});

db.ref("weather/humidity").on("value", snap => {
  document.getElementById("hum").innerText = snap.val() + " %";
});

db.ref("weather/rain").on("value", snap => {
  document.getElementById("rain").innerText = snap.val();
});

// -----------------------------
// FREE external weather: Open‑Meteo (no API key)
// -----------------------------
async function fetchOpenMeteoByCoords(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability` +
    `&current_weather=true&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  const current = data.current_weather || {};
  const humiditySeries =
    data.hourly && data.hourly.relative_humidity_2m;
  const precipSeries =
    data.hourly && data.hourly.precipitation_probability;
  const timeArray = data.hourly && data.hourly.time;
  const index =
    timeArray && current.time
      ? timeArray.indexOf(current.time)
      : -1;

  const humidity =
    index >= 0 && humiditySeries ? humiditySeries[index] : null;
  const precipProb =
    index >= 0 && precipSeries ? precipSeries[index] : null;

  return {
    temp:
      typeof current.temperature === "number"
        ? current.temperature
        : null,
    humidity: typeof humidity === "number" ? humidity : null,
    rainProb: typeof precipProb === "number" ? precipProb : null,
    description: `wind ${current.windspeed} km/h`
  };
}

// Hyderabad, India fixed location: 17.3850° N, 78.4867° E
async function getFusedWeather(sensorData) {
  let external = null;

  try {
    // Always use Hyderabad coordinates
    external = await fetchOpenMeteoByCoords(17.3850, 78.4867);
  } catch (e) {
    external = null;
  }

  const humidity = sensorData.humidity;
  let rainProb = 10;

  if (humidity > 75) rainProb += 25;
  if (humidity > 85) rainProb += 15;
  if (sensorData.rain == 1) rainProb = Math.max(rainProb, 85);

  if (external && typeof external.rainProb === "number") {
    rainProb = Math.max(rainProb, external.rainProb);
  }

  rainProb = Math.max(0, Math.min(100, Math.round(rainProb)));

  return { external, rainProb };
}

// -----------------------------
// Graph arrays + Chart.js
// -----------------------------
let tempData = [];
let humData = [];
let labels = [];

const tempCtx = document.getElementById("tempChart").getContext("2d");
const tempChart = new Chart(tempCtx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [
      {
        label: "Temperature",
        data: tempData,
        borderColor: "#ff4d4d",
        backgroundColor: "rgba(255,77,77,0.2)",
        borderWidth: 3,
        tension: 0.4,
        fill: true
      }
    ]
  },
  options: {
    plugins: { legend: { labels: { color: "#fff" } } },
    scales: {
      x: {
        ticks: { color: "#ffffff" },
        grid: { color: "rgba(255,255,255,0.1)" }
      },
      y: {
        ticks: { color: "#ffffff" },
        grid: { color: "rgba(255,255,255,0.1)" }
      }
    }
  }
});

const humCtx = document.getElementById("humChart").getContext("2d");
const humChart = new Chart(humCtx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [
      {
        label: "Humidity",
        data: humData,
        borderColor: "#00e5ff",
        backgroundColor: "rgba(0,229,255,0.2)",
        borderWidth: 3,
        tension: 0.4,
        fill: true
      }
    ]
  }
});

// -----------------------------
// Main realtime weather listener
// (sensors + Hyderabad Open‑Meteo fusion)
// -----------------------------
db.ref("weather").on("value", async snap => {
  const data = snap.val() || {};

  // external + fused rain probability
  const fused = await getFusedWeather(data);
  const external = fused.external;
  const rainProb = fused.rainProb;

  // sun display
  const sun = document.getElementById("sunGlow");
  if (sun) {
    if (data.temperature > 32) {
      sun.style.display = "block";
    } else {
      sun.style.display = "none";
    }
  }

  // rain animation
  const rainContainer = document.getElementById("rainContainer");
  if (rainContainer) {
    rainContainer.innerHTML = "";
    if (rainProb >= 50) {
      const drops = rainProb >= 80 ? 120 : 80;
      for (let i = 0; i < drops; i++) {
        const drop = document.createElement("div");
        drop.classList.add("raindrop");
        drop.style.left = Math.random() * 100 + "vw";
        drop.style.animationDuration = 0.5 + Math.random() + "s";
        rainContainer.appendChild(drop);
      }
    }
  }

  // store history (backend path kept the same)
  const timestamp = Date.now();
  db.ref("weather_history/" + timestamp).set({
    temperature: data.temperature,
    humidity: data.humidity,
    rain: data.rain
  });

  // derive trends + suggestion text
  let tempTrend = "Stable";
  let humTrend = "Stable";

  if (data.temperature > 32) tempTrend = "Rising";
  if (data.temperature > 35) tempTrend = "Strongly Rising";
  if (data.humidity > 60) humTrend = "Increasing";
  if (data.humidity > 80) humTrend = "High";

  const suggestionParts = [];

  if (external) {
    suggestionParts.push(
      `Hyderabad external data: about ${Math.round(
        external.temp
      )}°C with ${external.humidity}% humidity (${external.description}).`
    );
  }

  if (data.temperature > 35) {
    suggestionParts.push(
      "It feels very hot. Stay hydrated and avoid direct sun in the afternoon."
    );
  } else if (data.temperature > 30) {
    suggestionParts.push("It's quite warm; light clothing is recommended.");
  }

  if (data.humidity > 80) {
    suggestionParts.push(
      "Humidity is high, so it may feel heavier than the actual temperature."
    );
  }

  if (rainProb >= 80) {
    suggestionParts.push("Rain is very likely. Carry an umbrella or raincoat. 🌧");
  } else if (rainProb >= 50) {
    suggestionParts.push(
      "There is a fair chance of rain, so a compact umbrella is a good idea."
    );
  } else {
    suggestionParts.push(
      "Rain risk is low for now, but the sky can still change quickly."
    );
  }

  const aiSuggestion = suggestionParts.join(" ");

  // status + icon + background (Apple‑like labels)
  let statusLabel = "Normal";
  let icon = "⛅";
  let bg = "normal";

  if (data.rain == 1 || rainProb >= 70) {
    statusLabel = "Rainy";
    icon = "🌧";
    bg = "rainy";
  } else if (data.humidity > 80) {
    statusLabel = "Very Humid";
    icon = "🌫";
    bg = "humid";
  } else if (data.temperature > 35) {
    statusLabel = "Very Hot";
    icon = "🔥";
    bg = "sunny";
  } else if (data.temperature > 32) {
    statusLabel = "Hot";
    icon = "☀";
    bg = "sunny";
  }

  if (external) {
    statusLabel += " · Hyderabad";
  }

  // update AI section
  document.getElementById("rainProb").innerText = rainProb + "%";
  document.getElementById("tempTrend").innerText = tempTrend;
  document.getElementById("humTrend").innerText = humTrend;
  document.getElementById("aiSuggestion").innerText = aiSuggestion;

  // update main dashboard status
  const statusElement = document.getElementById("weatherStatus");
  const iconElement = document.getElementById("weatherIcon");
  const bgElement = document.getElementById("weatherBackground");

  if (statusElement) statusElement.innerText = statusLabel;
  if (iconElement) iconElement.innerText = icon;
  if (bgElement) {
    bgElement.className = "";
    bgElement.classList.add(bg);
  }

  // update charts
  const timeLabel = new Date().toLocaleTimeString();
  labels.push(timeLabel);
  tempData.push(data.temperature);
  humData.push(data.humidity);

  if (labels.length > 20) {
    labels.shift();
    tempData.shift();
    humData.shift();
  }

  tempChart.update();
  humChart.update();
});

// -----------------------------
// Optional: AI prediction from Firebase (kept)
// -----------------------------
db.ref("ai_prediction/rain_prediction").on("value", snap => {
  const prediction = snap.val();
  if (prediction === null || prediction === undefined) return;

  let text = "No rain expected";
  if (prediction == 1) {
    text = "🌧 AI predicts rain";
  }

  const current = document.getElementById("aiSuggestion").innerText || "";
  document.getElementById("aiSuggestion").innerText =
    current + " " + text;
});

// -----------------------------
// Background elements (clouds / fog / storm) – original logic
// -----------------------------
function createClouds() {
  const bg = document.getElementById("sunnyBackground");
  if (!bg) return;

  for (let i = 0; i < 7; i++) {
    let cloud = document.createElement("div");
    cloud.classList.add("cloud");

    let width = 100 + Math.random() * 120;
    cloud.style.width = width + "px";
    cloud.style.height = width * 0.5 + "px";

    cloud.style.top = Math.random() * 250 + "px";
    cloud.style.left = Math.random() * 100 + "vw";

    cloud.style.animationDuration = 30 + Math.random() * 40 + "s";
    cloud.style.animationDelay = -Math.random() * 40 + "s";

    bg.appendChild(cloud);
  }
}
createClouds();

function createFog() {
  const fogBg = document.getElementById("fogBackground");
  if (!fogBg) return;

  for (let i = 0; i < 10; i++) {
    let fog = document.createElement("div");
    fog.classList.add("fog");

    fog.style.top = Math.random() * 300 + "px";
    fog.style.left = Math.random() * 100 + "vw";

    fog.style.animationDuration = 40 + Math.random() * 40 + "s";
    fog.style.animationDelay = -Math.random() * 40 + "s";

    fogBg.appendChild(fog);
  }
}
createFog();

function createStorm() {
  const storm = document.getElementById("stormBackground");
  if (!storm) return;

  for (let i = 0; i < 8; i++) {
    let cloud = document.createElement("div");
    cloud.classList.add("stormCloud");

    cloud.style.top = Math.random() * 300 + "px";
    cloud.style.left = Math.random() * 100 + "vw";

    cloud.style.animationDuration = 25 + Math.random() * 30 + "s";
    cloud.style.animationDelay = -Math.random() * 40 + "s";

    storm.appendChild(cloud);
  }
}
createStorm();

function createAnalyticsFog() {
  const fogBg = document.getElementById("analyticsBackground");
  if (!fogBg) return;

  for (let i = 0; i < 8; i++) {
    let fog = document.createElement("div");
    fog.classList.add("analyticsFog");

    fog.style.top = Math.random() * 400 + "px";
    fog.style.left = Math.random() * 100 + "vw";
    fog.style.animationDuration = 40 + Math.random() * 40 + "s";
    fog.style.animationDelay = -Math.random() * 40 + "s";

    fogBg.appendChild(fog);
  }
}
createAnalyticsFog();

// -----------------------------
// Chatbot – more human + weather‑aware for Hyderabad
// -----------------------------
function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const smallTalkDatabase = [
  {
    keys: ["hello", "hi", "hey"],
    reply:
      "Hi there! I'm your AI Weather Assistant for Hyderabad. Ask me about rain chances, temperature, or just chat."
  },
  {
    keys: ["how are you", "how r u"],
    reply:
      "I'm feeling partly cloudy with a strong chance of helping you. How are you?"
  },
  {
    keys: ["who are you", "what are you"],
    reply:
      "I'm a small AI that watches your sensors and live Hyderabad weather data to keep you prepared."
  },
  {
    keys: ["thank", "thanks"],
    reply: "You're welcome. If you need another forecast, I'm right here."
  },
  {
    keys: ["help", "what can you do"],
    reply:
      "You can ask about rain, temperature, humidity, current conditions in Hyderabad, or general forecasts."
  }
];

async function buildChatReply(input, sensorData) {
  const lower = normalizeText(input);

  // small talk first
  for (const item of smallTalkDatabase) {
    if (item.keys.some(k => lower.includes(k))) {
      return item.reply;
    }
  }

  // use fused helper for local conditions
  const fused = await getFusedWeather(sensorData);
  const external = fused.external;
  const rainProb = fused.rainProb;

  if (lower.includes("rain") || lower.includes("umbrella")) {
    let base = `For Hyderabad, based on humidity (${sensorData.humidity}%) and live data, I estimate about ${rainProb}% chance of rain soon.`;
    if (rainProb >= 70) {
      base += " I strongly recommend carrying an umbrella or raincoat. 🌧";
    } else if (rainProb >= 40) {
      base += " It may or may not rain, so a small umbrella is a safe idea.";
    } else {
      base += " Rain looks unlikely right now.";
    }
    return base;
  }

  if (lower.includes("temperature") || lower.includes("hot") || lower.includes("cold")) {
    let extra = "";
    const t = sensorData.temperature;
    if (t >= 35) {
      extra =
        " It's very hot. Avoid direct sunlight for long periods and drink plenty of water.";
    } else if (t >= 30) {
      extra = " It's warm; light clothing will be comfortable.";
    } else if (t <= 15) {
      extra = " It's on the cooler side. A light jacket is a good idea.";
    }
    return `Right now in Hyderabad the local station reads ${t}°C with humidity at ${sensorData.humidity}%.` + extra;
  }

  if (lower.includes("humidity") || lower.includes("moisture")) {
    return `Humidity in Hyderabad is around ${sensorData.humidity}%. Higher humidity makes the air feel heavier and can make heat feel more intense.`;
  }

  if (lower.includes("forecast") || lower.includes("weather") || lower.includes("conditions")) {
    if (external) {
      return `In Hyderabad it's about ${sensorData.temperature}°C from your station with ${sensorData.humidity}% humidity. External data says around ${Math.round(
        external.temp
      )}°C with ${external.humidity}% humidity.`;
    }
    return `Your station in Hyderabad reports ${sensorData.temperature}°C and ${sensorData.humidity}% humidity with rain sensor reading ${sensorData.rain}.`;
  }

  // generic fallback
  return `I see about ${sensorData.temperature}°C and ${sensorData.humidity}% humidity from your Hyderabad station. You can ask me about rain chances, temperature, humidity, or general conditions.`;
}

async function sendMessage() {
  const inputBox = document.getElementById("userInput");
  const rawInput = inputBox.value;
  const input = rawInput.trim();

  if (input === "") return;

  const chatbox = document.getElementById("chatbox");

  // user bubble
  chatbox.innerHTML += `
<div class="userMessage">
${input}
</div>
`;
  inputBox.value = "";

  // pull the latest sensor values from Firebase
  db.ref("weather")
    .once("value")
    .then(async snap => {
      const data = snap.val() || {};
      const reply = await buildChatReply(input, data);

      chatbox.innerHTML += `
<div class="aiMessage">
🤖 ${reply}
</div>
`;
      chatbox.scrollTop = chatbox.scrollHeight;
    });
}

// expose sendMessage for HTML onclick
window.sendMessage = sendMessage;