// Drafts the call record at close. Talks to any OpenAI-compatible
// /chat/completions endpoint with plain fetch (no SDK).
//
// Rule from the contract: closing a call must never depend on the LLM. So
// draft() never throws. If env is missing, the request fails, times out, or the
// reply is not the JSON we asked for, it returns a deterministic fallback built
// from the taps, marked source: "fallback".
import { getStage, outcomeKeys, tapLabel } from './stages.js';

const SYSTEM_PROMPT = `You write the record of one cold call. The caller sells growth and consulting work to Indian companies.
Write exactly 2 short factual lines. If the prospect's stage-5 words are given, quote them verbatim inside double quotes.
Use only what is in the call notes. Do not invent names, numbers, dates or commitments.
Reply with a JSON object only: {"summary": string, "suggested_outcome": string, "flag": string or null}.
suggested_outcome must be one of: ${outcomeKeys.join(', ')}.
flag: null, unless chosen_outcome is given and does not match what the prospect said (for example the caller chose meeting_booked but no meeting was agreed). Then one sentence saying why.`;

// The furthest tap that implies an outcome decides the fallback guess.
// Taps not listed here (e.g. "Right person, listening") say nothing about the outcome.
const TAP_OUTCOME = {
  meeting: 'meeting_booked',
  call_at_their_time: 'callback_scheduled',
  call_back_time: 'callback_scheduled',
  busy_elsewhere: 'callback_scheduled',
  send_document: 'document_sent',
  send_in_writing: 'document_sent',
  send_first: 'document_sent',
  referral: 'referred',
  wrong_person: 'referred',
  wrong_contact: 'wrong_contact',
  dropped: 'dropped',
  none: 'not_interested',
  warm_no: 'not_interested',
  clear_no: 'not_interested',
  has_someone: 'not_interested',
  all_fine: 'not_interested',
};

function guessOutcome(stages) {
  const furthestFirst = [...stages].sort((a, b) => b.stage_no - a.stage_no);
  for (const s of furthestFirst) {
    if (TAP_OUTCOME[s.tap]) return TAP_OUTCOME[s.tap];
  }
  return 'not_interested';
}

// e.g. Reached Stage 6 Objection. Need: 'We want to export'. Objection: Send in writing.
export function fallbackSummary(call, stages) {
  const reached = getStage(call.stage_reached);
  const parts = [`Reached Stage ${reached.no} ${reached.name}.`];

  const need = stages.find((s) => s.stage_no === 5)?.prospect_words;
  if (need) parts.push(`Need: '${need}'.`);

  const last = [...stages].filter((s) => s.tap).sort((a, b) => b.stage_no - a.stage_no)[0];
  if (last) parts.push(`${getStage(last.stage_no).name}: ${tapLabel(last.stage_no, last.tap)}.`);

  return {
    summary: parts.join(' '),
    suggested_outcome: guessOutcome(stages),
    flag: null,
    source: 'fallback',
  };
}

// One line per saved stage, e.g. "Stage 6 Objection: Send in writing | words: ..."
export function buildUserMessage(stages, chosenOutcome) {
  const lines = [...stages].sort((a, b) => a.stage_no - b.stage_no).map((s) => {
    const name = getStage(s.stage_no).name;
    const tap = s.tap ? tapLabel(s.stage_no, s.tap) : '(no tap)';
    return `Stage ${s.stage_no} ${name}: ${tap} | words: ${s.prospect_words || '-'}`;
  });
  if (chosenOutcome) lines.push(`chosen_outcome: ${chosenOutcome}`);
  return lines.join('\n');
}

// Models sometimes wrap JSON in ```json fences or add a sentence around it.
// Take the outermost {...} and check every field; return null if anything is off.
export function parseReply(content) {
  if (typeof content !== 'string') return null;
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let obj;
  try {
    obj = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof obj?.summary !== 'string' || !obj.summary.trim()) return null;
  if (!outcomeKeys.includes(obj.suggested_outcome)) return null;

  const flag = typeof obj.flag === 'string' && obj.flag.trim() ? obj.flag.trim().slice(0, 500) : null;
  return {
    summary: obj.summary.trim().slice(0, 2000),
    suggested_outcome: obj.suggested_outcome,
    flag,
    source: 'llm',
  };
}

export function createLlm({ baseUrl, apiKey, model, fetch = globalThis.fetch } = {}) {
  const configured = Boolean(baseUrl && apiKey && model);

  async function draft(call, stages, chosenOutcome = null) {
    if (!configured) return fallbackSummary(call, stages);
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserMessage(stages, chosenOutcome) },
          ],
        }),
        // The caller is waiting on the phone; give up after 15s and use the fallback.
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = await res.json();
      const parsed = parseReply(data?.choices?.[0]?.message?.content);
      if (!parsed) throw new Error('LLM reply was not the expected JSON');
      return parsed;
    } catch (err) {
      // Log the reason only, never the key or the request body.
      console.warn(JSON.stringify({ level: 'warn', msg: 'llm fallback', reason: err.message }));
      return fallbackSummary(call, stages);
    }
  }

  return { configured, draft };
}
