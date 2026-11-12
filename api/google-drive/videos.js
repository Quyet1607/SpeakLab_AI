/**
 * Preview-only, read-only Drive video listing.
 * Kept disabled by default; never triggers OAuth, upload, playback or deletion.
 */
import { readSession } from '../../server/sessionCookie.js';
import { listOwnedDriveVideos } from '../../server/driveVideoReader.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Cookie');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const account = readSession(req);
  if (!account) return res.status(401).json({ error: 'Vui lòng đăng nhập Google.' });

  // Require an explicit future decision to enable read-only Drive listing.
  // This flag is NEVER set by frontend or client cookies.
  if (process.env.SPEAKLAB_DRIVE_READ_ONLY_ENABLED !== 'true') {
    return res.status(503).json({
      enabled: false,
      error: 'Danh sách video Google Drive chưa được kích hoạt trên Preview.',
    });
  }
  try {
    const videos = await listOwnedDriveVideos(account.id);
    return res.status(200).json({
      videos,
      canUpload: false,
      canPlay: false,
      canDelete: false,
    });
  } catch (error) {
    return res.status(error?.status === 401 ? 401 : 503).json({
      error: error?.status === 401
        ? 'Cần phiên Google hợp lệ.'
        : 'Chưa thể đọc danh sách video Drive. Kiểm tra kết nối backend.',
    });
  }
}
