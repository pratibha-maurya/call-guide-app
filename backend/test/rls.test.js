// Runs the real SQL files in a throwaway in-memory Postgres, with a small stand-in
// for Supabase's auth schema and roles, so the RLS policies themselves are tested.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (path) => readFileSync(new URL(`../../supabase/${path}`, import.meta.url), 'utf8')
  .replace('create extension if not exists "pgcrypto";', ''); // gen_random_uuid is built in

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const SUPABASE_STANDIN = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');
`;

// The schema as it is in the live project today: before owners existed.
const beforeAuth = () => sql('schema.sql')
  .replace(/^\s*user_id .*\n/m, '')
  .replace(/^create index if not exists calls_user_started_idx.*\n/m, '')
  .split('-- Ownership:')[0]
  + sql('migrations/002_grant_service_role.sql');

async function run(db, role, userId, query) {
  await db.exec(`reset role; select set_config('request.jwt.sub', '${userId ?? ''}', false); set role ${role};`);
  try {
    return await db.query(query);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.sub', '', false);");
  }
}

async function makeDb(setup) {
  const db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  await db.exec(setup);
  return db;
}

describe('RLS: upgrading the existing database', () => {
  let db;
  let aCall;
  let bCall;
  const asA = (q) => run(db, 'authenticated', A, q);
  const asB = (q) => run(db, 'authenticated', B, q);

  before(async () => {
    db = await makeDb(beforeAuth());
    await db.exec(`
      insert into calls (prospect_name) values ('Old call 1'), ('Old call 2'), ('Old call 3');
      insert into call_stages (call_id, stage_no, prospect_words)
        select id, 5, 'old words' from calls;
    `);
    await db.exec(sql('migrations/003_add_call_owner.sql'));
  });

  test('003 keeps every old row, with no owner yet and invisible to users', async () => {
    const { rows } = await db.query('select count(*)::int n, count(user_id)::int owned from calls');
    assert.deepEqual(rows[0], { n: 3, owned: 0 });
    assert.equal((await asA('select * from calls')).rows.length, 0);
  });

  test('the already-deployed backend (service role) still reads and creates calls', async () => {
    const res = await run(db, 'service_role', null, "insert into calls (prospect_name) values ('Old backend') returning user_id");
    assert.equal(res.rows[0].user_id, null);
    assert.equal((await run(db, 'service_role', null, 'select * from calls')).rows.length, 4);
    await db.exec("delete from calls where prospect_name = 'Old backend'");
  });

  test('004 as written stops with an error and changes nothing', async () => {
    await assert.rejects(db.exec(sql('migrations/004_assign_existing_calls.sql')), /No account with that email/);
    const { rows } = await db.query('select count(user_id)::int owned from calls');
    assert.equal(rows[0].owned, 0);
  });

  test('004 gives the old calls and their stages to the named account, whatever the case', async () => {
    await db.exec(sql('migrations/004_assign_existing_calls.sql').replace('YOUR_EMAIL_HERE', 'A@Example.com'));
    assert.equal((await asA('select * from calls')).rows.length, 3);
    assert.equal((await asA('select * from call_stages')).rows.length, 3);
    assert.equal((await asB('select * from calls')).rows.length, 0);
  });

  test('005 then requires an owner', async () => {
    await db.exec(sql('migrations/005_require_call_owner.sql'));
    await assert.rejects(run(db, 'service_role', null, "insert into calls (prospect_name) values ('x')"), /null value/);
  });

  test('a new call is owned by whoever creates it', async () => {
    aCall = (await asA("insert into calls (prospect_name) values ('A new') returning id, user_id")).rows[0];
    bCall = (await asB("insert into calls (prospect_name) values ('B new') returning id, user_id")).rows[0];
    assert.equal(aCall.user_id, A);
    assert.equal(bCall.user_id, B);
  });

  test('a user cannot read another user\'s call or stages', async () => {
    await asA(`insert into call_stages (call_id, stage_no, prospect_words) values ('${aCall.id}', 5, 'A words')`);
    assert.equal((await asB(`select * from calls where id = '${aCall.id}'`)).rows.length, 0);
    assert.equal((await asB(`select * from call_stages where call_id = '${aCall.id}'`)).rows.length, 0);
    assert.ok((await asB('select prospect_name from calls')).rows.every((r) => r.prospect_name === 'B new'));
  });

  test('counts, which stats rely on, include only your own rows', async () => {
    assert.equal((await asB('select count(*)::int n from calls')).rows[0].n, 1);
    assert.equal((await asA('select count(*)::int n from calls')).rows[0].n, 4);
  });

  test('a user cannot create a call in someone else\'s name', async () => {
    await assert.rejects(asA(`insert into calls (prospect_name, user_id) values ('Fake', '${B}')`), /row-level security/);
  });

  test('a user cannot change another user\'s call or stages', async () => {
    await asB(`update calls set summary = 'hacked' where id = '${aCall.id}'`);
    await asB(`update call_stages set prospect_words = 'hacked' where call_id = '${aCall.id}'`);
    const { rows } = await db.query(`select summary, (select prospect_words from call_stages where call_id = c.id) words from calls c where id = '${aCall.id}'`);
    assert.deepEqual(rows[0], { summary: null, words: 'A words' });
  });

  test('a user cannot add stages to another user\'s call', async () => {
    await assert.rejects(asB(`insert into call_stages (call_id, stage_no) values ('${aCall.id}', 6)`), /row-level security/);
  });

  test('a user cannot move a stage onto another user\'s call', async () => {
    const own = (await asB(`insert into call_stages (call_id, stage_no) values ('${bCall.id}', 2) returning id`)).rows[0];
    await assert.rejects(asB(`update call_stages set call_id = '${aCall.id}' where id = '${own.id}'`), /row-level security/);
  });

  test('a user cannot give their call away', async () => {
    await assert.rejects(asA(`update calls set user_id = '${B}' where id = '${aCall.id}'`), /row-level security/);
  });

  test('a user can change their own call', async () => {
    await asA(`update calls set summary = 'mine' where id = '${aCall.id}'`);
    assert.equal((await asA(`select summary from calls where id = '${aCall.id}'`)).rows[0].summary, 'mine');
  });

  test('nobody can delete calls or stages through the API roles', async () => {
    await asA(`delete from calls where id = '${aCall.id}'`).catch(() => {});
    await asA(`delete from call_stages where call_id = '${aCall.id}'`).catch(() => {});
    const { rows } = await db.query(`select (select count(*)::int from calls where id = '${aCall.id}') c, (select count(*)::int from call_stages where call_id = '${aCall.id}') s`);
    assert.deepEqual(rows[0], { c: 1, s: 1 });
  });

  test('the logged-out role gets nothing', async () => {
    await assert.rejects(run(db, 'anon', null, 'select * from calls'), /permission denied/);
    await assert.rejects(run(db, 'anon', null, 'select * from call_stages'), /permission denied/);
    await assert.rejects(run(db, 'anon', null, "insert into calls (prospect_name) values ('x')"), /permission denied/);
  });

  test('a logged-in role with no user id sees nothing', async () => {
    assert.equal((await run(db, 'authenticated', null, 'select * from calls')).rows.length, 0);
  });
});

describe('RLS: a fresh database from schema.sql', () => {
  test('ends up with the same protection, and 003 is safe to run again', async () => {
    const db = await makeDb(sql('schema.sql'));
    await db.exec(sql('migrations/003_add_call_owner.sql'));
    await run(db, 'authenticated', A, "insert into calls (prospect_name) values ('A')");
    assert.equal((await run(db, 'authenticated', B, 'select * from calls')).rows.length, 0);
    assert.equal((await run(db, 'authenticated', A, 'select * from calls')).rows.length, 1);
    await assert.rejects(db.query("insert into calls (prospect_name) values ('no owner')"), /null value/);
  });
});
