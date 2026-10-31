// Vercel entry point: the same app as server.js, wired from Vercel's env.
import { createApp } from '../server.js';
import { createDb } from '../db.js';
import { createAuth } from '../auth.js';
import { createLlm } from '../llm.js';

const env = process.env;

export default createApp({
  db: createDb({ url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY }),
  auth: createAuth({
    url: env.SUPABASE_URL,
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
    allowedEmails: env.ALLOWED_EMAILS,
  }),
  llm: createLlm({ baseUrl: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY, model: env.LLM_MODEL }),
  config: {
    corsOrigins: env.CORS_ORIGINS,
    apiKey: env.API_KEY,
    dev: env.NODE_ENV !== 'production',
  },
});
