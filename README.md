# Call Guide

A screen that sits beside the phone during a cold call and keeps the caller on the structure of the call: eight stages, what each is for, what prospects tend to say there, one tap for what happened, one box for the prospect's own words, and a record of where each call ended.

| | |
|---|---|
| **Live screen (Vercel)** | _to be added_ |
| **Backend health (Render)** | _to be added_ `/health` |
| **Database** | Supabase (Postgres), schema in [`supabase/schema.sql`](supabase/schema.sql) |
| **LLM** | _provider / model to be added_ — used only at the end of a call (see below) |

## How it fits together

```
Caller's screen (Vercel, React)  -->  API (Render, Express)  -->  Supabase (Postgres)
                                            |
                                            +-->  LLM (end-of-call record + mismatch flag)
```

The screen never talks to the database directly. The service-role key and the LLM key live only in Render's environment.

## The eight stages

`shared/stages.json` is the single source for the stages: purpose, what prospects tend to say, the taps, and the outcomes. The backend validates against it and the screen renders from it. After editing it, run `npm run sync-stages` in both `backend/` and `frontend/`.

## Where the LLM is used, and why only there

During the call the caller should be listening, not waiting on a model, so stages 1–8 involve no LLM. At the close, the LLM:

1. drafts a two-line call record that quotes the prospect's stage-5 words verbatim, and
2. flags when the outcome the caller picked doesn't match what was said (the stage-8 trap: logging "meeting booked" when only a document was agreed).

The caller edits and confirms the draft. If the LLM is down or unconfigured, a plain summary is built from the taps and the call still saves.

## Repo layout

```
frontend/   React + Vite screen (live call, past calls, call detail)
backend/    Express API, Supabase queries, LLM summary, tests (npm test)
supabase/   schema.sql
shared/     stages.json (stage content) and API.md (contract)
```

## Run locally

```
cd backend && cp .env.example .env   # fill in Supabase + LLM values
npm install && npm run dev            # http://localhost:3000

cd frontend && npm install && npm run dev   # http://localhost:5173
```

Without `VITE_API_URL` the screen runs against an in-memory mock API.

## Notes

- Render's free tier sleeps when idle; the first request can take up to a minute. The screen pings `/health` on load to wake it.
- Supabase's free tier pauses a project after a week without activity.
