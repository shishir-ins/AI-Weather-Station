document.addEventListener("DOMContentLoaded", function(){

  const toggle = document.getElementById("themeToggle");

  toggle.addEventListener("click", function(){

    document.body.classList.toggle("dark");

    if(document.body.classList.contains("dark")){
      toggle.innerHTML = "🌙";
    }else{
      toggle.innerHTML = "☀️";
    }

  });

});
// theme toggle



// tabs

function showTab(tab){

  document.querySelectorAll(".tab").forEach(t=>{
    t.classList.add("hidden");
  });

  document.getElementById(tab).classList.remove("hidden");

}

// firebase

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

db.ref("weather/temperature").on("value", snap => {
  document.getElementById("temp").innerText = snap.val() + " °C";
});

db.ref("weather/humidity").on("value", snap => {
  document.getElementById("hum").innerText = snap.val() + " %";
});

db.ref("weather/rain").on("value", snap => {
  const rainVal = Number(snap.val() || 0);
  document.getElementById("rain").innerText = rainVal;
});

// AI suggestions

db.ref("weather").on("value", snap => {

  let data = snap.val() || {};
  const rainValue = Number(data.rain || 0);   // use this everywhere for rain logic

  let suggestion = "Weather normal";

  if (data.temperature > 35)
    suggestion = "🔥 High heat. Stay hydrated.";

  if (data.humidity > 75)
    suggestion = "💧 High humidity detected.";

  // RAIN ONLY IF SENSOR > 20
  if (rainValue > 20)
    suggestion = "🌧 Rain likely. Carry umbrella.";

  // keep old id check in case element exists
  if (document.getElementById("suggestion")) {
    document.getElementById("suggestion").innerText = suggestion;
  }

  let status = "Normal";
  let icon = "⛅";
  let bg = "normal";

  if (rainValue > 20) {
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
  else {
    // WEATHER STATUS LOGIC (fallback)

    let statusInner = "Normal";
    let iconInner = "⛅";

    if (rainValue > 20) {
      statusInner = "Rainy";
      iconInner = "🌧";
    }
    else if (data.humidity > 75) {
      statusInner = "Humid";
      iconInner = "🌫";
    }
    else if (data.temperature > 32) {
      statusInner = "Hot";
      iconInner = "☀";
    }

    const statusElementInner = document.getElementById("weatherStatus");
    const iconElementInner = document.getElementById("weatherIcon");

    if (statusElementInner) statusElementInner.innerText = statusInner;
    if (iconElementInner) iconElementInner.innerText = iconInner;
  }

  const statusElement = document.getElementById("weatherStatus");
  const iconElement = document.getElementById("weatherIcon");

  if (statusElement) statusElement.innerText = status;
  if (iconElement) iconElement.innerText = icon;

  const background = document.getElementById("weatherBackground");

  background.className = "";
  background.classList.add(bg);

  // prefix icons version
  if (rainValue > 20) {
    status = "🌧 Rainy";
  }
  else if (data.humidity > 75) {
    status = "🌫 Humid";
  }
  else if (data.temperature > 32) {
    status = "☀ Hot";
  }
  else {
    status = "⛅ Normal";
  }

  document.getElementById("weatherStatus").innerText = status;
});

// chatbot

const clymbotState = {
  messages: [],
  location: null,
  locationStatus: 'unknown'
};

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderMessage(role, text) {
  const chatbox = document.getElementById("chatbox");
  if (!chatbox) return;
  const cls = role === 'assistant' ? 'aiMessage' : 'userMessage';
  const prefix = role === 'assistant' ? '🤖 ' : '';
  chatbox.insertAdjacentHTML(
    'beforeend',
    `<div class="${cls}">${prefix}${escapeHtml(text).replaceAll('\n', '<br>')}</div>`
  );
  chatbox.scrollTop = chatbox.scrollHeight;
}

async function getLatestSensorSnapshot() {
  const snap = await db.ref("weather").once("value");
  return snap.val() || {};
}

async function ensureLocation() {
  if (clymbotState.location || clymbotState.locationStatus === 'denied') return;
  if (!('geolocation' in navigator)) {
    clymbotState.locationStatus = 'unavailable';
    return;
  }

  clymbotState.locationStatus = 'requesting';
  await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clymbotState.location = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        clymbotState.locationStatus = 'granted';
        resolve();
      },
      () => {
        clymbotState.locationStatus = 'denied';
        resolve();
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 15 * 60 * 1000 }
    );
  });
}

async function sendMessage() {
  const inputBox = document.getElementById("userInput");
  const raw = inputBox?.value ?? '';
  const userText = raw.trim();
  if (!userText) return;

  inputBox.value = "";
  renderMessage('user', userText);

  // Keep lightweight local history for better conversations
  clymbotState.messages.push({ role: 'user', content: userText });
  clymbotState.messages = clymbotState.messages.slice(-20);

  // Best-effort location so "next few hours" predictions are real.
  // If denied, the bot will still chat normally.
  await ensureLocation();

  let sensor = {};
  try {
    sensor = await getLatestSensorSnapshot();
  } catch {
    sensor = {};
  }

  renderMessage('assistant', 'Thinking...');
  const chatbox = document.getElementById("chatbox");
  const thinkingEl = chatbox?.lastElementChild;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userText,
        messages: clymbotState.messages,
        sensor,
        location: clymbotState.location
      })
    });

    const data = await res.json().catch(() => ({}));
    const reply = data?.reply || data?.error || 'Something went wrong.';

    if (thinkingEl) {
      thinkingEl.innerHTML = `🤖 ${escapeHtml(reply).replaceAll('\n', '<br>')}`;
      thinkingEl.className = 'aiMessage';
    } else {
      renderMessage('assistant', reply);
    }

    clymbotState.messages.push({ role: 'assistant', content: reply });
    clymbotState.messages = clymbotState.messages.slice(-20);
  } catch (e) {
    const msg = e?.message || 'Network error.';
    if (thinkingEl) {
      thinkingEl.innerHTML = `🤖 ${escapeHtml(msg)}`;
      thinkingEl.className = 'aiMessage';
    } else {
      renderMessage('assistant', msg);
    }
    clymbotState.messages.push({ role: 'assistant', content: msg });
    clymbotState.messages = clymbotState.messages.slice(-20);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("userInput");
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  // First message
  if (document.getElementById("chatbox")) {
    renderMessage(
      'assistant',
      "Hey — I'm clymbot. Ask anything, or say “predict the next few hours” for a short-term forecast."
    );
    clymbotState.messages.push({
      role: 'assistant',
      content:
        "Hey — I'm clymbot. Ask anything, or say “predict the next few hours” for a short-term forecast."
    });
  }
});
// Graph arrays

let tempData = [];
let humData = [];
let labels = [];

// Create charts

const tempCtx = document.getElementById("tempChart").getContext("2d");

const tempChart = new Chart(tempCtx, {
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
      fill:true
    }]
  },
  options:{
    responsive: true,
    plugins:{legend:{labels:{color:"#000000"}}},
    scales:{
      x:{
        ticks:{color:"#000000"},
        grid:{color:"rgba(0,0,0,0.08)"}
      },
      y:{
        ticks:{color:"#000000"},
        grid:{color:"rgba(0,0,0,0.08)"}
      }
    }
  }
});

const humCtx = document.getElementById("humChart").getContext("2d");

const humChart = new Chart(humCtx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [{
      label: "Humidity",
      data: humData,
      borderColor: "#00e5ff",
      backgroundColor: "rgba(0,229,255,0.2)",
      borderWidth:3,
      tension:0.4,
      fill:true
    }] 
  },
  options:{
    responsive: true,
    plugins:{legend:{labels:{color:"#000000"}}},
    scales:{
      x:{
        ticks:{color:"#000000"},
        grid:{color:"rgba(0,0,0,0.08)"}
      },
      y:{
        ticks:{color:"#000000"},
        grid:{color:"rgba(0,0,0,0.08)"}
      }
    }
  }
});

// Update graphs from Firebase

db.ref("weather").on("value", snap => {

  let data = snap.val() || {};
  const rainValue = Number(data.rain || 0);

  console.log("GRAPH UPDATE:", new Date().toLocaleTimeString(),
              "temp=", data.temperature, "hum=", data.humidity, "rain=", rainValue);

  const sun = document.getElementById("sunGlow");

  if (data.temperature > 32) {
    sun.style.display = "block";
  } else {
    sun.style.display = "none";
  }
  const rainContainer = document.getElementById("rainContainer");

  // clear old rain
  rainContainer.innerHTML = "";

  // RAIN ONLY IF SENSOR > 20
  if (rainValue > 20) {

    for (let i = 0; i < 80; i++) {

      let drop = document.createElement("div");
      drop.classList.add("raindrop");

      drop.style.left = Math.random() * 100 + "vw";
      drop.style.animationDuration = (0.5 + Math.random()) + "s";

      rainContainer.appendChild(drop);

    }

  }

  // store history for ML later

  let timestamp = Date.now();

  db.ref("weather_history/" + timestamp).set({
    temperature: data.temperature,
    humidity: data.humidity,
    rain: rainValue
  });

  // AI prediction logic

  let rainProb = 10;
  let tempTrend = "Stable";
  let humTrend = "Stable";
  let aiSuggestion = "Weather looks normal.";

  if (data.humidity > 75) {
    rainProb += 40;
    humTrend = "Increasing";
  }

  if (data.temperature > 32) {
    tempTrend = "Rising";
  }

  if (rainValue > 20) {
    rainProb = 90;
    aiSuggestion = "🌧 Rain detected. Carry umbrella.";
  }

  if (data.temperature > 35) {
    aiSuggestion = "🔥 Very hot weather. Stay hydrated.";
  }

  if (data.humidity > 80) {
    aiSuggestion = "💧 High humidity. Possible rain soon.";
  }

  document.getElementById("rainProb").innerText = rainProb + "%";
  document.getElementById("tempTrend").innerText = tempTrend;
  document.getElementById("humTrend").innerText = humTrend;
  document.getElementById("aiSuggestion").innerText = aiSuggestion;

  // GRAPH UPDATE DATA

  let time = new Date().toLocaleTimeString();

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

// AI prediction from Firebase

db.ref("ai_prediction/rain_prediction").on("value", snap => {

  let prediction = snap.val();

  let text = "No rain expected";

  if (prediction == 1) {
    text = "🌧 AI predicts rain";
  }

  document.getElementById("aiSuggestion").innerText = text;

});

function createClouds(){

  const bg = document.getElementById("sunnyBackground");
  if(!bg) return;

  for(let i=0;i<7;i++){

    let cloud = document.createElement("div");
    cloud.classList.add("cloud");

    // random cloud size
    let width = 100 + Math.random()*120;
    cloud.style.width = width + "px";
    cloud.style.height = width*0.5 + "px";

    // random vertical position
    cloud.style.top = Math.random()*250 + "px";

    // random starting horizontal position
    cloud.style.left = Math.random()*100 + "vw";

    // random speed
    cloud.style.animationDuration = (30 + Math.random()*40) + "s";

    // random delay so they don't start together
    cloud.style.animationDelay = (-Math.random()*40) + "s";

    bg.appendChild(cloud);

  }

}

createClouds();

function createFog(){

  const fogBg = document.getElementById("fogBackground");

  if(!fogBg) return;

  for(let i=0;i<10;i++){

    let fog = document.createElement("div");
    fog.classList.add("fog");

    fog.style.top = Math.random()*300 + "px";
    fog.style.left = Math.random()*100 + "vw";

    fog.style.animationDuration = (40 + Math.random()*40) + "s";
    fog.style.animationDelay = (-Math.random()*40) + "s";

    fogBg.appendChild(fog);

  }

}

createFog();

function createStorm(){

  const storm = document.getElementById("stormBackground");

  if(!storm) return;

  for(let i=0;i<8;i++){

    let cloud = document.createElement("div");
    cloud.classList.add("stormCloud");

    cloud.style.top = Math.random()*300 + "px";
    cloud.style.left = Math.random()*100 + "vw";

    cloud.style.animationDuration = (25 + Math.random()*30) + "s";
    cloud.style.animationDelay = (-Math.random()*40) + "s";

    storm.appendChild(cloud);

  }

}

createStorm();

function createAnalyticsFog(){

  const fogBg = document.getElementById("analyticsBackground");
  if(!fogBg) return;

  for(let i=0;i<8;i++){

    let fog = document.createElement("div");
    fog.classList.add("analyticsFog");

    fog.style.top = Math.random()*400 + "px";
    fog.style.left = Math.random()*100 + "vw";
    fog.style.animationDuration = (40 + Math.random()*40) + "s";
    fog.style.animationDelay = (-Math.random()*40) + "s";

    fogBg.appendChild(fog);

  }

}

createAnalyticsFog();