// Picks the real client when VITE_API_URL is set, otherwise the in-memory mock.
import * as client from './client.js';
import * as mock from './mock.js';

export const usingMock = !import.meta.env.VITE_API_URL;
export const api = usingMock ? mock : client;
