/**
 * Admin-only OAuth bootstrap helpers for Google Drive (Phase 3.2C).
 * This module is server-side only. Never import it from src/ (Vite/browser).
 * Does not upload, list, download or delete videos.
 */
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const COOKIE = '__Host-speaklab-drive-setup';
const CALLBACK_PATH = '/api/google-drive/oauth/callback';
const EXPIRY_SECONDS = 600;

export function readOAuthConfig(env = process.env) {
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();
  const setupKey = (env.GOOGLE_OAUTH_SETUP_KEY || '').trim();
  const redirectUri = (env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  const folderId = (env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const ownerEmail = (env.GOOGLE_DRIVE_OWNER_EMAIL || '').trim().toLowerCase();
  if (!clientId || !clientSecret || !redirectUri || !folderId || setupKey.length < 24 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return null;
  let parsed;
  try { parsed = new URL(redirectUri); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.pathname !== CALLBACK_PATH ||
      parsed.search || parsed.hash || parsed.username || parsed.password) return null;
  return { clientId, clientSecret, setupKey, redirectUri, folderId, ownerEmail };
}

export function matchesOAuthOrigin(request, config) {
  // Setup must begin on exactly the same HTTPS origin that receives the callback cookie.
  try {
    const requestUrl = new URL(request.url);
    return requestUrl.origin === new URL(config.redirectUri).origin;
  } catch { return false; }
}

export function safeEquals(actual, expected) {
  const a = createHash('sha256').update(String(actual)).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

function signature(state, key) {
  return createHmac('sha256', key).update(state).digest('base64url');
}

export function makeOAuthState(config, now = Date.now()) {
  const state = randomBytes(24).toString('hex') + '.' + Math.floor(now / 1000);
  const sig = signature(state, config.setupKey);
  return { state, cookie: state + '.' + sig };
}

export function isOAuthStateValid(state, cookie, config, now = Date.now()) {
  if (typeof state !== 'string' || !/^[0-9a-f]{48}\.[0-9]{10}$/.test(state) ||
      typeof cookie !== 'string' || cookie.length > 180) return false;
  const issued = Number(state.split('.')[1]);
  const age = Math.floor(now / 1000) - issued;
  if (age < 0 || age > EXPIRY_SECONDS) return false;
  return safeEquals(cookie, state + '.' + signature(state, config.setupKey));
}

export function readCookie(request, name = COOKIE) {
  const cookies = request.headers.get('cookie') || '';
  const entry = cookies.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return entry ? entry.slice(name.length + 1) : null;
}

export function setStateCookie(value) {
  return COOKIE + '=' + value + '; Path=/; Max-Age=' + EXPIRY_SECONDS +
    '; HttpOnly; Secure; SameSite=Lax';
}

export function clearStateCookie() {
  return COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

export function htmlResponse(status, body, headers = {}) {
  return new Response('<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">' +
    '<title>SpeakLab AI · Thiết lập Google Drive</title>' +
    '<style>body{background:#F7F9F6;color:#3D4740;font:16px system-ui,sans-serif;margin:0;padding:32px}' +
    'main{max-width:650px;margin:32px auto;padding:28px;background:#fff;border:1px solid #E4E9E3;border-radius:14px}' +
    'input,textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid #AFC5B6;border-radius:6px;font:14px system-ui,sans-serif}' +
    'button{background:#52785D;border:0;border-radius:7px;color:#fff;padding:12px 18px;margin-top:15px;cursor:pointer}' +
    'p{line-height:1.6}.warning{color:#873631}code{word-break:break-all}</style></head><body><main>' +
    body + '</main></body></html>', {
    status,
    headers: {
      'Content-Type':'text/html; charset=utf-8',
      'Cache-Control':'no-store, private, max-age=0',
      'Pragma':'no-cache',
      'Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff',
      'X-Frame-Options':'DENY',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      ...headers,
    },
  });
}

export function unconfiguredResponse() {
  return htmlResponse(503, '<h2>Chưa hoàn tất cấu hình backend</h2>' +
    '<p>Hãy thiết lập các biến <code>GOOGLE_CLIENT_SECRET</code>, ' +
    '<code>GOOGLE_OAUTH_SETUP_KEY</code>, <code>GOOGLE_OAUTH_REDIRECT_URI</code>, ' +
    '<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_DRIVE_FOLDER_ID</code> và ' +
    '<code>GOOGLE_DRIVE_OWNER_EMAIL</code> chỉ trong Vercel Preview.</p>' +
    '<p>Chưa có thao tác nào được thực hiện với Google Drive.</p>');
}

export function wrongOriginResponse() {
  return htmlResponse(400, '<h2>Sai địa chỉ triển khai</h2>' +
    '<p>Hãy mở chức năng thiết lập OAuth trên đúng tên miền Preview trùng với ' +
    '<code>GOOGLE_OAUTH_REDIRECT_URI</code>. Không dùng tên miền Production khi ' +
    'đang cấu hình chỉ cho nhánh Preview.</p>');
}


/** Fail closed if someone opens the endpoint via a different deploy, domain or HTTP origin. */
export function isExpectedServerOrigin(request, config) {
  const expected = new URL(config.redirectUri);
  const actualHost = String(request.headers.host || '').toLowerCase();
  const forwardedProto = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return forwardedProto === 'https' && actualHost === expected.host.toLowerCase();
}

/** Convert a Web Response from the shared HTML helper into a Vercel Node response. */
export async function sendWebResponse(nodeResponse, webResponse) {
  nodeResponse.statusCode = webResponse.status;
  for (const [name, value] of webResponse.headers) nodeResponse.setHeader(name, value);
  nodeResponse.end(await webResponse.text());
}
