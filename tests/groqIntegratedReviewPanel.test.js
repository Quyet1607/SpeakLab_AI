import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAdultPreviewHandler } from '../api/groq/adult-preview.js';

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('integrated Groq: original History review panel offers Groq next to Gemini, not a new entry page', () => {
  const ui = file('src/features/history/AiSpeechReviewPanel.tsx');
  assert.match(ui, /'gemini' \| 'groq'/u);
  assert.match(ui, /Gemini hiện tại/u);
  assert.match(ui, /Groq · Bài người lớn tự viết/u);
  assert.match(ui, /studentGroqMode \? '\/api\/ai\/groq-review' : '\/api\/groq\/adult-preview'/u);
  assert.match(ui, /<AiReviewResults key=\{sessionId\} review=\{review\}/u);
  assert.match(ui, /setReview\(data\.review\)/u);
  assert.match(ui, /ownerSub && \(!groqMode \|\| studentGroqMode\)/u);
  assert.match(ui, /!groqAvailable \|\| !groqAllowedInput/u);
  assert.match(ui, /previewAccepted === currentGroqSnapshot/u);
  assert.match(ui, /setPreviewAccepted\(null\)/u);
  assert.match(ui, /setConsent\(false\)/u);
  assert.match(ui, /adultSelfAuthored: true/u);
  assert.match(ui, /confirmExternalTransfer: true, confirmOneCall: true/u);
});
test('integrated Groq: Gemini endpoint and full 40-slide support remain unmodified', () => {
  const gemini = file('api/ai/review.js');
  assert.match(gemini, /new GoogleGenAI/u);
  assert.match(gemini, /parseGroundedReview\(output\.text, evidence, input\.slides\)/u);
  assert.doesNotMatch(gemini, /requestGroqReview|groqGenericReviewEngine|adult-preview/u);
  const freeSpeech = file('server/freeSpeechReview.js');
  assert.match(freeSpeech, /MAX_SLIDES = 40/u);
});
test('integrated Groq: server still blocks learner and disabled preview before external call', async () => {
  const calls = [];
  const env = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
    GROQ_API_KEY: 'mock-secret' };
  const h = createAdultPreviewHandler({ env, sessionReader: () => ({ id: 'adult', role: 'teacher' }),
    quotaReserver: async () => { calls.push('quota'); throw new Error('Must never reserve'); },
    runner: async () => { calls.push('groq'); throw new Error('Must never call'); } });
  const res = { statusCode: 200, setHeader() { return this; },
    status(c) { this.statusCode = c; return this; }, json(x) { this.body = x; return this; } };
  await h({ method: 'POST', headers: {}, body: null }, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(calls, []);
});
