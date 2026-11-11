# SpeakLab AI – Đợt 3.2C (bước 1): Lịch sử video và chuẩn bị tích hợp Google Drive

## Trạng thái thực tế (không nhầm lẫn)
- Đã kiểm tra folder Drive giáo viên: `Video app SpeakLab`, ID `1Tv6v99rwN_7HzFuEn5vKA3epyso6G89c`. Folder riêng tư, chưa chia sẻ, lúc kiểm tra chưa có video.
- Video ghi trong buổi luyện được tự động lưu bằng IndexedDB ở trình duyệt **trên thiết bị đang sử dụng** sau khi dừng.
- Lịch sử luyện tập có mục “Video đã ghi” với phát video, tải về, xóa cục bộ.
- Chưa có upload Google Drive từ SpeakLab, chưa có đồng bộ tài khoản hoặc xóa file Drive. Không được mô tả đây là lưu cloud.
- Nhánh `main` giữ nguyên.

## Tại sao chưa nối Drive bằng khóa API tĩnh hoặc link thư mục?
Link folder và kết nối Drive của ChatGPT **không** cấp quyền cho web app. Video học sinh có thể chứa thông tin nhạy cảm.
Không nhúng OAuth refresh token, access token, client secret hoặc service account key vào React/Vite, mã GitHub hay biến `VITE_*`.
Không chia sẻ folder Drive công khai để cho phép video play.
Không cho phép người dùng nhập tùy ý file ID và xóa file Drive.

## Kiến trúc đề xuất cho bước 2
1. Học sinh đăng nhập vào SpeakLab AI. Backend xác minh ID token và quyền truy cập.
2. Backend giữ ủy quyền OAuth Google của giáo viên bằng secret store / DB mã hóa (không chia sẻ với browser).
3. `POST /api/recordings/init` kiểm tra quyền sở hữu session, tạo mã recording và phiên resumable upload vào đúng folder Drive. Không truyền token Google cho trình duyệt.
4. Upload video lớn theo khối (trực tiếp đến URI resumable của Drive chỉ nếu preflight CORS tương thích, hoặc qua storage trung gian / backend streaming), có retry và tiến độ. Không gửi nguyên video lớn qua Vercel Function giới hạn payload.
5. Backend lưu liên kết `{recordingId, ownerUserId, sessionId, driveFileId, size, mimeType, createdAt, status}` trong database.
6. `GET /api/recordings` trả về chỉ video thuộc tài khoản học sinh; `GET /api/recordings/:id/stream` xác thực và proxy bytes/HTTP Range hoặc cấp phát theo cơ chế có giới hạn và kiểm soát.
7. `DELETE /api/recordings/:id` xác thực người yêu cầu, đánh dấu pending, chuyển đúng Drive file vào Trash; chỉ cập nhật bản ghi khi Drive xác nhận. Tránh xóa nhầm hoặc mất đồng bộ. Giáo viên có vai trò quản trị tách biệt.
8. Chỉ hiển thị “Đã đồng bộ Google Drive” sau khi upload và ghi metadata thành công. Trong thất bại, giữ bản ghi cục bộ và hỗ trợ tải về.

## Google Cloud cần cấu hình để kích hoạt
- Project Cloud, bật Google Drive API, thiết lập consent screen.
- OAuth 2.0 web client cho backend, callback URI HTTPS chính xác.
- Giáo viên duy nhất thực hiện consent, chỉ cấp phạm vi quyền thực sự cần; ưu tiên `drive.file`, cân nhắc giới hạn của scope với folder tạo thủ công.
- Lưu credential an toàn trong môi trường máy chủ. Nếu cần thao tác với folder có sẵn qua `drive.file`, kiểm tra cách cấp quyền/Picker hoặc sử dụng quyền truy cập thích hợp, không giả định folder ID là đủ.
- Xác thực học sinh, chính sách quyền, chống truy cập chéo người dùng và CSDL bản ghi thực.

## Kiểm thử bước 1
1. Mở bản Preview nhánh `feature/recording-3-2`, bật micro và chia sẻ PowerPoint.
2. Bấm ghi, trình bày 15–30 giây, dừng ghi.
3. Bấm Kết thúc phòng họp, mở Lịch sử luyện tập, tìm video trong “Video đã ghi”.
4. Xem lại, tải về, làm mới trang rồi xem lại.
5. Xóa cục bộ, xác nhận video biến mất.
6. Kiểm tra camera/micro/chia sẻ màn hình vẫn hoạt động bình thường.
7. Lưu ý: bản ghi cục bộ có thể mất khi xóa dữ liệu trình duyệt hoặc dùng trình duyệt/thiết bị khác; video lớn có thể bị quota IndexedDB từ chối. KHÔNG dùng làm bản sao lưu duy nhất.

## Kiểm tra mã nguồn
Các file TypeScript được kiểm tra cú pháp, nhưng chưa xác nhận `npm run build` hoặc kiểm thử thiết bị thật trong môi trường hiện tại.
