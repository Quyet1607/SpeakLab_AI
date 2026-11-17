/**
 * Existing SpeakLab history review integration: Groq option for learners.
 * The endpoint is disabled by default and has NO grant-creation API.
 * It requires a previously verified, scoped server-side consent record.
 */
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import {
  validateReviewRequest, MAX_TRANSCRIPT_CHARS, MAX_SLIDES,
  MAX_SLIDE_CHARS, MAX_SLIDE_TOTAL,
} from '../../server/freeSpeechReview.js';
import {
  requireVerifiedLearnerGroqGrant, isStudentGroqReviewConfigured,
} from '../../server/groqLearnerConsentGate.js';
import { ensureGroqPilotQuotaConfigured, reserveGroqPilotQuota } from '../../server/groqPilotQuota.js';
import { runGenericGroqReview } from '../../server/groqGenericReviewEngine.js';

const MAX_BYTES = 100000;
const PRIVATE_DATA = [
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu,
  /(?:\+?84|0)[\s.-]?(?:\d[\s.-]?){9,10}/u,
  /(?:\b(?:cccd|căn cước|số định danh)\s*(?:là|:)?\s*\d{9,12}\b)/iu,
];
function secure(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}
function errorResponse(res, status, code, message) {
  return res.status(status).json({ code, error: message });
}

export function createLearnerGroqReviewHandler({
  env = process.env, sessionReader = readSession, sameOrigin = isSameOriginRequest,
  grantReader = requireVerifiedLearnerGroqGrant,
  quotaConfigured = ensureGroqPilotQuotaConfigured,
  reserveQuota = reserveGroqPilotQuota, runner = runGenericGroqReview,
} = {}) {
  return async function handler(req, res) {
    secure(res);
    if (env.VERCEL_ENV !== 'preview' ||
        env.VERCEL_GIT_COMMIT_REF !== 'feature/groq-synthetic-pilot') {
      return errorResponse(res, 404, 'NOT_AVAILABLE', 'Chức năng chỉ có trên nhánh Preview.');
    }
    if (!['GET','POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return errorResponse(res, 405, 'METHOD_NOT_ALLOWED', 'Chỉ hỗ trợ GET hoặc POST.');
    }
    const identity = sessionReader(req, env);
    if (!identity) return errorResponse(res, 401, 'AUTH_REQUIRED', 'Cần đăng nhập Google.');
    if (identity.role !== 'learner') {
      return errorResponse(res, 403, 'LEARNER_ONLY', 'Quyền xử lý Groq dành cho học sinh phải được xác minh riêng.');
    }
    const configured = isStudentGroqReviewConfigured(env);
    // Readiness never consumes Groq quota, returns no student identifiers.
    if (req.method === 'GET') {
      if (!configured) return res.status(200).json({ ready: false, provider: 'gemini' });
      try {
        await grantReader({ identity, env });
        return res.status(200).json({ ready: Boolean(env.GROQ_API_KEY?.trim()), provider: 'groq' });
      } catch {
        return res.status(200).json({ ready: false, provider: 'gemini' });
      }
    }
    if (!sameOrigin(req)) return errorResponse(res, 403, 'INVALID_ORIGIN', 'Nguồn yêu cầu không hợp lệ.');
    if (!configured || !env.GROQ_API_KEY?.trim()) {
      return errorResponse(res, 403, 'GROQ_STUDENT_DISABLED', 'Groq cho học sinh chưa được cho phép trên máy chủ.');
    }
    if (!/^application\/json(?:\s*;|\s*$)/iu.test(String(req.headers['content-type'] || ''))) {
      return errorResponse(res, 415, 'JSON_REQUIRED', 'Chỉ hỗ trợ JSON.');
    }
    let body, input;
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_BYTES ||
          Number(req.headers['content-length'] || 0) > MAX_BYTES) {
        return errorResponse(res, 413, 'TOO_LARGE', 'Dữ liệu vượt giới hạn cho phép.');
      }
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).sort().join(',') !==
          'consent,sessionId,slides,speakingGoal,topic,topicDescription,transcript' ||
          body.consent !== true) throw Error('invalid');
      input = validateReviewRequest(body);
      if (input.transcript.length > MAX_TRANSCRIPT_CHARS || input.slides.length > MAX_SLIDES ||
          input.slides.some(x => x.text.length > MAX_SLIDE_CHARS) ||
          input.slides.reduce((total, x) => total + x.text.length, 0) > MAX_SLIDE_TOTAL) throw Error('limits');
    } catch {
      return errorResponse(res, 400, 'INVALID_INPUT', 'Chưa có đồng ý hoặc dữ liệu bài thuyết trình không hợp lệ.');
    }
    const text = [input.topic, input.topicDescription, input.speakingGoal,
      input.transcript, ...input.slides.map(x => x.text)].join('\n');
    if (PRIVATE_DATA.some(rule => rule.test(text))) {
      return errorResponse(res, 400, 'PERSONAL_DATA_REVIEW', 'Vui lòng rà soát thông tin cá nhân trong bài trước khi sử dụng Groq.');
    }
    // Both the server-side grant AND content check run immediately before
    // reserving quota. Client-provided consent cannot bypass this step.
    try { await grantReader({ identity, env }); } catch {
      return errorResponse(res, 403, 'GROQ_STUDENT_GRANT_REQUIRED', 'Chưa xác minh được đồng thuận xử lý dữ liệu Groq hoặc đã thu hồi/hết hạn.');
    }
    try { quotaConfigured(env); } catch {
      return errorResponse(res, 503, 'QUOTA_UNAVAILABLE', 'Không xác minh được hạn mức Groq.');
    }
    let reservation;
    try { reservation = await reserveQuota({ identity, env }); } catch (e) {
      return errorResponse(res, e?.status === 429 ? 429 : 503, 'QUOTA_UNAVAILABLE',
        'Hạn mức Groq đã hết hoặc không thể kiểm tra. Không tự gọi lại.');
    }
    try {
      const result = await runner({ input, apiKey: env.GROQ_API_KEY });
      return res.status(200).json({ review: result.review, model: result.model,
        note: 'Nhận xét từ Groq chỉ phân tích bản ghi và chữ slide; không gửi âm thanh, video hoặc PPTX gốc.' });
    } catch (e) {
      const code = e?.code === 'GROQ_RATE_LIMIT' ? 'GROQ_RATE_LIMIT' :
        e?.code === 'GROQ_TIMEOUT' ? 'GROQ_TIMEOUT' : 'GROQ_REVIEW_FAILED';
      return errorResponse(res, code === 'GROQ_RATE_LIMIT' ? 429 :
        code === 'GROQ_TIMEOUT' ? 504 : 502, code,
        'Groq chưa trả được nhận xét có dẫn chứng hợp lệ. Không tự động gửi lại.');
    } finally {
      await reservation.release();
    }
  };
}
export default createLearnerGroqReviewHandler();
