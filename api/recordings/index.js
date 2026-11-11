/**
 * Owner-only metadata listing. Read-only and fail-closed.
 * Never leaks Google Drive IDs or service credentials.
 */
import { readSession } from '../../server/sessionCookie.js';
import { listOwnerRecordings, metadataConfigured } from '../../server/recordingMetadata.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Cookie');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Vui lòng đăng nhập Google để xem video cá nhân.' });
  if (!metadataConfigured()) {
    return res.status(503).json({
      configured: false,
      error: 'Kho dữ liệu video đám mây chưa kích hoạt trên Preview.',
    });
  }
  try {
    const recordings = await listOwnerRecordings(session.id);
    return res.status(200).json({
      recordings,
      cloudVideoPlaybackEnabled: false,
      cloudVideoUploadEnabled: false,
      cloudVideoDeleteEnabled: false,
    });
  } catch (error) {
    return res.status(error?.status || 503).json({
      error: error?.message || 'Chưa thể truy vấn video cá nhân.',
    });
  }
}
