import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SYNTHETIC_COMPARISON_CASES } from './fixtures/groqSyntheticComparisonCases.js';
import { evidenceForSample, validateSyntheticCaseReview } from '../server/groqSyntheticCases.js';
import { adaptVerifiedSyntheticGroqReview, OFFLINE_GROQ_CONTRACT_MODEL } from '../server/groqSyntheticReviewAdapter.js';

function mockModelResponse() {
  return {
    summary: 'Bài nói trình bày hai biện pháp phù hợp chủ đề và nhận biết giới hạn số liệu.',
    limitations: 'Chỉ kiểm tra chữ trong bản ghi lời nói và hai slide văn bản, không có quan sát thực tế.',
    criteria: [
      { criterion: 'R1', evidenceIds: ['OPEN','SOLUTION_1'], comment: 'Mở đầu có đề tài.', suggestion: 'Giải thích chủ đề.' },
      { criterion: 'R2', evidenceIds: ['OPEN','CLOSE'], comment: 'Phần đầu và kết.', suggestion: 'Bổ sung chuyển ý.' },
      { criterion: 'R3', evidenceIds: ['LIMIT'], comment: 'Có giới hạn số liệu.', suggestion: 'Thử đo kết quả.' },
      { criterion: 'R4', evidenceIds: ['SLIDE_1','SOLUTION_1','SLIDE_2','SOLUTION_2'], comment: 'Có chữ slide.', suggestion: 'Đọc chữ của slide.' },
      { criterion: 'R5', evidenceIds: ['SOLUTION_1','SOLUTION_2'], comment: 'Nêu hai cách.', suggestion: 'Giải thích cách làm.' },
    ],
  };
}

test('step 5: converts all 4 validated fictional Groq R1-R5 reports to the real SpeakLab UI shape', () => {
  for (const sample of SYNTHETIC_COMPARISON_CASES) {
    const groqReview = validateSyntheticCaseReview(mockModelResponse(), sample);
    const adapted = adaptVerifiedSyntheticGroqReview({ caseId: sample.id, groqReview });
    const r = adapted.review;
    assert.equal(adapted.syntheticOnly, true);
    assert.equal(adapted.adapter, 'step-5-offline');
    assert.equal(r.model, OFFLINE_GROQ_CONTRACT_MODEL);
    assert.deepEqual(r.strengths.map(x => x.evidenceId), ['E1','E1']);
    assert.equal(r.strengths.length, 2);
    assert.equal(r.improvements.length, 2);
    assert.equal(r.slideComparisons.length, 2);
    assert.deepEqual(r.slideComparisons.map(x => x.slideNumber), [1,2]);
    assert.equal(r.slideOverview.length, 2);
    assert.equal(r.slideReviewStats.target, 2);
    assert.equal(r.slideReviewStats.accepted, 2);
    assert.equal(r.source, 'transcript_and_pptx');
    assert.ok(r.limitations.some(x => x.includes('ASR')));
    assert.ok(r.limitations.some(x => x.includes('giả lập')));
    const evidence = evidenceForSample(sample);
    for (const x of r.slideComparisons) {
      assert.equal(x.status, 'possible_difference');
      assert.equal(x.slideQuote, sample.slides[x.slideNumber - 1]);
      assert.equal(x.spokenQuote, evidence[x.slideNumber === 1 ? 'SOLUTION_1' : 'SOLUTION_2']);
      assert.ok(x.evidence.includes(x.spokenQuote));
    }
    for (const item of [...r.strengths, ...r.improvements]) {
      assert.ok(item.evidence.includes(sample.topic) || sample.transcript.includes(item.evidence));
    }
    assert.doesNotMatch(JSON.stringify(r), /\b(?:OPEN|CLOSE|LIMIT|SOLUTION_[12]|SLIDE_[12])\b/u);
  }
});

test('step 5: malformed or untrusted R1-R5 cannot masquerade as UI-ready output', () => {
  const sample = SYNTHETIC_COMPARISON_CASES[0];
  const valid = validateSyntheticCaseReview(mockModelResponse(), sample);
  for (const [id, value] of [
    ['unknown', valid], [sample.id, null], [sample.id, { summary: 'Giả', criteria: [] }],
    [sample.id, { ...valid, summary: 'Đạt 9/10 điểm.' }],
    [sample.id, { ...valid, criteria: valid.criteria.slice(0, 4) }],
    [sample.id, { ...valid, criteria: valid.criteria.map(c => c.criterion === 'R4' ? { ...c, evidenceIds: ['SLIDE_1'] } : c) }],
  ]) {
    assert.throws(() => adaptVerifiedSyntheticGroqReview({ caseId: id, groqReview: value }), {
      code: 'GROQ_SYNTHETIC_ADAPTER_REJECTED',
    });
  }
});

test('step 5: evidence is reconstructed from the selected fixture, never from model quote', () => {
  const sample = SYNTHETIC_COMPARISON_CASES[2];
  const review = validateSyntheticCaseReview(mockModelResponse(), sample);
  review.criteria[0].quote = 'Câu dẫn chứng giả được cố ý thêm bởi dữ liệu không đáng tin.';
  const adapted = adaptVerifiedSyntheticGroqReview({ caseId: sample.id, groqReview: review });
  assert.ok(!JSON.stringify(adapted).includes(review.criteria[0].quote));
  assert.equal(adapted.review.slideComparisons[0].slideQuote, sample.slides[0]);
});

test('step 5: adapter is offline and never changes Gemini or exposes student input', () => {
  const adapter = readFileSync(new URL('../server/groqSyntheticReviewAdapter.js', import.meta.url), 'utf8');
  const activeRoute = readFileSync(new URL('../api/ai/review.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/features/history/AiSpeechReviewPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(adapter, /requestGroqReview\s*\(|fetch\s*\(|process\.env|GROQ_API_KEY|api\/groq/u);
  assert.match(adapter, /validateSyntheticCaseReview\(groqReview, sample\)/u);
  assert.match(adapter, /parseGroundedReview\(JSON\.stringify\(candidates\), chunks, slides\)/u);
  assert.match(activeRoute, /new GoogleGenAI\(/u);
  assert.match(ui, /'\/api\/ai\/review'/u);
  assert.doesNotMatch(activeRoute, /groqSyntheticReviewAdapter|GROQ_API_KEY/u);
});
