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

    // Application-created folders are accessible with drive.file, unlike a
    // manually-created folder whose ID was pasted into environment variables.
    const folderName = 'SpeakLab AI - Video recordings';
    const folderMime = 'application/vnd.google-apps.folder';
    const driveHeaders = { Authorization: 'Bearer ' + token };
    const query = [
      "name = '" + folderName.replace(/'/g, "\\'") + "'",
      "mimeType = '" + folderMime + "'",
      'trashed = false',
    ].join(' and ');
    const search = new URL('https://www.googleapis.com/drive/v3/files');
    search.searchParams.set('q', query);
    search.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,trashed,capabilities(canAddChildren))');
    search.searchParams.set('page_size', '100');
    // Drive API parameter is pageSize (camelCase).
    search.searchParams.delete('page_size');
    search.searchParams.set('pageSize', '100');
    const listingResponse = await fetch(search, {
      headers: driveHeaders,
      signal: AbortSignal.timeout(15000),
    });
    if (!listingResponse.ok) {
      return sendWebResponse(res, safeHtml(502,
        '<h2>Không thể kiểm tra thư mục SpeakLab AI</h2>' +
        '<p>Google Drive chưa cho phép liệt kê các thư mục do ứng dụng quản lý. ' +
        'Chưa tạo thư mục mới và chưa lưu token.</p>'));
    }
    const listing = await listingResponse.json();
    const existing = Array.isArray(listing.files) ? listing.files : [];
    if (listing.nextPageToken || existing.length > 1) {
      return sendWebResponse(res, safeHtml(409,
        '<h2>Cần kiểm tra thư mục trùng tên</h2>' +
        '<p>Ứng dụng thấy nhiều thư mục cùng tên hoặc danh sách chưa đầy đủ. ' +
        'Để tránh ghi nhầm dữ liệu, hệ thống chưa chọn thư mục nào. ' +
        'Hãy kiểm tra Google Drive và thử lại.</p>'));
    }

    let folder = existing[0] || null;
    let created = false;
    if (!folder) {
      const creationResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,trashed,capabilities(canAddChildren)',
        {
          method: 'POST',
          headers: { ...driveHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName, mimeType: folderMime }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!creationResponse.ok) {
        return sendWebResponse(res, safeHtml(502,
          '<h2>Không tạo được thư mục Google Drive</h2>' +
          '<p>Google không chấp nhận yêu cầu tạo thư mục bằng quyền drive.file. ' +
          'Chưa lưu token hoặc video. Hãy kiểm tra quyền đã cấp.</p>'));
      }
      folder = await creationResponse.json();
      created = true;
    }

    // The API can omit capabilities from a create response. Verify by fetching.
    const verifyResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(folder.id) +
        '?fields=id,name,mimeType,trashed,capabilities(canAddChildren)',
      { headers: driveHeaders, signal: AbortSignal.timeout(15000) },
    );
    if (!verifyResponse.ok) {
      return sendWebResponse(res, safeHtml(502,
        '<h2>Thư mục đã được tạo nhưng chưa xác minh được</h2>' +
        '<p>Hãy mở Google Drive để kiểm tra thư mục mới, sau đó thử xác minh lại. ' +
        'Không tạo thư mục khác bằng tay.</p>'));
    }
    const verified = await verifyResponse.json();
    if (verified.id !== folder.id ||
        verified.name !== folderName ||
        verified.mimeType !== folderMime ||
        verified.trashed !== false ||
        verified.capabilities?.canAddChildren !== true) {
      return sendWebResponse(res, safeHtml(403,
        '<h2>Thư mục chưa đủ quyền ghi</h2>' +
        '<p>Ứng dụng đã xác thực giáo viên nhưng không xác nhận được quyền thêm video vào thư mục. ' +
        'Chưa bật lưu trữ Drive.</p>'));
    }
    return sendWebResponse(res, safeHtml(200,
      '<h2>' + (created ? 'Đã tạo thư mục Google Drive thành công' :
        'Đã tìm thấy thư mục SpeakLab AI đã tạo trước đó') + '</h2>' +
      '<p>Đã xác minh đúng tài khoản giáo viên và quyền thêm tệp vào thư mục <strong>' +
      escapeHtml(verified.name) + '</strong>.</p>' +
      '<p><strong>Folder ID mới:</strong></p>' +
      '<p><code>' + escapeHtml(verified.id) + '</code></p>' +
      '<p>Hãy sao chép Folder ID trên và thay giá trị biến ' +
      '<code>GOOGLE_DRIVE_FOLDER_ID</code> tại <strong>Vercel Preview</strong>. ' +
      'Không dùng ID của thư mục cũ được tạo thủ công.</p>' +
      '<p><strong>Quan trọng:</strong> Bước này chỉ tạo và xác minh thư mục. ' +
      'Không lưu refresh token, chưa tải video lên Drive, chưa chia sẻ thư mục công khai, ' +
      'chưa bật chức năng xóa video.</p>'));

  } catch {
    return sendWebResponse(res, safeHtml(502, '<h2>Không thể kiểm tra Google Drive</h2>' +
      '<p>Có lỗi kết nối hoặc Google phản hồi quá thời gian. Hãy thử lại sau.</p>'));
  }
}
