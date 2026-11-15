# SpeakLab AI – Phòng họp mô phỏng, không tự chèn slide mẫu (12/11/2026)

## Mục tiêu
Mô phỏng trải nghiệm phòng họp giống Teams / Meet / Zoom cho **một học sinh luyện tập thật**, những người còn lại là **nhân vật mô phỏng**. Không có tài khoản khác đăng nhập phòng và không mô phỏng cuộc gọi video/âm thanh thật từ họ. Người học có thể bấm vào từng nhân vật để nhận **câu hỏi phản biện mô phỏng dưới dạng chữ**, sau đó tự trả lời bằng micro.

## Mặc định
1. Trong màn hình chuẩn bị, lựa chọn đầu tiên và mặc định là **Không dùng PowerPoint – Phòng họp luyện tập**.
2. Vào phòng: hiển thị lưới gồm ô người luyện (camera thật nếu người học đã bật) và các ô hội đồng/thính giả mô phỏng (chỉ ảnh đại diện và nhãn “Mô phỏng”). **Không tự tải hay chiếu PowerPoint mẫu.**
3. Các slide mẫu / PPTX cá nhân vẫn có thể lựa chọn **thủ công** ở màn hình chuẩn bị; chia sẻ màn hình trực tiếp vẫn hoạt động.
4. Khi tắt chia sẻ màn hình, quay về nguồn trình chiếu đã được học sinh chọn trước đó, hoặc về lưới họp nếu chưa chọn trình chiếu. Xóa PPTX cá nhân cũng quay về lưới, không chuyển sang slide mẫu.
5. Tài khoản khách không bị gắn tên học sinh mẫu. Người đã đăng nhập Google hiển thị tên Google của chính mình.

## Ghi hình
- **Không chia sẻ màn hình:** ghi video 1280×720, 20 FPS (nếu trình duyệt hỗ trợ canvas.captureStream), gồm **toàn bộ lưới cuộc họp**, ô webcam thật nếu được bật, tên và ảnh đại diện mô phỏng, câu hỏi mô phỏng đang hiển thị, kèm **micro thật duy nhất** của người luyện. Camera là tùy chọn, micro cần bật.
- **Đang chia sẻ màn hình:** ghi PowerPoint/màn hình chia sẻ và micro theo luồng gốc; không quay lén các cửa sổ chưa được chia sẻ.
- Cả hai chế độ đều cần người học chủ động bật thiết bị và xác nhận ghi. Không tự kích hoạt camera, micro, chia sẻ màn hình hoặc ghi hình.
- Các nhân vật mô phỏng **không có tiếng nói**, không có luồng media thật, không ghi hội thoại của người khác. Câu hỏi chỉ là gợi ý luyện tập dạng chữ.
- Dừng ghi: video tự lưu trên trình duyệt IndexedDB, có thể xem lại từ **Lịch sử luyện tập**, tải video về máy. **Không bật nút Xem ngay và không tự bật modal xem thử.**
- Nếu không đủ dung lượng hoặc trình duyệt không hỗ trợ MediaRecorder/canvas.captureStream, hệ thống báo lỗi. Video không được tải lên Drive hoặc kho lưu trữ đám mây.

## Không ảnh hưởng dữ liệu cũ
- Không đổi tên kho IndexedDB.
- Không xóa/di chuyển video cũ.
- Không cập nhật lịch sử học sinh trước đây chỉ để gán lại slide/video.
- Không tự đổi nhánh main/Production.

## Kiểm tra thực tế cần thực hiện
1. Mở Preview mới nhất, Bắt đầu luyện tập, không chọn PowerPoint.
2. Vào phòng: thấy **1 ô của mình + N ô mô phỏng**, tuyệt đối không thấy slide mẫu.
3. Bật camera + micro (hoặc chỉ micro), ghi 15–20 giây; bấm một ô mô phỏng để hiện câu hỏi.
4. Dừng ghi, vào Lịch sử → Xem lại: phải thấy **toàn bộ lưới và câu hỏi chữ** cùng âm thanh micro, không chỉ riêng webcam.
5. Thử chia sẻ PowerPoint và ghi màn hình ở một buổi khác; không làm hỏng chế độ cũ.
6. Mở GitHub Actions **Check local video library**, bảo đảm tests, TypeScript check và build đã thành công. Vercel Ready không thay thế kiểm thử thiết bị thật.

## Vẫn chỉ là giả lập
Học sinh là người thực duy nhất trong phòng luyện. Mọi avatar, vai trò hội đồng, ý kiến và câu hỏi của người còn lại là kịch bản mô phỏng. Không có gọi đa điểm, không có kết nối tài khoản thứ hai, không có âm thanh AI của người tham gia. Không được trình bày video như một cuộc họp thật giữa nhiều người.
