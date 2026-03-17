import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve static files
app.use(express.static(process.cwd()));

const port = Number(process.env.PORT || 5173);

// ✅ Groq setup
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// -----------------------------
// Helpers
// -----------------------------
function isForecastRequest(text) {
  if (!text) return false;
  return /(forecast|next\s*\d+\s*hours?|next\s*few\s*hours?|few\s*hours|later\s*today|tonight|hourly|what.*happen)/i.test(
    text
  );
}

async function getOpenMeteoForecast({ lat, lon }) {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation_probability',
      'precipitation',
      'cloud_cover'
    ].join(',')
  );
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`);
  const json = await res.json();

  const hourly = json?.hourly;
  if (!hourly?.time?.length) return null;

  const now = Date.now();
  const rows = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (!Number.isFinite(t) || t < now - 30 * 60 * 1000) continue;

    rows.push({
      time: hourly.time[i],
      temperatureC: hourly.temperature_2m?.[i],
      humidityPct: hourly.relative_humidity_2m?.[i],
      precipProbPct: hourly.precipitation_probability?.[i],
      precipitationMm: hourly.precipitation?.[i],
      cloudCoverPct: hourly.cloud_cover?.[i]
    });

    if (rows.length >= 6) break;
  }

  return rows.length ? rows : null;
}

function compactSensorContext(sensor) {
  if (!sensor || typeof sensor !== 'object') return null;

  const temperature = Number(sensor.temperature);
  const humidity = Number(sensor.humidity);
  const rain = Number(sensor.rain);

  const out = {};
  if (Number.isFinite(temperature)) out.temperatureC = temperature;
  if (Number.isFinite(humidity)) out.humidityPct = humidity;
  if (Number.isFinite(rain)) out.rainSensor = rain;

  return Object.keys(out).length ? out : null;
}

// -----------------------------
// Routes
// -----------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userText = String(body.userText || '');

    const sensor = compactSensorContext(body.sensor);

    const location =
      body.location && typeof body.location === 'object'
        ? {
            lat: Number(body.location.lat),
            lon: Number(body.location.lon)
          }
        : null;

    if (!userText.trim()) {
      return res.status(400).json({ error: 'Missing userText.' });
    }

    const wantsForecast = isForecastRequest(userText);
    const forecast =
      wantsForecast && location ? await getOpenMeteoForecast(location) : null;

    const system = [
      'You are Clymbot: a friendly AI inside a weather dashboard.',
      'You explain weather and give short-term predictions.',
      'Be concise unless user asks more.',
      'Include confidence when predicting.',
      sensor ? `Sensor data: ${JSON.stringify(sensor)}` : null,
      forecast ? `Forecast: ${JSON.stringify(forecast)}` : null
    ]
      .filter(Boolean)
      .join('\n');

    const history = messages
      .slice(-20)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))
      .filter((m) => m.content.trim());

    const input = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: userText }
    ];

    // ✅ Groq call
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: input,
      temperature: 0.7
    });

    const reply =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "I'm not sure what to say yet.";

    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// -----------------------------
app.listen(port, () => {
  console.log(`🚀 CLYMBOT running on http://localhost:${port}`);
});