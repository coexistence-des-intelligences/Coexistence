import { rpc } from './supabase.js';

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function pseudonymousSubject(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = (request.headers.get('User-Agent') || '').slice(0, 160);
  const raw = `${ip}|${ua}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.RATE_LIMIT_SECRET || 'dev-only'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
}

export async function enforceRateLimit(request, env, action, limit, windowSeconds) {
  if (!env.SUPABASE_URL || !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) return;
  const subject = await pseudonymousSubject(request, env);
  const result = await rpc(env, 'check_rate_limit', {
    p_subject_hash: subject,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  const row = Array.isArray(result) ? result[0] : result;
  if (row && row.allowed === false) {
    const err = new Error('Trop de requêtes. Réessayez plus tard.');
    err.status = 429;
    throw err;
  }
}

export function obviousPrivacyRisk(text) {
  const s = String(text || '');
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(s);
  const phone = /(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/.test(s);
  const card = /\b(?:\d[ -]*?){13,19}\b/.test(s);
  return email || phone || card;
}

export function publicSecurityHeaders(headers = {}) {
  return {
    ...headers,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'"
  };
}
