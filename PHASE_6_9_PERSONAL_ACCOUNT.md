# SpeakLab AI — Bước 6.9: Tài khoản cá nhân và lịch sử video (Preview)

## Mục tiêu
Ứng dụng dành cho **học sinh tự luyện thuyết trình và phản biện**. Không tạo lớp học hay quản lý danh sách học sinh. Người dùng Google có thể luyện tập cá nhân; teacher identity chỉ dành cho công việc kết nối Google Drive phía backend sau này.

## Đã triển khai
- `POST /api/auth/session`: xác minh Google ID token tại server (khóa công khai Google, issuer, audience, hạn dùng), cấp cookie `__Host-speaklab-session` HttpOnly/Secure/SameSite=Lax có chữ ký HMAC.
- `GET /api/auth/session`: kiểm tra phiên Google còn hạn, không trả token cho frontend.
- `DELETE /api/auth/session`: đăng xuất, hết hiệu lực cookie trên trình duyệt.
- Cookie có thời gian tối đa 8 giờ và không dài hơn thời hạn ID token. Không lưu Google credential hoặc secret trong localStorage.
- Tài khoản được phân biệt bằng Google `sub` bất biến, không dựa vào tên demo hoặc email do người dùng tự nhập.
- **Khu vực tài khoản ở góc trên bên phải Header**: đăng nhập Google khi chưa có phiên; sau khi đăng nhập hiển thị tên/ảnh đại diện và menu xem thông tin, đăng xuất. Không có luồng đăng ký tài khoản SpeakLab riêng.
- Tên và ảnh đại diện trong header chuyển sang tài khoản Google khi đăng nhập; số liệu thống kê luyện tập được tính từ lịch sử cục bộ, không phải dữ liệu đám mây.
- Video **ghi mới** được lưu trong IndexedDB với `ownerSub` ở thời điểm dừng ghi nếu server xác minh được phiên. Lịch sử chỉ lọc theo `ownerSub` của tài khoản hiện tại, **để tiện dùng trên một thiết bị**.
- Video cũ chưa gắn tài khoản (`ownerSub` không có) được giữ nguyên, chỉ hiển thị khi ở chế độ khách. Không gán nhầm toàn bộ video cũ cho người mới đăng nhập.
- Nếu phiên server tạm không hoạt động, lưu video mới ở nhóm khách để không làm mất bản ghi; vẫn có thể tải về.
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
1. Mở nhánh Preview, nhấn nút Đăng nhập bằng Google ở góc trên bên phải Header.
2. Nếu hoạt động, hiển thị thông tin tài khoản và nút Đăng xuất; kiểm tra F5 vẫn đăng nhập.
3. Ghi thử video ngắn (PowerPoint + micro), dừng ghi, vào Lịch sử xem video dưới tài khoản đang đăng nhập.
4. Đăng xuất → Lịch sử chỉ hiện video cũ/khách, không có video gắn với tài khoản vừa đăng nhập.
5. Đăng nhập lại cùng tài khoản → video vừa ghi xuất hiện trở lại.
6. Nếu trước đó đã có video cũ, kiểm tra nó vẫn xuất hiện trong chế độ khách.
7. Kiểm thử camera, micro, screen share, PowerPoint, lưu/tải video và nút thoát phòng.

## GIỚI HẠN BẢO MẬT — ĐỌC KỸ
- **Không được xem bộ lọc IndexedDB theo tài khoản là bảo mật phân quyền thực sự.** Dữ liệu IndexedDB thuộc một website và có thể bị người khác dùng chung browser, tiện ích mở rộng hoặc DevTools truy cập. Không bảo đảm riêng tư giữa nhiều học sinh dùng chung thiết bị.
- Không sử dụng để bảo quản video nhạy cảm của học sinh trên máy dùng chung. Trong giai đoạn này nên thử với dữ liệu giả và máy cá nhân; tải bản quan trọng về máy.
- Khi dùng Drive cloud, API phải kiểm tra session cookie *trên server* và ánh xạ `ownerSub ↔ driveFileId` trong database; không tin `ownerSub` phía client. Chỉ kích hoạt sau khi có cơ sở dữ liệu metadata, token Drive an toàn, upload resumable và kiểm thử quyền owner-only.
- Google OAuth External/Testing có giới hạn test users khi đăng nhập; trước khi mở rộng cho học sinh cần cấu hình chính sách xác thực phù hợp và tuân thủ quy định dữ liệu người học. Google Sign-In chỉ dùng cho đăng nhập; không có nút đăng ký riêng và không yêu cầu quyền Google Drive.
- Nếu rotate `SPEAKLAB_SESSION_SECRET`, mọi phiên cookie cũ sẽ hết hiệu lực.

## Kế tiếp
Bước 6.10: thiết kế metadata database + upload chunked + server auth trên Drive + playback/delete theo chủ sở hữu. Không tạo lớp học, giáo viên chỉ quản lý OAuth Drive. **Không merge vào main khi chưa kiểm thử.**
