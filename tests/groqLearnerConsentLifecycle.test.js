import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createLearnerConsentHandler,
  requestLearnerConsentReview, readLearnerConsentStatus, withdrawLearnerConsent,
} from '../api/ai/groq-consent.js';
import { learnerGroqGrantKey } from '../server/groqLearnerConsentGate.js';
const env = {
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  SPEAKLAB_GROQ_CONSENT_REQUESTS_ENABLED: 'true',
  SPEAKLAB_RATE_LIMIT_REST_URL: 'https://redis.example',
  SPEAKLAB_RATE_LIMIT_REST_TOKEN: 'dummy_redis_token',
  SPEAKLAB_SESSION_SECRET: Buffer.alloc(48, 3).toString('base64'),
};
const student = { id: '12345678901234', role: 'learner' };
const headers = {
  origin: 'https://preview.example', host: 'preview.example', 'x-forwarded-proto': 'https',
  'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
};
function res() { return {
  code: 200, value: null, setHeader() {}, status(x) { this.code = x; return this; },
  json(x) { this.value = x; return this; },
}; }
const mockFetcher = ({ grant = null, pending = null, evalCode = 1 } = {}) => {
  const calls = [];
  return {
    calls,
    fetcher: async (_, options) => {
      const args = JSON.parse(options.body);
      calls.push(args);
      const action = args[0];
      const result = action === 'GET' ? (args[1].includes('student-consent-request') ? pending : grant) :
        action === 'SET' ? 'OK' : action === 'EVAL' ? evalCode : undefined;
      return { ok: true, json: async () => ({ result }) };
    },
  };
};
test('request: student produces only pending status; never writes verified grant or calls Groq', async () => {
  const mock = mockFetcher();
  const result = await requestLearnerConsentReview({ identity: student, env,
    now: () => 1800000000000, fetcher: mock.fetcher });
  assert.deepEqual(result, { status: 'pending_verification', created: true });
  assert.deepEqual(mock.calls.map(x => x[0]), ['GET', 'SET']);
  assert.ok(mock.calls[1][1].includes('student-consent-request'));
  assert.ok(!JSON.stringify(mock.calls).includes('guardianVerification'));
  assert.ok(!JSON.stringify(mock.calls).includes('transcript'));
  assert.equal(mock.calls[1][4], 'NX');
  assert.equal(mock.calls[1][5], 'EX');
});
test('request: denied if operator has not enabled consent requests or a grant already exists', async () => {
  const a = mockFetcher();
  await assert.rejects(requestLearnerConsentReview({
    identity: student, env: { ...env, SPEAKLAB_GROQ_CONSENT_REQUESTS_ENABLED: undefined },
    fetcher: a.fetcher,
  }));
  assert.deepEqual(a.calls, []);
  const b = mockFetcher({ grant: JSON.stringify({ status: 'verified' }) });
  await assert.rejects(requestLearnerConsentReview({ identity: student, env,
    fetcher: b.fetcher }), { status: 409 });
  assert.deepEqual(b.calls.map(x => x[0]), ['GET']);
});
test('withdraw: atomic, removes pending and revokes verified record while preserving TTL', async () => {
  const m = mockFetcher();
  const result = await withdrawLearnerConsent({ identity: student, env, fetcher: m.fetcher,
    now: () => 1800000000000 });
  assert.equal(result.status, 'withdrawn');
  const args = m.calls[0];
  assert.equal(args[0], 'EVAL');
  assert.equal(args[2], '2');
  assert.equal(args[3], learnerGroqGrantKey(student.id, env.SPEAKLAB_SESSION_SECRET));
  assert.ok(args[4].includes('student-consent-request'));
  assert.ok(args[1].includes("record.status = 'revoked'"));
  assert.ok(args[1].includes("'KEEPTTL'"));
  assert.ok(args[1].includes("redis.call('DEL', KEYS[2])"));
});
test('status: neither existing pending nor revoked records are reported as Groq enabled', async () => {
  const a = mockFetcher({ pending: '1800000000000' });
  const pending = await readLearnerConsentStatus({ identity: student, env, fetcher: a.fetcher });
  assert.equal(pending.status, 'pending_verification');
  assert.equal(pending.canUseGroq, false);
  const b = mockFetcher({ grant: JSON.stringify({ status: 'revoked', revokedAt: 1800000000000 }) });
  const revoked = await readLearnerConsentStatus({ identity: student, env, fetcher: b.fetcher });
  assert.equal(revoked.status, 'withdrawn');
  assert.equal(revoked.canUseGroq, false);
});
test('route: no guest, teacher, wrong origin or production access; no user ID accepted from client', async () => {
  for (const [who, activeEnv, requestHeaders, code] of [
    [null, env, headers, 401],
    [{ ...student, role: 'teacher' }, env, headers, 403],
    [student, { ...env, VERCEL_ENV: 'production' }, headers, 404],
    [student, env, { ...headers, origin: 'https://evil.example' }, 403],
  ]) {
    const handler = createLearnerConsentHandler({ env: activeEnv, sessionReader: () => who,
      requester: async () => { throw Error('must not execute'); } });
    const result = res();
    await handler({ method: 'POST', headers: requestHeaders, body: { action: 'request' } }, result);
    assert.equal(result.code, code);
  }
  const h = createLearnerConsentHandler({ env, sessionReader: () => student,
    requester: async () => { throw Error('must not execute'); } });
  const result = res();
  await h({ method: 'POST', headers, body: { action: 'request', studentId: 'someone_else' } }, result);
  assert.equal(result.code, 400);
});
test('route: consent request and withdrawal call only their respective server actions', async () => {
  const events = [];
  const h = createLearnerConsentHandler({ env, sessionReader: () => student,
    statusReader: async () => ({ status: 'not_requested', requestsEnabled: true }),
    requester: async () => { events.push('request'); return { status: 'pending_verification' }; },
    withdrawer: async () => { events.push('withdraw'); return { status: 'withdrawn' }; },
  });
  for (const [method, body, expected] of [
    ['GET', undefined, 'not_requested'],
    ['POST', { action: 'request' }, 'pending_verification'],
    ['POST', { action: 'withdraw' }, 'withdrawn'],
  ]) {
    const r = res(); await h({ method, headers, body }, r);
    assert.equal(r.code, 200);
    assert.equal(r.value.status, expected);
  }
  assert.deepEqual(events, ['request','withdraw']);
});
test('client: request and withdraw visible only in existing History AI review panel, not dashboard', () => {
  const panel = readFileSync(new URL('../src/features/history/AiSpeechReviewPanel.tsx', import.meta.url), 'utf8');
  assert.ok(panel.includes('/api/ai/groq-consent'));
  assert.ok(panel.includes('Gửi yêu cầu xét duyệt'));
  assert.ok(panel.includes('Thu hồi yêu cầu / quyền Groq'));
  assert.ok(panel.includes("setStudentGroqReady(false)"));
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(!app.includes('/api/ai/groq-consent'));
});
