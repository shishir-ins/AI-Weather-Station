import 'dotenv/config';
import express from 'express';

import { OpenAI } from 'openai';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve the static site from repo root
app.use(express.static(process.cwd()));

const port = Number(process.env.PORT || 5173);

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

function isForecastRequest(text) {
  if (!text) return false;
  return /(forecast|next\s*\d+\s*hours?|next\s*few\s*hours?|few\s*hours|later\s*today|tonight|hourly|what.*happen)/i.test(
    text
  );
}

async function chatWithOllama({ system, messages }) {
  const url = new URL('/api/chat', ollamaBaseUrl);

  const payload = {
    model: ollamaModel,
    stream: false,
    messages: [
      { role: 'system', content: system },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Ollama error ${res.status}. Is Ollama running and is the model pulled? ${text}`.trim()
    );
  }

  const json = await res.json();
  const reply = json?.message?.content?.trim?.() || '';
  return reply;
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
  url.searchParams.set('hourly', [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation_probability',
    'precipitation',
    'cloud_cover'
  ].join(','));
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
    if (rows.length >= 6) break; // next ~6 hours
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

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    provider: openai ? 'openai' : 'ollama',
    llmConfigured: Boolean(openaiApiKey) || Boolean(ollamaBaseUrl),
    model: openai ? openaiModel : ollamaModel
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
      res.status(400).json({ error: 'Missing userText.' });
      return;
    }

    const wantsForecast = isForecastRequest(userText);
    const forecast =
      wantsForecast && location ? await getOpenMeteoForecast(location) : null;

    const system = [
      'You are Clymbot: a friendly, highly capable AI assistant inside a weather dashboard.',
      'You can chat normally about anything, but you are especially good at explaining weather and making short-term, next-hours predictions.',
      'Be concise by default, but if the user asks for more detail, expand.',
      'If you provide a prediction, include a brief confidence note and what data you used.',
      'Never claim you can see real-world data unless it is provided in context.',
      sensor ? `Live sensor snapshot: ${JSON.stringify(sensor)}.` : null,
      forecast ? `Next hours forecast (Open-Meteo): ${JSON.stringify(forecast)}.` : null
    ]
      .filter(Boolean)
      .join('\n');

    // Keep only the last ~20 turns to control context size
    const history = messages
      .filter((m) => m && typeof m === 'object')
      .slice(-20)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))
      .filter((m) => m.content.trim());

    const input = [
      ...history,
      { role: 'user', content: userText }
    ];

    let reply = '';
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: openaiModel,
        messages: [{ role: 'system', content: system }, ...input],
        temperature: 0.7
      });
      reply = completion?.choices?.[0]?.message?.content?.trim?.() || '';
    } else {
      reply = await chatWithOllama({ system, messages: input });
    }

    res.json({ reply: reply || "I'm not sure what to say yet—try again." });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`CLYMBOT dev server running on http://localhost:${port}`);
});

