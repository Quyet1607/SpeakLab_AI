/**
 * Isolated, opt-in teacher-operated adult-authored review rehearsal on Preview.
 * Disabled by default: explicit operator env gate, same-origin session, Redis.
 * Do NOT use student recordings or real PPTX files.
 */
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import { reserveGroqPilotQuota, ensureGroqPilotQuotaConfigured } from '../../server/groqPilotQuota.js';
import { runGenericGroqReview } from '../../server/groqGenericReviewEngine.js';
import {
  validateReviewRequest, MAX_TRANSCRIPT_CHARS, MAX_SLIDES,
  MAX_SLIDE_CHARS, MAX_SLIDE_TOTAL,
} from '../../server/freeSpeechReview.js';

const BRANCH = 'feature/groq-synthetic-pilot';
// Full existing SpeakLab text contract. Limits apply *before* any quota reservation.
const MAX_REQUEST_CHARS = 65000;
const MAX_REQUEST_BYTES = 100000;
const QUOTA_CODES = new Set([
  'GROQ_OPERATOR_DAILY_LIMIT', 'GROQ_SYSTEM_DAILY_LIMIT',
  'GROQ_SYSTEM_MINUTE_LIMIT', 'GROQ_CONCURRENT_LIMIT',
]);
const BLOCKED_CONTENT = [
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu,
  /(?:\+?84|0)\s?(?:\d[\s.-]?){9,10}/u,
  /(?:học sinh|phụ huynh|lớp\s*\d+[a-z]?|mã học sinh|số căn cước|cccd|địa chỉ nhà|ngày sinh|tên trường)/iu,
  /https?:\/\//iu,
];
const headers = res => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
};
function validAdultInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !==
      'adultSelfAuthored,confirmExternalTransfer,confirmOneCall,sessionId,slides,speakingGoal,topic,transcript' ||
      body.adultSelfAuthored !== true ||
      body.confirmExternalTransfer !== true ||
      body.confirmOneCall !== true) return null;
  let input;
  try {
    input = validateReviewRequest({
      consent: true, sessionId: body.sessionId, topic: body.topic,
      speakingGoal: body.speakingGoal, transcript: body.transcript, slides: body.slides,
    });
  } catch { return null; }
  if (input.transcript.length > MAX_TRANSCRIPT_CHARS ||
      input.slides.length > MAX_SLIDES || input.topic.length > 120 ||
      input.speakingGoal.length > 400 ||
      input.slides.some(s => s.text.length > MAX_SLIDE_CHARS) ||
      input.slides.reduce((sum, slide) => sum + slide.text.length, 0) > MAX_SLIDE_TOTAL) return null;
  const text = [input.topic, input.speakingGoal, input.transcript, ...input.slides.map(s => s.text)].join('\n');
  if (BLOCKED_CONTENT.some(pattern => pattern.test(text))) return null;
  // Conservative boundary, not a guarantee of de-identification. The
  // operator must still personally review all text before enabling a call.
  return { ...input, consent: true };
}

export function createAdultPreviewHandler({
  env = process.env, sessionReader = readSession,
  sameOrigin = isSameOriginRequest,
  quotaConfigured = ensureGroqPilotQuotaConfigured,
  quotaReserver = reserveGroqPilotQuota,
  runner = runGenericGroqReview,
} = {}) {
  return async function handler(req, res) {
    headers(res);
    if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
      return res.status(404).json({ error: 'Khu vực này chỉ dành cho nhánh Preview được phép.' });
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Chỉ hỗ trợ GET hoặc POST.' });
    }
    const identity = sessionReader(req, env);
    if (!identity) return res.status(401).json({ error: 'Cần đăng nhập Google trên tên miền Preview.' });
    if (identity.role !== 'teacher') {
      return res.status(403).json({ error: 'Chỉ tài khoản giáo viên vận hành mới được truy cập.' });
    }
    const enabled = env.SPEAKLAB_GROQ_ADULT_PILOT_ENABLED === 'true';
    if (req.method === 'GET') {
      return res.status(200).json({
        ready: enabled && Boolean(env.GROQ_API_KEY?.trim()),
        enabled, maxTranscriptChars: MAX_TRANSCRIPT_CHARS, maxSlides: MAX_SLIDES,
        maxSlideChars: MAX_SLIDE_CHARS, maxSlideTotal: MAX_SLIDE_TOTAL,
        note: 'Chỉ bài do người lớn tự viết, không có thông tin cá nhân. Không được dùng dữ liệu học sinh.',
      });
    }
    if (!enabled) return res.status(403).json({
      error: 'Thử nghiệm dữ liệu do người lớn tự viết chưa được chủ vận hành bật trên Preview.',
      code: 'ADULT_PILOT_DISABLED',
    });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
    if (!/^application\/json(?:\s*;|\s*$)/iu.test(String(req.headers['content-type'] || ''))) {
      return res.status(415).json({ error: 'Chỉ hỗ trợ JSON.' });
    }
    let body;
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!raw || raw.length > MAX_REQUEST_CHARS ||
          Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BYTES ||
          Number(req.headers['content-length'] || 0) > MAX_REQUEST_BYTES) {
        return res.status(413).json({ error: 'Bài nói vượt giới hạn thử nghiệm.' });
      }
      body = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: 'JSON không hợp lệ.' });
    }
    const input = validAdultInput(body);
    if (!input) return res.status(400).json({
      error: 'Chỉ nhận bài người lớn tự viết, không chứa thông tin định danh; tối đa 40 slide chữ và 24.000 ký tự bản ghi.',
      code: 'ADULT_INPUT_REJECTED',
    });
    if (!env.GROQ_API_KEY?.trim()) return res.status(503).json({ error: 'Groq chưa được cấu hình trên Preview.' });
    try { quotaConfigured(env); } catch {
      return res.status(503).json({ error: 'Chưa có Redis quota cho thử nghiệm.' });
    }
    let reservation;
    try {
      reservation = await quotaReserver({ identity, env });
    } catch (error) {
      if (error?.status === 429 && QUOTA_CODES.has(error.code)) {
        return res.status(429).json({ error: 'Đã hết hạn mức thử nghiệm Groq hoặc đang có một lượt xử lý.', code: error.code });
      }
      return res.status(503).json({ error: 'Không xác minh được quota. Groq chưa được gọi.' });
    }
    try {
      const result = await runner({ input, apiKey: env.GROQ_API_KEY });
      return res.status(200).json({
        review: result.review,
        model: result.model,
        note: 'Chỉ là kết quả thử nghiệm có kiểm soát; không phải nhận xét học sinh. Không lưu nội dung lên máy chủ SpeakLab.',
      });
    } catch (error) {
      const code = String(error?.code || '');
      if (code === 'GROQ_RATE_LIMIT') return res.status(429).json({ error: 'Groq Free Tier đã hết lượt; không tự gửi lại.' });
      if (code === 'GROQ_TIMEOUT') return res.status(504).json({ error: 'Hết thời gian chờ; không tự gửi lại.' });
      if (['GROQ_INVALID_REVIEW','GROQ_INCOMPLETE_SLIDE_REVIEW','GROQ_OUTPUT_LIMIT','GROQ_INVALID_RESPONSE'].includes(code)) {
        return res.status(502).json({ error: 'Groq không trả đủ nhận xét có dẫn chứng hợp lệ; không hiển thị phần chưa kiểm chứng.', code: 'INVALID_REVIEW' });
      }
      return res.status(502).json({ error: 'Không hoàn tất được yêu cầu tới Groq. Không tự động gửi lại.' });
    } finally {
      await reservation.release();
    }
  };
}

export default createAdultPreviewHandler();
