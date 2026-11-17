import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilotHandler } from '../api/groq/pilot.js';

const env = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  GROQ_API_KEY: 'MOCK_ONLY_NOT_A_SECRET',
};
const baseHeaders = {
  origin: 'https://pilot.vercel.app',
  host: 'pilot.vercel.app',
  'x-forwarded-proto': 'https',
  'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
};
const validCommand = { syntheticOnly: true, confirmOneCall: true };

function makeResponse() {
  return {
    code: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
async function runRequest(handler, { method = 'POST', body = validCommand, headers = {} } = {}) {
  const response = makeResponse();
  await handler({ method, headers: { ...baseHeaders, ...headers }, body }, response);
  return response;
}
function spyHandler(overrides = {}) {
  const calls = { quota: 0, groq: 0 };
  const handler = createPilotHandler({
    env,
    sessionReader: () => ({ id: 'teacher-mock', role: 'teacher' }),
    quotaConfigured: () => {},
    quotaReserver: async () => {
      calls.quota += 1;
      return { release: async () => true };
    },
    pilotRunner: async () => {
      calls.groq += 1;
      return { review: { criteria: [], summary: 'Synthetic', limitations: 'Text only' } };
    },
    ...overrides,
  });
  return { handler, calls };
}

test('all student-like inputs are rejected before Redis and Groq', async () => {
  const fields = [
    ['transcript', 'Em tên là Nguyễn Văn A, lớp 8A'],
    ['slides', ['Trường THCS X']],
    ['topic', 'Học sinh lớp 8'],
    ['studentId', 'student-123'],
    ['email', 'learner@example.com'],
    ['video', 'data:video/mp4;base64,AAAA'],
    ['consent', true],
    ['sessionId', 'student-session'],
    ['prompt', 'Please assess my presentation'],
    ['messages', [{ role: 'user', content: 'Student speech' }]],
  ];
  const { handler, calls } = spyHandler();
  for (const [key, value] of fields) {
    const response = await runRequest(handler, { body: { ...validCommand, [key]: value } });
    assert.equal(response.code, 400, `Expected rejection for ${key}`);
    assert.doesNotMatch(JSON.stringify(response.body), /Nguyễn Văn A|Trường THCS X|learner@example.com|student-session/u);
  }
  assert.deepEqual(calls, { quota: 0, groq: 0 });
});

test('only the exact synthetic command is accepted', async () => {
  const { handler, calls } = spyHandler();
  const malformed = [
    {}, { syntheticOnly: true }, { confirmOneCall: true },
    { syntheticOnly: 'true', confirmOneCall: true },
    { syntheticOnly: true, confirmOneCall: 1 },
    null, [], [validCommand],
    { ...validCommand, extra: undefined },
  ];
  for (const body of malformed) {
    assert.equal((await runRequest(handler, { body })).code, 400);
  }
  assert.deepEqual(calls, { quota: 0, groq: 0 });
  assert.equal((await runRequest(handler)).code, 200);
  assert.deepEqual(calls, { quota: 1, groq: 1 });
});

test('guest and learner are blocked from both readiness and execution', async () => {
  for (const [identity, status] of [[null, 401], [{ id: 'learner', role: 'learner' }, 403]]) {
    const { handler, calls } = spyHandler({ sessionReader: () => identity });
    assert.equal((await runRequest(handler, { method: 'GET' })).code, status);
    assert.equal((await runRequest(handler)).code, status);
    assert.deepEqual(calls, { quota: 0, groq: 0 });
  }
});

test('production, incorrect preview branch and forged origin fail closed', async () => {
  for (const changedEnv of [
    { ...env, VERCEL_ENV: 'production' },
    { ...env, VERCEL_GIT_COMMIT_REF: 'main' },
    { ...env, VERCEL_GIT_COMMIT_REF: '' },
  ]) {
    const { handler, calls } = spyHandler({ env: changedEnv });
    assert.equal((await runRequest(handler)).code, 404);
    assert.deepEqual(calls, { quota: 0, groq: 0 });
  }
  const { handler, calls } = spyHandler();
  assert.equal((await runRequest(handler, { headers: { origin: 'https://attacker.example' } })).code, 403);
  assert.deepEqual(calls, { quota: 0, groq: 0 });
});

test('invalid content type and oversized declared body cannot reach Groq', async () => {
  const { handler, calls } = spyHandler();
  assert.equal((await runRequest(handler, { headers: { 'content-type': 'text/plain' } })).code, 415);
  assert.equal((await runRequest(handler, { headers: { 'content-length': '257' } })).code, 415);
  assert.deepEqual(calls, { quota: 0, groq: 0 });
});
