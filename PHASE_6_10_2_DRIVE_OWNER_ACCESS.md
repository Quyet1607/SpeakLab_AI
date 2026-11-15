# SpeakLab AI – Giai đoạn 6.10.2: xác minh chủ sở hữu video trên Google Drive

## Phạm vi đã triển khai
**Mã nguồn backend và kiểm thử, KHÔNG kích hoạt video đám mây.** Mục tiêu SpeakLab AI là để học sinh tự luyện thuyết trình; không có lớp học, danh sách học sinh hoặc Supabase.

- \`server/driveVideoAuthorization.js\`: kiểm tra Google \`sub\`, ID thư mục, UUID bản ghi, metadata file; so khớp \`appProperties.ownerSub\`, \`schemaVersion=1\`, \`recordingId\`, \`sessionId\`, \`mimeType\`, \`parents\`, \`trashed\`.
- \`server/driveVideoReader.js\`: gọi Drive \`files.list\` **chỉ đọc**, với query ràng buộc cả thư mục lẫn Google \`sub\`. Kiểm tra lại từng file sau khi Google trả về; bỏ qua file không đúng chủ, dữ liệu sai hoặc file khác định dạng. Không trả \`driveFileId\` hoặc email.
- \`api/google-drive/videos.js\`: GET đọc danh sách video cá nhân **chỉ khi** Google session hợp lệ và biến \`SPEAKLAB_DRIVE_READ_ONLY_ENABLED=true\`. Mặc định trả 503, không gọi Drive. Hiện tại chưa có refresh token được lưu; không bật cờ.
- \`tests/driveVideoAuthorization.test.js\`, \`tests/driveVideoReader.test.js\`: kiểm thử ngoại tuyến với data giả, không cần tài khoản Drive.
- \`npm run test:drive\`: chạy test Node tích hợp.
- \`.github/workflows/drive-ownership-tests.yml\`: thử chạy test tự động khi nhánh feature cập nhật mã liên quan.

## Metadata cho video Drive sau này
Khi tạo video bằng Drive API, backend sẽ đặt:
\`\`\`json
{
  "appProperties": {
    "ownerSub": "<Google sub đã được server xác minh>",
    "recordingId": "<UUID do server tạo>",
    "sessionId": "<mã phiên hợp lệ>",
    "schemaVersion": "1"
  }
}
\`\`\`
Đây chỉ là ví dụ cấu trúc, không phải dữ liệu thật. Những trường này không phải căn cứ duy nhất: trước khi đọc/phát/xóa, backend cần đối chiếu cả ID thư mục gốc, MIME type và trạng thái không bị xóa.

## Vì sao chưa bật API
Quy trình OAuth bootstrap trước đây **chỉ tạo và kiểm chứng thư mục**, không lưu refresh token Google. Việc bật Drive chỉ đọc khi chưa sẵn sàng sẽ tạo lỗi không cần thiết. Cần thêm giải pháp bí mật phía server, rồi kiểm chứng xem có đọc được chính thư mục được tạo bằng \`drive.file\`.

Đặc biệt, **không gửi access token, refresh token, Drive ID và mật khẩu cho học sinh**. Đường dẫn API chỉ chấp nhận cookie Google đã ký, lấy chủ sở hữu từ máy chủ; không nhận \`ownerSub\` client truyền vào.

## Bước tiếp theo 6.10.3
- Lưu refresh token của giáo viên an toàn ở backend, giải quyết OAuth đang ở Testing (token có thể hết hạn sau 7 ngày), không in hoặc chuyển token qua trình duyệt.
- Kiểm tra kỹ thuật resumable upload Google Drive và CORS, giới hạn request Function của Vercel; không upload toàn bộ video vào một POST Vercel.
- Khi có giải pháp bảo vệ token upload và nguồn phát, mới cho phép upload/download/delete cho owner-only.
- Kiểm thử hai tài khoản Google khác nhau, các video cũ trong IndexedDB, tình huống ngắt mạng và file lớn.

**Không có thao tác nào với main hoặc Production.** Chưa bật Google Drive upload, playback hay delete. 
