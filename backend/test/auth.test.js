import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server.js';
import { createAuth, parseAllowedEmails } from '../auth.js';
import { createLlm } from '../llm.js';
import { createFakeDb, createFakeAuth } from './fake-db.js';

console.log = () => {};
console.warn = () => {};
console.error = () => {};

const noLlm = createLlm({});
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

// Every route that needs a login, with a body that would otherwise be valid.
const PROTECTED = [
  ['get', '/me'],
  ['get', '/calls'],
  ['get', '/stats'],
  ['post', '/calls', { prospect_name: 'X' }],
  ['get', `/calls/${UNKNOWN_ID}`],
  ['post', `/calls/${UNKNOWN_ID}/stages`, { stage_no: 1 }],
  ['post', `/calls/${UNKNOWN_ID}/summary`, {}],
  ['post', `/calls/${UNKNOWN_ID}/suggest`, { stage_no: 1 }],
  ['post', `/calls/${UNKNOWN_ID}/close`, { outcome: 'meeting_booked', stage_no: 1 }],
];

describe('login is required', () => {
  let db;
  let app;
  beforeEach(() => {
    db = createFakeDb();
    app = createApp({ db, auth: createFakeAuth(), llm: noLlm });
  });

  test('createApp refuses to start without auth', () => {
    assert.throws(() => createApp({ db, llm: noLlm }), /auth/);
  });

  test('/health and /stages stay public', async () => {
    await request(app).get('/health').expect(200);
    await request(app).get('/stages').expect(200);
  });

  for (const [method, path, body] of PROTECTED) {
    test(`${method.toUpperCase()} ${path}: no token, bad scheme or bad token gets 401`, async () => {
      await request(app)[method](path).send(body).expect(401);
      await request(app)[method](path).set('authorization', 'token-a').send(body).expect(401);
      await request(app)[method](path).set('authorization', 'Bearer forged').send(body).expect(401);
      assert.equal(db.calls.size, 0);
    });
  }

  test('401 comes before any body parsing', async () => {
    await request(app).post('/calls').set('content-type', 'application/json').send('{bad').expect(401);
  });

  test('GET /me returns only who you are', async () => {
    const res = await request(app).get('/me').set('authorization', 'Bearer token-a').expect(200);
    assert.deepEqual(res.body, { user: { id: 'user-a', email: 'a@example.com' } });
  });
});

describe('real token check', () => {
  const user = { id: 'u1', email: 'Me@Example.com', email_confirmed_at: '2026-01-01' };
  const accepted = async () => ({ data: { user }, error: null });
  const appWith = (auth) => createApp({ db: createFakeDb(), auth, llm: noLlm });
  const me = (app) => request(app).get('/me').set('authorization', 'Bearer t');

  test('parseAllowedEmails trims, lowercases and drops blanks', () => {
    assert.deepEqual([...parseAllowedEmails(' A@x.com, ,b@Y.com ')], ['a@x.com', 'b@y.com']);
    assert.equal(parseAllowedEmails(undefined).size, 0);
  });

  test('an approved email gets in, whatever its case', async () => {
    const res = await me(appWith(createAuth({ allowedEmails: 'me@example.com', getUser: accepted }))).expect(200);
    assert.equal(res.body.user.id, 'u1');
  });

  test('a valid token with another email gets 403', async () => {
    await me(appWith(createAuth({ allowedEmails: 'other@example.com', getUser: accepted }))).expect(403);
  });

  test('an empty approved list lets nobody in', async () => {
    await me(appWith(createAuth({ allowedEmails: '', getUser: accepted }))).expect(403);
    await me(appWith(createAuth({ getUser: accepted }))).expect(403);
  });

  test('* lets in any confirmed account, but still not an unconfirmed one', async () => {
    await me(appWith(createAuth({ allowedEmails: '*', getUser: accepted }))).expect(200);
    const getUser = async () => ({ data: { user: { ...user, email_confirmed_at: null } }, error: null });
    await me(appWith(createAuth({ allowedEmails: '*', getUser }))).expect(403);
  });

  test('an unconfirmed email gets 403', async () => {
    const getUser = async () => ({ data: { user: { ...user, email_confirmed_at: null } }, error: null });
    await me(appWith(createAuth({ allowedEmails: 'me@example.com', getUser }))).expect(403);
  });

  test('a token Supabase rejects gets 401', async () => {
    const getUser = async () => ({ data: { user: null }, error: { status: 401, message: 'bad jwt' } });
    await me(appWith(createAuth({ allowedEmails: 'me@example.com', getUser }))).expect(401);
  });

  test('a Supabase outage gets 503, never access', async () => {
    const down = async () => ({ data: { user: null }, error: { status: 500 } });
    const noStatus = async () => ({ data: { user: null }, error: { message: 'fetch failed' } });
    await me(appWith(createAuth({ allowedEmails: 'me@example.com', getUser: down }))).expect(503);
    await me(appWith(createAuth({ allowedEmails: 'me@example.com', getUser: noStatus }))).expect(503);
  });

  test('without Supabase env nothing gets through', async () => {
    await me(appWith(createAuth({ allowedEmails: 'me@example.com' }))).expect(503);
  });
});

describe('one user cannot reach another user\'s data', () => {
  let db;
  let app;
  let llmCalls;
  let callId;
  const as = (who, method, path) => request(app)[method](path).set('authorization', `Bearer token-${who}`);

  beforeEach(async () => {
    db = createFakeDb();
    llmCalls = 0;
    const fakeFetch = async () => {
      llmCalls += 1;
      throw new Error('LLM must not run for a call you do not own');
    };
    app = createApp({ db, auth: createFakeAuth(), llm: createLlm({ apiKey: 'k', fetch: fakeFetch }) });
    const res = await as('a', 'post', '/calls').send({ prospect_name: 'Private Prospect', company: 'Secret Co' }).expect(201);
    callId = res.body.call.id;
    await as('a', 'post', `/calls/${callId}/stages`)
      .send({ stage_no: 5, prospect_words: 'private words' }).expect(200);
  });

  test('a new call belongs to the user who created it', () => {
    assert.equal(db.calls.get(callId).user_id, 'user-a');
  });

  test('the client cannot choose the owner', async () => {
    const res = await as('a', 'post', '/calls').send({ prospect_name: 'X', user_id: 'user-b' }).expect(201);
    assert.equal(db.calls.get(res.body.call.id).user_id, 'user-a');
  });

  test('the owner can still read it', async () => {
    const res = await as('a', 'get', `/calls/${callId}`).expect(200);
    assert.equal(res.body.stages[0].prospect_words, 'private words');
  });

  test('another user reading it gets 404, the same as a call that does not exist', async () => {
    const theirs = await as('b', 'get', `/calls/${callId}`).expect(404);
    const missing = await as('b', 'get', `/calls/${UNKNOWN_ID}`).expect(404);
    assert.deepEqual(theirs.body, missing.body);
  });

  test('another user cannot change the stages or close the call', async () => {
    await as('b', 'post', `/calls/${callId}/stages`).send({ stage_no: 5, prospect_words: 'hacked' }).expect(404);
    await as('b', 'post', `/calls/${callId}/close`).send({ outcome: 'meeting_booked', stage_no: 5 }).expect(404);
    const res = await as('a', 'get', `/calls/${callId}`).expect(200);
    assert.equal(res.body.call.status, 'in_progress');
    assert.equal(res.body.stages[0].prospect_words, 'private words');
  });

  test('another user cannot get AI output from the call', async () => {
    await as('b', 'post', `/calls/${callId}/summary`).send({}).expect(404);
    await as('b', 'post', `/calls/${callId}/suggest`).send({ stage_no: 5 }).expect(404);
    assert.equal(llmCalls, 0);
  });

  test('lists and search show only your own calls', async () => {
    const all = await as('b', 'get', '/calls').expect(200);
    assert.deepEqual(all.body.calls, []);
    const search = await as('b', 'get', '/calls?q=Secret').expect(200);
    assert.deepEqual(search.body.calls, []);
    const mine = await as('a', 'get', '/calls?q=Secret').expect(200);
    assert.equal(mine.body.calls.length, 1);
  });

  test('stats count only your own calls', async () => {
    const theirs = await as('b', 'get', '/stats').expect(200);
    assert.equal(theirs.body.total, 0);
    assert.equal(theirs.body.with_need_words, 0);
    const mine = await as('a', 'get', '/stats').expect(200);
    assert.equal(mine.body.total, 1);
    assert.equal(mine.body.with_need_words, 1);
  });
});
