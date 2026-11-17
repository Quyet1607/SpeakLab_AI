import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilotHandler } from '../api/groq/pilot.js';
import { makeSessionCookie } from '../server/sessionCookie.js';

const secret = Buffer.alloc(32, 39).toString('base64');
const env = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  SPEAKLAB_SESSION_SECRET: secret,
  GROQ_API_KEY: 'MOCK_GROQ_KEY_NEVER_REAL',
};
const valid = { syntheticOnly: true, confirmOneCall: true };
const now = () => Math.floor(Date.now() / 1000);
function signedCookie(role = 'teacher', expiresAt = now() + 3600) {
  return makeSessionCookie({
    userId: '12345678901234567890',
    displayName: 'Test Operator',
    role,
    expiresAt,
  }, env).split(';')[0];
}
function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}
function suite(overrideEnv = env) {
  const events = [];
  const handler = createPilotHandler({
    env: overrideEnv,
    quotaConfigured: () => {},
    quotaReserver: async ({ identity }) => {
      events.push('reserve:' + identity.role);
      return { release: async () => { events.push('release'); return true; } };
    },
    pilotRunner: async ({ apiKey }) => {
      assert.equal(apiKey, env.GROQ_API_KEY);
      events.push('groq');
      return { review: { criteria: [], summary: 'MOCK', limitations: 'MOCK' } };
    },
  });
  return {
    events,
    async call({
      method = 'POST',
      cookie = signedCookie(),
      body = valid,
      origin = 'https://preview.example',
      host = 'preview.example',
      fetchSite = 'same-origin',
      proto = 'https',
      contentType = 'application/json',
    } = {}) {
      const req = {
        method,
        headers: {
          cookie,
          origin,
          host,
          'x-forwarded-proto': proto,
          'sec-fetch-site': fetchSite,
          'content-type': contentType,
        },
        body,
      };
      const res = response();
      await handler(req, res);
      return res;
    },
  };
}

test('2.7.2: signed teacher can read config and perform exactly one synthetic call', async () => {
  const h = suite();
  const readiness = await h.call({ method: 'GET' });
  assert.equal(readiness.statusCode, 200);
  assert.equal(readiness.body.ready, true);
  assert.equal(readiness.body.syntheticOnly, true);
  assert.deepEqual(h.events, []);
  const invoked = await h.call();
  assert.equal(invoked.statusCode, 200);
  assert.equal(invoked.body.syntheticOnly, true);
  assert.deepEqual(h.events, ['reserve:teacher', 'groq', 'release']);
});

test('2.7.2: guest, learner and expired sessions are rejected on both API methods', async () => {
  const h = suite();
  const identities = [
    ['guest', '', 401],
    ['learner', signedCookie('learner'), 403],
    ['expired teacher', signedCookie('teacher', now() - 10), 401],
    ['bogus cookie', '__Host-speaklab-session=not-valid', 401],
  ];
  for (const [label, cookie, expected] of identities) {
    for (const method of ['GET', 'POST']) {
      const res = await h.call({ cookie, method });
      assert.equal(res.statusCode, expected, label + ' ' + method);
      assert.notEqual(res.body.ready, true);
    }
  }
  assert.deepEqual(h.events, []);
});

test('2.7.2: modifying signed learner cookie to teacher does not elevate privileges', async () => {
  const original = signedCookie('learner');
  const [cookieName, token] = original.split('=');
  const [payload, mac] = token.split('.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  assert.equal(parsed.role, 'learner');
  parsed.role = 'teacher';
  const forged = cookieName + '=' + Buffer.from(JSON.stringify(parsed)).toString('base64url') + '.' + mac;
  const h = suite();
  assert.equal((await h.call({ cookie: forged, method: 'GET' })).statusCode, 401);
  assert.equal((await h.call({ cookie: forged, method: 'POST' })).statusCode, 401);
  assert.deepEqual(h.events, []);
});

test('2.7.2: Production, incorrect branch and missing deployment context block teacher access', async () => {
  for (const changes of [
    { VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'development' },
    { VERCEL_ENV: undefined },
    { VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL_GIT_COMMIT_REF: 'feature/not-allowed' },
    { VERCEL_GIT_COMMIT_REF: undefined },
  ]) {
    const h = suite({ ...env, ...changes });
    for (const method of ['GET', 'POST']) {
      const res = await h.call({ method });
      assert.equal(res.statusCode, 404, JSON.stringify(changes));
    }
    assert.deepEqual(h.events, []);
  }
});

test('2.7.2: cross-origin and forged transport never trigger Redis or Groq', async () => {
  const h = suite();
  for (const args of [
    { origin: 'https://attacker.example' },
    { origin: 'http://preview.example' },
    { origin: '' },
    { host: 'other.example' },
    { proto: 'http' },
    { fetchSite: 'cross-site' },
  ]) {
    assert.equal((await h.call(args)).statusCode, 403, JSON.stringify(args));
  }
  assert.deepEqual(h.events, []);
});

test('2.7.2: synthetic-only command cannot be turned into student assessment', async () => {
  const h = suite();
  for (const body of [
    { ...valid, transcript: 'Bài nói học sinh' },
    { ...valid, slides: ['Lớp học'] },
    { ...valid, sessionId: 'student-session' },
    { ...valid, topic: 'Bài thật' },
    { ...valid, consent: true },
    { syntheticOnly: false, confirmOneCall: true },
    { syntheticOnly: true, confirmOneCall: false },
  ]) {
    assert.equal((await h.call({ body })).statusCode, 400);
  }
  assert.deepEqual(h.events, []);
});

test('2.7.2: invalid HTTP method or media type do not consume quota', async () => {
  const h = suite();
  const method = await h.call({ method: 'PUT' });
  assert.equal(method.statusCode, 405);
  assert.equal(method.headers.Allow, 'GET, POST');
  assert.equal((await h.call({ contentType: 'text/plain' })).statusCode, 415);
  assert.deepEqual(h.events, []);
});
