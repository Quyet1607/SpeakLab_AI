/**
 * Google Identity Services ID token verification for SpeakLab AI.
 * Server-only. No Google tokens or signing keys are accepted from the browser.
 * Verification uses Google's published rotating public keys.
 */
import { createPublicKey, verify as verifySignature } from 'node:crypto';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const MAX_TOKEN_LENGTH = 12000;
let cachedKeys = null;
let cachedUntil = 0;

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

function parseJwtPart(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new AuthError('Mã đăng nhập Google không hợp lệ.');
  }
}

async function loadGoogleKeys() {
  if (cachedKeys && Date.now() < cachedUntil) return cachedKeys;
  let response;
  try {
    response = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AuthError('Chưa thể kiểm tra chữ ký Google. Vui lòng thử lại.', 503);
  }
  if (!response.ok) throw new AuthError('Không tải được khóa xác thực Google.', 503);
  const result = await response.json();
  if (!Array.isArray(result.keys) || result.keys.length === 0) {
    throw new AuthError('Google trả về danh sách khóa không hợp lệ.', 503);
  }
  const maxAgeMatch = /(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') || '');
  const seconds = maxAgeMatch ? Math.min(3600, Math.max(60, Number(maxAgeMatch[1]))) : 600;
  cachedKeys = result.keys;
  cachedUntil = Date.now() + seconds * 1000;
  return cachedKeys;
}

export async function verifyGoogleIdToken(idToken, env = process.env) {
  const audience = String(env.GOOGLE_CLIENT_ID || '').trim();
  if (!audience) throw new AuthError('Backend chưa cấu hình Google Client ID.', 503);
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > MAX_TOKEN_LENGTH) {
    throw new AuthError('Thiếu mã đăng nhập Google hợp lệ.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) {
    throw new AuthError('Định dạng mã Google không hợp lệ.');
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parseJwtPart(headerPart);
  const payload = parseJwtPart(payloadPart);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new AuthError('Chữ ký Google không được hỗ trợ.');
  }

  let keys = await loadGoogleKeys();
  let key = keys.find(item => item.kid === header.kid && item.kty === 'RSA' && item.use === 'sig');
  if (!key) {
    cachedUntil = 0; // Google can rotate keys before the previous token expires.
    keys = await loadGoogleKeys();
    key = keys.find(item => item.kid === header.kid && item.kty === 'RSA' && item.use === 'sig');
  }
  if (!key) throw new AuthError('Không nhận diện được khóa chữ ký Google.');

  let valid = false;
  try {
    valid = verifySignature(
      'RSA-SHA256',
      Buffer.from(headerPart + '.' + payloadPart, 'utf8'),
      createPublicKey({ key, format: 'jwk' }),
      Buffer.from(signaturePart, 'base64url'),
    );
  } catch {
    throw new AuthError('Không kiểm tra được chữ ký Google.');
  }
  if (!valid) throw new AuthError('Chữ ký Google không hợp lệ.');

  const now = Math.floor(Date.now() / 1000);
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss) ||
      payload.aud !== audience ||
      !Number.isInteger(payload.exp) || payload.exp <= now ||
      (payload.nbf !== undefined && (!Number.isInteger(payload.nbf) || payload.nbf > now + 60)) ||
      !Number.isInteger(payload.iat) || payload.iat > now + 60 ||
      typeof payload.sub !== 'string' || !/^[0-9]{5,64}$/.test(payload.sub) ||
      payload.email_verified !== true ||
      typeof payload.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new AuthError('Thông tin định danh Google không được chấp nhận.');
  }

  // Only accept Google-authoritative identities at this stage; don't trust an
  // arbitrary external email that was verified long ago by a third-party provider.
  const email = payload.email.toLowerCase();
  const googleAuthoritative = email.endsWith('@gmail.com') ||
    (typeof payload.hd === 'string' && payload.hd.length > 0);
  if (!googleAuthoritative) throw new AuthError('Tài khoản email cần được xác minh bổ sung.', 403);

  const ownerEmail = String(env.GOOGLE_DRIVE_OWNER_EMAIL || '').trim().toLowerCase();
  return {
    userId: payload.sub, // Immutable Google subject, NOT user-supplied email or display name.
    email,
    displayName: typeof payload.name === 'string' ? payload.name.slice(0, 160) : '',
    role: ownerEmail && email === ownerEmail ? 'teacher' : 'unregistered',
    expiresAt: payload.exp,
  };
}

export async function requireUser(request, env = process.env) {
  const auth = String(request.headers.authorization || '');
  const match = /^Bearer ([^\s]+)$/.exec(auth);
  if (!match) throw new AuthError('Vui lòng đăng nhập bằng Google.');
  return verifyGoogleIdToken(match[1], env);
}

export function requireEnrolledStudent(user) {
  if (user.role !== 'student' && user.role !== 'teacher') {
    throw new AuthError('Tài khoản chưa được giáo viên thêm vào lớp.', 403);
  }
  return user;
}
