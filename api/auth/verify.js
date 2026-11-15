/**
 * Preview-only authentication readiness endpoint.
 * Verifies Google ID token and reports stable identity; no enrollment or cloud
 * video access is granted by this endpoint.
 */
import { AuthError, verifyGoogleIdToken } from '../../server/googleIdentity.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return res.status(415).json({ error: 'Yêu cầu phải là JSON.' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const idToken = body?.credential;
    const account = await verifyGoogleIdToken(idToken);
    return res.status(200).json({
      authenticated: true,
      identity: {
        id: account.userId,
        name: account.displayName,
        role: account.role,
      },
      enrollmentRequired: false,
      cloudRecordingEnabled: false,
      message: account.role === 'teacher'
        ? 'Đã xác minh tài khoản giáo viên. Chưa bật lưu video cloud.'
        : 'Đã xác minh tài khoản cá nhân. Chưa bật lưu video lên Google Drive.',
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return res.status(status).json({
      authenticated: false,
      error: error instanceof AuthError ? error.message : 'Không thể xác minh đăng nhập.',
    });
  }
}
