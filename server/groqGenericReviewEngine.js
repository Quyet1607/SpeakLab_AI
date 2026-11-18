/**
 * Generic Groq review engine for gated adult-only Preview route.
 * Unlike the synthetic R1-R5 pilot, this accepts an arbitrary validated
 * presentation and produces the actual SpeakLab UI review contract.
 * Security/consent/age/privacy are enforced by the caller; this module must
 * never be exposed as an unauthenticated route.
 */
import {
  validateReviewRequest, makeEvidenceChunks, buildReviewPrompt,
  parseGroundedReview, MAX_SLIDES,
} from './freeSpeechReview.js';
import { requestGroqReview, GROQ_REVIEW_MODEL } from './groqReviewProvider.js';

const string = { type: 'string' };
const evidencePoint = {
  type: 'object', properties: { point: string, evidenceId: string },
};
const improvement = {
  type: 'object', properties: { point: string, evidenceId: string, action: string },
};
const slideComparison = {
  type: 'object', properties: {
    slideNumber: { type: 'integer' },
    status: { type: 'string', enum: ['matched', 'partial', 'not_found', 'possible_difference'] },
    point: string, slideQuote: string, spokenQuote: string, evidenceId: string,
    covered: string, missing: string, action: string,
  },
};
/** The same output fields as api/ai/review.js, converted to strict Groq JSON schema by provider. */
export const GROQ_GENERIC_REVIEW_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    summary: string,
    strengths: { type: 'array', items: evidencePoint },
    improvements: { type: 'array', items: improvement },
    slideComparisons: { type: 'array', items: slideComparison },
    limitations: { type: 'array', items: string },
  },
});

function rejected(code = 'GROQ_INVALID_REVIEW') {
  return Object.assign(new Error('Groq trả nhận xét không có cấu trúc hoặc dẫn chứng hợp lệ.'), { code });
}

/**
 * No fallback, retries, logging of inputs, cookie, quota or provider keys.
 * The caller must explicitly implement these before exposing a route.
 */
export async function runGenericGroqReview({
  input, apiKey, fetcher, timeoutMs = 30000,
} = {}) {
  let checked;
  try {
    checked = validateReviewRequest(input);
    if (checked.slides.length > MAX_SLIDES) throw rejected();
  } catch {
    throw rejected('GROQ_INVALID_REQUEST');
  }
  const evidence = makeEvidenceChunks(checked.transcript);
  const prompt = buildReviewPrompt(checked, evidence);
  // Reserve sufficient completion space for *every* text-bearing slide,
  // not merely the first few. A long deck may still exceed the model's
  // context/output/Free Tier limits: one request, then fail closed; never
  // silently trim slides or retry at additional cost.
  // Groq Free Tier currently exposes a low per-minute token budget. Keep the
  // single request deliberately compact so a normal full-deck review can fit
  // under that budget without silently dropping slides or retrying.
  const maxOutputTokens = checked.slides.length ? 3500 : 2800;
  const result = await requestGroqReview({
    apiKey, prompt, schema: GROQ_GENERIC_REVIEW_SCHEMA,
    maxOutputTokens, fetcher, timeoutMs,
  });
  let review;
  try {
    review = parseGroundedReview(result.text, evidence, checked.slides);
  } catch {
    throw rejected();
  }
  if (review.strengths.length !== 2 || review.improvements.length !== 2) throw rejected();
  // Groq may return a structurally valid report while one or more slide
  // comparisons fail our grounding checks (for example, an invented quote).
  // Do not discard the whole review and do not retry. Keep every verified
  // comparison, and represent each unverified slide explicitly as
  // "not_found" using only the original slide text. This keeps the report
  // complete without presenting an unverified AI claim as fact.
  if (checked.slides.length && review.slideReviewStats?.accepted !== checked.slides.length) {
    const verified = new Map((review.slideComparisons || []).map(item => [item.slideNumber, item]));
    const completed = checked.slides.map(slide => verified.get(slide.number) || ({
      slideNumber: slide.number,
      status: 'not_found',
      point: 'Chưa xác minh được nội dung lời nói tương ứng từ bản ghi ASR.',
      slideQuote: slide.text.trim().slice(0, 220),
      spokenQuote: '',
      evidenceId: '',
      evidence: '',
      covered: 'Chưa có dẫn chứng lời nói được xác minh cho slide này.',
      missing: 'Chưa tìm thấy dẫn chứng nguyên văn tương ứng trong bản ghi ASR.',
      action: 'Kiểm tra lại bản ghi lời nói và bổ sung phần giải thích tương ứng nếu có.',
    }));
    review.slideComparisons = completed;
    review.slideReviewStats = {
      ...(review.slideReviewStats || {}),
      target: checked.slides.length,
      received: review.slideReviewStats?.received ?? 0,
      accepted: completed.length,
      rejected: checked.slides.length - (review.slideReviewStats?.accepted ?? 0),
    };
  }
  return {
    review: {
      ...review,
      model: GROQ_REVIEW_MODEL,
      limitations: [
        ...review.limitations,
        'Kết quả từ Groq, chỉ phân tích văn bản, không đánh giá giọng nói hay hình ảnh.',
      ].slice(0, 5),
    },
    model: GROQ_REVIEW_MODEL,
  };
}
