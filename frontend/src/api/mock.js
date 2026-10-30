// In-memory stand-in for the backend so `npm run dev` works with no server.
// Same function names and return shapes as client.js, with fake latency.
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

export async function getHealth() {
  await latency();
  return { ok: true, db: true, llm: false, time: now() };
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

export async function listCalls(limit = 50) {
  await latency();
  const list = [...calls.values()]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit)
    .map((c) => ({ ...c, need_words: needWords(c.id) }));
  return { calls: list };
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
    { name: 'Ritu Agarwal', role: 'Founder', company: 'Agarwal Spices', reached: 6, outcome: 'document_sent', hoursAgo: 1,
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
      status: 'closed', stage_reached: ex.reached, outcome: ex.outcome, next_step: null,
      summary: null, outcome_flag: null,
      started_at: started.toISOString(),
      ended_at: new Date(started.getTime() + 6 * 60e3).toISOString(),
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
