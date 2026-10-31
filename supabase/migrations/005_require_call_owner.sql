-- 005: every call must have an owner from now on.
--
-- Run LAST, only after the login version of the backend is deployed. The old
-- backend creates calls with no owner, so it would fail once this is on. If it
-- created any in the meantime this stops with an error: run 004 again, then this.

alter table calls alter column user_id set not null;
