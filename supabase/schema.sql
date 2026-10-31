-- Call Guide schema (Supabase / Postgres)
-- Run once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists calls (
  id              uuid primary key default gen_random_uuid(),
  prospect_name   text not null,
  prospect_role   text,
  company         text,
  status          text not null default 'in_progress'
                  check (status in ('in_progress', 'closed')),
  stage_reached   smallint not null default 1 check (stage_reached between 1 and 8),
  outcome         text,
  next_step       text,
  summary         text,           -- LLM-drafted, caller-confirmed record
  outcome_flag    text,           -- LLM note when outcome and words disagree
  started_at      timestamptz not null default now(),
  ended_at        timestamptz
);

create table if not exists call_stages (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid not null references calls(id) on delete cascade,
  stage_no        smallint not null check (stage_no between 1 and 8),
  tap             text,           -- key of the tapped "what happened" option
  prospect_words  text,           -- the prospect's own words
  saved_at        timestamptz not null default now(),
  unique (call_id, stage_no)
);

create index if not exists calls_started_at_idx on calls (started_at desc);
create index if not exists call_stages_call_idx on call_stages (call_id);

-- The backend uses the service-role key, which bypasses RLS.
-- RLS is enabled with no policies so the anon key can read or write nothing.
alter table calls enable row level security;
alter table call_stages enable row level security;

-- Bypassing RLS is not enough: the role also needs table privileges, which
-- newer Supabase projects do not grant automatically.
grant select, insert, update, delete on calls, call_stages to service_role;
