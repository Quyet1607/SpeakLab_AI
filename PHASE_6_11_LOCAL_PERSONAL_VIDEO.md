# SpeakLab AI – Hướng phát triển sau khi dừng Google Drive (12/11/2026)

## Quyết định
- **Ngừng triển khai Google Drive và Supabase.** Không yêu cầu tiếp các bước OAuth refresh token hoặc Vercel Drive Vault.
- SpeakLab AI dành cho **học sinh tự luyện thuyết trình, phản biện và xem lại bản ghi**, không tạo lớp và không quản lý danh sách học sinh.
- Tài khoản Google vẫn dùng để nhận diện và **nhóm video trong cùng trình duyệt**. Đây không phải bảo mật phân quyền thực sự giữa nhiều người dùng chung thiết bị.
- Video lưu trong IndexedDB của trình duyệt hiện tại; hoàn toàn **không đồng bộ qua các thiết bị**.

## Đã triển khai trên feature/recording-3-2
- Giữ video đang có ở cùng IndexedDB (`speaklab_local_recordings_v1`), không xóa hoặc đổi schema.
- Video mới: lưu với nhãn `local_device`; video cũ với `local_pending_drive` vẫn đọc bình thường.
- Trang **Lịch sử luyện tập → Video đã ghi**: xem lại, tải video, xóa video trên trình duyệt, hiện đúng nhãn lưu tại thiết bị.
- **Nhập video từ máy**: tài khoản Google đang đăng nhập có thể chọn WebM/MP4, tối đa 1 GB. Tệp được ghi vào IndexedDB và gắn với Google `sub` hiện tại. Đây không phải tải video lên máy chủ. Nếu dung lượng trình duyệt không đủ, thao tác báo lỗi và tệp gốc vẫn nằm trên máy.
- Tránh kết quả truy vấn video cũ bị hiển thị sau khi người dùng chuyển phiên Google.
- Cập nhật lời giải thích trong Cài đặt và bản dự thảo Privacy/Terms trên Preview cùng GitHub Pages.
- Thêm GitHub Actions `Check local video library`: TypeScript + build giao diện, dùng Bun lockfile. Chỉ xác nhận hoàn thành sau khi workflow báo Success.

## Hạn chế
- **Các video của tài khoản A có thể bị người dùng chung browser truy cập qua IndexedDB/DevTools.** Đây chỉ là phân nhóm giao diện, không phải kho lưu trữ riêng tư trên server.
- Đăng nhập trên thiết bị khác không tự xuất hiện video của thiết bị cũ. Người dùng tự tải bản ghi WebM/MP4 xuống và nhập lại trên máy mới.
- Các thống kê điểm, báo cáo và nhiều buổi luyện trong Dashboard/History vẫn là nội dung demo, chưa phải dữ liệu cá nhân được đồng bộ tài khoản. Đừng dùng chúng như kết quả học tập thật.
- Phiên đăng nhập Google vẫn cần `GOOGLE_CLIENT_ID`, `SPEAKLAB_SESSION_SECRET` và endpoint `/api/auth/session`.
- Các API Drive cũ nằm trong nhánh nhưng không được giao diện gọi, và cờ đọc Drive vẫn phải để tắt. Không tiếp tục cấp OAuth hoặc lưu token; nếu có secret Drive trước đây, chủ sở hữu có thể thu hồi quyền trong Google Account và xóa biến Drive trên Vercel Preview sau khi xác nhận không có ứng dụng khác phụ thuộc.

## Lộ trình tối giản
1. **Hoàn thiện thư viện video cá nhân trên thiết bị:** xác nhận nhập/xem/tải/xóa, đăng xuất và đăng nhập lại trên Preview.
2. **Nâng cấp phòng luyện:** nâng cao trải nghiệm quay màn hình và micro, thời lượng, lỗi thiết bị, kiểm tra video thực sự phát đủ hình/tiếng.
3. **Báo cáo luyện tập thật:** thay dần dữ liệu demo bằng dữ liệu buổi luyện thực tế, phân biệt rõ chỉ số nào AI chưa hỗ trợ.
4. **Rà soát an toàn:** cảnh báo thiết bị dùng chung, hướng dẫn sao lưu, quy trình đồng thuận của học sinh và phụ huynh theo tình huống áp dụng.
5. Chỉ merge vào `main` khi build, video và trải nghiệm luyện tập được kiểm chứng.

Không phát hành thay đổi lên main/Production trong giai đoạn này.
