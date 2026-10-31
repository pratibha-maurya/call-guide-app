# Call Guide

A screen that sits beside the phone during a cold call and keeps the caller on the structure of the call: eight stages, what each is for, what prospects tend to say there, one tap for what happened, one box for the prospect's own words, and a record of where each call ended.

| | |
|---|---|
| **Live screen (Vercel)** | https://call-guide-app.vercel.app |
| **Backend health (Vercel)** | https://call-guide-api.vercel.app/health |
| **Database** | Supabase (Postgres), schema in [`supabase/schema.sql`](supabase/schema.sql) |
| **LLM** | Groq, `openai/gpt-oss-20b` (OpenAI-compatible API), called only from the backend |

## How it fits together

```
Caller's screen (Vercel, React)  -->  API (Render, Express)  -->  Supabase (Postgres)
                                            |
                                            +-->  LLM (end-of-call record + mismatch flag)
```

The screen never talks to the database directly. The service-role key and the LLM key live only in Render's environment.

## The eight stages

`shared/stages.json` is the single source for the stages: purpose, what prospects tend to say, the taps, and the outcomes. The backend validates against it and the screen renders from it. After editing it, run `npm run sync-stages` in both `backend/` and `frontend/`.

## Where the LLM is used

The live screen works without any AI: taps and one words box. The LLM is used in two places, both through the backend so the key never reaches the browser:

**Mid-call, on demand ("Suggest what to say").** Optional button on every stage. The backend sends Groq the stage, its purpose, what the prospect tends to say there, and the call so far; Groq returns one line to say and one follow-up question. If Groq is down or slow (8s), the screen shows the stage's own guidance labelled "Static guidance – AI unavailable" — never presented as AI.

**At the close.** The LLM:

1. drafts a two-line call record that quotes the prospect's stage-5 words verbatim, and
2. flags when the outcome the caller picked doesn't match what was said (the stage-8 trap: logging "meeting booked" when only a document was agreed).

The caller edits and confirms the draft. If the LLM is down or unconfigured, a plain summary is built from the taps and the call still saves.

## Database setup

In the Supabase SQL editor:

1. If the project already has older tables named `calls`, `call_history` or `stage_results`, run `supabase/migrations/001_move_legacy_tables.sql` first. It renames them to `*_legacy` (no data is deleted) so they don't block the new tables.
2. Run `supabase/schema.sql`.

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

Without `VITE_API_URL` the screen shows a configuration error. For an offline demo, set `VITE_USE_MOCK=true` to use the in-memory mock API (clearly labelled "mock" on screen).

## Notes

- Render's free tier sleeps when idle; the first request can take up to a minute. The screen pings `/health` on load to wake it.
- Supabase's free tier pauses a project after a week without activity.
