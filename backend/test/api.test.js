import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server.js';
import { createLlm, parseReply, parseSuggestion, DEFAULT_BASE_URL, DEFAULT_MODEL } from '../llm.js';
import { createDb, searchFilter } from '../db.js';
import { createFakeDb } from './fake-db.js';

// Silence per-request logs during tests.
console.log = () => {};
console.warn = () => {};

const noLlm = createLlm({}); // no env -> always the fallback
let db;
let app;

beforeEach(() => {
  db = createFakeDb();
  app = createApp({ db, llm: noLlm });
});

async function newCall(name = 'Ravi Kumar') {
  const res = await request(app).post('/calls').send({ prospect_name: name, company: 'Acme' });
  return res.body.call;
}
const saveStage = (id, body) => request(app).post(`/calls/${id}/stages`).send(body);

test('GET /health reports process, db and llm status', async () => {
  const res = await request(app).get('/health').expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.db, true);
  assert.equal(res.body.llm, false);
  assert.equal(res.body.llm_model, null);
  assert.ok(res.body.time);
});

test('GET /stages returns the guide', async () => {
  const res = await request(app).get('/stages').expect(200);
  assert.equal(res.body.stages.length, 8);
  assert.ok(res.body.outcomes.length > 0);
});

describe('POST /calls', () => {
  test('creates a call with trimmed fields', async () => {
    const res = await request(app).post('/calls')
      .send({ prospect_name: '  Ravi  ', prospect_role: ' CFO ', company: '' }).expect(201);
    assert.equal(res.body.call.prospect_name, 'Ravi');
    assert.equal(res.body.call.prospect_role, 'CFO');
    assert.equal(res.body.call.company, null);
    assert.equal(res.body.call.status, 'in_progress');
  });

  test('requires prospect_name', async () => {
    const res = await request(app).post('/calls').send({ prospect_name: '   ' }).expect(400);
    assert.match(res.body.error, /prospect_name/);
  });

  test('rejects malformed JSON with 400', async () => {
    await request(app).post('/calls').set('content-type', 'application/json').send('{bad').expect(400);
  });
});

describe('POST /calls/:id/stages', () => {
  test('validates stage_no, tap and text length', async () => {
    const { id } = await newCall();
    for (const stage_no of [0, 9, '3', 2.5, undefined]) {
      const res = await saveStage(id, { stage_no }).expect(400);
      assert.match(res.body.error, /stage_no/);
    }
    // "meeting" is a stage-7 tap, not a stage-1 tap
    const tapRes = await saveStage(id, { stage_no: 1, tap: 'meeting' }).expect(400);
    assert.match(tapRes.body.error, /tap must be one of/);
    await saveStage(id, { stage_no: 5, prospect_words: 'x'.repeat(2001) }).expect(400);
  });

  test('404 for unknown or malformed call id', async () => {
    await saveStage('00000000-0000-4000-8000-000000000000', { stage_no: 1 }).expect(404);
    await saveStage('not-a-uuid', { stage_no: 1 }).expect(404);
  });

  test('upserts per stage and stage_reached never goes down', async () => {
    const { id } = await newCall();
    let res = await saveStage(id, { stage_no: 5, tap: 'named_goal', prospect_words: ' Export ' }).expect(200);
    assert.equal(res.body.stage.prospect_words, 'Export');
    assert.equal(res.body.call.stage_reached, 5);

    // Going back to stage 3 keeps stage_reached at 5
    res = await saveStage(id, { stage_no: 3, tap: 'yes_now' }).expect(200);
    assert.equal(res.body.call.stage_reached, 5);

    // Re-saving stage 5 updates the same row instead of adding one
    res = await saveStage(id, { stage_no: 5, prospect_words: 'Enter the US market' }).expect(200);
    assert.equal(res.body.stage.tap, 'named_goal'); // untouched field kept
    assert.equal(db.stages.filter((s) => s.stage_no === 5).length, 1);

    const detail = await request(app).get(`/calls/${id}`).expect(200);
    assert.deepEqual(detail.body.stages.map((s) => s.stage_no), [3, 5]);
    assert.equal(detail.body.stages[1].prospect_words, 'Enter the US market');
  });

  test('409 when the call is closed', async () => {
    const { id } = await newCall();
    await request(app).post(`/calls/${id}/close`).send({ outcome: 'dropped', stage_no: 2 }).expect(200);
    await saveStage(id, { stage_no: 3 }).expect(409);
  });
});

describe('POST /calls/:id/close', () => {
  test('validates outcome', async () => {
    const { id } = await newCall();
    const res = await request(app).post(`/calls/${id}/close`).send({ outcome: 'sold', stage_no: 7 }).expect(400);
    assert.match(res.body.error, /outcome/);
    await request(app).post(`/calls/${id}/close`).send({ stage_no: 7 }).expect(400);
    await request(app).post(`/calls/${id}/close`).send({ outcome: 'dropped' }).expect(400);
  });

  test('closes and stores where the call ended', async () => {
    const { id } = await newCall();
    await saveStage(id, { stage_no: 7, tap: 'send_document' });
    const res = await request(app).post(`/calls/${id}/close`).send({
      outcome: 'document_sent', stage_no: 6, next_step: ' WhatsApp deck today ',
      summary: 'Asked for a deck.', outcome_flag: 'Check this.',
    }).expect(200);
    const { call } = res.body;
    assert.equal(call.status, 'closed');
    assert.ok(call.ended_at);
    assert.equal(call.stage_reached, 6); // set from the body, not the max
    assert.equal(call.outcome, 'document_sent');
    assert.equal(call.next_step, 'WhatsApp deck today');
    assert.equal(call.summary, 'Asked for a deck.');
    assert.equal(call.outcome_flag, 'Check this.');
  });

  test('404 for unknown call', async () => {
    await request(app).post('/calls/00000000-0000-4000-8000-000000000000/close')
      .send({ outcome: 'dropped', stage_no: 1 }).expect(404);
  });
});

test('GET /calls includes need_words and respects limit', async () => {
  const a = await newCall('A');
  await newCall('B');
  await saveStage(a.id, { stage_no: 5, prospect_words: 'We want to export' });
  await saveStage(a.id, { stage_no: 6, prospect_words: 'not this one' });

  const res = await request(app).get('/calls').expect(200);
  assert.equal(res.body.calls.length, 2);
  const byName = Object.fromEntries(res.body.calls.map((c) => [c.prospect_name, c]));
  assert.equal(byName.A.need_words, 'We want to export');
  assert.equal(byName.B.need_words, null);

  const limited = await request(app).get('/calls?limit=1').expect(200);
  assert.equal(limited.body.calls.length, 1);
});

describe('POST /calls/:id/summary', () => {
  test('falls back to a tap-based summary when LLM env is missing', async () => {
    const { id } = await newCall();
    await saveStage(id, { stage_no: 5, tap: 'named_goal', prospect_words: 'We want to export' });
    await saveStage(id, { stage_no: 6, tap: 'send_in_writing' });

    const res = await request(app).post(`/calls/${id}/summary`).expect(200);
    assert.deepEqual(res.body, {
      summary: "Reached Stage 6 Objection. Need: 'We want to export'. Objection: Send in writing.",
      suggested_outcome: 'document_sent',
      flag: null,
      source: 'fallback',
    });
    // nothing saved
    assert.equal(db.calls.get(id).summary, null);
  });

  test('rejects an unknown outcome in the body', async () => {
    const { id } = await newCall();
    await request(app).post(`/calls/${id}/summary`).send({ outcome: 'sold' }).expect(400);
  });

  test('uses a mocked LLM reply wrapped in code fences', async () => {
    let sent;
    const fakeFetch = async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      const content = '```json\n{"summary":"Line 1.\\nLine 2.","suggested_outcome":"document_sent",'
        + '"flag":"Caller chose meeting_booked but the prospect only asked for a document."}\n```';
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    };
    const llm = createLlm({ baseUrl: 'https://llm.test/v1/', apiKey: 'k', model: 'm', fetch: fakeFetch });
    app = createApp({ db, llm });

    const { id } = await newCall();
    await saveStage(id, { stage_no: 5, tap: 'named_goal', prospect_words: 'We want to export' });
    const res = await request(app).post(`/calls/${id}/summary`).send({ outcome: 'meeting_booked' }).expect(200);

    assert.equal(res.body.source, 'llm');
    assert.equal(res.body.summary, 'Line 1.\nLine 2.');
    assert.equal(res.body.suggested_outcome, 'document_sent');
    assert.match(res.body.flag, /meeting_booked/);

    assert.equal(sent.url, 'https://llm.test/v1/chat/completions');
    assert.equal(sent.init.headers.authorization, 'Bearer k');
    assert.equal(sent.body.temperature, 0.2);
    assert.deepEqual(sent.body.response_format, { type: 'json_object' });
    const userMsg = sent.body.messages[1].content;
    assert.match(userMsg, /Stage 5 Their need, in their words: Named a goal or problem \| words: We want to export/);
    assert.match(userMsg, /chosen_outcome: meeting_booked/);
  });

  test('falls back when the LLM fails or returns junk', async () => {
    for (const fakeFetch of [
      async () => new Response('nope', { status: 500 }),
      async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Sure! Here you go.' } }] })),
      async () => { throw new Error('network down'); },
    ]) {
      app = createApp({ db, llm: createLlm({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', fetch: fakeFetch }) });
      const { id } = await newCall();
      const res = await request(app).post(`/calls/${id}/summary`).expect(200);
      assert.equal(res.body.source, 'fallback');
    }
  });
});

test('parseReply validates keys', () => {
  assert.equal(parseReply('{"summary":"x","suggested_outcome":"sold","flag":null}'), null);
  assert.equal(parseReply('{"summary":"","suggested_outcome":"dropped"}'), null);
  assert.equal(parseReply(null), null);
  assert.deepEqual(parseReply('{"summary":" x ","suggested_outcome":"dropped","flag":""}'),
    { summary: 'x', suggested_outcome: 'dropped', flag: null, source: 'llm' });
});

describe('x-api-key', () => {
  beforeEach(() => {
    app = createApp({ db, llm: noLlm, config: { apiKey: 'secret' } });
  });

  test('/health and /stages stay open', async () => {
    await request(app).get('/health').expect(200);
    await request(app).get('/stages').expect(200);
  });

  test('other routes need the key', async () => {
    await request(app).get('/calls').expect(401);
    await request(app).get('/calls').set('x-api-key', 'wrong').expect(401);
    await request(app).get('/calls').set('x-api-key', 'secret').expect(200);
    await request(app).post('/calls').send({ prospect_name: 'A' }).expect(401);
  });
});

describe('CORS', () => {
  test('allows listed origins, vercel previews only when opted in, localhost in dev', async () => {
    const make = (config) => createApp({ db, llm: noLlm, config });
    const allowed = async (a, origin) =>
      (await request(a).get('/health').set('Origin', origin)).headers['access-control-allow-origin'] === origin;

    const strict = make({ corsOrigins: 'https://callguide.vercel.app', dev: false });
    assert.equal(await allowed(strict, 'https://callguide.vercel.app'), true);
    assert.equal(await allowed(strict, 'https://callguide-git-x.vercel.app'), false);
    assert.equal(await allowed(strict, 'http://localhost:5173'), false);

    const previews = make({ corsOrigins: 'https://callguide.vercel.app, *.vercel.app', dev: true });
    assert.equal(await allowed(previews, 'https://callguide-git-x.vercel.app'), true);
    assert.equal(await allowed(previews, 'http://localhost:5173'), true);
    assert.equal(await allowed(previews, 'https://evil.com'), false);
  });
});

// ---- v2 additions ----

describe('GET /calls search and status', () => {
  async function seed() {
    const mk = (body) => request(app).post('/calls').send(body).then((r) => r.body.call);
    const ravi = await mk({ prospect_name: 'Ravi Kumar', company: 'Acme Exports', prospect_role: 'CFO' });
    const meera = await mk({ prospect_name: 'Meera', company: '100% Cotton (India), Ltd_' });
    const arjun = await mk({ prospect_name: 'Arjun', prospect_role: 'Head of Growth' });
    await request(app).post(`/calls/${meera.id}/close`).send({ outcome: 'dropped', stage_no: 1 }).expect(200);
    return { ravi, meera, arjun };
  }
  const names = (res) => res.body.calls.map((c) => c.prospect_name).sort();

  test('q matches name, company and role, case-insensitive, trimmed', async () => {
    await seed();
    assert.deepEqual(names(await request(app).get('/calls?q=%20%20ravi%20').expect(200)), ['Ravi Kumar']);
    assert.deepEqual(names(await request(app).get('/calls?q=EXPORTS').expect(200)), ['Ravi Kumar']);
    assert.deepEqual(names(await request(app).get('/calls?q=growth').expect(200)), ['Arjun']);
    assert.deepEqual(names(await request(app).get('/calls?q=').expect(200)), ['Arjun', 'Meera', 'Ravi Kumar']);
  });

  test('special characters are matched literally', async () => {
    await seed();
    for (const q of ['100%', '(India),', 'Ltd_']) {
      const res = await request(app).get('/calls').query({ q }).expect(200);
      assert.deepEqual(names(res), ['Meera'], q);
    }
    assert.deepEqual(names(await request(app).get('/calls').query({ q: '%' }).expect(200)), ['Meera']);
  });

  test('status filters and combines with q', async () => {
    await seed();
    assert.deepEqual(names(await request(app).get('/calls?status=closed').expect(200)), ['Meera']);
    assert.deepEqual(names(await request(app).get('/calls?status=in_progress').expect(200)), ['Arjun', 'Ravi Kumar']);
    assert.deepEqual(names(await request(app).get('/calls?status=in_progress&q=meera').expect(200)), []);
  });

  test('400 for invalid status or q', async () => {
    let res = await request(app).get('/calls?status=open').expect(400);
    assert.match(res.body.error, /status must be one of/);
    await request(app).get('/calls?status=closed&status=in_progress').expect(400);
    res = await request(app).get('/calls').query({ q: 'x'.repeat(101) }).expect(400);
    assert.match(res.body.error, /q must be at most 100/);
    await request(app).get('/calls').query({ q: 'x'.repeat(100) }).expect(200);
    await request(app).get('/calls?q=a&q=b').expect(400);
  });
});

test('searchFilter escapes LIKE wildcards and PostgREST reserved characters', () => {
  assert.equal(searchFilter('ravi'),
    'prospect_name.ilike."%ravi%",company.ilike."%ravi%",prospect_role.ilike."%ravi%"');
  // % _ \ get a LIKE backslash; then \ and " get a PostgREST backslash inside the quotes.
  const f = searchFilter('5%_a\\b,(c)"d');
  assert.equal(f.split(',prospect_role')[0].split(',company')[0],
    'prospect_name.ilike."%5\\\\%\\\\_a\\\\\\\\b,(c)\\"d%"');
  // , ( ) never appear outside a quoted value: exactly 3 top-level filters.
  const outsideQuotes = f.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  assert.equal(outsideQuotes, 'prospect_name.ilike."",company.ilike."",prospect_role.ilike.""');
});

describe('GET /stats', () => {
  test('all stage and outcome keys present, zeros included', async () => {
    let res = await request(app).get('/stats').expect(200);
    assert.deepEqual(res.body.by_stage, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 });
    assert.deepEqual(Object.keys(res.body.by_outcome).sort(),
      ['callback_scheduled', 'document_sent', 'dropped', 'meeting_booked', 'not_interested', 'referred', 'wrong_contact']);
    assert.ok(Object.values(res.body.by_outcome).every((n) => n === 0));
    assert.equal(res.body.total, 0);

    const a = await newCall('A');
    const b = await newCall('B');
    await newCall('C');
    await saveStage(a.id, { stage_no: 5, tap: 'named_goal', prospect_words: 'Export to the US' });
    await saveStage(b.id, { stage_no: 5, tap: 'named_goal' }); // no words: not counted
    await request(app).post(`/calls/${b.id}/close`).send({ outcome: 'document_sent', stage_no: 6 }).expect(200);

    res = await request(app).get('/stats').expect(200);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.closed, 1);
    assert.equal(res.body.in_progress, 2);
    assert.deepEqual(res.body.by_stage, { 1: 1, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 0, 8: 0 });
    assert.equal(res.body.by_outcome.document_sent, 1);
    assert.equal(res.body.by_outcome.dropped, 0);
    assert.equal(res.body.with_need_words, 1);
  });

  test('needs x-api-key when API_KEY is set', async () => {
    app = createApp({ db, llm: noLlm, config: { apiKey: 'secret' } });
    await request(app).get('/stats').expect(401);
    await request(app).get('/stats').set('x-api-key', 'secret').expect(200);
  });
});

describe('POST /calls/:id/suggest', () => {
  const suggest = (id, body) => request(app).post(`/calls/${id}/suggest`).send(body);
  const stage6Purpose = () => request(app).get('/stages').then((r) => r.body.stages[5].purpose);

  test('static fallback without an LLM key, nothing saved', async () => {
    const { id } = await newCall();
    const res = await suggest(id, { stage_no: 6, tap: 'send_in_writing', prospect_words: 'Email me' }).expect(200);
    assert.deepEqual(res.body, { say: await stage6Purpose(), follow_up: null, source: 'static' });
    assert.equal(db.stages.length, 0);
  });

  test('validates like a stage save; 404 for unknown call; allowed on closed calls', async () => {
    const { id } = await newCall();
    await suggest(id, { stage_no: 9 }).expect(400);
    await suggest(id, { stage_no: 1, tap: 'meeting' }).expect(400);
    await suggest('00000000-0000-4000-8000-000000000000', { stage_no: 1 }).expect(404);
    await suggest('nope', { stage_no: 1 }).expect(404);
    await request(app).post(`/calls/${id}/close`).send({ outcome: 'dropped', stage_no: 2 }).expect(200);
    await suggest(id, { stage_no: 2 }).expect(200);
  });

  test('sends stage + call context and parses a code-fenced JSON reply', async () => {
    let sent;
    const fakeFetch = async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      const content = 'Here you go:\n```json\n{"say":" Happy to. What should the note cover for you? ","follow_up":"Who else reads it?"}\n```';
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    };
    app = createApp({ db, llm: createLlm({ apiKey: 'k', fetch: fakeFetch }) });

    const { id } = await newCall();
    await saveStage(id, { stage_no: 5, tap: 'named_goal', prospect_words: 'We want to export' });
    await saveStage(id, { stage_no: 6, tap: 'has_someone', prospect_words: 'old saved words' }).expect(200);
    const res = await suggest(id, { stage_no: 6, tap: 'send_in_writing', prospect_words: 'Just email me' }).expect(200);

    assert.deepEqual(res.body, {
      say: 'Happy to. What should the note cover for you?',
      follow_up: 'Who else reads it?',
      source: 'llm',
      model: DEFAULT_MODEL,
    });
    assert.equal(sent.url, `${DEFAULT_BASE_URL}/chat/completions`);
    assert.equal(sent.body.model, DEFAULT_MODEL);
    assert.ok(sent.init.signal, 'request has a timeout signal');
    assert.match(sent.body.messages[0].content, /Indian companies/);
    const user = sent.body.messages[1].content;
    assert.match(user, /Current stage 6 Objection/);
    assert.match(user, /Purpose: /);
    assert.match(user, /Stage 5 Their need, in their words: Named a goal or problem \| words: We want to export/);
    assert.match(user, /Now: Send in writing \| words: Just email me/); // body overrides the saved row
    assert.doesNotMatch(user, /old saved words/);
    assert.equal(db.stages.find((s) => s.stage_no === 6).tap, 'has_someone'); // nothing saved
  });

  test('falls back to static on HTTP error, network error or bad JSON', async () => {
    const purpose = await stage6Purpose();
    for (const fakeFetch of [
      async () => new Response('rate limited', { status: 429 }),
      async () => { throw new DOMException('timed out', 'TimeoutError'); },
      async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"say": ""}' } }] })),
      async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not json at all' } }] })),
    ]) {
      app = createApp({ db, llm: createLlm({ apiKey: 'k', fetch: fakeFetch }) });
      const { id } = await newCall();
      const res = await suggest(id, { stage_no: 6 }).expect(200);
      assert.deepEqual(res.body, { say: purpose, follow_up: null, source: 'static' });
    }
  });
});

test('parseSuggestion', () => {
  assert.equal(parseSuggestion(null), null);
  assert.equal(parseSuggestion('{"follow_up":"x"}'), null);
  assert.deepEqual(parseSuggestion('{"say":"Hi.","follow_up":""}'), { say: 'Hi.', follow_up: null });
});

describe('LLM config', () => {
  test('defaults to Groq; enabled only by LLM_API_KEY; empty strings count as unset', () => {
    assert.equal(DEFAULT_BASE_URL, 'https://api.groq.com/openai/v1');
    assert.equal(DEFAULT_MODEL, 'llama-3.3-70b-versatile');
    assert.equal(createLlm({}).configured, false);
    assert.equal(createLlm({ baseUrl: 'https://x/v1', model: 'm' }).configured, false);
    const llm = createLlm({ baseUrl: '', apiKey: 'k', model: '' });
    assert.equal(llm.configured, true);
    assert.equal(llm.model, DEFAULT_MODEL);
    assert.equal(createLlm({ apiKey: 'k', model: 'other' }).model, 'other');
  });

  test('/health shows the model name, never the key', async () => {
    app = createApp({ db, llm: createLlm({ apiKey: 'sk-secret-123' }) });
    const res = await request(app).get('/health').expect(200);
    assert.equal(res.body.llm, true);
    assert.equal(res.body.llm_model, DEFAULT_MODEL);
    assert.doesNotMatch(JSON.stringify(res.body), /sk-secret/);
  });
});

describe('without Supabase env', () => {
  test('boots; /health ok with db:false; data routes 503', async () => {
    app = createApp({ db: createDb({}), llm: noLlm });
    const health = await request(app).get('/health').expect(200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.db, false);
    await request(app).get('/stages').expect(200);
    const res = await request(app).get('/calls').expect(503);
    assert.equal(res.body.error, 'database not configured');
    await request(app).get('/stats').expect(503);
    await request(app).get('/calls?q=ravi&status=closed').expect(503);
    await request(app).post('/calls/00000000-0000-4000-8000-000000000000/suggest').send({ stage_no: 1 }).expect(503);
  });
});
