import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import handler from '../api/ai/review.js';
import { makeSessionCookie } from '../server/sessionCookie.js';

const secret = randomBytes(48).toString('base64');
const env = { SPEAKLAB_SESSION_SECRET: secret };
const cookie = makeSessionCookie({
  userId: '123456789', displayName: 'Người thử nghiệm', role: 'learner',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
}, env).split(';')[0];

function mockResponse() {
  const headers = {};
  return {
    code: 200, data: null, headers,
    setHeader(name, value) { headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
}

function mockRequest(body = {}, opts = {}) {
  return {
    method: 'POST',
    headers: {
      host: 'preview.example.test',
      origin: 'https://preview.example.test',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      cookie,
      ...opts,
    },
    body,
  };
}

test('API rejects unauthorized or wrong-origin calls before Gemini', async () => {
  const a = mockResponse();
  await handler(mockRequest({}, { cookie: '' }), a);
  assert.equal(a.code, 401);
  const b = mockResponse();
  await handler(mockRequest({}, { origin: 'https://hostile.example' }), b);
  assert.equal(b.code, 403);
});

test('API rejects missing consent and fails closed when free-tier config is absent', async () => {
  const oldSecret = process.env.SPEAKLAB_SESSION_SECRET;
  const oldPreview = process.env.VERCEL_ENV;
  const oldConfirmed = process.env.SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED;
  const oldKey = process.env.GEMINI_API_KEY;
  try {
    process.env.SPEAKLAB_SESSION_SECRET = secret;
    delete process.env.VERCEL_ENV;
    delete process.env.SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED;
    delete process.env.GEMINI_API_KEY;
    const req = mockRequest({
      sessionId: 'ses_1234567', consent: false,
      topic: 'Bảo vệ dữ liệu cá nhân',
      transcript: 'Em trình bày về bảo vệ dữ liệu cá nhân. Chúng ta cần cẩn thận khi chia sẻ thông tin.',
      slides: [],
    });
    const noConsent = mockResponse();
    await handler(req, noConsent);
    assert.equal(noConsent.code, 400);
    const disabled = mockResponse();
    await handler({ ...req, body: { ...req.body, consent: true } }, disabled);
    assert.equal(disabled.code, 503);
    assert.ok(!JSON.stringify(disabled.data).includes('key'));
  } finally {
    if (oldSecret === undefined) delete process.env.SPEAKLAB_SESSION_SECRET;
    else process.env.SPEAKLAB_SESSION_SECRET = oldSecret;
    if (oldPreview === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = oldPreview;
    if (oldConfirmed === undefined) delete process.env.SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED;
    else process.env.SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED = oldConfirmed;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
