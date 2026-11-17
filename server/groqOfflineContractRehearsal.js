/**
 * Offline-only contract rehearsal. Converts deterministic fictional fixtures
 * to the existing validated SpeakLab review-result shape.
 *
 * No provider request, route export, student input or consent grant.
 * This is deliberately NOT a Groq-to-Gemini replacement adapter.
 */
import { SYNTHETIC_COMPARISON_CASES } from '../tests/fixtures/groqSyntheticComparisonCases.js';
import { makeEvidenceChunks, parseGroundedReview } from './freeSpeechReview.js';

const label = 'offline-contract-mock';
function contractError() {
  return Object.assign(new Error('Chỉ kiểm tra hợp đồng với mẫu giả lập nội bộ.'), {
    code: 'SYNTHETIC_CONTRACT_ONLY',
  });
}
export function listOfflineContractCases() {
  return SYNTHETIC_COMPARISON_CASES.map(s => ({ id: s.id, label: s.label }));
}
function fixedSample(id) {
  if (typeof id !== 'string') throw contractError();
  const sample = SYNTHETIC_COMPARISON_CASES.find(s => s.id === id);
  if (!sample) throw contractError();
  return sample;
}
function safeQuote(text) {
  // The original source text, never model-written: substring of a chosen E1.
  return text.slice(0, Math.min(65, text.length)).trim();
}
export function makeOfflineContractFixture(caseId) {
  const sample = fixedSample(caseId);
  const evidence = makeEvidenceChunks(sample.transcript);
  const slideTexts = sample.slides.map((text, i) => ({ number: i + 1, text }));
  const sourceId = evidence[0]?.id;
  if (!sourceId) throw contractError();
  const spokenQuote = safeQuote(evidence[0].text);
  const candidates = {
    summary: 'Bài nói có hai biện pháp thực tế và nêu giới hạn của bằng chứng hiện có.',
    strengths: [
      { point: 'Bài đã giới thiệu đúng chủ đề cần trình bày trong phần mở đầu.', evidenceId: sourceId },
      { point: 'Bài đã đề xuất hai hành động có thể triển khai trong tình huống cụ thể.', evidenceId: sourceId },
    ],
    improvements: [
      { point: 'Bản ghi chưa có kết quả đo lường để chứng minh hiệu quả của hai biện pháp.', evidenceId: sourceId,
        action: 'Hãy mô tả cách theo dõi kết quả bằng một bảng ghi chép trước khi kết luận.' },
      { point: 'Phần kết nên nhắc lại rõ hơn điều kiện để áp dụng các biện pháp.', evidenceId: sourceId,
        action: 'Thêm một câu kết tóm tắt hai giải pháp và giới hạn thực hiện của chúng.' },
    ],
    slideComparisons: slideTexts.map(slide => ({
      slideNumber: slide.number,
      status: 'possible_difference',
      point: 'Chỉ đối chiếu chữ trên slide với văn bản bài nói trong bản ghi có sẵn.',
      slideQuote: slide.text.slice(0, 60),
      spokenQuote,
      evidenceId: sourceId,
      covered: 'Bản ghi nhắc đến các giải pháp cùng chủ đề cần xem xét đối chiếu.',
      missing: 'Chưa xác nhận bằng chứng đồng bộ thời điểm trình chiếu và lời nói.',
      action: 'Đọc lại nội dung của slide và đối chiếu với câu tương ứng trong bản ghi.',
    })),
    limitations: ['Đây là một mẫu hư cấu được tạo để kiểm tra cấu trúc đầu ra.'],
  };
  return { sample, evidence, slideTexts, candidates };
}
export function validateOfflineContractFixture(caseId) {
  const fixture = makeOfflineContractFixture(caseId);
  // Reuse the actual existing result validator. Never call an AI provider.
  const review = parseGroundedReview(
    JSON.stringify(fixture.candidates), fixture.evidence, fixture.slideTexts,
  );
  if (review.strengths.length !== 2 || review.improvements.length !== 2 ||
      review.slideOverview.length !== fixture.slideTexts.length ||
      review.slideComparisons.length !== fixture.slideTexts.length) {
    throw contractError();
  }
  return {
    caseId: fixture.sample.id,
    source: label,
    review: { ...review, model: label },
  };
}
