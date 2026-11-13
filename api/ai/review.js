/** Phase 7.3.1 – authenticated, opt-in, Preview-only text assessment. */
import { GoogleGenAI, Type } from '@google/genai';
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import {
  FREE_REVIEW_MODEL, validateReviewRequest, makeEvidenceChunks,
  buildReviewPrompt, parseGroundedReview, ensureFreePreview, reserveReviewQuota,
} from '../../server/freeSpeechReview.js';

const assessment = {
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
      type: Type.ARRAY, maxItems: 2,
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.INTEGER }, point: { type: Type.STRING },
          evidenceId: { type: Type.STRING },
        },
        required: ['slideNumber', 'point', 'evidenceId'],
      },
    },
    limitations: { type: Type.ARRAY, maxItems: 4, items: { type: Type.STRING } },
  },
  required: ['summary', 'strengths', 'improvements', 'slideComparisons', 'limitations'],
};

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

  try {
    // These are independent, mandatory guards. Never fall back to a paid model.
    ensureFreePreview();
    const remainingToday = await reserveReviewQuota(identity.id);
    const evidence = makeEvidenceChunks(input.transcript);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const output = await ai.models.generateContent({
      model: FREE_REVIEW_MODEL,
      contents: buildReviewPrompt(input, evidence),
      config: {
        temperature: 0.35,
        maxOutputTokens: 1800,
        responseMimeType: 'application/json',
        responseSchema: assessment,
      },
    });
    const review = parseGroundedReview(output.text || '', evidence, input.slides);
    return res.status(200).json({ review, remainingToday });
  } catch (error) {
    if ([429, 503].includes(error?.status)) {
      return res.status(error.status).json({ error: error.message });
    }
    const providerStatus = Number(error?.status || error?.code || 0);
    if (providerStatus === 429 || /RESOURCE_EXHAUSTED|quota|rate.limit/iu.test(String(error?.message || ''))) {
      return res.status(429).json({ error: 'Đã hết hạn mức Gemini miễn phí. Hệ thống không tự sử dụng API trả phí.' });
    }
    // Do not log or return user transcript, model output or provider credentials.
    return res.status(502).json({ error: 'AI chưa trả về nhận xét có thể kiểm chứng. Vui lòng thử lại sau.' });
  }
}
