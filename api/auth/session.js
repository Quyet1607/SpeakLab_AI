/**
 * Google ID token -> signed, HttpOnly session cookie.
 * Supports a teacher and independent learner identities without requiring a
 * class roster. No cloud video operations or authorization are enabled.
 */
import { AuthError, verifyGoogleIdToken } from '../../server/googleIdentity.js';
import {
  sessionConfigured, makeSessionCookie, readSession, clearSessionCookie,
  isSameOriginRequest,
} from '../../server/sessionCookie.js';

function secureHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Cookie');
}

export default async function handler(req, res) {
  secureHeaders(res);
  if (!sessionConfigured()) {
    return res.status(503).json({
      authenticated: false,
      configured: false,
      error: 'Thiếu SPEAKLAB_SESSION_SECRET trong cấu hình Preview.',
    });
  }

  if (req.method === 'GET') {
    const identity = readSession(req);
    return res.status(200).json({
      authenticated: Boolean(identity),
      identity,
      cloudRecordingEnabled: false,
    });
  }

  if (req.method === 'DELETE') {
    if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ authenticated: false });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
  }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return res.status(415).json({ error: 'Yêu cầu phải có định dạng JSON.' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const account = await verifyGoogleIdToken(body?.credential);
    const session = makeSessionCookie(account);
    res.setHeader('Set-Cookie', session);
    return res.status(200).json({
      authenticated: true,
      identity: {
        id: account.userId,
        name: account.displayName,
        role: account.role,
      },
      cloudRecordingEnabled: false,
      message: account.role === 'teacher'
        ? 'Đã đăng nhập bằng Google với tài khoản giáo viên.'
        : 'Đã đăng nhập Google. Bạn có thể luyện tập cá nhân; video vẫn lưu trên thiết bị.',
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return res.status(status).json({
      authenticated: false,
      error: error instanceof AuthError ? error.message : 'Không thể tạo phiên đăng nhập.',
    });
  }
}
