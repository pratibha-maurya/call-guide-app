# Call Guide backend

Express API for the cold-call guide. Data in Supabase, call record drafted by an
OpenAI-compatible LLM. The contract is `../shared/API.md`.

Files: `server.js` (routes), `db.js` (Supabase queries), `llm.js` (summary + fallback),
`validate.js` (request checks), `stages.js` (loads `stages.json`).

## Env vars

| Var | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | |
| `SUPABASE_SERVICE_KEY` | yes | service-role key, server only |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | no | if any is missing, `/summary` returns the tap-based fallback |
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

Free tier sleeps when idle; the first request after a nap takes ~30-50s.
Run `../supabase/schema.sql` once in the Supabase SQL editor before first use.
