/**
 * Drive-only read adapter. Server only.
 * Requires OAuth refresh token kept as a Preview secret.
 * No student ever receives an access token, refresh token or Drive file ID.
 */
import {
  makeOwnerVideoQuery,
  assertOwnedVideoMetadata,
  publicRecordingMetadata,
  validateDriveFolderId,
  validateGoogleSubject,
} from './driveVideoAuthorization.js';

function readConfig(env = process.env) {
  const folderId = validateDriveFolderId(String(env.GOOGLE_DRIVE_FOLDER_ID || ''));
  const clientId = String(env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(env.GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = String(env.GOOGLE_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !refreshToken) {
    const error = new Error('Google Drive chưa được kết nối để đọc video.');
    error.status = 503;
    throw error;
  }
  return { folderId, clientId, clientSecret, refreshToken };
}

async function getAccessToken(config, fetcher = fetch) {
  let response;
  try {
    response = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    const error = new Error('Không thể kết nối dịch vụ xác thực Google.');
    error.status = 503;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Quyền Google Drive cần được cấp lại hoặc kiểm tra.');
    error.status = 503;
    throw error;
  }
  const token = await response.json();
  if (typeof token.access_token !== 'string' || token.access_token.length < 20) {
    const error = new Error('Google không trả về mã truy cập hợp lệ.');
    error.status = 503;
    throw error;
  }
  return token.access_token;
}

async function driveGet(url, accessToken, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(url, {
      headers: { Authorization: 'Bearer ' + accessToken },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    const error = new Error('Không thể liên lạc với Google Drive.');
    error.status = 503;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Không thể đọc dữ liệu Google Drive.');
    error.status = 503;
    throw error;
  }
  return response.json();
}

/**
 * Read-only listing with strict folder and Google-sub ownership validation.
 * Invalid/legacy files are skipped, not silently adopted.
 */
export async function listOwnedDriveVideos(ownerSub, env = process.env, fetcher = fetch) {
  const subject = validateGoogleSubject(ownerSub);
  const config = readConfig(env);
  const token = await getAccessToken(config, fetcher);
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', makeOwnerVideoQuery(config.folderId, subject));
  url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,trashed,parents,appProperties,size,createdTime)');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('spaces', 'drive');
  const result = await driveGet(url.toString(), token, fetcher);
  // Fail-closed on incomplete list (do not claim this is a complete library).
  if (!Array.isArray(result.files) || result.nextPageToken) {
    const error = new Error('Danh sách Drive chưa đầy đủ; vui lòng thử lại.');
    error.status = 503;
    throw error;
  }
  const safe = [];
  const seenRecordings = new Set();
  for (const file of result.files) {
    try {
      assertOwnedVideoMetadata(file, config.folderId, subject);
      const record = publicRecordingMetadata(file, config.folderId, subject);
      if (seenRecordings.has(record.recordingId)) continue;
      seenRecordings.add(record.recordingId);
      safe.push(record);
    } catch {
      // Foreign, unowned, malformed or legacy files are never returned.
    }
  }
  return safe;
}
