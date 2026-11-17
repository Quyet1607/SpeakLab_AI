import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPilotHandler } from '../api/groq/pilot.js';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const review = readFileSync(new URL('../src/features/history/AiSpeechReviewPanel.tsx', import.meta.url), 'utf8');

test('2.7.1: pilot entry only renders after teacher session and authenticated readiness', () => {
  assert.match(app, /accountSession\.status !== 'signed_in' \|\| accountSession\.identity\?\.role !== 'teacher'/);
  assert.match(app, /fetch\('\/api\/groq\/pilot'/);
  assert.match(app, /response\.ok && data\?\.ready === true/);
  assert.match(app, /data\?\.syntheticOnly === true && data\?\.branch === 'feature\/groq-synthetic-pilot'/);
  assert.match(app, /setGroqPilotReady\(false\)/);
  assert.match(app, /groqPilotReady=\{groqPilotReady\}/);
  assert.match(dashboard, /\{groqPilotReady && \(/);
  assert.match(dashboard, /href="\/groq-pilot\.html"/);
  assert.match(dashboard, /Thử Groq AI \(dữ liệu giả lập\)/);
});

test('2.7.1: no student upload, review provider replacement or Gemini consent change', () => {
  assert.doesNotMatch(dashboard, /fetch\('\/api\/groq\/pilot'|transcript\s*:/);
  assert.match(review, /'\/api\/ai\/review'/);
  assert.match(review, /đến Google Gemini/u);
});

function createRes() {
  return { code: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
test('2.7.1: backend rejects learner and Production even if pilot URL is opened directly', async () => {
  let calls = 0;
  for (const [role, mode, expected] of [
    ['learner', 'preview', 403],
    ['teacher', 'production', 404],
  ]) {
    const handler = createPilotHandler({
      env: {
        VERCEL_ENV: mode,
        VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
        GROQ_API_KEY: 'MOCK_ONLY',
      },
      sessionReader: () => ({ id: 'mock', role }),
      quotaConfigured: () => {},
      quotaReserver: async () => { calls++; return { release: async () => {} }; },
      pilotRunner: async () => { calls++; return { review: {} }; },
    });
    const res = createRes();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.code, expected);
  }
  assert.equal(calls, 0);
});
