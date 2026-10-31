# Call Guide frontend

React + Vite screen that keeps a cold caller on the 8-stage call structure.
Routes: `/` dashboard, `/call` live call (an in-progress call resumes here), `/calls` past calls, `/calls/:id` one call.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | yes, unless mocking | Backend URL, no trailing slash (`http://localhost:3000` locally, the Render URL in production). If it is missing and the mock is off, the app shows a config error banner instead of running. |
| `VITE_SUPABASE_URL` | yes, unless mocking | Supabase project URL, for logging in. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes, unless mocking | Publishable key only. Never the secret key: everything here reaches the browser. |
| `VITE_API_KEY` | no | Sent as the `x-api-key` header when set. |
| `VITE_USE_MOCK` | no | `true` runs on the in-memory mock API (`src/api/mock.js`) for offline demos. Nothing is saved. Any other value uses the real backend. |

Copy `.env.example` to `.env` **in `frontend/`, next to `package.json`** (not the repo root).
Vite reads `.env` only when the dev server starts: **restart `npm run dev` after editing it.**

In mock mode, `localStorage.setItem('callguide.mockLlm', 'off')` in the browser console makes
"Suggest what to say" return the static fallback, to demo the "AI unavailable" path.

## Run locally

```bash
npm install
npm run dev          # needs frontend/.env with VITE_API_URL (or VITE_USE_MOCK=true)
npm run build        # production build into dist/
npm run preview      # serve the build
npm run sync-stages  # copy ../shared/stages.json -> src/stages.json (commit the copy)
```

Stages load from `GET /stages` at startup; `src/stages.json` is the fallback so
the screen renders while the Render backend is still waking up.

## Deploy on Vercel

1. Import the repo. Root Directory: `frontend`. Framework preset: Vite.
2. Environment variable: `VITE_API_URL=https://<your-backend>.onrender.com` (plus `VITE_API_KEY` if the backend checks one).
3. Deploy. `vercel.json` rewrites every path to `index.html`, so deep links such as `/call`, `/calls` and `/calls/<id>` work.

Remember to allow the Vercel domain in the backend's CORS settings.
