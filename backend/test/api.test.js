import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server.js';
import { createLlm, parseReply } from '../llm.js';
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
