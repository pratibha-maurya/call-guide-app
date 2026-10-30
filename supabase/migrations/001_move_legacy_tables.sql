-- 001: make room for the Call Guide tables in a Supabase project that already
-- has tables from earlier experiments.
--
-- Why: supabase/schema.sql uses "create table if not exists calls". If an older
-- table called "calls" exists with different columns (e.g. name, phone,
-- transcript, duration), Postgres silently keeps the old one and the backend
-- fails on missing columns (stage_reached, outcome...). Renaming keeps every old
-- row; nothing is deleted.
--
-- Run this once in the Supabase SQL editor, THEN run supabase/schema.sql.
-- Safe to re-run: each rename only happens if the old table exists and the
-- legacy name is free, and only if the table does NOT already have the Call
-- Guide shape (column stage_reached).

do $$
begin
  -- calls: rename only if it is not already the Call Guide table
  if to_regclass('public.calls') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'calls' and column_name = 'stage_reached')
     and to_regclass('public.calls_legacy') is null then
    alter table public.calls rename to calls_legacy;
    raise notice 'renamed calls -> calls_legacy';
  end if;

  if to_regclass('public.call_history') is not null
     and to_regclass('public.call_history_legacy') is null then
    alter table public.call_history rename to call_history_legacy;
    raise notice 'renamed call_history -> call_history_legacy';
  end if;

  if to_regclass('public.stage_results') is not null
     and to_regclass('public.stage_results_legacy') is null then
    alter table public.stage_results rename to stage_results_legacy;
    raise notice 'renamed stage_results -> stage_results_legacy';
  end if;
end $$;

-- Renaming a table does not rename its indexes (including the primary-key
-- index "calls_pkey"). Index names are unique per schema, so schema.sql would
-- fail with "relation calls_pkey already exists". Prefix every index on the
-- legacy tables with "legacy_".
do $$
declare r record;
begin
  for r in
    select i.indexname
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename in ('calls_legacy', 'call_history_legacy', 'stage_results_legacy')
      and i.indexname not like 'legacy\_%'
  loop
    execute format('alter index public.%I rename to %I', r.indexname, 'legacy_' || r.indexname);
  end loop;
end $$;
