// HTTP routes. createApp() takes its dependencies (db, llm, config) as
// arguments so tests can pass in-memory fakes; the bottom of the file wires the
// real ones from env when this file is run directly (npm start).
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import { guide } from './stages.js';
import { buildSuggestContext } from './llm.js';
import { aggregateStats } from './stats.js';
import * as v from './validate.js';
import { HttpError } from './validate.js';

// CORS_ORIGINS="https://callguide.vercel.app,*.vercel.app"
// The literal "*.vercel.app" opts in to Vercel preview URLs; otherwise exact matches only.
function corsOptions({ corsOrigins = '', dev = false }) {
  const list = corsOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  const allowVercelPreviews = list.includes('*.vercel.app');
  return {
    origin(origin, done) {
      if (!origin) return done(null, true); // curl, Render health checks: no Origin header
      const ok = list.includes(origin)
        || (allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin))
        || (dev && origin === 'http://localhost:5173');
      done(null, ok); // false = no CORS headers, the browser blocks it
    },
  };
}

// Optional shared key. /health and /stages stay open so Render's health check
// and the static guide work without it.
function requireApiKey(apiKey) {
  const expected = Buffer.from(apiKey);
  return (req, res, next) => {
    if (req.path === '/health' || req.path === '/stages') return next();
    const got = Buffer.from(req.get('x-api-key') ?? '');
    // Constant-time compare so the key cannot be guessed byte by byte from timings.
    if (got.length === expected.length && timingSafeEqual(got, expected)) return next();
    next(new HttpError(401, 'missing or invalid x-api-key'));
  };
}

// One JSON line per request. Path only, no query string, bodies or headers,
// so nothing secret or personal ends up in Render's logs.
function requestLog(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Math.round(performance.now() - start),
    }));
  });
  next();
}

export function createApp({ db, llm, config = {} }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLog);
  app.use(cors(corsOptions(config)));
  app.use(express.json({ limit: '50kb' }));
  if (config.apiKey) app.use(requireApiKey(config.apiKey));

  // Loads the call or throws 404. Every /calls/:id route starts with this.
  async function findCall(id) {
    const call = v.isUuid(id) ? await db.getCall(id) : null;
    if (!call) throw new HttpError(404, 'call not found');
    return call;
  }

  // ok is true whenever the process answers; db/llm report dependencies.
  // Never calls the LLM: health checks run often and must stay free and fast.
  app.get('/health', async (req, res) => {
    res.json({
      ok: true,
      db: await db.ping(),
      llm: llm.configured,
      llm_model: llm.configured ? llm.model : null, // model name only, never the key
      time: new Date().toISOString(),
    });
  });

  app.get('/stages', (req, res) => res.json(guide));

  app.post('/calls', async (req, res) => {
    const call = await db.createCall(v.newCall(req.body));
    res.status(201).json({ call });
  });

  app.get('/calls', async (req, res) => {
    res.json({ calls: await db.listCalls(v.listQuery(req.query)) });
  });

  app.get('/stats', async (req, res) => {
    res.json(aggregateStats(await db.statsData()));
  });

  app.get('/calls/:id', async (req, res) => {
    const call = await findCall(req.params.id);
    res.json({ call, stages: await db.getStages(call.id) });
  });

  app.post('/calls/:id/stages', async (req, res) => {
    const input = v.stageSave(req.body); // validate before touching the db
    const call = await findCall(req.params.id);
    if (call.status === 'closed') throw new HttpError(409, 'call is closed');

    const stage = await db.upsertStage(call.id, input);
    const updated = await db.raiseStageReached(call.id, input.stage_no);
    res.json({ stage, call: updated });
  });

  // Drafts a record for the caller to review. Saves nothing: the caller edits
  // it and sends the final text with /close.
  app.post('/calls/:id/summary', async (req, res) => {
    const { outcome } = v.summaryRequest(req.body ?? {});
    const call = await findCall(req.params.id);
    const stages = await db.getStages(call.id);
    res.json(await llm.draft(call, stages, outcome));
  });

  // Mid-call "Ask AI". Saves nothing, and works on closed calls too (reviewing
  // an old call). The body is validated like a stage save, but the tap/words in
  // it may not be saved yet, so they override the saved row for this stage.
  app.post('/calls/:id/suggest', async (req, res) => {
    const input = v.stageSave(req.body);
    const call = await findCall(req.params.id);
    const stages = await db.getStages(call.id);
    res.json(await llm.suggest(buildSuggestContext(input.stage_no, stages, input)));
  });

  app.post('/calls/:id/close', async (req, res) => {
    const input = v.closeCall(req.body);
    const call = await findCall(req.params.id);
    res.json({ call: await db.closeCall(call.id, input) });
  });

  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  // Express 5 forwards errors thrown in async handlers here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // HttpError from our code, or body-parser errors (bad JSON = 400, too large = 413).
    const status = err.status ?? err.statusCode ?? 500;
    if (status === 503) return res.status(503).json({ error: err.message });
    if (status >= 500) {
      console.error(JSON.stringify({ level: 'error', path: req.path, msg: err.message }));
      return res.status(500).json({ error: 'internal error' });
    }
    res.status(status).json({ error: err.expose === false ? 'bad request' : err.message });
  });

  return app;
}

// Started directly (npm start / npm run dev), not imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { createDb } = await import('./db.js');
  const { createLlm } = await import('./llm.js');
  const env = process.env;

  const llm = createLlm({ baseUrl: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY, model: env.LLM_MODEL });
  const app = createApp({
    db: createDb({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_KEY }),
    llm,
    config: {
      corsOrigins: env.CORS_ORIGINS,
      apiKey: env.API_KEY,
      dev: env.NODE_ENV !== 'production',
    },
  });
  const port = Number(env.PORT) || 3000;
  // Log which features are on, never the values.
  app.listen(port, () => console.log(JSON.stringify({
    msg: 'listening', port, llm: llm.configured,
    apiKey: Boolean(env.API_KEY), dev: env.NODE_ENV !== 'production',
  })));
}
