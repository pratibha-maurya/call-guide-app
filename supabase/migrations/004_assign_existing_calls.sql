-- 004: give the calls that have no owner to one account. Stages follow their call.
--
-- Run after 003, once the account exists. Put your email in the select below
-- first; as written it stops with an error and changes nothing. Only rows with
-- no owner are touched, nothing is deleted, and it is safe to run again.

do $$
declare
  owner_id uuid;
  assigned integer;
begin
  select id into owner_id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE');
  if owner_id is null then
    raise exception 'No account with that email. Create it in Authentication > Users first.';
  end if;

  update calls set user_id = owner_id where user_id is null;
  get diagnostics assigned = row_count;
  raise notice 'Assigned % call(s).', assigned;
end $$;
