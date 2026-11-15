# SpeakLab AI – Giai đoạn 7.1: Thiết lập nội dung luyện tập

Trạng thái: triển khai thử nghiệm trên nhánh `feature/recording-3-2`; không thay đổi `main` / Production.

## Mục tiêu
Học sinh tự nhập đề tài thực sự cần luyện thuyết trình. Phần thông tin này được giữ xuyên suốt phiên luyện, sau đó lưu cùng lịch sử đã hoàn thành **trong trình duyệt hiện tại**. Không sử dụng nội dung bài mẫu để tự thay thế đề tài của học sinh.

## Những gì triển khai trong 7.1
- **Tên buổi luyện**: nhãn dùng để quản lý các lần tập và tên video, giữ mặc định nếu cần.
- **Tên đề tài**: bắt buộc, tối đa 120 ký tự; nếu trống, yêu cầu học sinh nhập trước khi vào phòng.
- **Mô tả ngắn**: tùy chọn, tối đa 800 ký tự.
- **Mục tiêu bài nói**: tùy chọn, tối đa 400 ký tự.
- **PowerPoint**: vẫn không bắt buộc. Không tự thêm slide; người học chỉ chọn tài liệu nếu muốn, hoặc chia sẻ màn hình ngoài bất kỳ lúc nào theo chức năng đã có.
- Tạo phiên mới với thông tin do học sinh nhập thay vì chủ đề giả lập lấy từ bộ slide; có thể xem trong hộp thoại chi tiết buổi luyện.
- Sau khi hoàn thành, thông tin đề tài, mô tả và mục tiêu được lưu ở `speaklab_completed_practice_v1` và hiện trong Lịch sử. Cấu trúc đã tồn tại vẫn đọc được nếu bản ghi cũ không có hai trường mới.
- **Luyện lại** khôi phục đề tài, mô tả và mục tiêu của phiên luyện. Các bản ghi video cũ không bị thay đổi.

## Giới hạn hiện tại
- Chưa nhận diện giọng nói tiếng Việt, chưa kết nối AI, chưa tạo câu hỏi theo đề tài và chưa tự động đánh giá câu trả lời. Không tạo điểm số AI hoặc báo cáo thực nếu thiếu dữ liệu.
- Không tự tải PowerPoint, mô tả đề tài, video hay dữ liệu cá nhân lên dịch vụ AI hoặc máy chủ.
- Metadata và video vẫn lưu trên trình duyệt và thiết bị hiện tại. Google sign-in chỉ dùng để phân nhóm dữ liệu tại máy; không phải phân quyền riêng tư chặt chẽ hoặc đồng bộ nhiều máy.
- Nội dung người học nhập sẽ là cơ sở cho các bước AI về sau, nhưng **không tự động sử dụng nội dung ấy để tạo câu hỏi ở 7.1**.

## Danh sách kiểm tra chấp nhận
1. Vào **Bắt đầu luyện tập**, thấy ô **Tên buổi luyện**, **Tên đề tài**, **Mô tả ngắn**, **Mục tiêu bài nói**.
2. Bỏ trống Tên đề tài rồi bấm Vào phòng: hệ thống từ chối và báo rõ. Điền tên đề tài mới có thể vào phòng.
3. Nhập thử đề tài `Giáo dục an toàn số`, mô tả và mục tiêu tự chọn; để **Không dùng PowerPoint**.
4. Vào phòng, không xuất hiện slide mẫu; bấm tên buổi luyện ở góc trên để xem chính xác 3 nội dung vừa nhập.
5. Kết thúc buổi luyện, vào **Lịch sử**, thấy đề tài, mô tả và mục tiêu. Tải lại trang, kiểm tra thông tin còn.
6. Chọn **Luyện lại** để xác minh ba trường được khôi phục.
7. Kiểm tra GitHub Actions `Check local video library` và Vercel Preview triển khai; kiểm tra không ảnh hưởng tới ghi hình, lưu video, chia sẻ màn hình.
8. **Không merge main** nếu chưa có xác nhận của người dùng.

Các bước 7.2–7.6 chưa được thực hiện trong lần cập nhật này.
