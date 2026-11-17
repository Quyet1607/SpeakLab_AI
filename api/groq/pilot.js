/**
 * Preview-only synthetic Groq pilot. No student inputs.
 * Requires a distributed Redis reservation before calling Groq.
 */
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import { MODEL, runPilot } from '../../scripts/groqSyntheticPilot.mjs';
import { ensureGroqPilotQuotaConfigured, reserveGroqPilotQuota } from '../../server/groqPilotQuota.js';

const BRANCH = 'feature/groq-synthetic-pilot';
const QUOTA_ERRORS = Object.freeze({
  GROQ_OPERATOR_DAILY_LIMIT: 'Tài khoản vận hành đã hết lượt thử trong ngày UTC.',
  GROQ_SYSTEM_DAILY_LIMIT: 'Groq Pilot đã hết hạn mức toàn hệ thống trong ngày UTC.',
  GROQ_SYSTEM_MINUTE_LIMIT: 'Groq Pilot đã hết hạn mức toàn hệ thống trong phút hiện tại.',
  GROQ_CONCURRENT_LIMIT: 'Đang có một lượt Groq chạy. Không gửi lượt đồng thời.',
});
const secure = res => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Cookie');
};

export function createPilotHandler({
  env = process.env, sessionReader = readSession, sameOrigin = isSameOriginRequest,
  pilotRunner = runPilot, quotaConfigured = ensureGroqPilotQuotaConfigured,
  quotaReserver = reserveGroqPilotQuota,
} = {}) {
  return async function pilotHandler(req, res) {
    secure(res);
    if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
      return res.status(404).json({ error: 'Groq pilot chỉ tồn tại trên nhánh Preview được phép.' });
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Chỉ hỗ trợ GET và POST.' });
    }
    const identity = sessionReader(req, env);
    if (!identity) return res.status(401).json({ error: 'Hãy đăng nhập Google trên cùng tên miền Preview rồi mở lại trang này.' });
    if (identity.role !== 'teacher') {
      return res.status(403).json({ error: 'Chỉ tài khoản vận hành vai trò giáo viên mới được chạy thử.' });
    }
    if (!env.GROQ_API_KEY?.trim()) return res.status(503).json({ error: 'Vercel Preview chưa nhận GROQ_API_KEY.' });
    try { quotaConfigured(env); } catch {
      return res.status(503).json({ error: 'Chưa cấu hình Redis hạn mức Groq Pilot trên Vercel Preview.' });
    }
    if (req.method === 'GET') {
      // Config readiness, not a Redis network test. Does not consume quota.
      return res.status(200).json({ ready: true, model: MODEL, syntheticOnly: true, branch: BRANCH });
    }
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
    if (!/^application\/json(?:\s*;|\s*$)/iu.test(String(req.headers['content-type'] || '')) ||
        Number(req.headers['content-length'] || 0) > 256) {
      return res.status(415).json({ error: 'Định dạng yêu cầu không hợp lệ.' });
    }
    let request;
    try { request = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: 'JSON không hợp lệ.' }); }
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        Object.keys(request).length !== 2 ||
        request.syntheticOnly !== true || request.confirmOneCall !== true) {
      return res.status(400).json({ error: 'Chỉ cho phép dữ liệu thử đã viết sẵn; không nhận dữ liệu người dùng.' });
    }

    let reservation;
    try { reservation = await quotaReserver({ identity, env }); }
    catch (error) {
      if (error?.status === 429 && Object.hasOwn(QUOTA_ERRORS, error?.code)) {
        return res.status(429).json({ error: QUOTA_ERRORS[error.code], code: error.code });
      }
      return res.status(503).json({ error: 'Không xác nhận được hạn mức Redis. Groq chưa được gọi.', code: 'QUOTA_UNAVAILABLE' });
    }
    try {
      const result = await pilotRunner({ live: true, apiKey: env.GROQ_API_KEY });
      return res.status(200).json({
        model: MODEL, syntheticOnly: true, review: result.review,
        note: 'Đây là dữ liệu giả lập, chưa phải báo cáo học sinh.',
      });
    } catch (error) {
      if (error?.code === 'GROQ_RATE_LIMIT' || /429/u.test(String(error?.message || ''))) {
        return res.status(429).json({ error: 'Groq Free Tier đã chạm giới hạn. Không tự gọi lại hoặc chuyển sang API trả phí.' });
      }
      if (error?.code === 'GROQ_TIMEOUT') {
        return res.status(504).json({ error: 'Groq không phản hồi trong 30 giây. Không tự động gửi lại.' });
      }
      if (error?.code === 'GROQ_INVALID_REVIEW') {
        return res.status(502).json({
          error: 'Groq trả kết quả không vượt qua kiểm chứng Rubric/dẫn chứng. Đã loại bỏ.',
          code: 'INVALID_REVIEW',
        });
      }
      if (error?.code === 'GROQ_OUTPUT_LIMIT') {
        return res.status(502).json({ error: 'Groq vượt giới hạn đầu ra. Không tự động gửi lại.', code: 'OUTPUT_LIMIT' });
      }
      if (error?.code === 'GROQ_REFUSED') {
        return res.status(502).json({ error: 'Groq từ chối tạo nhận xét. Không tự động gửi lại.', code: 'PROVIDER_REFUSED' });
      }
      if (error?.code === 'GROQ_ACCESS_DENIED' || error?.code === 'GROQ_MODEL_UNAVAILABLE') {
        return res.status(502).json({ error: 'Cấu hình quyền truy cập hoặc mô hình Groq chưa sẵn sàng.', code: 'PROVIDER_UNAVAILABLE' });
      }
      if (error?.code === 'GROQ_INVALID_RESPONSE') {
        return res.status(502).json({ error: 'Groq không trả JSON hợp lệ.', code: 'INVALID_RESPONSE' });
      }
      if (error?.code === 'GROQ_UPSTREAM_HTTP') {
        return res.status(502).json({ error: 'Groq API tạm thời không phản hồi hợp lệ.', code: 'UPSTREAM_HTTP' });
      }
      return res.status(502).json({ error: 'Không kết nối được Groq. Không tự động gửi lại.', code: 'GROQ_NETWORK' });
    } finally {
      await reservation.release();
    }
  };
}
export default createPilotHandler();
