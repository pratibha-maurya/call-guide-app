// In-memory stand-in for db.js with the same function names, so the tests
// exercise the real routes and validation without a Supabase project.
// forUser() limits each user to their own rows, as the RLS policies do; the
// policies themselves are tested against real Postgres in rls.test.js.
import { randomUUID } from 'node:crypto';
import { SEARCH_COLUMNS } from '../db.js';
import * as validate from '../validate.js';

// Two approved users. Any other token is rejected.
export function createFakeAuth() {
  const users = {
    'token-a': { id: 'user-a', email: 'a@example.com' },
    'token-b': { id: 'user-b', email: 'b@example.com' },
  };
  const { HttpError } = validate;
  return {
    async verify(token) {
      if (!users[token]) throw new HttpError(401, 'invalid or expired login');
      return users[token];
    },
  };
}

export function createFakeDb() {
  const calls = new Map();
  const stages = []; // rows of call_stages

  const forUser = (token, user) => {
    const owned = (c) => c.user_id === user.id;
    const myCalls = () => [...calls.values()].filter(owned);
    const myStages = () => stages.filter((s) => owned(calls.get(s.call_id)));

    return {
      async createCall(fields) {
        const call = {
          id: randomUUID(), prospect_role: null, company: null, ...fields, user_id: user.id,
          status: 'in_progress', stage_reached: 1, outcome: null, next_step: null,
          summary: null, outcome_flag: null, started_at: new Date().toISOString(), ended_at: null,
        };
        calls.set(call.id, call);
        return { ...call };
      },

      async getCall(id) {
        return calls.has(id) && owned(calls.get(id)) ? { ...calls.get(id) } : null;
      },

      async getStages(callId) {
        return myStages().filter((s) => s.call_id === callId).sort((a, b) => a.stage_no - b.stage_no);
      },

      async upsertStage(callId, { stage_no, ...fields }) {
        let row = stages.find((s) => s.call_id === callId && s.stage_no === stage_no);
        if (!row) {
          row = { id: randomUUID(), call_id: callId, stage_no, tap: null, prospect_words: null };
          stages.push(row);
        }
        Object.assign(row, fields, { saved_at: new Date().toISOString() });
        return { ...row };
      },

      async raiseStageReached(callId, stageNo) {
        const call = calls.get(callId);
        call.stage_reached = Math.max(call.stage_reached, stageNo);
        return { ...call };
      },

      async closeCall(id, { stage_no, ...fields }) {
        const call = calls.get(id);
        Object.assign(call, fields, {
          status: 'closed', ended_at: new Date().toISOString(), stage_reached: stage_no,
        });
        return { ...call };
      },

      // Plain substring match: the fake has no LIKE, so %, _ and \ are literal here
      // just as the escaped PostgREST filter makes them in db.js.
      async listCalls({ limit, q = null, status = null }) {
        const needle = q?.toLowerCase();
        const matches = (c) => SEARCH_COLUMNS.some((col) => c[col]?.toLowerCase().includes(needle));
        return myCalls()
          .filter((c) => !status || c.status === status)
          .filter((c) => !needle || matches(c))
          .sort((a, b) => b.started_at.localeCompare(a.started_at))
          .slice(0, limit)
          .map((c) => ({
            ...c,
            need_words: stages.find((s) => s.call_id === c.id && s.stage_no === 5)?.prospect_words ?? null,
          }));
      },

      async statsData() {
        return {
          calls: myCalls().map(({ id, status, stage_reached, outcome }) => ({ id, status, stage_reached, outcome })),
          withNeedWords: myStages().filter((s) => s.stage_no === 5 && s.prospect_words).length,
        };
      },
    };
  };

  return { calls, stages, forUser, async ping() { return true; } };
}
