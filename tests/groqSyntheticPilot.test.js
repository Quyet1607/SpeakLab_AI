import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRequest, validateReview, runPilot, SAMPLE, MODEL,
} from '../scripts/groqSyntheticPilot.mjs';

function validReview() {
  return {
    summary: 'Bài nói có hai giải pháp cụ thể và tự thừa nhận chưa có số liệu.',
    limitations: 'Chỉ đọc chữ ASR và slide; chưa xác minh tính đúng của các khẳng định.',
    criteria: [
      { criterion: 'R1', comment: 'Bám đúng đề tài.', evidenceIds: ['R1_A'], suggestion: 'Nêu rõ đối tượng áp dụng.' },
      { criterion: 'R2', comment: 'Cấu trúc hoàn chỉnh và mạch lạc.', evidenceIds: ['R2_A', 'R2_B'], suggestion: 'Giữ cấu trúc hiện tại.' },
      { criterion: 'R3', comment: 'Chưa có số liệu.', evidenceIds: ['R3_A'], suggestion: 'Kiểm chứng bằng một khảo sát.' },
      { criterion: 'R4', comment: 'Slide minh họa rõ ràng, bố cục tốt.', evidenceIds: ['R4_S1', 'R4_T1', 'R4_S2', 'R4_T2'], suggestion: 'Tiếp tục dùng hình ảnh đẹp.' },
      { criterion: 'R5', comment: 'Nêu được hai giải pháp.', evidenceIds: ['R5_A', 'R5_B'], suggestion: 'Tóm tắt hai giải pháp ở cuối.' },
    ],
  };
}

test('dry-run does not need API key or make network requests', async () => {
  let calls = 0;
  const result = await runPilot({ live: false, apiKey: '', fetcher: async () => { calls++; } });
  assert.equal(calls, 0);
  assert.deepEqual(result, { mode: 'offline', model: MODEL, hasSyntheticInput: true });
});

test('live mode refuses requests when Groq API key is absent', async () => {
  let calls = 0;
  await assert.rejects(runPilot({ live: true, apiKey: '', fetcher: async () => { calls++; } }), /GROQ_API_KEY/);
  assert.equal(calls, 0);
});

test('strict JSON request has no arbitrary user text, no student identity, and no score field', () => {
  const req = makeRequest();
  assert.equal(req.model, 'openai/gpt-oss-20b');
  assert.equal(req.stream, false);
  assert.equal(req.response_format.json_schema.strict, true);
  assert.equal(req.response_format.json_schema.schema.additionalProperties, false);
  assert.equal(req.messages[1].content.includes(SAMPLE.transcript), true);
  assert.equal(req.messages[1].content.includes(SAMPLE.slides[0]), true);
  assert.equal(req.messages[1].content.includes('R2_A'), true);
  assert.equal(req.messages[1].content.includes('R4_T2'), true);
  assert.equal(JSON.stringify(req).includes('api_key'), false);
  assert.equal(JSON.stringify(req).includes('ownerSub'), false);
});

test('evidence is multi-source for R2, R4 and R5; quotes are inserted from exact server-owned text', () => {
  const normalized = validateReview(validReview());
  assert.equal(normalized.criteria[0].quote, 'giảm rác nhựa ở trường học');
  assert.match(normalized.criteria[1].quote, /Mở đầu: Hôm nay em nói về giảm rác nhựa ở trường học\\./u);
  assert.match(normalized.criteria[1].quote, /Kết thúc: Em xin cảm ơn\\./u);
  assert.match(normalized.criteria[3].quote, /Slide 1: Giảm rác nhựa: Mang bình nước cá nhân/u);
  assert.match(normalized.criteria[3].quote, /Lời nói: Em đề xuất mang bình nước cá nhân/u);
  assert.match(normalized.criteria[3].quote, /Slide 2: Thùng phân loại rác trong lớp học/u);
  assert.match(normalized.criteria[4].quote, /Giải pháp 2: Mỗi lớp có thể đặt thùng phân loại rác\\./u);
});

test('R2 and R4 are rewritten conservatively instead of displaying unsupported model claims', () => {
  const normalized = validateReview(validReview());
  const r2 = normalized.criteria.find(item => item.criterion === 'R2');
  const r4 = normalized.criteria.find(item => item.criterion === 'R4');
  assert.match(r2.comment, /chưa đủ để kết luận toàn bộ mạch lập luận/u);
  assert.doesNotMatch(r2.comment, /hoàn chỉnh|mạch lạc/u);
  assert.match(r4.comment, /nội dung tương ứng với hai giải pháp/u);
  assert.doesNotMatch(r4.comment, /minh họa rõ ràng|bố cục tốt/u);
  assert.match(r4.suggestion, /chỉ đối chiếu chữ/u);
  assert.doesNotMatch(JSON.stringify([r2, r4]), /hình ảnh đẹp|bố cục tốt|minh họa rõ ràng/u);
});

test('rejects missing opening, ending, slide-text, speech-text or second-solution evidence', () => {
  const cases = [
    ['R2', ['R2_A'], /Thiếu dẫn chứng bắt buộc ở tiêu chí R2/u],
    ['R2', ['R2_B'], /Thiếu dẫn chứng bắt buộc ở tiêu chí R2/u],
    ['R4', ['R4_S1', 'R4_T1', 'R4_S2'], /Thiếu dẫn chứng bắt buộc ở tiêu chí R4/u],
    ['R4', ['R4_S1', 'R4_S2', 'R4_T2', 'R4_T1'], null],
    ['R5', ['R5_A'], /Thiếu dẫn chứng bắt buộc ở tiêu chí R5/u],
  ];
  for (const [criterion, ids, expected] of cases) {
    const review = validReview();
    review.criteria.find(item => item.criterion === criterion).evidenceIds = ids;
    if (expected) assert.throws(() => validateReview(review), expected);
    else assert.doesNotThrow(() => validateReview(review));
  }
});

test('rejects evidence from another criterion and duplicate evidence IDs', () => {
  const wrongSource = validReview();
  wrongSource.criteria[0].evidenceIds = ['R4_S1'];
  assert.throws(() => validateReview(wrongSource), /không thuộc nguồn/u);
  const duplicate = validReview();
  duplicate.criteria[0].evidenceIds = ['R1_A', 'R1_A'];
  assert.throws(() => validateReview(duplicate), /Danh sách dẫn chứng không hợp lệ/u);
});

test('rejects unsupported voice, visual and score claims in model-authored prose', () => {
  for (const [field, badText] of [
    ['summary', 'Bài nói có giọng điệu tự tin và hình ảnh slide đẹp.'],
    ['R1', 'Em phát âm rõ ràng và có ánh mắt tự tin.'],
    ['R3', 'Bố cục slide rất chuyên nghiệp.'],
    ['R5', 'Bài nói đạt 9/10 điểm.'],
  ]) {
    const review = validReview();
    if (field === 'summary') review.summary = badText;
    else review.criteria.find(item => item.criterion === field).comment = badText;
    assert.throws(() => validateReview(review), /vượt quá dữ liệu văn bản|điểm số/u);
  }
});

test('rejects duplicate criteria and malformed review structures', () => {
  const duplicate = validReview();
  duplicate.criteria[1].criterion = 'R1';
  assert.throws(() => validateReview(duplicate), /không hợp lệ hoặc bị lặp/u);
  const missing = validReview();
  missing.criteria.pop();
  assert.throws(() => validateReview(missing), /đúng 5 tiêu chí/u);
});

test('live pilot uses the shared Groq adapter and sends only built-in synthetic content once', async () => {
  let calls = 0;
  const result = await runPilot({
    live: true, apiKey: 'DUMMY_TEST_TOKEN_NOT_A_SECRET',
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer DUMMY_TEST_TOKEN_NOT_A_SECRET');
      const req = JSON.parse(options.body);
      assert.equal(req.model, MODEL);
      assert.equal(req.messages[1].content.includes(SAMPLE.transcript), true);
      assert.equal(req.messages[1].content.includes(SAMPLE.slides[1]), true);
      assert.equal(req.response_format.json_schema.strict, true);
      assert.equal(req.response_format.json_schema.schema.properties.criteria.items.properties.evidenceIds.type, 'array');
      assert.equal(req.messages[1].content.includes('R4_T2'), true);
      assert.equal(req.messages[1].content.includes('DỮ LIỆU GIẢ LẬP'), true);
      return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validReview()) } }] }) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.mode, 'live');
  assert.equal(result.model, MODEL);
  assert.equal(result.review.criteria[0].evidenceIds[0], 'R1_A');
  assert.equal(result.review.criteria[0].quote, 'giảm rác nhựa ở trường học');
});

test('malformed provider JSON is rejected with a safe diagnostic code', async () => {
  await assert.rejects(runPilot({
    live: true, apiKey: 'DUMMY_TEST_TOKEN_NOT_A_SECRET',
    fetcher: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '{bad json' } }] }) }),
  }), error => error.code === 'GROQ_INVALID_RESPONSE');
});

test('adapter output truncation is rejected without a second request', async () => {
  let calls = 0;
  await assert.rejects(runPilot({
    live: true, apiKey: 'DUMMY_TEST_TOKEN_NOT_A_SECRET',
    fetcher: async () => {
      calls++;
      return { ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '' } }] }) };
    },
  }), error => error.code === 'GROQ_OUTPUT_LIMIT');
  assert.equal(calls, 1);
});

test('upstream HTTP failures preserve safe status categories without exposing response body', async () => {
  await assert.rejects(runPilot({
    live: true, apiKey: 'DUMMY_TEST_TOKEN_NOT_A_SECRET',
    fetcher: async () => ({ ok: false, status: 503, text: async () => 'private provider details' }),
  }), error => error.code === 'GROQ_UPSTREAM_HTTP' && error.status === 503 && !error.message.includes('private'));
});

test('429 stops without retries or fallback to paid model', async () => {
  let calls = 0;
  await assert.rejects(runPilot({
    live: true, apiKey: 'DUMMY_TEST_TOKEN_NOT_A_SECRET',
    fetcher: async () => { calls++; return { ok: false, status: 429 }; },
  }), error => error.code === 'GROQ_RATE_LIMIT');
  assert.equal(calls, 1);
});
