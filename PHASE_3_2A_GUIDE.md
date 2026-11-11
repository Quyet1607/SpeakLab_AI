# SpeakLab AI – Đợt 3.2A: Ghi màn hình PowerPoint và micro

## Phạm vi
- Ghi **luồng màn hình đang chia sẻ** và **âm thanh micro đang bật** bằng `MediaRecorder`, trong một tệp video.
- Nút ghi hình trong thanh điều khiển, hộp thoại xác nhận, trạng thái REC và thời lượng ghi riêng.
- Dừng ghi và lưu video cục bộ về thiết bị; cảnh báo nếu rời phòng khi còn bản ghi chưa tải.
- Tự hoàn tất ghi khi người dùng chủ động tắt/đổi micro hoặc dừng chia sẻ.
- Không gọi lại quyền chia sẻ hay micro khi nguồn đã bật; không dừng thiết bị gốc chỉ vì dừng MediaRecorder.
- Không dùng API key, không tự tải video lên máy chủ.

## Chưa triển khai
- Ghép webcam vào video (Đợt 3.2B).
- Ghi slide PPTX nội bộ khi không chia sẻ màn hình.
- Thư viện phát lại video (Đợt 3.3).
- Phân tích AI, âm thanh hệ thống PowerPoint, tính năng ghi native Android/iOS.

## Kiểm thử thủ công trên bản build độc lập (HTTPS hoặc localhost)
1. Bật micro và kiểm tra thanh tín hiệu.
2. Chia sẻ **cửa sổ trình chiếu PowerPoint**, tránh chọn cửa sổ SpeakLab AI.
3. Nhấn nút ghi (hình tròn), đọc xác nhận và chọn **Bắt đầu ghi**.
4. Trình bày 30–60 giây, thử hiệu ứng Animation/Transition.
5. Nhấn **Dừng ghi**, đợi hoàn tất, nhấn **Lưu video**.
6. Mở video để xác nhận có hình màn hình PowerPoint và tiếng micro.
7. Thử tắt micro và dừng chia sẻ khi đang ghi; xác nhận có thông báo và tệp được hoàn tất.
8. Thử ghi hai lần, kiểm tra các chức năng camera, micro, trình chiếu PPTX và Vừa khung không bị ảnh hưởng.

## Lưu ý
- Chỉ báo tải về thành công theo nghĩa đã **yêu cầu tải**; người dùng cần kiểm tra tệp thực sự được lưu.
- `MediaRecorder.isTypeSupported()` được dùng để chọn định dạng, file có thể là WebM hoặc MP4 tùy trình duyệt.
- Video được lưu tạm trong RAM trình duyệt; video dài có thể cần nhiều bộ nhớ.
- Chưa thể xác nhận ghi âm/hình thực tế trên mọi trình duyệt hoặc thiết bị khi chưa kiểm thử.
- Nhánh phát triển: `feature/recording-3-2`. Không gộp vào `main` trước khi kiểm thử đạt.
