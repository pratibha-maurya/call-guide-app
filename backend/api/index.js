// Vercel entry point: the same app as server.js, wired from Vercel's env.
import { createApp } from '../server.js';
import { createDb } from '../db.js';
import { createLlm } from '../llm.js';

const env = process.env;

export default createApp({
  db: createDb({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_KEY }),
  llm: createLlm({ baseUrl: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY, model: env.LLM_MODEL }),
  config: {
    corsOrigins: env.CORS_ORIGINS,
    apiKey: env.API_KEY,
    dev: env.NODE_ENV !== 'production',
  },
});
