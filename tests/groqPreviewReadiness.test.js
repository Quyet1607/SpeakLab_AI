import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilotHandler } from '../api/groq/pilot.js';
import { makeSessionCookie, readSession } from '../server/sessionCookie.js';
import { ensureGroqPilotQuotaConfigured } from '../server/groqPilotQuota.js';

const SESSION_SECRET = Buffer.alloc(32, 7).toString('base64');
const env = Object.freeze({
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  SPEAKLAB_SESSION_SECRET: SESSION_SECRET,
  SPEAKLAB_RATE_LIMIT_REST_URL: 'https://redis-test.example',
  SPEAKLAB_RATE_LIMIT_REST_TOKEN: 'MOCK_REDIS_TOKEN_NOT_REAL',
  GROQ_API_KEY: 'MOCK_GROQ_KEY_NOT_REAL',
});
const account = role => ({
  userId: '123456789012345678901', displayName: 'Operator',
  role, expiresAt: Math.floor(Date.now() / 1000) + 3600,
});
function cookie(role = 'teacher') {
  return makeSessionCookie(account(role), env).split(';')[0];
}
function request({ method = 'GET', cookieValue = cookie(), origin = 'https://pilot.example' } = {}) {
  return {
    method,
    headers: {
      cookie: cookieValue,
      host: 'pilot.example',
      origin,
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: { syntheticOnly: true, confirmOneCall: true },
  };
}
function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}
function harness(overrideEnv = env) {
  const calls = { reserve: 0, groq: 0 };
  const handler = createPilotHandler({
    env: overrideEnv,
    quotaReserver: async () => {
      calls.reserve++;
      return { release: async () => true };
    },
    pilotRunner: async () => {
      calls.groq++;
      return { review: { criteria: [], summary: 'Mock', limitations: 'Mock' } };
    },
  });
  return {
    calls,
    async run(options) {
      const res = response();
      await handler(request(options), res);
      return res;
    },
  };
}

test('2.6.1: signed Google session and complete Preview config enable config-only GET', async () => {
  const h = harness();
  const res = await h.run();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    ready: true,
    model: 'openai/gpt-oss-20b',
    syntheticOnly: true,
    branch: 'feature/groq-synthetic-pilot',
  });
  assert.equal(res.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.equal(res.headers['Vary'], 'Cookie');
  assert.deepEqual(h.calls, { reserve: 0, groq: 0 });
});

test('2.6.1: absent, invalid, expired or learner session cannot use readiness', async () => {
  const h = harness();
  for (const [name, cookieValue, status] of [
    ['guest', '', 401],
    ['invalid signature', cookie().replace(/.$/u, 'x'), 401],
    ['learner role', cookie('learner'), 403],
  ]) {
    const res = await h.run({ cookieValue });
    assert.equal(res.statusCode, status, name);
    assert.equal(res.body.ready, undefined, name);
  }
  const expired = makeSessionCookie({
    ...account('teacher'),
    expiresAt: Math.floor(Date.now() / 1000) - 10,
  }, env).split(';')[0];
  assert.equal(readSession({ headers: { cookie: expired } }, env), null);
  assert.deepEqual(h.calls, { reserve: 0, groq: 0 });
});

test('2.6.1: wrong branch or Production is unavailable even with valid session', async () => {
  for (const patch of [
    { VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'development' },
    { VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL_GIT_COMMIT_REF: '' },
  ]) {
    const h = harness({ ...env, ...patch });
    const res = await h.run();
    assert.equal(res.statusCode, 404);
    assert.deepEqual(h.calls, { reserve: 0, groq: 0 });
  }
});

test('2.6.1: missing Groq key fails without leaking any credential', async () => {
  const h = harness({ ...env, GROQ_API_KEY: '  ' });
  const res = await h.run();
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(res.body), /MOCK_REDIS_TOKEN_NOT_REAL|MOCK_GROQ_KEY_NOT_REAL|redis-test\.example/u);
  assert.deepEqual(h.calls, { reserve: 0, groq: 0 });
});

test('2.6.1: Redis REST configuration must be present and plausible', async () => {
  const cases = [
    { SPEAKLAB_RATE_LIMIT_REST_URL: '' },
    { SPEAKLAB_RATE_LIMIT_REST_URL: 'http://redis-test.example' },
    { SPEAKLAB_RATE_LIMIT_REST_URL: 'https://redis-test.example/secret-path' },
    { SPEAKLAB_RATE_LIMIT_REST_TOKEN: '' },
    { SPEAKLAB_SESSION_SECRET: 'invalid' },
  ];
  for (const patch of cases) {
    assert.throws(() => ensureGroqPilotQuotaConfigured({ ...env, ...patch }));
    const h = harness({ ...env, ...patch });
    const res = await h.run();
    assert.notEqual(res.statusCode, 200, JSON.stringify(Object.keys(patch)));
    assert.deepEqual(h.calls, { reserve: 0, groq: 0 });
  }
});

test('2.6.1: a GET response never proves Redis connectivity or spends a pilot call', async () => {
  const h = harness();
  for (let i = 0; i < 2; i++) {
    assert.equal((await h.run()).statusCode, 200);
  }
  assert.deepEqual(h.calls, { reserve: 0, groq: 0 });
});
