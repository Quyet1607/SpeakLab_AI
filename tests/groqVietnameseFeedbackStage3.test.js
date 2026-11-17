import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNTHETIC_COMPARISON_CASES } from './fixtures/groqSyntheticComparisonCases.js';
import { validateSyntheticCaseReview, evidenceForSample, makeSyntheticCaseRequest } from '../server/groqSyntheticCases.js';

const TOKENS = /\b(?:OPEN|CLOSE|LIMIT|SOLUTION_[12]|SLIDE_[12])\b/u;

function mockResponse() {
  return {
    summary: 'Bài nói nêu hai biện pháp và thừa nhận chưa có bằng chứng thực nghiệm.',
    limitations: 'Chỉ có chữ bài nói và slide, chưa kiểm chứng kết quả bằng thực nghiệm.',
    criteria: [
      { criterion: 'R1', comment: 'Bài nói sử dụng dẫn chứng OPEN và SOLUTION_1 để chứng minh nội dung.', evidenceIds: ['OPEN', 'SOLUTION_1'], suggestion: 'Đảm bảo dẫn chứng được trích dẫn chính xác và không bị trùng.' },
      { criterion: 'R2', comment: 'Toàn bộ lập luận rất mạch lạc.', evidenceIds: ['OPEN', 'CLOSE'], suggestion: 'Tiếp tục duy trì tính mạch lạc.' },
      { criterion: 'R3', comment: 'Bài thuyết trình có dẫn chứng LIMIT về thiếu dữ liệu.', evidenceIds: ['LIMIT'], suggestion: 'Hãy kiểm tra dẫn chứng không bị trùng.' },
      { criterion: 'R4', comment: 'Slide có hình ảnh đẹp và bố cục tốt.', evidenceIds: ['SLIDE_1', 'SOLUTION_1', 'SLIDE_2', 'SOLUTION_2'], suggestion: 'Dùng hình ảnh rõ ràng hơn.' },
      { criterion: 'R5', comment: 'Hai biện pháp thuộc SOLUTION_1 và SOLUTION_2.', evidenceIds: ['SOLUTION_1', 'SOLUTION_2'], suggestion: 'Làm rõ cách triển khai.' },
    ],
  };
}

test('stage 3: internal evidence identifiers never appear in display prose across four samples', () => {
  for (const sample of SYNTHETIC_COMPARISON_CASES) {
    const result = validateSyntheticCaseReview(mockResponse(), sample);
    assert.equal(result.criteria.length, 5);
    for (const item of result.criteria) {
      assert.doesNotMatch(item.comment, TOKENS, sample.id + ' comment');
      assert.doesNotMatch(item.suggestion, TOKENS, sample.id + ' suggestion');
      assert.doesNotMatch(item.quote, TOKENS, sample.id + ' quote');
      assert.ok(item.evidenceIds.length > 0);
    }
  }
});

test('stage 3: fallback comments and advice match each selected sample, not a generic rubric', () => {
  const checks = [
    ['water-conservation', /khóa vòi|nước rửa rau/iu, /chất tẩy rửa|đo lượng nước/iu],
    ['reading-habit', /mười lăm phút|câu hỏi/iu, /đoạn sách|đọc hiểu/iu],
    ['online-safety', /mật khẩu|xác thực hai bước/iu, /mã xác minh|tài liệu hướng dẫn bảo mật/iu],
    ['school-garden', /lịch tưới|lá khô/iu, /phân công tưới|phát triển của cây/iu],
  ];
  for (const [id, content, suggestion] of checks) {
    const sample = SYNTHETIC_COMPARISON_CASES.find(x => x.id === id);
    const result = validateSyntheticCaseReview(mockResponse(), sample);
    assert.match(result.criteria[0].comment, content, id);
    assert.match(result.criteria[0].suggestion + ' ' + result.criteria[2].suggestion, suggestion, id);
    assert.match(result.criteria[4].comment, content, id);
    assert.doesNotMatch(JSON.stringify(result.criteria.map(x => x.suggestion)), /kiểm tra dẫn chứng không bị trùng|trích dẫn chính xác/iu);
  }
});

test('stage 3: displayed evidence is exclusively from the selected sample', () => {
  for (const sample of SYNTHETIC_COMPARISON_CASES) {
    const e = evidenceForSample(sample);
    const result = validateSyntheticCaseReview(mockResponse(), sample);
    for (const criterion of result.criteria) {
      for (const id of criterion.evidenceIds) assert.ok(criterion.quote.includes(e[id]));
    }
    for (const other of SYNTHETIC_COMPARISON_CASES.filter(x => x.id !== sample.id)) {
      assert.ok(!result.criteria[3].quote.includes(other.slides[0]));
    }
  }
});

test('stage 3: prompt prohibits evidence tokens in learner prose', () => {
  const prompt = makeSyntheticCaseRequest(SYNTHETIC_COMPARISON_CASES[0]).prompt;
  assert.match(prompt, /CHỈ được ghi ở evidenceIds/u);
  assert.match(prompt, /không bao giờ viết mã này trong summary/u);
  assert.match(prompt, /bước cải thiện cụ thể phù hợp với đề tài/u);
});

test('stage 3: malformed evidence and unsupported score remain rejected', () => {
  const sample = SYNTHETIC_COMPARISON_CASES[0];
  const badEvidence = mockResponse();
  badEvidence.criteria[3].evidenceIds = ['SLIDE_1', 'SLIDE_2'];
  assert.throws(() => validateSyntheticCaseReview(badEvidence, sample), { code: 'GROQ_INVALID_REVIEW' });
  const scored = mockResponse();
  scored.summary = 'Bài nói được chấm 9/10 điểm.';
  assert.throws(() => validateSyntheticCaseReview(scored, sample), { code: 'GROQ_INVALID_REVIEW' });
  const voice = mockResponse();
  voice.limitations = 'Em có giọng điệu tự tin dù mới nghe bản ghi.';
  assert.throws(() => validateSyntheticCaseReview(voice, sample), { code: 'GROQ_INVALID_REVIEW' });
});

test('stage 3: even plausible but generic model prose is replaced by audited per-topic wording', () => {
  for (const sample of SYNTHETIC_COMPARISON_CASES) {
    const response = mockResponse();
    for (const criterion of response.criteria) {
      criterion.comment = 'Đây là một đoạn bình luận chung chung, không liên quan đến nội dung bài nói.';
      criterion.suggestion = 'Cần cố gắng hơn và cải thiện nội dung bài nói ở lần sau.';
    }
    const result = validateSyntheticCaseReview(response, sample);
    for (const item of result.criteria) {
      assert.doesNotMatch(item.comment, /chung chung|bình luận/u);
      assert.doesNotMatch(item.suggestion, /cố gắng hơn|lần sau/u);
      assert.doesNotMatch(item.quote, TOKENS);
    }
  }
});

test('stage 3: summary and limitations containing internal tokens are rejected before display', () => {
  const sample = SYNTHETIC_COMPARISON_CASES[0];
  for (const field of ['summary', 'limitations']) {
    const response = mockResponse();
    response[field] = 'Nhận xét có mã SOLUTION_1 lộ ra trong nội dung cho giáo viên.';
    assert.throws(() => validateSyntheticCaseReview(response, sample), { code: 'GROQ_INVALID_REVIEW' });
  }
});

test('stage 3: preserving evidence IDs does not let the model inject arbitrary quotes', () => {
  const sample = SYNTHETIC_COMPARISON_CASES[2];
  const response = mockResponse();
  response.criteria[0].quote = 'Một câu chưa từng xuất hiện trong bản ghi.';
  const normalized = validateSyntheticCaseReview(response, sample);
  assert.ok(!JSON.stringify(normalized).includes(response.criteria[0].quote));
  assert.ok(normalized.criteria[0].quote.includes(evidenceForSample(sample).SOLUTION_1));
});
