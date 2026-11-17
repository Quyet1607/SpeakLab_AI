import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SYNTHETIC_COMPARISON_CASES } from './fixtures/groqSyntheticComparisonCases.js';
import {
  syntheticCaseList, getSyntheticCase, evidenceForSample,
  makeSyntheticCaseRequest, validateSyntheticCaseReview, runSyntheticCase,
} from '../server/groqSyntheticCases.js';
import { createPilotHandler } from '../api/groq/pilot.js';

const mockReview = () => ({
  summary: 'Bài nói trình bày hai biện pháp cụ thể và thừa nhận giới hạn minh chứng.',
  limitations: 'Chỉ phân tích văn bản bài nói và chữ slide, chưa kiểm chứng kết quả thực nghiệm.',
  criteria: [
    { criterion: 'R1', comment: 'Mở đầu nêu chủ đề.', evidenceIds: ['OPEN', 'SOLUTION_1'], suggestion: 'Giới thiệu rõ lợi ích.' },
    { criterion: 'R2', comment: 'Cấu trúc mạch lạc tuyệt đối.', evidenceIds: ['OPEN', 'CLOSE'], suggestion: 'Giữ cấu trúc này.' },
    { criterion: 'R3', comment: 'Có giới hạn dẫn chứng.', evidenceIds: ['LIMIT'], suggestion: 'Thu thập dữ liệu khảo sát.' },
    { criterion: 'R4', comment: 'Hai slide rất đẹp.', evidenceIds: ['SLIDE_1', 'SOLUTION_1', 'SLIDE_2', 'SOLUTION_2'], suggestion: 'Duy trì hình ảnh tốt.' },
    { criterion: 'R5', comment: 'Nêu hai biện pháp.', evidenceIds: ['SOLUTION_1', 'SOLUTION_2'], suggestion: 'Làm rõ cách triển khai.' },
  ],
});
const env = {
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/groq-synthetic-pilot',
  GROQ_API_KEY: 'MOCK_KEY_ONLY',
};
const headers = {
  origin: 'https://preview.example', host: 'preview.example',
  'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
};
function makeRes() {
  return { code: 200, body: null, headers: {},
    setHeader(k,v){this.headers[k]=v;},
    status(code){this.code=code;return this;},
    json(body){this.body=body;return this;},
  };
}
async function runRoute(body) {
  const calls = [];
  const handler = createPilotHandler({
    env, sessionReader: () => ({ id: 'teacher', role: 'teacher' }),
    quotaConfigured: () => {},
    quotaReserver: async () => {
      calls.push('quota');
      return { release: async () => { calls.push('release'); return true; } };
    },
    pilotRunner: async () => { calls.push('legacy'); return { review: {} }; },
    sampleRunner: async ({ id }) => {
      calls.push(id);
      const sample = getSyntheticCase(id);
      return { review: validateSyntheticCaseReview(mockReview(), sample),
        sample: { id, label: sample.label, topic: sample.topic } };
    },
  });
  const res = makeRes();
  await handler({ method: 'POST', headers, body }, res);
  return { res, calls };
}

test('step 2: all four server-owned cases have evidence matching source transcript and slides', () => {
  const list = syntheticCaseList();
  assert.equal(list.length, 4);
  for (const item of list) {
    assert.deepEqual(Object.keys(item), ['id', 'label', 'topic']);
    const sample = getSyntheticCase(item.id);
    const e = evidenceForSample(sample);
    assert.equal(evidenceForSample(sample).SLIDE_1, sample.slides[0]);
    assert.equal(evidenceForSample(sample).SLIDE_2, sample.slides[1]);
    for (const id of ['OPEN', 'SOLUTION_1', 'SOLUTION_2', 'LIMIT', 'CLOSE']) {
      assert.ok(sample.transcript.includes(e[id]), item.id + ':' + id);
    }
    const req = makeSyntheticCaseRequest(sample);
    assert.ok(req.prompt.includes(sample.transcript));
    assert.equal(req.schema.properties.criteria.items.properties.evidenceIds.items.enum.length, 7);
    const result = validateSyntheticCaseReview(mockReview(), sample);
    assert.deepEqual(result.criteria.map(x => x.criterion), ['R1','R2','R3','R4','R5']);
    for (const criterion of result.criteria) {
      assert.ok(criterion.quote.length > 20);
      for (const id of criterion.evidenceIds) assert.ok(criterion.quote.includes(e[id]));
    }
    assert.match(result.criteria[1].comment, /chưa đủ để kết luận toàn bộ mạch lập luận/u);
    assert.doesNotMatch(result.criteria[3].comment, /đẹp|hình ảnh tốt/u);
  }
});

test('step 2: invalid case IDs never resolve to user text', () => {
  for (const id of ['', '../student', 'prototype', 'toString', 'WATER-CONSERVATION', 1, {}, null]) {
    assert.equal(getSyntheticCase(id), null);
  }
});

test('step 2: route accepts allowlisted case exactly once after Redis reservation', async () => {
  for (const sample of SYNTHETIC_COMPARISON_CASES) {
    const { res, calls } = await runRoute({
      syntheticOnly: true, confirmOneCall: true, caseId: sample.id,
    });
    assert.equal(res.code, 200);
    assert.equal(res.body.sample.id, sample.id);
    assert.deepEqual(calls, ['quota', sample.id, 'release']);
  }
});

test('step 2: user-supplied text and unknown IDs are denied before Redis and Groq', async () => {
  for (const body of [
    { syntheticOnly: true, confirmOneCall: true, caseId: 'unknown' },
    { syntheticOnly: true, confirmOneCall: true, caseId: '../secret' },
    { syntheticOnly: true, confirmOneCall: true, caseId: null },
    { syntheticOnly: true, confirmOneCall: true, caseId: 'reading-habit', transcript: 'User text' },
    { syntheticOnly: true, confirmOneCall: true, caseId: 'reading-habit', slides: ['user slide'] },
    { syntheticOnly: true, confirmOneCall: true, caseId: 'reading-habit', email: 'student@example.com' },
  ]) {
    const { res, calls } = await runRoute(body);
    assert.equal(res.code, 400);
    assert.deepEqual(calls, []);
    assert.doesNotMatch(JSON.stringify(res.body), /student@example.com|User text/u);
  }
});

test('step 2: strict response validator denies missing evidence and unsupported claims', () => {
  const sample = SYNTHETIC_COMPARISON_CASES[0];
  const bad = mockReview(); bad.criteria[3].evidenceIds = ['SLIDE_1', 'SOLUTION_1'];
  assert.throws(() => validateSyntheticCaseReview(bad, sample), { code: 'GROQ_INVALID_REVIEW' });
  const badScore = mockReview(); badScore.summary = 'Bài đạt 9/10 điểm.';
  assert.throws(() => validateSyntheticCaseReview(badScore, sample), { code: 'GROQ_INVALID_REVIEW' });
});

test('step 2: Groq adapter still makes one mocked call and returns source-grounded quotes', async () => {
  let count = 0;
  const sample = SYNTHETIC_COMPARISON_CASES[1];
  const result = await runSyntheticCase({
    id: sample.id, apiKey: 'DUMMY_KEY',
    fetcher: async (url, options) => {
      count++;
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      const request = JSON.parse(options.body);
      assert.ok(request.messages[1].content.includes(sample.transcript));
      return { ok: true, json: async () => ({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(mockReview()) } }],
      }) };
    },
  });
  assert.equal(count, 1);
  assert.equal(result.sample.id, sample.id);
  assert.ok(result.review.criteria[3].quote.includes(sample.slides[0]));
  assert.doesNotMatch(result.review.criteria[3].quote, /\\bSLIDE_[12]:/u);
});

test('step 2: frontend only submits caseId and retains single-use interaction', () => {
  const html = readFileSync(new URL('../public/groq-pilot.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../public/groq-pilot.js', import.meta.url), 'utf8');
  for (const sample of SYNTHETIC_COMPARISON_CASES) assert.ok(html.includes('value="' + sample.id + '"'));
  assert.match(script, /caseId: samplePicker\.value/u);
  assert.match(script, /button\.disabled = true/u);
  assert.match(script, /samplePicker\.disabled = true/u);
  assert.doesNotMatch(html, /<textarea|type="file"/u);
});
