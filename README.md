# CLYMBOT (website + clymbot AI)

This repo is a static weather dashboard with a **real LLM-backed chatbot** (`clymbot`) served by a tiny local Node server.

## Run locally

1) Install dependencies

```bash
npm install
```

2) Create `.env`

Copy `.env.example` → `.env` and set:

- **Option A (OpenAI API, paid)**: set `OPENAI_API_KEY`
- **Option B (Free, local)**: install Ollama and set `OLLAMA_MODEL`

3) Start the server

```bash
npm run dev
```

Open `http://localhost:5173`.

## Free mode (local LLM via Ollama)

1) Install Ollama

- Install the Ollama app for Windows, then restart your terminal.

2) Pull a model (once)

```bash
ollama pull llama3.1:8b
```

3) Make sure Ollama is running, then start this repo:

```bash
npm run dev
```

## What clymbot can do

- Normal conversation (LLM)
- “Next few hours” predictions:
  - Uses **your live Firebase sensor snapshot** if available
  - If the browser grants location, it also pulls an hourly forecast from **Open‑Meteo** for the next ~6 hours

