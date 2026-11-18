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
  // A slide comparison can be omitted only with an explicit incomplete report;
  // never present partial analysis as if the entire deck were reviewed.
  if (checked.slides.length && review.slideReviewStats?.accepted !== checked.slides.length) {
    throw rejected('GROQ_INCOMPLETE_SLIDE_REVIEW');
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
