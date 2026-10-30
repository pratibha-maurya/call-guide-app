// In-memory stand-in for the backend, for offline demos (VITE_USE_MOCK=true).
// Same function names and return shapes as client.js, with fake latency.
// To demo the "AI unavailable" path, run in the console:
//   localStorage.setItem('callguide.mockLlm', 'off')
import stagesData from '../stages.json';

const calls = new Map(); // id -> call
const stagesByCall = new Map(); // id -> Map(stage_no -> stage row)

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const latency = () => wait(250 + Math.random() * 350);
const now = () => new Date().toISOString();
const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const tapLabel = (stageNo, tap) =>
  stagesData.stages[stageNo - 1]?.taps.find((t) => t.key === tap)?.label;

function needWords(id) {
  return stagesByCall.get(id)?.get(5)?.prospect_words || null;
}

// The mock never pretends to be a real model: its replies are labelled 'mock' in the UI.
const MOCK_MODEL = 'mock (no AI)';

function mockLlmOn() {
  try {
    return localStorage.getItem('callguide.mockLlm') !== 'off';
  } catch {
    return true;
  }
}

export async function getHealth() {
  await latency();
  return { ok: true, db: true, llm: mockLlmOn(), llm_model: MOCK_MODEL, time: now() };
}

export async function getStages() {
  await latency();
  return stagesData;
}

export async function createCall({ prospect_name, prospect_role, company }) {
  await latency();
  if (!prospect_name) throw new Error('prospect_name is required');
  const call = {
    id: newId(),
    prospect_name,
    prospect_role: prospect_role || null,
    company: company || null,
    status: 'in_progress',
    stage_reached: 1,
    outcome: null,
    next_step: null,
    summary: null,
    outcome_flag: null,
    started_at: now(),
    ended_at: null,
  };
  calls.set(call.id, call);
  stagesByCall.set(call.id, new Map());
  return { call };
}

export async function saveStage(callId, { stage_no, tap = null, prospect_words = null }) {
  await latency();
  const call = calls.get(callId);
  if (!call) throw new Error('call not found');
  const stage = { call_id: callId, stage_no, tap, prospect_words, saved_at: now() };
  stagesByCall.get(callId).set(stage_no, stage);
  call.stage_reached = Math.max(call.stage_reached, stage_no);
  return { stage, call };
}

export async function draftSummary(callId, { outcome } = {}) {
  await wait(900);
  const call = calls.get(callId);
  if (!call) throw new Error('call not found');
  const rows = [...stagesByCall.get(callId).values()].sort((a, b) => a.stage_no - b.stage_no);
  const words = needWords(callId);
  const taps = rows.filter((r) => r.tap).map((r) => tapLabel(r.stage_no, r.tap));
  const who = [call.prospect_name, call.company].filter(Boolean).join(', ');
  const line1 = `${who}: ${taps.join('; ') || 'no stages recorded'}.`;
  const line2 = words ? `In their words: "${words}"` : 'Their need was not captured.';

  const saidAllFine = stagesByCall.get(callId).get(5)?.tap === 'all_fine';
  const flag =
    outcome === 'meeting_booked' && saidAllFine
      ? 'They said everything is fine at stage 5, but the outcome is a booked meeting.'
      : null;

  return { summary: `${line1}\n${line2}`, suggested_outcome: outcome || 'not_interested', flag, source: 'fallback' };
}

export async function closeCall(callId, { outcome, stage_no, next_step, summary, outcome_flag }) {
  await latency();
  const call = calls.get(callId);
  if (!call) throw new Error('call not found');
  Object.assign(call, {
    status: 'closed',
    outcome,
    stage_reached: stage_no,
    next_step: next_step || null,
    summary: summary || null,
    outcome_flag: outcome_flag || null,
    ended_at: now(),
  });
  return { call };
}

export async function listCalls({ limit = 50, q, status } = {}) {
  await latency();
  const needle = (q || '').trim().toLowerCase();
  const matches = (c) =>
    !needle ||
    [c.prospect_name, c.company, c.prospect_role].some((v) => v?.toLowerCase().includes(needle));
  const list = [...calls.values()]
    .filter((c) => (!status || c.status === status) && matches(c))
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit)
    .map((c) => ({ ...c, need_words: needWords(c.id) }));
  return { calls: list };
}

export async function getStats() {
  await latency();
  const all = [...calls.values()];
  const by_stage = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  const by_outcome = {};
  for (const c of all) {
    by_stage[c.stage_reached] += 1;
    if (c.outcome) by_outcome[c.outcome] = (by_outcome[c.outcome] || 0) + 1;
  }
  return {
    total: all.length,
    closed: all.filter((c) => c.status === 'closed').length,
    in_progress: all.filter((c) => c.status === 'in_progress').length,
    by_stage,
    by_outcome,
    with_need_words: all.filter((c) => needWords(c.id)).length,
  };
}

// Canned "AI" lines per stage; the real backend asks the LLM.
const SUGGESTIONS = {
  1: ['Hi, this is Arjun from Northwind. I help family firms find new buyers; do you have one minute?', 'Is now a bad time, or can I take sixty seconds?'],
  2: ['We help manufacturers your size find distributors outside their home state. That is the whole call.', 'Who usually looks after new markets at your company?'],
  3: ['Happy to keep it to two minutes, and you can stop me any time.', 'Would two minutes now work, or is later today better?'],
  4: ['That helps. So most of your orders come through the same few dealers today?', 'What does a good month look like for you right now?'],
  5: ['If I heard you right, that is the thing you would fix first. Let me make sure I write it down exactly.', 'What would change for you if that was sorted by next season?'],
  6: ['Fair enough, a lot of people say that. I am not asking you to switch anything today.', 'What would you need to see to think it was worth a second look?'],
  7: ['Let us put twenty minutes in the diary so I can show you how it worked for a firm like yours.', 'Does Tuesday or Thursday afternoon suit you better?'],
  8: ['Thank you for your time. I will send a short note on WhatsApp so you have my number.', 'Is this the best number to reach you on?'],
};

export async function suggest(callId, { stage_no, prospect_words }) {
  await wait(1100);
  if (!calls.has(callId)) throw new Error('call not found');
  const stage = stagesData.stages[stage_no - 1];
  if (!mockLlmOn()) return { say: stage.purpose, follow_up: null, source: 'static' };
  const [say, follow_up] = SUGGESTIONS[stage_no];
  const heard = prospect_words?.trim().replace(/[.!?]+$/, '');
  const echo = heard ? `You said "${heard}". ` : '';
  return { say: `${echo}${say}`, follow_up, source: 'mock', model: MOCK_MODEL };
}

export async function getCall(callId) {
  await latency();
  const call = calls.get(callId);
  if (!call) throw new Error('call not found');
  const stages = [...stagesByCall.get(callId).values()].sort((a, b) => a.stage_no - b.stage_no);
  return { call, stages };
}

// A few past calls so the Past calls screen has something to show in dev.
function seed() {
  const examples = [
    { name: 'Meera Kapoor', role: 'Partner', company: 'Kapoor Exports', reached: 3, outcome: null, hoursAgo: 0.5,
      stages: { 1: 'right_person', 2: 'let_me_go_on', 3: 'yes_now' } },
    { name: 'Ritu Agarwal', role: 'Founder', company: 'Agarwal Spices', reached: 6, outcome: 'document_sent', hoursAgo: 1,
      next: 'WhatsApp the two-page note today, call Friday 4 pm',
      notes: 'Ritu wants her masalas in Gulf supermarkets by next Diwali.\nAsked for something in writing to show her brother.',
      stages: { 1: 'right_person', 2: 'asked_what_we_do', 3: 'yes_now', 4: 'described_it', 5: ['named_goal', 'We want our masalas in Gulf supermarkets by next Diwali.'], 6: ['send_in_writing', 'Send me something on WhatsApp, I will show my brother.'] } },
    { name: 'Vikram Shetty', role: 'MD', company: 'Shetty Castings', reached: 3, outcome: 'callback_scheduled', hoursAgo: 3,
      stages: { 1: 'right_person', 2: 'called_it_sales', 3: ['call_back_time', 'After two, not before.'] } },
    { name: 'Anjali Menon', role: 'CEO', company: 'Kerala Coir Works', reached: 6, outcome: 'not_interested', hoursAgo: 26,
      stages: { 1: 'right_person', 2: 'let_me_go_on', 3: 'yes_now', 4: 'described_it', 5: ['all_fine', 'Honestly, orders are full till March.'], 6: ['has_someone', 'We already have a consultant in Kochi.'] } },
    { name: 'Suresh Iyer', role: 'Director', company: 'Iyer Textiles', reached: 1, outcome: 'wrong_contact', hoursAgo: 50,
      stages: { 1: ['wrong_contact', 'He left the company last year.'] } },
    { name: 'Farhan Qureshi', role: 'Owner', company: 'Qureshi Leather', reached: 7, outcome: 'meeting_booked', hoursAgo: 75,
      stages: { 1: 'right_person', 2: 'asked_number_source', 3: 'yes_now', 4: 'described_it', 5: ['named_goal', 'Our dealers in the north are not growing, we need new ones.'], 6: 'no_objection', 7: ['meeting', 'Come to the Kanpur office Tuesday.'] } },
  ];
  for (const ex of examples) {
    const started = new Date(Date.now() - ex.hoursAgo * 3600e3);
    const id = newId();
    calls.set(id, {
      id, prospect_name: ex.name, prospect_role: ex.role, company: ex.company,
      stage_reached: ex.reached, outcome: ex.outcome,
      status: ex.outcome ? 'closed' : 'in_progress',
      next_step: ex.next || null, summary: ex.notes || null, outcome_flag: null,
      started_at: started.toISOString(),
      ended_at: ex.outcome ? new Date(started.getTime() + (4 + ex.reached) * 60e3 + 37e3).toISOString() : null,
    });
    const map = new Map();
    for (const [no, v] of Object.entries(ex.stages)) {
      const [tap, words] = Array.isArray(v) ? v : [v, null];
      map.set(Number(no), { call_id: id, stage_no: Number(no), tap, prospect_words: words, saved_at: started.toISOString() });
    }
    stagesByCall.set(id, map);
  }
}
seed();
