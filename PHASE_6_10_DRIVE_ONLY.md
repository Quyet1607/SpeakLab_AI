# SpeakLab AI — Bước 6.10 (rút gọn): Google Drive là nơi lưu duy nhất

## Quyết định thiết kế
Không yêu cầu Supabase, PostgreSQL hay hệ thống tạo/quản lý lớp. SpeakLab AI là ứng dụng học sinh **tự luyện thuyết trình, ghi hình và xem lại video cá nhân**. Google Drive của giáo viên là kho video backend duy nhất.

### Lưu video và chủ sở hữu ngay trên Drive
- Mỗi file video được tạo bởi SpeakLab Drive OAuth client trong thư mục Drive riêng đã tạo.
- Metadata riêng tư của Drive `appProperties`: `ownerSub` là Google `sub` do **server kiểm tra phiên**, `sessionId` là định danh phiên, `recordingId` là UUID do server tạo, `schemaVersion` là `1`. Không chép token, email, thông tin nhạy cảm vào appProperties.
- Tìm kiếm file với Drive `files.list(q)` đồng thời lọc `'<folderId>' in parents`, `trashed=false`, `appProperties has { key='ownerSub' and value='<verifiedGoogleSub>' }`. Server không dùng ownerSub từ URL/body do học sinh gửi.
- Khi phát video hoặc xóa: server gọi Drive `files.get` lấy `id,parents,appProperties,mimeType,trashed`; bắt buộc kiểm tra `ownerSub` khớp session, file thuộc thư mục SpeakLab, đúng MIME video, không bị trash. Không sử dụng URL share công khai.
- Không cho duyệt hoặc tìm file Drive khác, kể cả của tài khoản giáo viên; giáo viên chỉ cung cấp Drive OAuth để backend lưu tệp, không mặc định được xem video của học sinh qua ứng dụng.

## Các giới hạn phải giải quyết trước khi bật Cloud
1. **Refresh token giáo viên:** OAuth bootstrap hiện chỉ tạo thư mục và bỏ token, chưa đủ điều kiện để backend lưu video. Cần thiết kế lưu refresh token bảo mật, có cơ chế thay thế/thu hồi. Khi Google OAuth app ở Testing, refresh token có thể hết hạn sau 7 ngày.
2. **Giới hạn upload Vercel:** Vercel Function có giới hạn body 4,5 MB. Không thể POST toàn bộ video lớn qua Function. Cần thiết kế resumable uploads với đường truyền an toàn, đánh giá CORS Drive upload, hạn sử dụng URL phiên upload, và khả năng chống truy cập trái phép. Tuyệt đối không đưa token OAuth của giáo viên vào browser.
3. **Playback:** Server phải xác minh quyền owner trên mỗi yêu cầu; video lớn cần streaming/range hoặc kiến trúc phù hợp giới hạn response của Vercel.
4. **Delete:** server xác minh owner trước khi đưa Drive file vào thùng rác, phản hồi rõ ràng khi file không còn tồn tại.
5. **Dữ liệu học sinh:** cần thông báo lưu trữ/đồng thuận thích hợp và kiểm thử quyền của hai tài khoản khác nhau trước khi kích hoạt.
6. **Khôi phục:** dữ liệu video cũ trong IndexedDB hiện chưa có Drive copy, không được xóa/di chuyển tự động hoặc nhận sai chủ sở hữu.

## Giai đoạn
- **6.10.1** (hiện tại): chuyển thiết kế về Drive-only, loại bỏ các file metadata Supabase khỏi nhánh Preview; giữ nguyên giao diện/lịch sử video.
- **6.10.2**: phát triển module xác minh quyền truy cập trên Drive và bộ kiểm thử bằng Drive mock, chưa có upload thật.
- **6.10.3**: cấu hình token Drive phía server an toàn và cơ chế truyền video dung lượng lớn.
- **6.10.4**: bật đồng bộ, lịch sử trên nhiều thiết bị, phát/xóa có xác minh quyền; kiểm thử trước khi merge main.

Nguồn kỹ thuật:
- https://developers.google.com/workspace/drive/api/guides/properties
- https://developers.google.com/workspace/drive/api/guides/search-files
- https://vercel.com/docs/errors/function_payload_too_large

**Không cần làm tiếp bất cứ bước nào ở Supabase.** Có thể giữ Project Supabase mới tạo mà không sử dụng; nếu sau này không cần, chủ tài khoản có thể xóa riêng sau khi kiểm tra không có dữ liệu cần giữ. **Không thay đổi Production/main.**
