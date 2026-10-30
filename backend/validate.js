// Request-body validation. Each function returns a clean object (trimmed strings,
// empty strings turned into null) or throws an HttpError(400) that the error
// middleware turns into { error }.
import { getStage, outcomeKeys } from './stages.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const SHORT = 200; // names, roles, companies
const LONG = 2000; // free text: prospect words, next step, summary

const bad = (message) => new HttpError(400, message);

// Optional text field: undefined stays undefined (field not sent), null or ''
// becomes null (field cleared), anything else must be a string within the cap.
function text(body, field, max, { required = false } = {}) {
  const raw = body[field];
  if (raw === undefined || raw === null) {
    if (required) throw bad(`${field} is required`);
    return raw;
  }
  if (typeof raw !== 'string') throw bad(`${field} must be a string`);
  const value = raw.trim();
  if (!value) {
    if (required) throw bad(`${field} is required`);
    return null;
  }
  if (value.length > max) throw bad(`${field} must be at most ${max} characters`);
  return value;
}

function stageNo(body) {
  const n = body.stage_no;
  if (!Number.isInteger(n) || n < 1 || n > 8) throw bad('stage_no must be an integer from 1 to 8');
  return n;
}

function outcome(body, { required }) {
  const value = text(body, 'outcome', SHORT, { required });
  if (value != null && !outcomeKeys.includes(value)) {
    throw bad(`outcome must be one of: ${outcomeKeys.join(', ')}`);
  }
  return value;
}

// Drop undefined keys so the DB layer only writes fields the client actually sent.
const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export function newCall(body = {}) {
  return compact({
    prospect_name: text(body, 'prospect_name', SHORT, { required: true }),
    prospect_role: text(body, 'prospect_role', SHORT),
    company: text(body, 'company', SHORT),
  });
}

export function stageSave(body = {}) {
  const stage_no = stageNo(body);
  const tap = text(body, 'tap', SHORT);
  if (tap != null) {
    const keys = getStage(stage_no).taps.map((t) => t.key);
    if (!keys.includes(tap)) throw bad(`tap must be one of: ${keys.join(', ')}`);
  }
  return compact({ stage_no, tap, prospect_words: text(body, 'prospect_words', LONG) });
}

export function closeCall(body = {}) {
  return {
    outcome: outcome(body, { required: true }),
    stage_no: stageNo(body),
    next_step: text(body, 'next_step', LONG) ?? null,
    summary: text(body, 'summary', LONG) ?? null,
    outcome_flag: text(body, 'outcome_flag', LONG) ?? null,
  };
}

export function summaryRequest(body = {}) {
  return { outcome: outcome(body, { required: false }) ?? null };
}

// Call ids are uuids. Rejecting anything else up front means a typo gets a clean
// 404 instead of a Postgres "invalid input syntax for type uuid" 500.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id) => UUID.test(id);

export function listLimit(query = {}) {
  const n = Number.parseInt(query.limit, 10);
  if (Number.isNaN(n)) return 50;
  return Math.min(Math.max(n, 1), 200);
}

const STATUSES = ['in_progress', 'closed'];

// GET /calls?q=&status=&limit=. Repeated params (?q=a&q=b) arrive as arrays
// and are rejected rather than silently picking one.
export function listQuery(query = {}) {
  const { q, status } = query;
  if (q !== undefined && typeof q !== 'string') throw bad('q must be a single string');
  const term = q?.trim() || null;
  if (term && term.length > 100) throw bad('q must be at most 100 characters');

  if (status !== undefined && !STATUSES.includes(status)) {
    throw bad(`status must be one of: ${STATUSES.join(', ')}`);
  }
  return { limit: listLimit(query), q: term, status: status ?? null };
}
