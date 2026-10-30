# Call Guide frontend

React + Vite screen that keeps a cold caller on the 8-stage call structure.
Routes: `/` live call, `/calls` past calls, `/calls/:id` one call.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | for the real backend | Render URL, no trailing slash. If unset, the app uses the in-memory mock API (`src/api/mock.js`). |
| `VITE_API_KEY` | no | Sent as the `x-api-key` header when set. |

Copy `.env.example` to `.env.local` to set them locally.

## Run locally

```bash
npm install
npm run dev          # mock API if VITE_API_URL is unset
npm run build        # production build into dist/
npm run preview      # serve the build
npm run sync-stages  # copy ../shared/stages.json -> src/stages.json (commit the copy)
```

Stages load from `GET /stages` at startup; `src/stages.json` is the fallback so
the screen renders while the Render backend is still waking up.

## Deploy on Vercel

1. Import the repo. Root Directory: `frontend`. Framework preset: Vite.
2. Environment variable: `VITE_API_URL=https://<your-backend>.onrender.com` (plus `VITE_API_KEY` if the backend checks one).
3. Deploy. `vercel.json` rewrites every path to `index.html`, so `/calls` deep links work.

Remember to allow the Vercel domain in the backend's CORS settings.
