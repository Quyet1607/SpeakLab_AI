# SpeakLab AI – Bước 6.11.3: Lịch sử luyện tập thật, không cộng dữ liệu mẫu

Ngày triển khai: 12/11/2026. Chỉ nhánh `feature/recording-3-2`; **không thay đổi main/Production**.

## Lý do
Trước đó `sessionService` nạp sẵn 6 buổi luyện tập minh họa và giữ các buổi tạo mới trong bộ nhớ. Khi làm mới trang, số buổi và điểm số có thể không phản ánh thực tế, gây nhầm lẫn cho học sinh.

## Những thay đổi
1. Tạo `src/services/localPracticeHistory.ts` lưu **metadata** buổi luyện đã hoàn thành vào localStorage của cùng trình duyệt, giới hạn 200 buổi. Trường lưu: ID, tiêu đề, chế độ, chủ đề, thời lượng thực tế, số slide, người tham gia mô phỏng, thời điểm hoàn thành, Google sub (hoặc null cho nhóm khách). **Không lưu file PowerPoint, video, token, báo cáo hay điểm số giả.**
2. Mỗi buổi luyện bắt đầu đồng hồ từ **00:00**, không cộng 2 phút 25 giây giả lập.
3. Khi nhấn **Kết thúc** và chọn **Xem báo cáo** hoặc **Trở về Tổng quan**, backend login được kiểm tra lại; metadata buổi luyện được lưu dưới tài khoản đã bắt đầu phiên, không gán nhầm sang tài khoản Google khác đổi giữa chừng.
4. Trang Lịch sử và Tổng quan chỉ lấy buổi luyện thực sự hoàn thành. Số liệu demo (6 buổi, 8,3/10, +32%) không còn tính vào hồ sơ luyện tập cá nhân.
5. Do **chưa có phân tích AI từ dữ liệu thực**, chọn “Xem báo cáo” khi kết thúc buổi luyện sẽ dẫn tới Lịch sử và hiển thị thông báo rõ ràng. Các báo cáo ví dụ vẫn có thể mở từ menu “Báo cáo đánh giá” với nhãn Demo.
6. Giữ nguyên thư viện video IndexedDB và chức năng nhập/xem/tải/xóa. **Video ghi trước khi cập nhật không bị xóa.** Chúng chưa tự được chuyển thành “buổi luyện hoàn thành” vì không có metadata đủ tin cậy để khôi phục.
7. Thêm bài kiểm thử `tests/localPracticeHistory.test.js` chạy bằng Bun, xác nhận nhóm tài khoản, thời lượng thực, không lưu điểm/report/PowerPoint.

## Hạn chế
- Lịch sử chỉ tồn tại trên **trình duyệt/thiết bị hiện tại**; Google sign-in dùng để phân nhóm, không có bảo vệ cách ly thực sự khi nhiều người dùng cùng trình duyệt.
- Bộ nhớ web có thể bị xóa khi người dùng xóa dữ liệu trang, vào chế độ ẩn danh, hoặc bị trình duyệt dọn dẹp. Video chỉ ở IndexedDB; metadata lịch sử ở localStorage.
- Chức năng chấm điểm/speech analysis vẫn là mô phỏng; **không suy diễn thành đánh giá thực**.
- Các bản ghi video cũ vẫn ở mục “Video đã ghi” nhưng chưa được cộng vào số buổi hoàn thành. Những buổi mới chỉ được ghi nhận khi người dùng hoàn tất phòng luyện.
- Khi mạng mất, quá trình xác minh tài khoản có thể thất bại; không có đồng bộ máy chủ để xử lý xung đột.
- Dùng nhiều tài khoản chung thiết bị có thể truy cập dữ liệu lưu trên máy thông qua DevTools; cần thiết bị riêng nếu cần bảo mật.

## Kiểm tra Preview
1. Kiểm tra GitHub Actions **Check local video library**: Bun test + TypeScript check + build đều Success.
2. Redeploy/refresh nhánh Preview. Tổng quan không còn hiển thị 6 buổi demo như thành tích thật.
3. Đăng nhập Google, bắt đầu buổi luyện ngắn, chờ 20–30 giây, kết thúc, chọn Trở về Tổng quan.
4. Kiểm tra chỉ số buổi luyện tăng thêm 1; vào Lịch sử thấy thời lượng thực tế và tên bài.
5. Refresh trang: buổi luyện vẫn ở đó. Video cũ vẫn xem, tải và xóa như trước.
6. Nếu có tài khoản Google thử khác, đổi tài khoản: danh sách không bị trộn; lưu ý đây là phân nhóm UI, không thay thế bảo mật lưu trữ trên máy chủ.
7. Chỉ xem xét merge main sau khi kiểm thử với video thật, không chỉ dựa vào TypeScript build.

Không sử dụng Google Drive, Supabase hoặc hệ thống quản lý lớp học.
