import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE, makeRequest, validateReview } from '../scripts/groqSyntheticPilot.mjs';

// Deterministic adversarial mock, not a live Groq response.
function example() {
  return {
    summary: 'Bài nói nêu hai giải pháp và thừa nhận giới hạn của số liệu thử nghiệm.',
    limitations: 'Chỉ đánh giá chữ trong transcript và slide; không có âm thanh hay hình ảnh.',
    criteria: [
      { criterion: 'R1', comment: 'Đề tài và giải pháp được nêu.', evidenceIds: ['R1_A', 'R1_B'], suggestion: 'Làm rõ lợi ích.' },
      { criterion: 'R2', comment: 'Mạch lập luận hoàn hảo và cấu trúc xuất sắc.', evidenceIds: ['R2_A', 'R2_B'], suggestion: 'Không cần sửa.' },
      { criterion: 'R3', comment: 'Chưa có số liệu thực nghiệm.', evidenceIds: ['R3_A'], suggestion: 'Thu thập số liệu.' },
      { criterion: 'R4', comment: 'Bố cục slide đẹp và hình ảnh thuyết phục.', evidenceIds: ['R4_S1', 'R4_T1', 'R4_S2', 'R4_T2'], suggestion: 'Giữ nguyên thiết kế.' },
      { criterion: 'R5', comment: 'Có hai giải pháp.', evidenceIds: ['R5_A', 'R5_B'], suggestion: 'Thêm kế hoạch triển khai.' },
    ],
  };
}

test('2.6.3: source evidence remains literal and unaltered in all five criteria', () => {
  const review = validateReview(example());
  assert.deepEqual(review.criteria.map(item => item.criterion), ['R1', 'R2', 'R3', 'R4', 'R5']);
  assert.match(SAMPLE.transcript, /Chúng ta chưa có số liệu thử nghiệm/u);
  for (const item of review.criteria) {
    assert.ok(item.quote && item.quote.length > 10);
    assert.ok(item.evidenceIds.length);
  }
  assert.match(review.criteria[0].quote, /giảm rác nhựa ở trường học/u);
  assert.match(review.criteria[2].quote, /chưa có số liệu thử nghiệm/u);
  assert.match(review.criteria[4].quote, /Giải pháp 1:|Giải pháp 2:/u);
});

test('2.6.3: R2 and R4 are constrained by verified markers, not model optimism', () => {
  const review = validateReview(example());
  const r2 = review.criteria[1];
  const r4 = review.criteria[3];
  assert.match(r2.quote, /Mở đầu:.*Kết thúc:/u);
  assert.match(r2.comment, /chưa đủ để kết luận toàn bộ mạch lập luận/u);
  assert.doesNotMatch(r2.comment + ' ' + r2.suggestion, /hoàn hảo|xuất sắc/u);
  assert.match(r4.quote, /Slide 1:.*Lời nói:.*Slide 2:.*Lời nói:/u);
  assert.doesNotMatch(r4.comment + ' ' + r4.suggestion, /đẹp|hình ảnh thuyết phục|giữ nguyên thiết kế/u);
  assert.match(r4.suggestion, /chỉ đối chiếu chữ/u);
});

test('2.6.3: simulated scores and nontext observations are rejected', () => {
  const forbidden = [
    ['summary', 'Giọng nói tự tin và phát âm rất rõ ràng.'],
    ['summary', 'Bài thuyết trình đạt 9/10 điểm.'],
    ['limitations', 'Bố cục slide đẹp và thiết kế chuyên nghiệp.'],
  ];
  for (const [field, text] of forbidden) {
    const mock = example();
    mock[field] = text;
    assert.throws(() => validateReview(mock), { code: 'GROQ_INVALID_REVIEW' });
  }
});

test('2.6.3: missing mandatory cross-source evidence fails closed', () => {
  const cases = [
    ['R2', ['R2_A']],
    ['R3', ['R1_A']],
    ['R4', ['R4_S1', 'R4_T1', 'R4_S2']],
    ['R5', ['R5_A']],
  ];
  for (const [criterion, ids] of cases) {
    const mock = example();
    mock.criteria.find(item => item.criterion === criterion).evidenceIds = ids;
    assert.throws(() => validateReview(mock), { code: 'GROQ_INVALID_REVIEW' });
  }
});

test('2.6.3: synthetic request excludes any student content and rejects scoring instruction', () => {
  const req = makeRequest();
  assert.equal(req.model, 'openai/gpt-oss-20b');
  assert.equal(req.response_format.json_schema.strict, true);
  assert.equal(req.messages[1].content.includes(SAMPLE.transcript), true);
  assert.equal(req.messages[1].content.includes(SAMPLE.slides[0]), true);
  assert.equal(req.messages[1].content.includes(SAMPLE.slides[1]), true);
  assert.match(req.messages[1].content, /Không tự tạo điểm tổng/u);
  assert.doesNotMatch(JSON.stringify(req), /ownerSub|GEMINI_API_KEY|GROQ_API_KEY|studentId/u);
});
