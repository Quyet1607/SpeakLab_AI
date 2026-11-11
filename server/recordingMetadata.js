/**
 * Server-only metadata access for SpeakLab Drive recordings.
 * This module never accepts owner identity from client input.
 * Do not enable upload/delete until secure Drive authorization is implemented.
 */
const TABLE = 'speaklab_recordings';

export function metadataConfigured(env = process.env) {
  try {
    const url = new URL(env.SUPABASE_URL || '');
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') &&
      typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' &&
      env.SUPABASE_SERVICE_ROLE_KEY.trim().length >= 32;
  } catch {
    return false;
  }
}

function metadataSettings(env) {
  if (!metadataConfigured(env)) {
    const error = new Error('Chưa cấu hình kho dữ liệu video trên Preview.');
    error.status = 503;
    throw error;
  }
  const origin = new URL(env.SUPABASE_URL).origin;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const headers = {
    apikey: secret,
    Accept: 'application/json',
    'Cache-Control': 'no-store',
  };
  // Legacy service_role JWT is also valid as an Authorization bearer token.
  // Newer sb_secret keys must be supplied via apikey, not as a Bearer JWT.
  if (secret.split('.').length === 3) headers.Authorization = 'Bearer ' + secret;
  return { origin, headers };
}

export async function listOwnerRecordings(ownerSub, env = process.env) {
  if (typeof ownerSub !== 'string' || !/^[0-9]{5,64}$/.test(ownerSub)) {
    const error = new Error('Danh tính chủ sở hữu không hợp lệ.');
    error.status = 403;
    throw error;
  }
  const { origin, headers } = metadataSettings(env);
  const requestUrl = new URL('/rest/v1/' + TABLE, origin);
  requestUrl.searchParams.set('select', 'id,session_id,title,mime_type,size_bytes,status,created_at');
  requestUrl.searchParams.set('owner_sub', 'eq.' + ownerSub);
  requestUrl.searchParams.set('status', 'eq.ready');
  requestUrl.searchParams.set('order', 'created_at.desc');
  requestUrl.searchParams.set('limit', '50');

  let response;
  try {
    response = await fetch(requestUrl, {
      method: 'GET', headers, cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    const error = new Error('Không kết nối được kho dữ liệu video.');
    error.status = 503;
    throw error;
  }
  if (!response.ok) {
    // Never leak upstream response bodies or credentials to clients.
    const error = new Error('Chưa thể đọc danh sách video trên máy chủ.');
    error.status = 503;
    throw error;
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) {
    const error = new Error('Dữ liệu video trả về không hợp lệ.');
    error.status = 502;
    throw error;
  }
  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    status: row.status,
    // Intentionally NEVER return owner_sub, drive_file_id, signed URL or secret.
  }));
}
