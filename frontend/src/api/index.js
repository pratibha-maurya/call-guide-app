// Real backend by default. The in-memory mock is opt-in (VITE_USE_MOCK=true),
// so a missing VITE_API_URL shows a config error instead of silently faking data.
import * as client from './client.js';
import * as mock from './mock.js';
import { supabaseConfigured } from '../lib/supabase.js';

export const usingMock = import.meta.env.VITE_USE_MOCK === 'true';
export const configError = !usingMock && (!import.meta.env.VITE_API_URL || !supabaseConfigured);
export const api = usingMock ? mock : client;
