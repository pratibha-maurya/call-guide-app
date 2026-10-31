-- 003: give every call an owner and let the database enforce "own calls only".
--
-- Why: the backend now queries as the logged-in user, so these policies decide
-- what each user can see. Nothing is deleted. Existing calls keep user_id = null
-- until 004 assigns them, and the service role keeps its access, so the version
-- of the app that is already deployed keeps working.
--
-- Run this once in the Supabase SQL editor. Safe to run again.

alter table calls
  add column if not exists user_id uuid default auth.uid() references auth.users(id);

create index if not exists calls_user_started_idx on calls (user_id, started_at desc);

grant select, insert, update on calls, call_stages to authenticated;
revoke all on calls, call_stages from anon;

alter table calls enable row level security;
alter table call_stages enable row level security;

drop policy if exists "own calls: read" on calls;
create policy "own calls: read" on calls for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own calls: add" on calls;
create policy "own calls: add" on calls for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "own calls: change" on calls;
create policy "own calls: change" on calls for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A stage belongs to whoever owns its call.
drop policy if exists "own stages: read" on call_stages;
create policy "own stages: read" on call_stages for select to authenticated
  using (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())));

drop policy if exists "own stages: add" on call_stages;
create policy "own stages: add" on call_stages for insert to authenticated
  with check (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())));

drop policy if exists "own stages: change" on call_stages;
create policy "own stages: change" on call_stages for update to authenticated
  using (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())))
  with check (exists (select 1 from calls where calls.id = call_id and calls.user_id = (select auth.uid())));
