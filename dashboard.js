document.addEventListener("DOMContentLoaded", function(){

const toggle = document.getElementById("themeToggle")

toggle.addEventListener("click", function(){

document.body.classList.toggle("dark")

if(document.body.classList.contains("dark")){
toggle.innerHTML = "🌙"
}else{
toggle.innerHTML = "☀️"
}

})

})
// theme toggle



// tabs

function showTab(tab){

document.querySelectorAll(".tab").forEach(t=>{
t.classList.add("hidden")
})

document.getElementById(tab).classList.remove("hidden")

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
}

firebase.initializeApp(firebaseConfig)

var db = firebase.database()

db.ref("weather/temperature").on("value",snap=>{
document.getElementById("temp").innerText = snap.val()+" °C"
})

db.ref("weather/humidity").on("value",snap=>{
document.getElementById("hum").innerText = snap.val()+" %"
})

db.ref("weather/rain").on("value",snap=>{
document.getElementById("rain").innerText = snap.val()
})

// AI suggestions

db.ref("weather").on("value",snap=>{

let data = snap.val()

let suggestion = "Weather normal"

if(data.temperature > 35)
suggestion = "🔥 High heat. Stay hydrated."

if(data.humidity > 75)
suggestion = "💧 High humidity detected."

if(data.rain == 1)
suggestion = "🌧 Rain likely. Carry umbrella."

// keep old id check in case element exists
if (document.getElementById("suggestion")) {
  document.getElementById("suggestion").innerText = suggestion
}

let status = "Normal"
let icon = "⛅"
let bg = "normal"

if(data.rain == 1){
status = "Rainy"
icon = "🌧"
bg = "rainy"
}
else if(data.humidity > 75){
status = "Humid"
icon = "🌫"
bg = "humid"
}
else if(data.temperature > 32){
status = "Hot"
icon = "☀"
bg = "sunny"
}
else{
// WEATHER STATUS LOGIC

let status = "Normal"
let icon = "⛅"

if(data.rain == 1){
status = "Rainy"
icon = "🌧"
}
else if(data.humidity > 75){
status = "Humid"
icon = "🌫"
}
else if(data.temperature > 32){
status = "Hot"
icon = "☀"
}
else{
status = "Normal"
icon = "⛅"
}

// update UI

const statusElement = document.getElementById("weatherStatus")
const iconElement = document.getElementById("weatherIcon")

if(statusElement){
statusElement.innerText = status
}

if(iconElement){
iconElement.innerText = icon
}
}

const statusElement = document.getElementById("weatherStatus")
const iconElement = document.getElementById("weatherIcon")

if(statusElement){
statusElement.innerText = status
}

if(iconElement){
iconElement.innerText = icon
}

const background = document.getElementById("weatherBackground")

background.className = ""
background.classList.add(bg)

if(data.rain == 1){
status = "Rainy"
icon = "🌧"
}
else if(data.humidity > 75){
status = "Humid"
icon = "🌫"
}
else if(data.temperature > 32){
status = "Hot"
icon = "☀"
}
else{
status = "Normal"
icon = "⛅"
}

document.getElementById("weatherStatus").innerText = status
document.getElementById("weatherIcon").innerText = icon

if(data.rain == 1){
status = "🌧 Rainy"
}
else if(data.humidity > 75){
status = "🌫 Humid"
}
else if(data.temperature > 32){
status = "☀ Hot"
}
else{
status = "⛅ Normal"
}

document.getElementById("weatherStatus").innerText = status
})

// chatbot

function sendMessage(){

let inputBox = document.getElementById("userInput")
let input = inputBox.value.trim().toLowerCase()

if(input === "") return

let chatbox = document.getElementById("chatbox")

// show user message

chatbox.innerHTML += `
<div class="userMessage">
${input}
</div>
`

inputBox.value=""

// get weather data
db.ref("weather").once("value").then((snap)=>{

let data = snap.val()

let reply = "I'm analyzing the weather data right now."

// smarter responses

if(input.includes("rain")){
reply = `Based on the current humidity (${data.humidity}%) and sensor readings, there is a strong chance of rain. You might want to carry an umbrella. 🌧`
}

else if(input.includes("temperature")){
reply = `The current temperature is ${data.temperature}°C. If you're heading outside, dress accordingly! 🌡`
}

else if(input.includes("humidity")){
reply = `Humidity is currently around ${data.humidity}%. High humidity can make it feel warmer than it actually is. 💧`
}

else if(input.includes("weather")){
reply = `Right now the weather is about ${data.temperature}°C with humidity at ${data.humidity}%.`
}

else if(input.includes("hello") || input.includes("hi")){
reply = "Hello! I'm clymbot, your weather assistant. Ask me anything about the weather conditions. 🤖"
}

else{
reply = `Right now I'm seeing ${data.temperature}°C temperature and ${data.humidity}% humidity. If you want, ask me about rain predictions or temperature trends.`
}

// show AI message


chatbox.innerHTML += `
<div class="aiMessage">
🤖 ${reply}
</div>
`
chatbox.scrollTop = chatbox.scrollHeight


// auto scroll
chatbox.scrollTop = chatbox.scrollHeight

})

}
// Graph arrays

let tempData = []
let humData = []
let labels = []

// Create charts

const tempCtx = document.getElementById("tempChart").getContext("2d")

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
plugins:{legend:{labels:{color:"#fff"}}},
scales:{
x:{
ticks:{color:"#ffffff"},
grid:{color:"rgba(255,255,255,0.1)"}
},
y:{
ticks:{color:"#ffffff"},
grid:{color:"rgba(255,255,255,0.1)"}
}
}
}
})

const humCtx = document.getElementById("humChart").getContext("2d")

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
}
})

// Update graphs from Firebase

db.ref("weather").on("value", snap => {

let data = snap.val()
const sun = document.getElementById("sunGlow")

if(data.temperature > 32){
sun.style.display = "block"
}else{
sun.style.display = "none"
}
const rainContainer = document.getElementById("rainContainer")

// clear old rain
rainContainer.innerHTML = ""

if(data.rain == 1){

for(let i=0;i<80;i++){

let drop = document.createElement("div")
drop.classList.add("raindrop")

drop.style.left = Math.random()*100 + "vw"
drop.style.animationDuration = (0.5 + Math.random()) + "s"

rainContainer.appendChild(drop)

}

}

// store history for ML later

let timestamp = Date.now()

db.ref("weather_history/" + timestamp).set({
temperature: data.temperature,
humidity: data.humidity,
rain: data.rain
})

// AI prediction logic

let rainProb = 10
let tempTrend = "Stable"
let humTrend = "Stable"
let aiSuggestion = "Weather looks normal."

if(data.humidity > 75){
rainProb += 40
humTrend = "Increasing"
}

if(data.temperature > 32){
tempTrend = "Rising"
}

if(data.rain == 1){
rainProb = 90
aiSuggestion = "🌧 Rain detected. Carry umbrella."
}

if(data.temperature > 35){
aiSuggestion = "🔥 Very hot weather. Stay hydrated."
}

if(data.humidity > 80){
aiSuggestion = "💧 High humidity. Possible rain soon."
}

document.getElementById("rainProb").innerText = rainProb + "%"
document.getElementById("tempTrend").innerText = tempTrend
document.getElementById("humTrend").innerText = humTrend
document.getElementById("aiSuggestion").innerText = aiSuggestion


// GRAPH UPDATE

let time = new Date().toLocaleTimeString()

labels.push(time)
tempData.push(data.temperature)
humData.push(data.humidity)

if(labels.length > 20){
labels.shift()
tempData.shift()
humData.shift()
}

tempChart.update()
humChart.update()

})

// AI prediction from Firebase

db.ref("ai_prediction/rain_prediction").on("value",snap=>{

let prediction = snap.val()

let text = "No rain expected"

if(prediction == 1){
text = "🌧 AI predicts rain"
}

document.getElementById("aiSuggestion").innerText = text

})

function createClouds(){

const bg = document.getElementById("sunnyBackground")
if(!bg) return

for(let i=0;i<7;i++){

let cloud = document.createElement("div")
cloud.classList.add("cloud")

// random cloud size
let width = 100 + Math.random()*120
cloud.style.width = width + "px"
cloud.style.height = width*0.5 + "px"

// random vertical position
cloud.style.top = Math.random()*250 + "px"

// random starting horizontal position
cloud.style.left = Math.random()*100 + "vw"

// random speed
cloud.style.animationDuration = (30 + Math.random()*40) + "s"

// random delay so they don't start together
cloud.style.animationDelay = (-Math.random()*40) + "s"

bg.appendChild(cloud)

}

}

createClouds()

function createFog(){

const fogBg = document.getElementById("fogBackground")

if(!fogBg) return

for(let i=0;i<10;i++){

let fog = document.createElement("div")
fog.classList.add("fog")

fog.style.top = Math.random()*300 + "px"
fog.style.left = Math.random()*100 + "vw"

fog.style.animationDuration = (40 + Math.random()*40) + "s"
fog.style.animationDelay = (-Math.random()*40) + "s"

fogBg.appendChild(fog)

}

}

createFog()
function createStorm(){

const storm = document.getElementById("stormBackground")

if(!storm) return

for(let i=0;i<8;i++){

let cloud = document.createElement("div")
cloud.classList.add("stormCloud")

cloud.style.top = Math.random()*300 + "px"
cloud.style.left = Math.random()*100 + "vw"

cloud.style.animationDuration = (25 + Math.random()*30) + "s"
cloud.style.animationDelay = (-Math.random()*40) + "s"

storm.appendChild(cloud)

}

}

createStorm()
function createAnalyticsFog(){

const fogBg = document.getElementById("analyticsBackground")
if(!fogBg) return

for(let i=0;i<8;i++){

let fog = document.createElement("div")
fog.classList.add("analyticsFog")

fog.style.top = Math.random()*400 + "px"
fog.style.left = Math.random()*100 + "vw"
fog.style.animationDuration = (40 + Math.random()*40) + "s"
fog.style.animationDelay = (-Math.random()*40) + "s"

fogBg.appendChild(fog)

}

}

createAnalyticsFog()