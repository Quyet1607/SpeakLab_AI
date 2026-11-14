/** Phase 7.3.1 – authenticated, opt-in, Preview-only text assessment. */
import { GoogleGenAI, Type } from '@google/genai';
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import {
  FREE_REVIEW_MODEL, MAX_DETAILED_SLIDES, validateReviewRequest, makeEvidenceChunks,
  buildReviewPrompt, parseGroundedReview, ensureFreePreview, reserveReviewQuota,
  releaseReviewQuota, classifyReviewProviderError,
} from '../../server/freeSpeechReview.js';

const assessment = (slideCount) => ({
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    strengths: {
      type: Type.ARRAY, minItems: 2, maxItems: 2,
      items: {
        type: Type.OBJECT,
        properties: { point: { type: Type.STRING }, evidenceId: { type: Type.STRING } },
        required: ['point', 'evidenceId'],
      },
    },
    improvements: {
      type: Type.ARRAY, minItems: 2, maxItems: 2,
      items: {
        type: Type.OBJECT,
        properties: {
          point: { type: Type.STRING }, evidenceId: { type: Type.STRING },
          action: { type: Type.STRING },
        },
        required: ['point', 'evidenceId', 'action'],
      },
    },
    slideComparisons: {
      type: Type.ARRAY, minItems: Math.min(6, slideCount), maxItems: Math.min(MAX_DETAILED_SLIDES, slideCount),
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.INTEGER },
          status: { type: Type.STRING, enum: ['matched', 'partial', 'not_found', 'possible_difference'] },
          point: { type: Type.STRING }, slideQuote: { type: Type.STRING },
          spokenQuote: { type: Type.STRING }, evidenceId: { type: Type.STRING },
          covered: { type: Type.STRING }, missing: { type: Type.STRING },
          action: { type: Type.STRING },
        },
        required: ['slideNumber', 'status', 'point', 'slideQuote', 'spokenQuote', 'evidenceId',
          'covered', 'missing', 'action'],
      },
    },
    limitations: { type: Type.ARRAY, maxItems: 4, items: { type: Type.STRING } },
  },
  required: ['summary', 'strengths', 'improvements', 'slideComparisons', 'limitations'],
});

function secureHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export default async function handler(req, res) {
  secureHeaders(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST.' });
  }
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
  if (!/^application\/json(?:\s*;|\s*$)/iu.test(String(req.headers['content-type'] || ''))) {
    return res.status(415).json({ error: 'Dữ liệu phải là JSON.' });
  }
  const identity = readSession(req);
  if (!identity) return res.status(401).json({ error: 'Cần đăng nhập Google để nhận nhận xét AI.' });

  let input;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (typeof raw !== 'string' || raw.length > 58000) {
      return res.status(413).json({ error: 'Nội dung gửi quá dài. Hãy dùng bản ghi ngắn hơn.' });
    }
    input = validateReviewRequest(JSON.parse(raw));
  } catch {
    return res.status(400).json({ error: 'Thiếu đồng ý hoặc nội dung bài nói không hợp lệ.' });
  }

  const quotaDate = new Date().toISOString().slice(0, 10);
  try {
    // These are independent, mandatory guards. Never fall back to a paid model.
    ensureFreePreview();
    const remainingToday = await reserveReviewQuota(identity.id, process.env, fetch, quotaDate);
    const evidence = makeEvidenceChunks(input.transcript);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const output = await ai.models.generateContent({
      model: FREE_REVIEW_MODEL,
      contents: buildReviewPrompt(input, evidence),
      config: {
        temperature: 0.35,
        // One Gemini call only: allow room for up to 8 detailed slide comparisons.
        maxOutputTokens: input.slides.length ? 7200 : 3200,
        responseMimeType: 'application/json',
        responseSchema: assessment(input.slides.length),
      },
    });
    if (!output.text?.trim()) {
      // A valid provider response can still be empty, e.g. MAX_TOKENS/SAFETY.
      const reason = output.candidates?.[0]?.finishReason;
      const code = reason === 'MAX_TOKENS' ? 'GEMINI_OUTPUT_LIMIT' :
        reason === 'SAFETY' ? 'GEMINI_SAFETY_BLOCK' : 'GEMINI_EMPTY_OUTPUT';
      return res.status(502).json({
        code,
        error: reason === 'MAX_TOKENS'
          ? 'Gemini chưa xuất đủ nội dung nhận xét trong giới hạn đầu ra. Vui lòng thử lại.'
          : 'Gemini chưa trả về bản nhận xét. Hãy thử lại với bản ghi mẫu khác.',
      });
    }
    let review;
    try {
      review = parseGroundedReview(output.text, evidence, input.slides);
    } catch {
      return res.status(502).json({
        code: 'GEMINI_INVALID_FEEDBACK',
        error: 'Gemini đã trả lời nhưng nhận xét chưa đủ cấu trúc hoặc dẫn chứng hợp lệ. Không hiển thị đánh giá thiếu căn cứ.',
      });
    }
    return res.status(200).json({ review, remainingToday });
  } catch (error) {
    if (error?.safePublic === true && [429, 503].includes(error?.status)) {
      return res.status(error.status).json({ code: 'SPEAKLAB_FREE_TIER_GUARD', error: error.message });
    }
    // Never expose provider errors: they can include request metadata.
    const publicError = classifyReviewProviderError(error);
    if (publicError.code === 'GEMINI_TEMPORARILY_UNAVAILABLE') {
      const refunded = await releaseReviewQuota(identity.id, quotaDate);
      if (!refunded) {
        console.warn('[SpeakLab AI review] Quota refund failed after temporary Gemini outage.');
      }
    }
    // Log only the sanitized code/status; never log request data or raw provider errors.
    console.warn('[SpeakLab AI review] Provider request failed.', {
      code: publicError.code,
      status: publicError.status,
    });
    return res.status(publicError.status).json(publicError);
  }
}
