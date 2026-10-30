// All Supabase access lives here. server.js only sees these plain async
// functions, so tests can swap in an in-memory fake with the same shape.
import { createClient } from '@supabase/supabase-js';

// Supabase returns { data, error } instead of throwing; turn errors into throws.
function unwrap({ data, error }) {
  if (error) throw new Error(`db: ${error.message}`);
  return data;
}

// Used when Supabase env vars are missing: the server still boots, /health
// reports db:false, and every data route answers 503 instead of crashing.
function unconfiguredDb() {
  const fail = async () => {
    const err = new Error('database not configured');
    err.status = 503;
    throw err;
  };
  return new Proxy({ ping: async () => false }, {
    get: (target, prop) => (prop in target ? target[prop] : fail),
  });
}

export function createDb({ url, serviceKey }) {
  if (!url || !serviceKey) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'SUPABASE_URL / SUPABASE_SERVICE_KEY missing; data routes return 503' }));
    return unconfiguredDb();
  }
  // Service-role key: bypasses RLS. It must only ever live on the server.
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  return {
    // Cheapest possible round trip, with a hard 3s cap so /health stays fast.
    async ping() {
      try {
        const { error } = await sb.from('calls').select('id').limit(1)
          .abortSignal(AbortSignal.timeout(3000));
        return !error;
      } catch {
        return false;
      }
    },

    async createCall(fields) {
      return unwrap(await sb.from('calls').insert(fields).select().single());
    },

    async getCall(id) {
      return unwrap(await sb.from('calls').select().eq('id', id).maybeSingle());
    },

    async getStages(callId) {
      return unwrap(await sb.from('call_stages').select().eq('call_id', callId).order('stage_no'));
    },

    // Upsert on the (call_id, stage_no) unique key. PostgREST only writes the
    // columns present in the payload, so omitting `tap` keeps the saved tap.
    async upsertStage(callId, { stage_no, ...fields }) {
      const row = { call_id: callId, stage_no, ...fields, saved_at: new Date().toISOString() };
      return unwrap(await sb.from('call_stages')
        .upsert(row, { onConflict: 'call_id,stage_no' }).select().single());
    },

    // stage_reached = greatest(stage_reached, stageNo), done as a conditional
    // update so two quick saves can never move it backwards.
    async raiseStageReached(callId, stageNo) {
      unwrap(await sb.from('calls').update({ stage_reached: stageNo })
        .eq('id', callId).lt('stage_reached', stageNo));
      return this.getCall(callId);
    },

    async closeCall(id, { outcome, stage_no, next_step, summary, outcome_flag }) {
      return unwrap(await sb.from('calls').update({
        status: 'closed',
        ended_at: new Date().toISOString(),
        stage_reached: stage_no, // where the call actually ended, may be lower
        outcome, next_step, summary, outcome_flag,
      }).eq('id', id).select().maybeSingle());
    },

    // One query: embed only the stage-5 row of each call (no N+1).
    async listCalls(limit) {
      const rows = unwrap(await sb.from('calls')
        .select('*, call_stages(prospect_words)')
        .eq('call_stages.stage_no', 5)
        .order('started_at', { ascending: false })
        .limit(limit));
      return rows.map(({ call_stages, ...call }) => ({
        ...call,
        need_words: call_stages?.[0]?.prospect_words ?? null,
      }));
    },
  };
}
