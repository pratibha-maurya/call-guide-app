# Call Guide backend

Express API for the cold-call guide. Data in Supabase; call record and mid-call
suggestions from an OpenAI-compatible LLM (Groq by default). The contract is `../shared/API.md`.

Files: `server.js` (routes), `db.js` (Supabase queries), `llm.js` (summary + suggest,
with fallbacks), `stats.js` (counts for `/stats`), `validate.js` (request checks),
`stages.js` (loads `stages.json`).

## Env vars

| Var | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | if missing, the server still boots: `/health` says `db: false`, data routes return 503 |
| `SUPABASE_SERVICE_KEY` | yes | service-role key, server only |
| `LLM_API_KEY` | no | turns the LLM on. Free key: console.groq.com -> API Keys. Without it `/summary` returns the tap-based fallback and `/suggest` the static stage purpose |
| `LLM_BASE_URL` | no | default `https://api.groq.com/openai/v1`; any OpenAI-compatible API |
| `LLM_MODEL` | no | default `openai/gpt-oss-20b`; shown in `/health` as `llm_model` |
| `CORS_ORIGINS` | yes in prod | comma-separated exact origins; add the literal `*.vercel.app` to allow preview URLs |
| `NODE_ENV` | no | anything but `production` also allows `http://localhost:5173` |
| `API_KEY` | no | if set, all routes except `/health` and `/stages` need header `x-api-key` |
| `PORT` | no | Render sets it; default 3000 |

## Run locally

```sh
cp .env.example .env    # fill it in
npm install
node --env-file=.env server.js   # or: npm run dev (export the vars first)
npm test                # in-memory fake db, no network
```

`stages.json` is a committed copy of `../shared/stages.json`. After editing the shared
file, run `npm run sync-stages` and commit the copy (Render only sees `backend/`).

## Deploy to Render

New Web Service from the repo:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`
- Env: the vars above, with `NODE_ENV=production`

Logs are one JSON line per request (method, path, status, ms). Request bodies,
query strings and env values are never logged.

Free tier sleeps when idle; the first request after a nap takes ~30-50s.
Run `../supabase/schema.sql` once in the Supabase SQL editor before first use.

## Deploy to Vercel (current live setup)

Project root: `backend/`. `api/index.js` is the entry point and `vercel.json` routes
every path to it. Set the env vars above in the Vercel project, with
`NODE_ENV=production` and `CORS_ORIGINS` set to the frontend URL.
