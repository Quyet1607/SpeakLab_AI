import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  requireVerifiedLearnerGroqGrant, learnerGroqGrantKey,
} from '../server/groqLearnerConsentGate.js';
import { createLearnerGroqReviewHandler } from '../api/ai/groq-review.js';

const env = {
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  SPEAKLAB_GROQ_STUDENT_REVIEW_ENABLED: 'true',
  SPEAKLAB_RATE_LIMIT_REST_URL: 'https://redis.example',
  SPEAKLAB_RATE_LIMIT_REST_TOKEN: 'REDIS_TEST_TOKEN',
  SPEAKLAB_SESSION_SECRET: Buffer.alloc(48, 1).toString('base64'),
  GROQ_API_KEY: 'GROQ_TEST_TOKEN',
};
const identity = { id: '12345678901234', role: 'learner' };
const now = 1800000000000;
function grant(overrides = {}) {
  const hash = createHmac('sha256', env.SPEAKLAB_SESSION_SECRET).update(identity.id).digest('hex');
  return {
    version: 'speaklab-groq-student-review-v1',
    provider: 'groq', purpose: 'student-presentation-text-review',
    status: 'verified', guardianVerification: 'verified-by-authorized-operator',
    operatorApproval: 'approved', subjectRole: 'learner', studentSubjectHash: hash,
    dataTypes: ['topic_and_goal', 'asr_transcript', 'slide_text'],
    policyVersion: 'groq-student-notice-v1',
    verifiedAt: now - 1000, expiresAt: now + 3600000,
    revokedAt: null, verificationReference: 'approvedCase_ABCD0123',
    ...overrides,
  };
}
const fetchGrant = record => async (url, options) => {
  assert.equal(url, env.SPEAKLAB_RATE_LIMIT_REST_URL);
  const args = JSON.parse(options.body);
  assert.equal(args[0], 'GET');
  assert.equal(args[1], learnerGroqGrantKey(identity.id, env.SPEAKLAB_SESSION_SECRET));
  return { ok: true, json: async () => ({ result: record === null ? null : JSON.stringify(record) }) };
};

test('student consent gate: only server-side scoped, verified, current grant passes', async () => {
  const result = await requireVerifiedLearnerGroqGrant({ identity, env, now: () => now,
    fetcher: fetchGrant(grant()) });
  assert.equal(result.policyVersion, 'groq-student-notice-v1');
});

test('student consent gate: missing, expired, revoked, forged or wrong-scope grant fails closed', async () => {
  const records = [
    null,
    grant({ status: 'pending' }),
    grant({ guardianVerification: 'self-asserted' }),
    grant({ operatorApproval: 'pending' }),
    grant({ revokedAt: now - 5000 }),
    grant({ expiresAt: now - 1 }),
    grant({ verifiedAt: now + 1000 }),
    grant({ subjectRole: 'teacher' }),
    grant({ studentSubjectHash: 'wrong' }),
    grant({ provider: 'gemini' }),
    grant({ purpose: 'generic-chat' }),
    grant({ policyVersion: '' }),
    grant({ verificationReference: 'invalid' }),
    grant({ dataTypes: ['asr_transcript'] }),
  ];
  for (const record of records) {
    await assert.rejects(requireVerifiedLearnerGroqGrant({
      identity, env, now: () => now, fetcher: fetchGrant(record),
    }), { code: 'GROQ_STUDENT_GRANT_REQUIRED' });
  }
});
test('student consent gate: disabled / Production / missing Redis are fail-closed', async () => {
  for (const changed of [
    { ...env, SPEAKLAB_GROQ_STUDENT_REVIEW_ENABLED: undefined },
    { ...env, VERCEL_ENV: 'production' },
    { ...env, VERCEL_GIT_COMMIT_REF: 'main' },
    { ...env, SPEAKLAB_RATE_LIMIT_REST_TOKEN: '' },
  ]) {
    await assert.rejects(requireVerifiedLearnerGroqGrant({
      identity, env: changed, fetcher: () => { throw Error('Should not fetch'); },
    }), { code: 'GROQ_STUDENT_GRANT_REQUIRED' });
  }
});
test('student consent gate: Redis failure is not treated as approval', async () => {
  await assert.rejects(requireVerifiedLearnerGroqGrant({
    identity, env, fetcher: async () => { throw Error('Redis down'); },
  }), { code: 'GROQ_STUDENT_GRANT_REQUIRED' });
});

const sample = {
  consent: true, sessionId: 'ses_student_12345', topic: 'Giao thông bền vững',
  topicDescription: 'Các lựa chọn di chuyển phù hợp',
  speakingGoal: 'Đề xuất hai cách đi lại ít phát thải',
  transcript: 'Tôi trình bày hai cách đi lại bền vững. ' +
    'Thứ nhất có thể đi xe đạp ở quãng ngắn để giảm nhiên liệu. ' +
    'Thứ hai có thể chọn xe buýt khi có tuyến phù hợp. ' +
    'Hiện tôi chưa có số liệu để chứng minh mức giảm phát thải cụ thể.',
  slides: [{ number: 1, text: 'Đi xe đạp cho quãng đường ngắn' }],
};
const headers = { origin: 'https://preview.example', host: 'preview.example',
  'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' };
function makeRes() { return {
  statusCode: 200, body: null, setHeader() {},
  status(x) { this.statusCode = x; return this; },
  json(x) { this.body = x; return this; },
}; }
async function go({ body = sample, method = 'POST', activeEnv = env,
  who = identity, gate = async () => ({ policyVersion: 'groq-student-notice-v1' }),
  origin = headers.origin, runnerError } = {}) {
  const events = [];
  const h = createLearnerGroqReviewHandler({
    env: activeEnv, sessionReader: () => who,
    grantReader: async () => { events.push('grant'); return gate(); },
    quotaConfigured: () => { events.push('quota-config'); },
    reserveQuota: async () => {
      events.push('reserve');
      return { release: async () => { events.push('release'); } };
    },
    runner: async ({ input }) => {
      events.push('groq');
      assert.equal(input.transcript, sample.transcript);
      if (runnerError) throw runnerError;
      return { model: 'groq-mock', review: { summary: 'Review', strengths: [], improvements: [] } };
    },
  });
  const res = makeRes();
  await h({ method, headers: { ...headers, origin }, body }, res);
  return { res, events };
}
test('student Groq route: default-off even with checkbox, no provider or quota', async () => {
  const { res, events } = await go({ activeEnv: { ...env,
    SPEAKLAB_GROQ_STUDENT_REVIEW_ENABLED: undefined } });
  assert.equal(res.statusCode, 403);
  assert.deepEqual(events, []);
});
test('student Groq route: learner GET readiness checks grant without quota', async () => {
  const a = await go({ method: 'GET' });
  assert.equal(a.res.body.ready, true);
  assert.deepEqual(a.events, ['grant']);
  const b = await go({ method: 'GET', gate: async () => { throw Error('revoked'); } });
  assert.equal(b.res.body.ready, false);
  assert.deepEqual(b.events, ['grant']);
});
test('student Groq route: missing consent, guest, teacher and wrong origin block before quota', async () => {
  for (const options of [
    { who: null }, { who: { id: '9876543210', role: 'teacher' } },
    { body: { ...sample, consent: false } }, { body: { ...sample, studentId: 's1' } },
    { origin: 'https://evil.example' },
    { gate: async () => { throw Error('revoked'); } },
  ]) {
    const { res, events } = await go(options);
    assert.ok(res.statusCode >= 400);
    assert.ok(!events.includes('reserve'));
    assert.ok(!events.includes('groq'));
  }
});
test('student Groq route: one reserve, one Groq call, always release', async () => {
  const { res, events } = await go();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(events, ['grant','quota-config','reserve','groq','release']);
});
test('student Groq route: provider error does not retry or leak input', async () => {
  const e = Object.assign(new Error(sample.transcript), { code: 'GROQ_INVALID_REVIEW' });
  const { res, events } = await go({ runnerError: e });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(events, ['grant','quota-config','reserve','groq','release']);
  assert.doesNotMatch(JSON.stringify(res.body), /Tôi trình bày/u);
});
test('student Groq route: email in slide text blocks before quota', async () => {
  const { res, events } = await go({ body: { ...sample, slides: [
    { number: 1, text: 'Liên hệ test@example.com để đăng ký.' },
  ] } });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(events, []);
});
