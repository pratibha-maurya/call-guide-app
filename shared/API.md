# API contract (backend <-> frontend)

Base URL: `VITE_API_URL` (Render). JSON in, JSON out. Errors: `{ "error": "message" }` with 4xx/5xx.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | - | `{ ok: true, db: true|false, llm: true|false, time }` |
| GET | `/stages` | - | contents of `stages.json` |
| POST | `/calls` | `{ prospect_name, prospect_role?, company? }` | `{ call }` (201) |
| POST | `/calls/:id/stages` | `{ stage_no (1-8), tap?, prospect_words? }` | `{ stage, call }` - upsert; `stage_reached = max(stage_reached, stage_no)` |
| POST | `/calls/:id/summary` | `{ outcome? }` | `{ summary, suggested_outcome, flag, source: "llm"|"fallback" }` - LLM draft, nothing saved |
| POST | `/calls/:id/close` | `{ outcome, stage_no, next_step?, summary?, outcome_flag? }` | `{ call }` - status closed, ended_at now, stage_reached = stage_no where the call ended; closing again overwrites |

Status codes: 400 validation, 401 missing/wrong `x-api-key` (only when `API_KEY` is set; `/health` and `/stages` exempt), 404 unknown call, 409 stage saved to a closed call. `stage_no` must be a JSON integer.
| GET | `/calls` | `?limit=50` | `{ calls: [ { ...call, need_words } ] }` newest first; `need_words` = stage-5 words |
| GET | `/calls/:id` | - | `{ call, stages: [...] }` |

Validation: `stage_no` 1..8; `tap` must be a key from that stage's `taps`; `outcome` must be a key in `outcomes`.

`call` shape: `{ id, prospect_name, prospect_role, company, status, stage_reached, outcome, next_step, summary, outcome_flag, started_at, ended_at }`.

## LLM (summary endpoint)
OpenAI-compatible chat completions, configured by env:
`LLM_BASE_URL` (e.g. https://api.groq.com/openai/v1), `LLM_API_KEY`, `LLM_MODEL`.
Input: stage names, taps (labels), prospect words, caller's chosen outcome if given.
Output (JSON): `summary` (2 lines, uses the prospect's stage-5 words verbatim when present),
`suggested_outcome` (an outcome key), `flag` (null, or one sentence when the chosen/likely outcome
does not match what was said). If LLM env is missing or the call fails, return a deterministic
fallback summary built from the taps and `flag: null` - closing a call must never depend on the LLM.
