import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilotHandler } from '../api/groq/pilot.js';
import { requestGroqReview } from '../server/groqReviewProvider.js';
import { reserveGroqPilotQuota } from '../server/groqPilotQuota.js';

const MOCK_SECRET = 'SENSITIVE_TEST_KEY_NEVER_SEND_TO_UI';
const env = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  GROQ_API_KEY: MOCK_SECRET,
};
const headers = {
  origin: 'https://pilot.example',
  host: 'pilot.example',
  'x-forwarded-proto': 'https',
  'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
};
function response() {
  return {
    statusCode: 200, body: undefined, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
async function run(opts = {}) {
  let quotaCount = 0;
  let groqCount = 0;
  let releaseCount = 0;
  const handler = createPilotHandler({
    env,
    sessionReader: () => ({ id: 'teacher', role: 'teacher' }),
    sameOrigin: () => true,
    quotaConfigured: () => {},
    quotaReserver: async () => {
      quotaCount++;
      if (opts.quotaError) throw opts.quotaError;
      return { release: async () => { releaseCount++; return true; } };
    },
    pilotRunner: async () => {
      groqCount++;
      if (opts.providerError) throw opts.providerError;
      return { review: { criteria: [], summary: 'test', limitations: 'test' } };
    },
  });
  const res = response();
  await handler({
    method: 'POST',
    headers,
    body: { syntheticOnly: true, confirmOneCall: true },
  }, res);
  return { res, quotaCount, groqCount, releaseCount };
}
const failure = (code, status = 502) =>
  Object.assign(new Error('PRIVATE_PROVIDER_PAYLOAD ' + MOCK_SECRET), { code, status });

test('2.6.4: Redis quota denial never invokes Groq and never reveals Redis error text', async () => {
  const codes = [
    'GROQ_OPERATOR_DAILY_LIMIT',
    'GROQ_SYSTEM_DAILY_LIMIT',
    'GROQ_SYSTEM_MINUTE_LIMIT',
    'GROQ_CONCURRENT_LIMIT',
  ];
  for (const code of codes) {
    const { res, quotaCount, groqCount, releaseCount } =
      await run({ quotaError: failure(code, 429) });
    assert.equal(res.statusCode, 429, code);
    assert.equal(res.body.code, code);
    assert.doesNotMatch(JSON.stringify(res.body), /PRIVATE_PROVIDER_PAYLOAD|SENSITIVE_TEST_KEY/u);
    assert.deepEqual([quotaCount, groqCount, releaseCount], [1, 0, 0]);
  }
  const unknown = await run({ quotaError: failure('INJECTED_UNKNOWN_QUOTA', 429) });
  assert.equal(unknown.res.statusCode, 503);
  assert.equal(unknown.res.body.code, 'QUOTA_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(unknown.res.body), /INJECTED|PRIVATE_PROVIDER/u);
  assert.equal(unknown.groqCount, 0);
});

test('2.6.4: Redis failures fail closed with no Groq request', async () => {
  for (const error of [failure('GROQ_QUOTA_UNAVAILABLE', 503), new Error(MOCK_SECRET)]) {
    const { res, quotaCount, groqCount, releaseCount } = await run({ quotaError: error });
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'QUOTA_UNAVAILABLE');
    assert.deepEqual([quotaCount, groqCount, releaseCount], [1, 0, 0]);
    assert.doesNotMatch(JSON.stringify(res.body), /SENSITIVE_TEST_KEY/u);
  }
});

test('2.6.4: provider failures are sanitized and release their lease once', async () => {
  const cases = [
    ['GROQ_RATE_LIMIT', 429, ''],
    ['GROQ_TIMEOUT', 504, ''],
    ['GROQ_INVALID_RESPONSE', 502, 'INVALID_RESPONSE'],
    ['GROQ_INVALID_REVIEW', 502, 'INVALID_REVIEW'],
    ['GROQ_OUTPUT_LIMIT', 502, 'OUTPUT_LIMIT'],
    ['GROQ_REFUSED', 502, 'PROVIDER_REFUSED'],
    ['GROQ_ACCESS_DENIED', 502, 'PROVIDER_UNAVAILABLE'],
    ['GROQ_MODEL_UNAVAILABLE', 502, 'PROVIDER_UNAVAILABLE'],
    ['GROQ_UPSTREAM_HTTP', 502, 'UPSTREAM_HTTP'],
    ['GROQ_NETWORK', 502, 'GROQ_NETWORK'],
  ];
  for (const [code, expectedStatus, expectedCode] of cases) {
    const { res, quotaCount, groqCount, releaseCount } =
      await run({ providerError: failure(code) });
    assert.equal(res.statusCode, expectedStatus, code);
    if (expectedCode) assert.equal(res.body.code, expectedCode);
    assert.deepEqual([quotaCount, groqCount, releaseCount], [1, 1, 1]);
    assert.doesNotMatch(JSON.stringify(res.body), /PRIVATE_PROVIDER_PAYLOAD|SENSITIVE_TEST_KEY/u);
  }
});

test('2.6.4: malformed request to provider, 429 and malformed JSON never retry', async () => {
  const schema = { type: 'object', properties: { summary: { type: 'string' } } };
  const request = async fetcher => {
    let calls = 0;
    const outcome = await requestGroqReview({
      apiKey: MOCK_SECRET,
      prompt: 'DỮ LIỆU GIẢ LẬP',
      schema,
      fetcher: async (...args) => { calls++; return fetcher(...args); },
    }).catch(error => error);
    return { calls, outcome };
  };
  const scenarios = [
    [async () => ({ ok: false, status: 429 }), 'GROQ_RATE_LIMIT'],
    [async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] }) }), 'GROQ_INVALID_RESPONSE'],
    [async () => { throw new Error(MOCK_SECRET); }, 'GROQ_NETWORK'],
    [async () => { throw Object.assign(new Error(MOCK_SECRET), { name: 'AbortError' }); }, 'GROQ_TIMEOUT'],
  ];
  for (const [fetcher, expectedCode] of scenarios) {
    const { calls, outcome } = await request(fetcher);
    assert.equal(calls, 1);
    assert.equal(outcome.code, expectedCode);
    assert.doesNotMatch(outcome.message, /SENSITIVE_TEST_KEY/u);
  }
});
