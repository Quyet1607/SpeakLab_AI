import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import handler from '../api/ai/defense.js';
import { makeSessionCookie } from '../server/sessionCookie.js';

const secret = randomBytes(48).toString('base64');
const cookie = makeSessionCookie({
  userId: '123456789', displayName: 'Người thử nghiệm', role: 'learner',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
}, { SPEAKLAB_SESSION_SECRET: secret }).split(';')[0];

const body = {
  action: 'questions', sessionId: 'ses_1234567890', consent: true,
  topic: 'Bảo vệ dữ liệu cá nhân',
  transcript: 'Hôm nay em trình bày về an toàn dữ liệu cá nhân và cách bảo vệ mật khẩu khi sử dụng Internet.',
  slides: [],
};

function response() {
  const headers = {};
  return {
    code: 200, data: null, headers,
    setHeader(k, v) { headers[k] = v; return this; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
}
function request(overrides = {}, headerChanges = {}) {
  return {
    method: 'POST', headers: {
      host: 'preview.example.test', origin: 'https://preview.example.test',
      'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json', cookie,
      ...headerChanges,
    }, body: { ...body, ...overrides },
  };
}
function withEnv(tweaks, callback) {
  const keys = Object.keys(tweaks);
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const [key, value] of Object.entries(tweaks)) {
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve().then(callback).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('defense route rejects wrong method, origin, media type and anonymous calls', async () => {
  await withEnv({ SPEAKLAB_SESSION_SECRET: secret }, async () => {
    const method = response();
    await handler({ ...request(), method: 'GET' }, method);
    assert.equal(method.code, 405);
    assert.equal(method.headers.Allow, 'POST');
    const wrongOrigin = response();
    await handler(request({}, { origin: 'https://attacker.example' }), wrongOrigin);
    assert.equal(wrongOrigin.code, 403);
    const wrongMedia = response();
    await handler(request({}, { 'content-type': 'text/plain' }), wrongMedia);
    assert.equal(wrongMedia.code, 415);
    const anonymous = response();
    await handler(request({}, { cookie: '' }), anonymous);
    assert.equal(anonymous.code, 401);
    assert.equal(anonymous.headers['Cache-Control'], 'private, no-store, max-age=0');
  });
});

test('defense route requires user consent and rejects fabricated challenge before provider/quota', async () => {
  await withEnv({ SPEAKLAB_SESSION_SECRET: secret }, async () => {
    const noConsent = response();
    await handler(request({ consent: false }), noConsent);
    assert.equal(noConsent.code, 400);
    const tamper = response();
    await handler(request({
      action: 'feedback',
      answers: [{ id: 'J1', text: 'Em đã giải thích mục tiêu nghiên cứu rõ ràng.' },
        { id: 'J2', text: '' }, { id: 'J3', text: '' }],
      challengeToken: 'unsigned-token.data',
    }), tamper);
    assert.equal(tamper.code, 400);
    assert.equal(tamper.data.code, 'DEFENSE_INVALID_REQUEST');
  });
});

test('defense route keeps Gemini disabled in Production unless explicitly opted in', async () => {
  await withEnv({
    SPEAKLAB_SESSION_SECRET: secret, VERCEL_ENV: 'production',
    GEMINI_API_KEY: 'fake-for-guard-test',
    SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED: 'true',
    SPEAKLAB_GEMINI_PRODUCTION_ENABLED: null,
  }, async () => {
    const r = response();
    await handler(request(), r);
    assert.equal(r.code, 503);
    assert.equal(r.data.code, 'SPEAKLAB_AI_PRODUCTION_DISABLED');
  });
});
