-- 002: let the backend reach the Call Guide tables.
--
-- Why: without table privileges every query fails with "permission denied for
-- table calls" (42501), even with the service-role key. Newer Supabase projects
-- do not grant these automatically. The anon key stays locked out.
--
-- Run this once in the Supabase SQL editor if schema.sql was run before it
-- included this grant. Safe to run again.

grant select, insert, update, delete on calls, call_stages to service_role;
