# SpeakLab AI — Bước 6.9: Bắt buộc đăng nhập Google và lịch sử cá nhân (Preview)

## Mục tiêu
Ứng dụng dành cho **học sinh tự luyện thuyết trình và phản biện**. Không tạo lớp học hay quản lý danh sách học sinh. Người dùng phải đăng nhập Google mới được vào ứng dụng; không có tài khoản khách hoặc luồng đăng ký SpeakLab riêng. Teacher identity chỉ dành cho công việc kết nối Google Drive phía backend sau này.

## Đã triển khai
- `POST /api/auth/session`: xác minh Google ID token tại server (khóa công khai Google, issuer, audience, hạn dùng), cấp cookie `__Host-speaklab-session` HttpOnly/Secure/SameSite=Lax có chữ ký HMAC.
- `GET /api/auth/session`: kiểm tra phiên Google còn hạn, không trả token cho frontend.
- `DELETE /api/auth/session`: đăng xuất, hết hiệu lực cookie trên trình duyệt.
- Cookie có thời gian tối đa 8 giờ và không dài hơn thời hạn ID token. Không lưu Google credential hoặc secret trong localStorage.
- Tài khoản được phân biệt bằng Google `sub` bất biến, không dựa vào tên demo hoặc email do người dùng tự nhập.
- **Khu vực tài khoản ở góc trên bên phải Header**: đăng nhập Google khi chưa có phiên; sau khi đăng nhập hiển thị tên/ảnh đại diện và menu xem thông tin, đăng xuất. Không có luồng đăng ký tài khoản SpeakLab riêng.
- Tên và ảnh đại diện trong header chuyển sang tài khoản Google khi đăng nhập; số liệu thống kê luyện tập được tính từ lịch sử cục bộ, không phải dữ liệu đám mây.
- Video **ghi mới** chỉ được lưu trong IndexedDB khi phiên Google được server xác minh; mỗi bản ghi được gắn ownerSub của tài khoản tại thời điểm lưu.
- Lịch sử buổi luyện, video, bản ghi lời nói, chữ trích từ slide và nhận xét AI chỉ được lưu/hiển thị trong nhóm ownerSub của tài khoản Google hiện tại. Đây là phân nhóm trên thiết bị, **không phải phân quyền bảo mật thực sự**.
- Khi mở ứng dụng sau thay đổi này, hệ thống tự xóa dữ liệu không có ownerSub hoặc ownerSub = null của chế độ khách khỏi trình duyệt hiện tại: lịch sử buổi luyện, video IndexedDB, bản ghi lời nói, chữ slide và nhận xét AI. Dữ liệu thuộc tài khoản Google có ownerSub hợp lệ được giữ nguyên.
- Nếu không xác minh được phiên Google, ứng dụng không cho vào trang luyện tập và không lưu dữ liệu khách.
- Không bật đồng bộ, xem hoặc xóa video trên Drive.

## Cần cấu hình thêm trên Vercel Preview

Thêm **một biến môi trường máy chủ mới**:

**Key:** `SPEAKLAB_SESSION_SECRET`

**Value:** một khóa ngẫu nhiên 32 byte, dạng Base64 (44 ký tự), được tạo bằng PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

- Chỉ chọn Preview, KHÔNG dùng tiền tố `VITE_`.
- Dùng khóa riêng, **khác** `GOOGLE_OAUTH_SETUP_KEY` và không bao giờ gửi qua ChatGPT/GitHub.
- Redeploy Preview sau khi thêm biến. Giữ `main` và Production không đổi.

## Kiểm thử
1. Mở nhánh Preview khi chưa đăng nhập: chỉ thấy màn hình đăng nhập Google, không thể vào Dashboard, Lịch sử hoặc phòng luyện.
2. Đăng nhập Google thành công: hệ thống dọn dữ liệu khách cũ trên trình duyệt hiện tại rồi mới mở ứng dụng.
3. Xác nhận dữ liệu có ownerSub của tài khoản Google vẫn còn nguyên sau khi dọn.
4. Ghi thử video ngắn (PowerPoint + micro), dừng ghi, vào Lịch sử xem video dưới đúng tài khoản Google.
5. Đăng xuất: ứng dụng quay về màn hình đăng nhập; không xuất hiện chế độ khách.
6. Đăng nhập lại cùng tài khoản: lịch sử và video của tài khoản đó vẫn xuất hiện.
7. Kiểm thử camera, micro, screen share, PowerPoint, lưu/tải video và nút thoát phòng.

## GIỚI HẠN BẢO MẬT — ĐỌC KỸ
- **Không được xem bộ lọc IndexedDB theo tài khoản là bảo mật phân quyền thực sự.** Dữ liệu IndexedDB thuộc một website và có thể bị người khác dùng chung browser, tiện ích mở rộng hoặc DevTools truy cập. Không bảo đảm riêng tư giữa nhiều học sinh dùng chung thiết bị.
- Dọn dữ liệu khách chỉ chạy trên trình duyệt/thiết bị mở phiên bản mới; không thể xóa từ xa bản dữ liệu khách nằm ở thiết bị khác chưa truy cập lại ứng dụng.
- Không sử dụng để bảo quản video nhạy cảm của học sinh trên máy dùng chung. Trong giai đoạn này nên thử với dữ liệu giả và máy cá nhân; tải bản quan trọng về máy.
- Khi dùng Drive cloud, API phải kiểm tra session cookie *trên server* và ánh xạ `ownerSub ↔ driveFileId` trong database; không tin `ownerSub` phía client. Chỉ kích hoạt sau khi có cơ sở dữ liệu metadata, token Drive an toàn, upload resumable và kiểm thử quyền owner-only.
- Google OAuth External/Testing có giới hạn test users khi đăng nhập; trước khi mở rộng cho học sinh cần cấu hình chính sách xác thực phù hợp và tuân thủ quy định dữ liệu người học. Google Sign-In chỉ dùng cho đăng nhập; không có nút đăng ký riêng và không yêu cầu quyền Google Drive.
- Nếu rotate `SPEAKLAB_SESSION_SECRET`, mọi phiên cookie cũ sẽ hết hiệu lực.

## Kế tiếp
Bước 6.10: thiết kế metadata database + upload chunked + server auth trên Drive + playback/delete theo chủ sở hữu. Không tạo lớp học, giáo viên chỉ quản lý OAuth Drive. **Không merge vào main khi chưa kiểm thử.**
