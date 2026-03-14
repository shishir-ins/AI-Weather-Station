// -----------------------------
// Theme toggle + title
// -----------------------------
document.addEventListener("DOMContentLoaded", function () {

  const toggle = document.getElementById("themeToggle");

  document.title = "CLYMBOT - AI Weather Station";

  if (toggle) {
    toggle.addEventListener("click", function () {

      document.body.classList.toggle("dark");

      if (document.body.classList.contains("dark")) {
        toggle.innerHTML = "🌙";
      } else {
        toggle.innerHTML = "☀️";
      }

    });
  }

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

window.showTab = showTab;


// -----------------------------
// Firebase (BACKEND – unchanged)
// -----------------------------
var firebaseConfig = {
  apiKey: "AIzaSyBrHiF3lIhmeGtgdsIzWKiQHIsmYakfbDs",
  authDomain: "ai-weather-station-cbdc9.firebaseapp.com",
  databaseURL: "https://ai-weather-station-cbdc9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-weather-station-cbdc9",
  storageBucket: "ai-weather-station-cbdc9.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();


// -----------------------------
// SENSOR VALUES
// -----------------------------
db.ref("weather/temperature").on("value", snap => {

  const el = document.getElementById("temp");
  if (el) el.innerText = snap.val() + " °C";

});

db.ref("weather/humidity").on("value", snap => {

  const el = document.getElementById("hum");
  if (el) el.innerText = snap.val() + " %";

});

db.ref("weather/rain").on("value", snap => {

  const el = document.getElementById("rain");
  if (el) el.innerText = snap.val();

});


// -----------------------------
// AI suggestions
// -----------------------------
db.ref("weather").on("value", snap => {

  let data = snap.val();

  let suggestion = "Weather normal";

  if (data.temperature > 35) suggestion = "🔥 High heat. Stay hydrated.";
  if (data.humidity > 75) suggestion = "💧 High humidity detected.";
  if (data.rain == 1) suggestion = "🌧 Rain likely. Carry umbrella.";

  const suggestionEl = document.getElementById("suggestion");
  if (suggestionEl) suggestionEl.innerText = suggestion;

  let status = "Normal";
  let icon = "⛅";
  let bg = "normal";

  if (data.rain == 1) {
    status = "Rainy";
    icon = "🌧";
    bg = "rainy";
  }
  else if (data.humidity > 75) {
    status = "Humid";
    icon = "🌫";
    bg = "humid";
  }
  else if (data.temperature > 32) {
    status = "Hot";
    icon = "☀";
    bg = "sunny";
  }

  const statusElement = document.getElementById("weatherStatus");
  const iconElement = document.getElementById("weatherIcon");

  if (statusElement) statusElement.innerText = status;
  if (iconElement) iconElement.innerText = icon;

  const background = document.getElementById("weatherBackground");

  if (background) {
    background.className = "";
    background.classList.add(bg);
  }

});


// -----------------------------
// Chatbot – ClymBot
// -----------------------------
function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const smallTalkDatabase = [

  {
    keys: ["hello", "hi", "hey"],
    reply: "Hi there! I’m ClymBot, your AI weather assistant. Ask me about rain chances, temperature, or just chat."
  },

  {
    keys: ["how are you", "how r u"],
    reply: "ClymBot is feeling lightly cloudy with a strong chance of helping you. How are you?"
  },

  {
    keys: ["who are you", "what are you"],
    reply: "I’m ClymBot – an AI that reads your weather station sensors and explains the weather in simple language."
  },

  {
    keys: ["thank", "thanks"],
    reply: "You’re welcome! ClymBot is always here if you need another forecast."
  },

  {
    keys: ["help", "what can you do"],
    reply: "ClymBot can answer questions about rain, temperature, humidity, current conditions, and simple predictions based on your sensors."
  }

];


async function buildChatReply(input, data) {

  const lower = normalizeText(input);

  for (const item of smallTalkDatabase) {
    if (item.keys.some(k => lower.includes(k))) return item.reply;
  }

  if (lower.includes("rain") || lower.includes("umbrella")) {

    let rainProb = 10;

    if (data.humidity > 75) rainProb += 40;
    if (data.humidity > 85) rainProb += 15;
    if (data.rain == 1) rainProb = 90;

    let base = `From the sensors, humidity is ${data.humidity}% and rain flag is ${data.rain}. ClymBot estimates about ${rainProb}% chance of rain soon.`;

    if (rainProb >= 70) base += " Taking an umbrella is a very good idea. 🌧";
    else if (rainProb >= 40) base += " It might rain, so a small umbrella is safe.";
    else base += " Rain looks unlikely right now.";

    return base;

  }

  if (lower.includes("temperature") || lower.includes("hot") || lower.includes("cold")) {

    let t = data.temperature;
    let extra = "";

    if (t >= 35) extra = " It’s very hot. Avoid strong sun and drink plenty of water.";
    else if (t >= 30) extra = " It’s warm; light clothing will feel comfortable.";
    else if (t <= 15) extra = " It’s cooler. A jacket is a good idea.";

    return `ClymBot sees ${t}°C with humidity at ${data.humidity}%.` + extra;

  }

  if (lower.includes("humidity")) {
    return `ClymBot reports humidity around ${data.humidity}%. Higher humidity makes air feel heavier.`;
  }

  return `ClymBot currently sees ${data.temperature}°C and ${data.humidity}% humidity from your station.`;

}


// -----------------------------
// Send Message
// -----------------------------
function sendMessage() {

  const inputBox = document.getElementById("userInput");
  const input = inputBox.value.trim();

  if (input === "") return;

  const chatbox = document.getElementById("chatbox");

  chatbox.innerHTML += `<div class="userMessage">${input}</div>`;

  inputBox.value = "";

  db.ref("weather").once("value").then(async snap => {

    const data = snap.val();
    const reply = await buildChatReply(input, data);

    chatbox.innerHTML += `<div class="aiMessage">🤖 ClymBot: ${reply}</div>`;

    chatbox.scrollTop = chatbox.scrollHeight;

  });

}

window.sendMessage = sendMessage;


// -----------------------------
// CHARTS (fixed loading error)
// -----------------------------
document.addEventListener("DOMContentLoaded", function () {

  const tempCanvas = document.getElementById("tempChart");
  const humCanvas = document.getElementById("humChart");

  if (!tempCanvas || !humCanvas) return;

  let tempData = [];
  let humData = [];
  let labels = [];

  const tempChart = new Chart(tempCanvas.getContext("2d"), {

    type: "line",

    data: {
      labels: labels,
      datasets: [{
        label: "Temperature",
        data: tempData,
        borderColor: "#ff4d4d",
        backgroundColor: "rgba(255,77,77,0.2)",
        borderWidth: 3,
        tension: 0.4,
        fill: true
      }]
    }

  });

  const humChart = new Chart(humCanvas.getContext("2d"), {

    type: "line",

    data: {
      labels: labels,
      datasets: [{
        label: "Humidity",
        data: humData,
        borderColor: "#00e5ff",
        backgroundColor: "rgba(0,229,255,0.2)",
        borderWidth: 3,
        tension: 0.4,
        fill: true
      }]
    }

  });


  db.ref("weather").on("value", snap => {

    const data = snap.val();

    const time = new Date().toLocaleTimeString();

    labels.push(time);
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

});
