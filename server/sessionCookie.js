/**
 * Short-lived, server-signed identity session for SpeakLab.
 * This is authentication only; it does not grant access to Google Drive.
 * Signed with a separate high-entropy secret held only on the server.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = '__Host-speaklab-session';
const MAX_AGE_SECONDS = 8 * 60 * 60;

export function sessionConfigured(env = process.env) {
  return typeof env.SPEAKLAB_SESSION_SECRET === 'string' &&
    env.SPEAKLAB_SESSION_SECRET.trim().length >= 43;
}

function getKey(env) {
  if (!sessionConfigured(env)) return null;
  const raw = env.SPEAKLAB_SESSION_SECRET.trim();
  if (!/^[A-Za-z0-9+/_=-]{43,128}$/.test(raw)) return null;
  let bytes;
  try { bytes = Buffer.from(raw, 'base64'); } catch { return null; }
  return bytes.length >= 32 ? bytes : null;
}

function mac(value, key) {
  return createHmac('sha256', key).update(value).digest('base64url');
}

export function makeSessionCookie(account, env = process.env) {
  const key = getKey(env);
  if (!key) throw new Error('SPEAKLAB_SESSION_SECRET invalid');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: account.userId,
    name: account.displayName || '',
    role: account.role,
    iat: now,
    exp: Math.min(now + MAX_AGE_SECONDS, account.expiresAt),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = data + '.' + mac(data, key);
  return COOKIE_NAME + '=' + token + '; Path=/; Max-Age=' +
    Math.max(1, payload.exp - now) + '; Secure; HttpOnly; SameSite=Lax';
}

export function clearSessionCookie() {
  return COOKIE_NAME + '=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax';
}

export function readSession(req, env = process.env) {
  const key = getKey(env);
  if (!key) return null;
  const cookies = String(req.headers.cookie || '').split(';');
  const pair = cookies.map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + '='));
  if (!pair) return null;
  const token = pair.slice(COOKIE_NAME.length + 1);
  if (token.length > 2400) return null;
  const [data, signature, more] = token.split('.');
  if (!data || !signature || more || !/^[A-Za-z0-9_-]+$/.test(data) ||
      !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  const expected = Buffer.from(mac(data, key));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== 'string' || !/^[0-9]{5,64}$/.test(payload.sub) ||
        typeof payload.name !== 'string' || payload.name.length > 160 ||
        !['teacher', 'unregistered'].includes(payload.role) ||
        !Number.isInteger(payload.exp) || payload.exp <= now ||
        !Number.isInteger(payload.iat) || payload.iat > now + 60 ||
        payload.exp - payload.iat > MAX_AGE_SECONDS) return null;
    return { id: payload.sub, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

export function isSameOriginRequest(req) {
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return proto === 'https' && Boolean(host) &&
    origin === 'https://' + host &&
    String(req.headers['sec-fetch-site'] || 'same-origin') !== 'cross-site';
}
