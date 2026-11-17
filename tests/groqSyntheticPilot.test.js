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
      { criterion: 'R1', comment: 'Bám đúng đề tài.', quote: 'giảm rác nhựa ở trường học', suggestion: 'Nêu rõ đối tượng áp dụng.' },
      { criterion: 'R2', comment: 'Có mở và kết.', quote: 'Em xin cảm ơn.', suggestion: 'Thêm câu chuyển ý rõ ràng.' },
      { criterion: 'R3', comment: 'Chưa có số liệu.', quote: 'Chúng ta chưa có số liệu thử nghiệm', suggestion: 'Kiểm chứng bằng một khảo sát.' },
      { criterion: 'R4', comment: 'Có chữ slide hỗ trợ.', quote: 'Thùng phân loại rác trong lớp học', suggestion: 'Giải thích cách triển khai thùng phân loại.' },
      { criterion: 'R5', comment: 'Nêu giải pháp.', quote: 'Em đề xuất mang bình nước cá nhân', suggestion: 'Tóm tắt hai giải pháp ở cuối.' },
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
  assert.equal(JSON.stringify(req).includes('api_key'), false);
  assert.equal(JSON.stringify(req).includes('ownerSub'), false);
});

test('valid mock response is accepted only if all source quotes are exact', () => {
  assert.deepEqual(validateReview(validReview()), validReview());
  const bad = validReview();
  bad.criteria[0].quote = 'Nghiên cứu cho thấy hiệu quả tăng 100%';
  assert.throws(() => validateReview(bad), /Dẫn chứng R1/);
});

test('rejects duplicate criteria, fabricated grades and wrong source', () => {
  const duplicate = validReview();
  duplicate.criteria[1].criterion = 'R1';
  assert.throws(() => validateReview(duplicate), /bị lặp/);
  const grade = validReview();
  grade.summary = 'Điểm tổng: 9/10 cho bài này.';
  assert.throws(() => validateReview(grade), /điểm số/);
  const slide = validReview();
  slide.criteria[3].quote = 'Em xin cảm ơn.';
  assert.throws(() => validateReview(slide), /Dẫn chứng R4/);
});

test('live pilot only sends built-in dummy text and checks returned quotes', async () => {
  let calls = 0;
  const result = await runPilot({
    live: true, apiKey: 'DUMMY_TEST_TOKEN_NOT_A_SECRET',
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer DUMMY_TEST_TOKEN_NOT_A_SECRET');
      const req = JSON.parse(options.body);
      assert.equal(req.messages[1].content.includes(SAMPLE.transcript), true);
      assert.equal(req.messages[1].content.includes(SAMPLE.slides[1]), true);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(validReview()) } }] }) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.mode, 'live');
  assert.deepEqual(result.review, validReview());
});

test('429 stops without retries or fallback to paid model', async () => {
  let calls = 0;
  await assert.rejects(runPilot({
    live: true, apiKey: 'DUMMY_TEST_TOKEN_NOT_A_SECRET',
    fetcher: async () => { calls++; return { ok: false, status: 429 }; },
  }), /429/);
  assert.equal(calls, 1);
});
