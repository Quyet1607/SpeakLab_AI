# SpeakLab AI — Giai đoạn 6.10.1: Nền tảng metadata riêng tư

## Mục tiêu
Học sinh luyện thuyết trình, ghi hình và xem lại **video của chính mình**. Không có lớp, giáo viên duyệt học sinh, hoặc quản lý danh sách lớp. Drive của giáo viên sau này chỉ là kho lưu trữ phía backend.

## Mã nguồn đã triển khai trên Preview
- \`database/001_private_recordings.sql\`: bảng \`speaklab_recordings\` lưu ánh xạ Google \`sub\` của chủ video và Google Drive file ID; các trạng thái \`pending/uploading/ready/failed/deleting\`; các ràng buộc dữ liệu và chỉ mục theo chủ.
- Bật Supabase RLS và không cấp quyền bảng cho \`anon\` / \`authenticated\`. Không tạo public policy. API server mới được sử dụng service-role key.
- \`server/recordingMetadata.js\`: module **chỉ chạy ở backend**, lấy danh sách theo \`owner_sub\`, status \`ready\`, giới hạn 50, tuyệt đối không trả Drive file ID.
- \`GET /api/recordings\`: yêu cầu cookie phiên Google hợp lệ; chủ sở hữu được suy ra từ \`readSession(req).id\` thay vì từ URL hay body người dùng gửi.
- Khi thiếu cấu hình DB, trả 503 có thông báo rõ ràng, không hiển thị dữ liệu giả hoặc tự bật cloud.
- Không thay đổi camera, micro, PowerPoint, việc lưu video trong IndexedDB hay lịch sử video cục bộ.
- **Chưa có tải video lên Drive, chưa có phát video từ Drive, chưa có xóa video trên Drive.**

## Bước cấu hình tiếp theo — chỉ làm khi người dùng đồng ý
1. Tạo Supabase project riêng cho SpeakLab AI ở khu vực phù hợp với yêu cầu quản lý dữ liệu học sinh.
2. Mở SQL Editor của Supabase và chạy \`database/001_private_recordings.sql\` trên project mới. Kiểm tra bảng đã tạo.
3. Trong Vercel Project → Settings → Environment Variables → **Preview**, thêm:
   - \`SUPABASE_URL\`: URL HTTPS của Supabase project.
   - \`SUPABASE_SERVICE_ROLE_KEY\`: khóa **secret/service_role**, chỉ ở backend. KHÔNG dùng \`VITE_\`, KHÔNG commit khóa lên GitHub và không gửi khóa cho ChatGPT.
4. Redeploy **Preview only**. Không bật Production, không thay đổi \`main\`.
5. Trước khi ghi bất kỳ dữ liệu học sinh nào, kiểm thử DB RLS, GET yêu cầu đăng nhập (401), GET sau đăng nhập (trả danh sách rỗng \`[]\`), và người dùng A không thể đọc bản ghi của B. Không dùng dữ liệu thật trong giai đoạn đầu.

## Bảo vệ dữ liệu và giới hạn
- Video vẫn nằm trên thiết bị; IndexedDB không tạo bảo mật giữa những người dùng chung trình duyệt.
- Service key có quyền đặc biệt, **không được xuất hiện trong dữ liệu trả cho trình duyệt**; api duy trì owner-filter và phải bảo vệ mọi future write/delete bằng session riêng.
- Không lấy email, tên người dùng, \`ownerSub\` từ frontend để quyết định quyền trên Drive.
- Chưa có refresh token Drive lưu an toàn: OAuth bootstrap cũ chỉ kiểm tra và **không lưu** refresh token. Phải có kho bí mật trước khi triển khai upload thực.
- Google Drive resumable upload và kích thước video lớn cần thiết kế luồng truyền tệp không dùng Vercel Functions làm proxy toàn bộ nội dung.
- Chỉ lưu/chia sẻ video sau khi có thông báo và sự đồng thuận phù hợp đối với dữ liệu học sinh.

## Roadmap
**6.10.2 — Kết nối DB Preview + kiểm thử quyền:** tạo project, chạy migration, thêm bí mật, xác nhận API.
**6.10.3 — Token Drive & phiên upload an toàn:** thiết kế cách bảo quản refresh token, hỗ trợ video lớn mà không công khai Drive session URL hoặc file ID cho người ngoài.
**6.10.4 — Đồng bộ:** chỉ sau khi xác nhận an toàn, bật upload, playback và delete owner-only; kiểm thử 2 tài khoản/2 thiết bị, file large, lỗi mạng và trạng thái upload.
