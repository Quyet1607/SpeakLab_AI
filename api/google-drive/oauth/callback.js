/**
 * Teacher-only OAuth callback. Performs ONE-TIME verification, then discards
 * Google tokens. No refresh token is displayed, logged, stored or sent to client.
 * Does not activate video storage or enable student access.
 */
import {
  readOAuthConfig,
  isExpectedServerOrigin,
  isOAuthStateValid,
  readCookie,
  clearStateCookie,
  htmlResponse,
  unconfiguredResponse,
  wrongOriginResponse,
  sendWebResponse,
  safeEquals,
  escapeHtml,
} from '../../../server/driveOAuthBootstrap.js';

function safeHtml(status, message, cookie = clearStateCookie()) {
  return htmlResponse(status, message, { 'Set-Cookie': cookie });
}

function parseGoogleError(body) {
  if (body?.error === 'invalid_grant') return 'Mã cấp quyền đã hết hạn hoặc địa chỉ callback không khớp.';
  if (body?.error === 'redirect_uri_mismatch') return 'Google báo sai Authorized redirect URI.';
  return 'Không thể hoàn tất bước cấp quyền với Google.';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const config = readOAuthConfig();
  if (!config) return sendWebResponse(res, unconfiguredResponse());
  if (!isExpectedServerOrigin(req, config)) return sendWebResponse(res, wrongOriginResponse());
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendWebResponse(res, safeHtml(405, '<h2>Chỉ hỗ trợ callback GET</h2>'));
  }

  const url = new URL(req.url || '/', new URL(config.redirectUri).origin);
  const state = url.searchParams.get('state');
  const cookie = readCookie({ headers: new Headers({ cookie: req.headers.cookie || '' }) });
  if (!isOAuthStateValid(state, cookie, config)) {
    return sendWebResponse(res, safeHtml(403, '<h2>Không xác minh được phiên kết nối</h2>' +
      '<p>Phiên có thể đã hết hạn (10 phút) hoặc không bắt đầu từ trang thiết lập của SpeakLab AI.</p>'));
  }
  if (url.searchParams.has('error')) {
    return sendWebResponse(res, safeHtml(400, '<h2>Chưa cấp quyền Google Drive</h2>' +
      '<p>Người dùng đã từ chối hoặc Google không thể hoàn tất yêu cầu.</p>'));
  }
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) {
    return sendWebResponse(res, safeHtml(400, '<h2>Thiếu mã OAuth hợp lệ</h2>'));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return sendWebResponse(res, safeHtml(400, '<h2>Google không cấp quyền truy cập</h2>' +
        '<p>' + parseGoogleError(tokenData) + '</p>'));
    }
    // Do not persist, log, print or expose access_token/refresh_token.
    const token = tokenData.access_token;
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(15000),
    });
    if (!profileRes.ok) {
      return sendWebResponse(res, safeHtml(502, '<h2>Không thể xác minh tài khoản Google</h2>'));
    }
    const profile = await profileRes.json();
    const profileEmail = String(profile.email || '').toLowerCase();
    if (!profile.email_verified || !safeEquals(profileEmail, config.ownerEmail)) {
      return sendWebResponse(res, safeHtml(403,
        '<h2>Tài khoản Google chưa được cho phép</h2>' +
        '<p>Vui lòng đăng nhập đúng tài khoản giáo viên sở hữu thư mục Drive. ' +
        'Ứng dụng không cấp quyền quản trị cho tài khoản này.</p>'));
    }

    const folderResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(config.folderId) +
        '?fields=id,name,mimeType,trashed,capabilities(canAddChildren,canReadRevisions),owners(emailAddress)&supportsAllDrives=true',
      { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) },
    );
    if (!folderResponse.ok) {
      // A manually-created folder can be invisible under drive.file until explicitly selected/opened with the app.
      return sendWebResponse(res, safeHtml(200,
        '<h2>Đã xác thực đúng giáo viên</h2>' +
        '<p>Đã kết nối OAuth tạm thời, nhưng ứng dụng <strong>chưa có quyền truy cập thư mục Drive hiện tại</strong> ' +
        'qua scope drive.file. Mã thư mục là chưa đủ. Cần cấp quyền riêng cho thư mục qua Google Picker ' +
        'hoặc chọn giải pháp thư mục do ứng dụng tạo.</p>' +
        '<p>Không lưu token, chưa bật tải video hay xóa Drive.</p>'));
    }
    const folder = await folderResponse.json();
    const isFolder = folder.id === config.folderId &&
      folder.mimeType === 'application/vnd.google-apps.folder' &&
      folder.trashed === false;
    const canWrite = folder.capabilities?.canAddChildren === true;
    if (!isFolder || !canWrite) {
      return sendWebResponse(res, safeHtml(403,
        '<h2>Thư mục chưa sẵn sàng</h2><p>Tài khoản xác thực không thể thêm video vào thư mục đã chọn, ' +
        'hoặc thư mục không hợp lệ.</p><p>Chưa lưu token và chưa bật kết nối Drive.</p>'));
    }

    return sendWebResponse(res, safeHtml(200,
      '<h2>Kiểm tra OAuth thành công</h2>' +
      '<p>Đã xác minh tài khoản giáo viên và quyền ghi vào thư mục: <strong>' +
      escapeHtml(folder.name || 'Thư mục SpeakLab AI') + '</strong>.</p>' +
      '<p><strong>Chú ý:</strong> Đây chỉ là phép kiểm tra một lần. ' +
      'Không lưu refresh token, chưa kích hoạt upload/video cloud. ' +
      'Cần triển khai kho lưu bí mật phía máy chủ và xác thực học sinh trước khi hoạt động chính thức.</p>'));
  } catch {
    return sendWebResponse(res, safeHtml(502, '<h2>Không thể kiểm tra Google Drive</h2>' +
      '<p>Có lỗi kết nối hoặc Google phản hồi quá thời gian. Hãy thử lại sau.</p>'));
  }
}
