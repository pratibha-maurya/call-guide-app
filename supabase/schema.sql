-- Call Guide schema (Supabase / Postgres)
-- Run once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists calls (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id),
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
create index if not exists calls_user_started_idx on calls (user_id, started_at desc);
create index if not exists call_stages_call_idx on call_stages (call_id);

-- RLS is on, so with no matching policy a role can read or write nothing.
alter table calls enable row level security;
alter table call_stages enable row level security;

-- Newer Supabase projects do not grant table privileges automatically.
grant select, insert, update, delete on calls, call_stages to service_role;

-- Ownership: the backend queries as the logged-in user. These must match
-- migrations/003_add_call_owner.sql.
grant select, insert, update on calls, call_stages to authenticated;
revoke all on calls, call_stages from anon;

create policy "own calls: read" on calls for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own calls: add" on calls for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own calls: change" on calls for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A stage belongs to whoever owns its call.
create policy "own stages: read" on call_stages for select to authenticated
  using (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())));
create policy "own stages: add" on call_stages for insert to authenticated
  with check (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())));
create policy "own stages: change" on call_stages for update to authenticated
  using (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())))
  with check (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())));
