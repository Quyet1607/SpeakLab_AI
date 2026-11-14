# SpeakLab AI – Bước 6.11.5: Ghi video không cần chia sẻ PowerPoint

## Mục tiêu và phạm vi
Thực hiện trên `feature/recording-3-2` (Vercel Preview). Không sửa main/Production. Giữ mô hình học sinh tự luyện, không lưu video lên máy chủ, không Google Drive/Supabase.

## Hành vi ghi hình
- **Chưa chia sẻ màn hình:** bấm **Bật Camera**, **Bật Micro**, rồi nút **Ghi hình** (chấm tròn) và xác nhận. Video thu **camera + micro**, không cần PowerPoint.
- **Đã chia sẻ màn hình PowerPoint:** bấm **Bật Micro**, nút **Ghi hình** và xác nhận. Video thu **màn hình chia sẻ + micro**, không ghép thêm webcam. Vẫn giữ chức năng cũ.
- Nếu camera hoặc nguồn chia sẻ bị mất trong lúc ghi, video tự kết thúc để tránh hình đen. Tắt hoặc đổi camera trong lúc đang ghi camera cũng kết thúc bản ghi; người học có thể bắt đầu bản ghi mới sau đó.
- Không tự yêu cầu quyền camera/micro khi vào phòng. Quyền phải do người dùng bật riêng; khi bắt đầu ghi có bước xác nhận rõ ràng.
- Dừng ghi sẽ tạo video WebM/MP4 theo hỗ trợ của trình duyệt, lưu trong IndexedDB và có thể tải xuống. Mở **Lịch sử luyện tập → Video đã ghi** để xem lại.
- Ghi hình **không** ghi đồng thời webcam và màn hình trong cùng một video; chế độ có màn hình ưu tiên PowerPoint. Không tự động bắt đầu chia sẻ màn hình.

## Files
- `src/services/presentationRecordingService.ts`: nguồn video nhận `screen` hoặc `camera`, vẫn dùng MediaRecorder và các track thật, không sở hữu/đóng track đầu vào.
- `src/pages/MeetingRoomPage.tsx`: chọn nguồn dựa trên chia sẻ màn hình/camera đang bật; xử lý ngắt nguồn, thông báo và modal xác nhận.
- `src/features/meeting/MeetingControls.tsx`: nhãn ghi hình rõ ràng cho từng chế độ.
- `tests/presentationRecordingService.test.js`: kiểm thử giả lập camera+micro, screen+micro, mất nguồn, không tự cấp quyền.
- GitHub Actions `Check local video library`: chạy test ghi hình, kiểm thử lịch sử, TypeScript và build khi thay đổi.

## Kiểm tra trên Preview (cần làm thủ công)
1. Chờ Vercel Preview Ready, mở phòng luyện, **không chia sẻ PowerPoint**.
2. Bật camera và micro, kiểm tra hình camera/âm lượng hoạt động.
3. Bấm nút ghi hình đỏ, xác nhận; nói thử 15–20 giây; dừng ghi.
4. Mở Lịch sử → Video đã ghi → Xem lại. Kiểm tra thực sự có **hình từ camera và âm thanh micro**.
5. Đảm bảo video ghi trước đây còn nguyên.
6. Quay lại phòng, chia sẻ PowerPoint + bật micro; quay và xem lại một bản ghi màn hình để xác nhận không thoái lui.
7. Thử không bật camera/micro rồi bấm ghi: phải báo yêu cầu bật nguồn, không âm thầm ghi hình.

Chưa thể khẳng định camera/micro thật hoạt động trên máy cụ thể cho tới khi thử qua trình duyệt và phần cứng thực tế. Xem GitHub Actions để xác nhận kiểm thử/build; trạng thái Vercel Ready không thay thế kiểm thử ghi hình.
