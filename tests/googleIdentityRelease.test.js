import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, randomBytes } from 'node:crypto';
import { verifyGoogleIdToken, AuthError } from '../server/googleIdentity.js';
import {
  makeSessionCookie, readSession, isSameOriginRequest,
} from '../server/sessionCookie.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'release-audit-key', use: 'sig', alg: 'RS256' };
const aud = 'release-audit-client.apps.googleusercontent.com';
const env = { GOOGLE_CLIENT_ID: aud, GOOGLE_DRIVE_OWNER_EMAIL: 'teacher@gmail.com' };
const now = Math.floor(Date.now() / 1000);
const validClaims = {
  iss: 'https://accounts.google.com',
  aud,
  exp: now + 3600,
  iat: now - 30,
  sub: '123456789123456789',
  email: 'teacher@gmail.com',
  email_verified: true,
  name: 'Giáo viên kiểm thử',
};

function issueToken(claims = validClaims) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const message = header + '.' + payload;
  return message + '.' + sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url');
}

test('Google identity accepts only a correctly signed Google ID token and the configured audience', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://www.googleapis.com/oauth2/v3/certs');
    requests += 1;
    return {
      ok: true,
      headers: { get: () => 'public, max-age=600' },
      json: async () => ({ keys: [jwk] }),
    };
  };
  try {
    const account = await verifyGoogleIdToken(issueToken(), env);
    assert.equal(account.userId, validClaims.sub);
    assert.equal(account.role, 'teacher');
    assert.equal(requests, 1);
    await assert.rejects(verifyGoogleIdToken(issueToken({ ...validClaims, aud: 'wrong-client' }), env), AuthError);
    await assert.rejects(verifyGoogleIdToken(issueToken({ ...validClaims, iss: 'https://evil.example.test' }), env), AuthError);
    await assert.rejects(verifyGoogleIdToken(issueToken({ ...validClaims, exp: now - 10 }), env), AuthError);
    await assert.rejects(verifyGoogleIdToken(issueToken({ ...validClaims, email_verified: false }), env), AuthError);
    await assert.rejects(verifyGoogleIdToken(issueToken({ ...validClaims, email: 'external@example.org', hd: undefined }), env), AuthError);
    const tampered = issueToken().split('.');
    tampered[1] = Buffer.from(JSON.stringify({ ...validClaims, sub: '99999999999' })).toString('base64url');
    await assert.rejects(verifyGoogleIdToken(tampered.join('.'), env), AuthError);
    const learner = await verifyGoogleIdToken(issueToken({ ...validClaims, email: 'learner@gmail.com' }), env);
    assert.equal(learner.role, 'learner');
  } finally {
    globalThis.fetch = original;
  }
});

test('signed session cookie rejects tampering and cross-origin requests', () => {
  const secret = randomBytes(48).toString('base64');
  const keyEnv = { SPEAKLAB_SESSION_SECRET: secret };
  const cookie = makeSessionCookie({
    userId: validClaims.sub, displayName: validClaims.name, role: 'teacher',
    expiresAt: now + 3600,
  }, keyEnv);
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /SameSite=Lax/u);
  assert.match(cookie, /Secure/u);
  const serialized = cookie.split(';')[0];
  assert.equal(readSession({ headers: { cookie: serialized } }, keyEnv)?.id, validClaims.sub);
  const [name, value] = serialized.split('=');
  const [data, signature] = value.split('.');
  assert.equal(readSession({ headers: { cookie: name + '=' + data + '.AAAA' } }, keyEnv), null);
  assert.equal(readSession({ headers: { cookie: serialized } }, { SPEAKLAB_SESSION_SECRET: randomBytes(48).toString('base64') }), null);
  assert.equal(Boolean(signature), true);

  const base = {
    host: 'preview.example.test',
    origin: 'https://preview.example.test',
    'x-forwarded-proto': 'https',
    'sec-fetch-site': 'same-origin',
  };
  assert.equal(isSameOriginRequest({ headers: base }), true);
  assert.equal(isSameOriginRequest({ headers: { ...base, origin: 'https://outside.example.test' } }), false);
  assert.equal(isSameOriginRequest({ headers: { ...base, 'x-forwarded-proto': 'http' } }), false);
  assert.equal(isSameOriginRequest({ headers: { ...base, 'sec-fetch-site': 'cross-site' } }), false);
});
