/**
 * Teacher-only Google Drive OAuth bootstrap (Phase 3.2C).
 * POST a secret in the request body, never in a URL. No browser-side Google token.
 * This endpoint does not upload videos or authorize students.
 */
import {
  readOAuthConfig,
  isExpectedServerOrigin,
  makeOAuthState,
  setStateCookie,
  htmlResponse,
  wrongOriginResponse,
  unconfiguredResponse,
  sendWebResponse,
  safeEquals,
} from '../../../server/driveOAuthBootstrap.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function readSubmittedKey(req) {
  const body = req.body;
  if (body && typeof body === 'object' && typeof body.setup_key === 'string') return body.setup_key;
  if (typeof body === 'string') return new URLSearchParams(body).get('setup_key') || '';
  let bytes = 0;
  const parts = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 4096) return '';
    parts.push(chunk);
  }
  const params = new URLSearchParams(Buffer.concat(parts).toString('utf8'));
  return params.get('setup_key') || '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const config = readOAuthConfig();
  if (!config) return sendWebResponse(res, unconfiguredResponse());
  if (!isExpectedServerOrigin(req, config)) return sendWebResponse(res, wrongOriginResponse());

  if (req.method === 'GET') {
    return sendWebResponse(res, htmlResponse(200,
      '<h2>Kết nối Google Drive của giáo viên</h2>' +
      '<p>Chỉ giáo viên sở hữu Google Drive được thực hiện bước này. ' +
      'Đây là trang cấu hình một lần, <strong>không phải đăng nhập cho học sinh</strong>.</p>' +
      '<form action="/api/google-drive/oauth/start" method="post" autocomplete="off">' +
      '<label for="setup_key">Khóa thiết lập bảo mật (GOOGLE_OAUTH_SETUP_KEY trên Vercel)</label>' +
      '<input id="setup_key" name="setup_key" type="password" ' +
      'autocomplete="off" spellcheck="false" />' +
      '<button type="submit">Xác minh và tiếp tục với Google</button></form>' +
      '<p>Nhấn nút để gửi kiểm tra. Nếu khóa trống hoặc không hợp lệ, trang sẽ hiển thị lỗi cụ thể thay vì đứng yên.</p>' +
      '<p class="warning">Không gửi khóa, Client Secret hoặc token qua ChatGPT, ảnh chụp màn hình hay GitHub.</p>' +
      '<p>Sau bước cấp quyền, backend sẽ kiểm tra đúng tài khoản giáo viên và khả năng truy cập thư mục Drive. ' +
      'Chưa bật tính năng lưu video.</p>'));
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendWebResponse(res, htmlResponse(405, '<h2>Phương thức không hợp lệ</h2>'));
  }
  if (!String(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) {
    return sendWebResponse(res, htmlResponse(415, '<h2>Biểu mẫu không hợp lệ</h2>'));
  }
  let supplied;
  try { supplied = await readSubmittedKey(req); }
  catch { supplied = ''; }
  if (!supplied || !safeEquals(supplied, config.setupKey)) {
    return sendWebResponse(res, htmlResponse(403, '<h2>Không được phép kết nối</h2>' +
      '<p>Khóa thiết lập trống hoặc không chính xác. Hãy kiểm tra lại chuỗi đã nhập trong Vercel Preview, ' +
      'và bảo đảm nhập đủ ký tự, không có dấu cách thừa. Không thực hiện yêu cầu nào đến Google.</p>'));
  }

  const { state, cookie } = makeOAuthState(config);
  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email ' + DRIVE_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent select_account');

  res.statusCode = 303;
  res.setHeader('Location', authUrl.toString());
  res.setHeader('Set-Cookie', setStateCookie(cookie));
  res.end();
}
