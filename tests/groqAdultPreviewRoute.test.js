import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAdultPreviewHandler } from '../api/groq/adult-preview.js';

const sample = {
  adultSelfAuthored: true, confirmExternalTransfer: true, confirmOneCall: true,
  sessionId: 'ses_adult_preview01',
  topic: 'Phương án đi lại giảm phát thải',
  speakingGoal: 'Phân tích hai cách đi lại tiết kiệm năng lượng',
  transcript: 'Tôi sẽ giới thiệu hai phương án đi lại tiết kiệm năng lượng. ' +
    'Đi xe đạp trên quãng đường ngắn giúp giảm nhu cầu sử dụng nhiên liệu. ' +
    'Đi xe buýt trên tuyến phù hợp giúp giảm số xe cá nhân trên đường. ' +
    'Hiện chưa có số liệu để kết luận mức tiết kiệm so với cách đi lại khác.',
  slides: [{ number: 1, text: 'Đi xe đạp trên quãng đường ngắn' }],
};
const env = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  SPEAKLAB_GROQ_ADULT_PILOT_ENABLED: 'true', GROQ_API_KEY: 'MOCK_ONLY',
};
const headers = {
  origin: 'https://preview.example', host: 'preview.example',
  'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
};
const makeRes = () => ({
  statusCode: 200, data: null, headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(data) { this.data = data; return this; },
});
async function request({
  body = sample, method = 'POST', identity = { id: 'teacher_123', role: 'teacher' },
  activeEnv = env, activeHeaders = headers, runnerResult,
} = {}) {
  const calls = [];
  const handler = createAdultPreviewHandler({
    env: activeEnv, sessionReader: () => identity,
    quotaConfigured: () => { calls.push('configured'); },
    quotaReserver: async () => {
      calls.push('reserved');
      return { release: async () => { calls.push('released'); return true; } };
    },
    runner: async ({ input }) => {
      calls.push('provider');
      assert.equal(input.transcript, body.transcript);
      assert.equal(input.slides.length, body.slides.length);
      if (runnerResult instanceof Error) throw runnerResult;
      return { model: 'mock-groq', review: runnerResult || {
        summary: 'Đã kiểm tra nội dung bài nói.', strengths: [], improvements: [],
        slideComparisons: [], limitations: [],
      } };
    },
  });
  const res = makeRes();
  await handler({ method, headers: activeHeaders, body }, res);
  return { res, calls };
}

test('adult Preview: disabled by default with no quota or provider calls', async () => {
  const { res, calls } = await request({
    activeEnv: { ...env, SPEAKLAB_GROQ_ADULT_PILOT_ENABLED: undefined },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.data.code, 'ADULT_PILOT_DISABLED');
  assert.deepEqual(calls, []);
});
test('adult Preview: GET readiness is teacher-only and never spends quota', async () => {
  const ready = await request({ method: 'GET' });
  assert.equal(ready.res.statusCode, 200);
  assert.equal(ready.res.data.ready, true);
  assert.deepEqual(ready.calls, []);
  const disabled = await request({ method: 'GET', activeEnv: { ...env, SPEAKLAB_GROQ_ADULT_PILOT_ENABLED: undefined } });
  assert.equal(disabled.res.data.ready, false);
  assert.deepEqual(disabled.calls, []);
});
test('adult Preview: rejects guest, learner, production and wrong branch before quota', async () => {
  for (const options of [
    { identity: null }, { identity: { id: 'learner_3', role: 'learner' } },
    { activeEnv: { ...env, VERCEL_ENV: 'production' } },
    { activeEnv: { ...env, VERCEL_GIT_COMMIT_REF: 'main' } },
  ]) {
    const { res, calls } = await request(options);
    assert.ok([401,403,404].includes(res.statusCode));
    assert.deepEqual(calls, []);
  }
});
test('adult Preview: rejects cross-origin and missing confirmations before quota', async () => {
  for (const body of [
    { ...sample, adultSelfAuthored: false },
    { ...sample, confirmExternalTransfer: false },
    { ...sample, confirmOneCall: false },
    { ...sample, transcript: 'quá ngắn' },
    { ...sample, studentId: '1234' },
    { ...sample, slides: Array.from({ length: 4 }, (_, i) => ({ number: i + 1, text: 'Bài không phù hợp' })) },
    { ...sample, topic: 'Một lớp 8A cần thực hiện dự án' },
    { ...sample, transcript: sample.transcript + ' Liên hệ somebody@example.com.' },
    { ...sample, transcript: sample.transcript + ' Gọi số 0912345678.' },
  ]) {
    const { res, calls } = await request({ body });
    assert.equal(res.statusCode, 400, JSON.stringify(body).slice(0, 80));
    assert.deepEqual(calls, []);
  }
  const external = await request({
    activeHeaders: { ...headers, origin: 'https://attacker.example' },
  });
  assert.equal(external.res.statusCode, 403);
  assert.deepEqual(external.calls, []);
});
test('adult Preview: admitted adult-authored text is reserved then sent exactly once and lease released', async () => {
  const { res, calls } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.model, 'mock-groq');
  assert.deepEqual(calls, ['configured', 'reserved', 'provider', 'released']);
  assert.doesNotMatch(JSON.stringify(res.data), /MOCK_ONLY|adultSelfAuthored|confirmExternalTransfer/u);
});
test('adult Preview: provider failure does not retry or leak user input', async () => {
  const failure = Object.assign(new Error(sample.transcript), { code: 'GROQ_INVALID_REVIEW' });
  const { res, calls } = await request({ runnerResult: failure });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(calls, ['configured', 'reserved', 'provider', 'released']);
  assert.ok(!JSON.stringify(res.data).includes(sample.transcript));
});
test('adult Preview: static page snapshots user input before send and does not store it', () => {
  const html = readFileSync(new URL('../public/groq-adult-preview.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/groq-adult-preview.js', import.meta.url), 'utf8');
  assert.match(html, /Không dùng bài của học sinh/u);
  assert.match(js, /snapshot = JSON.stringify\(data\)/u);
  assert.match(js, /adultSelfAuthored: true, confirmExternalTransfer: true, confirmOneCall: true/u);
  assert.match(js, /locked = true/u);
  assert.doesNotMatch(js, /localStorage|sessionStorage|setInterval|window\.location\.reload/u);
  assert.doesNotMatch(html, /type="file"/u);
});
