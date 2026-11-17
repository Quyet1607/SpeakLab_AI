/**
 * Groq Preview-only synthetic pilot. No user-uploaded or student data accepted.
 * Protect the API key and require the signed-in operator (teacher role).
 */
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import { MODEL, runPilot } from '../../scripts/groqSyntheticPilot.mjs';

const BRANCH = 'feature/groq-synthetic-pilot';
const WINDOW_MS = 60_000;
const secure = (res) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Cookie');
};

export function createPilotHandler({
  env = process.env,
  sessionReader = readSession,
  sameOrigin = isSameOriginRequest,
  pilotRunner = runPilot,
  now = Date.now,
} = {}) {
  const recent = new Map();
  const running = new Set();
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
      return res.status(403).json({ error: 'Chỉ tài khoản vận hành có vai trò giáo viên mới được chạy phép thử. Hãy kiểm tra GOOGLE_DRIVE_OWNER_EMAIL trên Preview.' });
    }
    if (!env.GROQ_API_KEY?.trim()) return res.status(503).json({ error: 'Vercel Preview chưa nhận GROQ_API_KEY. Kiểm tra phạm vi biến môi trường và deployment mới.' });
    if (req.method === 'GET') {
      return res.status(200).json({ ready: true, model: MODEL, syntheticOnly: true, branch: BRANCH });
    }
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
    if (!/^application\/json(?:\s*;|\s*$)/iu.test(String(req.headers['content-type'] || '')) ||
        Number(req.headers['content-length'] || 0) > 256) {
      return res.status(415).json({ error: 'Định dạng yêu cầu không hợp lệ.' });
    }
    let request;
    try {
      request = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: 'JSON không hợp lệ.' });
    }
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        Object.keys(request).length !== 2 ||
        request.syntheticOnly !== true || request.confirmOneCall !== true) {
      return res.status(400).json({ error: 'Chỉ cho phép chạy một bài thử đã được viết sẵn; không nhận dữ liệu người dùng.' });
    }
    const userId = identity.id;
    const time = now();
    if (running.has(userId) || time - (recent.get(userId) ?? -Infinity) < WINDOW_MS) {
      return res.status(429).json({ error: 'Đã gửi yêu cầu gần đây. Hãy đợi ít nhất 60 giây và không nhấn liên tục.' });
    }
    running.add(userId);
    recent.set(userId, time);
    try {
      const result = await pilotRunner({ live: true, apiKey: env.GROQ_API_KEY });
      return res.status(200).json({
        model: MODEL, syntheticOnly: true, review: result.review,
        note: 'Đây là dữ liệu giả lập, chưa phải báo cáo học sinh.',
      });
    } catch (error) {
      const message = typeof error?.message === 'string' ? error.message : '';
      if (message.includes('429')) return res.status(429).json({ error: 'Groq đã đạt giới hạn miễn phí. Không tự gọi lại.' });
      if (message.includes('Dẫn chứng') || message.includes('Tiêu chí') ||
          message.includes('điểm số') || message.includes('cấu trúc') ||
          message.includes('Tóm tắt') || message.includes('giới hạn đánh giá')) {
        return res.status(502).json({ error: 'Groq trả nhận xét chưa đạt kiểm chứng Rubric/dẫn chứng. Không hiển thị nhận xét chưa xác minh.' });
      }
      return res.status(502).json({ error: 'Thử nghiệm Groq chưa thành công. Có thể do mô hình, giới hạn hoặc phản hồi không hợp lệ; kiểm tra trạng thái Groq.' });
    } finally {
      running.delete(userId);
    }
  };
}

export default createPilotHandler();
