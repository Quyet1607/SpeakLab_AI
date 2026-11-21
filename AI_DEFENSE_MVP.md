# SpeakLab AI – Hội đồng phản biện giả lập (MVP)

## Phạm vi

Bản đầu tiên được tích hợp vào **Lịch sử luyện tập → một buổi có bản ghi chữ → AI nhận xét → Bảo vệ trước hội đồng AI**.

- **Giám khảo 1:** kiến thức và cơ sở nghiên cứu;
- **Giám khảo 2:** giải pháp kỹ thuật và kiểm thử;
- **Giám khảo 3:** phản biện giả định và tính ứng dụng.

Học sinh chủ động đồng ý gửi dữ liệu rồi bấm **Tạo 3 câu hỏi phản biện**. Gemini tạo toàn bộ ba câu hỏi trong **một yêu cầu**; bộ câu hỏi yêu cầu mã dẫn chứng E hợp lệ. Học sinh trả lời bằng **văn bản** hoặc chủ động bật micro nhận diện tiếng Việt trong trình duyệt. Người học có thể bỏ trống câu chưa biết nhưng cần trả lời ít nhất một câu. Bấm **Nhận xét câu trả lời bằng AI** để Gemini nhận xét toàn bộ ba câu trong **một yêu cầu** thứ hai.

Mỗi nhận xét có trích đoạn nguyên văn từ câu trả lời (nếu có), nội dung đã giải đáp, nội dung cần làm rõ và gợi ý luyện lại. Hệ thống không tự chấm điểm, không nhận xét phát âm, âm lượng, giọng điệu, hình ảnh hoặc cử chỉ chỉ từ văn bản.

## An toàn, giới hạn

- Cả hai lần gọi Gemini dùng chung **hạn mức server-side 5 yêu cầu/ngày** với AI nhận xét thuyết trình hiện có; không tự gọi lại khi Gemini trả lỗi.
- Cần đăng nhập Google, yêu cầu cùng nguồn, consent rõ ràng, các biến Gemini Free Tier và Redis đã cấu hình; API key không có ở frontend.
- Bộ câu hỏi được ký HMAC từ phía server, ràng buộc tài khoản, phiên luyện, đề tài, TXT và chữ PPTX; **hết hạn sau 24 giờ**. Đổi dữ liệu hoặc đổi tài khoản sẽ buộc tạo bộ câu hỏi mới.
- Gemini chỉ nhận **chữ** và nội dung câu trả lời, không nhận video/âm thanh/tệp PPTX. Micro dùng Web Speech API của trình duyệt, có thể được nhà cung cấp trình duyệt xử lý âm thanh; tính năng này chỉ được mở khi người học tự bật.
- Kết quả hỏi đáp lưu **trên trình duyệt/thiết bị**, không đồng bộ đám mây. Xóa bản ghi chữ liên quan sẽ xóa cả bài luyện phản biện.
- Công cụ này là **giám khảo AI mô phỏng**, không phải hội đồng giám khảo thật; câu hỏi và nhận xét có thể sai, cần người học và giáo viên kiểm chứng.

## Kiểm thử thủ công trên Vercel Preview

1. Đăng nhập tài khoản Google trên Preview, tạo một buổi nói mẫu và bật chức năng nhận diện tiếng Việt để có TXT.
2. Kết thúc buổi, mở **Lịch sử luyện tập → bản ghi → Bảo vệ trước hội đồng AI**; đồng ý gửi văn bản.
3. Bấm **Tạo 3 câu hỏi phản biện**; xác nhận ba vai trò J1/J2/J3, câu hỏi phù hợp với đề tài và mã E tồn tại.
4. Gõ câu trả lời cho 1–3 câu. Có thể để trống câu khác. Nếu thử micro, đọc kỹ thông báo và bật micro bằng thao tác riêng; đối chiếu văn bản đã nhận diện trước khi gửi Gemini.
5. Bấm **Nhận xét câu trả lời bằng AI**; xác nhận ba phần nhận xét, trích dẫn không bịa, không chấm điểm/phát âm.
6. Tải lại trang để kiểm tra dữ liệu cục bộ được giữ nguyên. Thử đổi chủ phiên/đổi nội dung/đến hạn 24 giờ để bảo đảm token cũ không dùng lại.
7. Xóa bản ghi chữ và xác nhận câu hỏi/trả lời phản biện liên quan cũng bị xóa.
8. Xem Network và Vercel Function Logs nếu lỗi. Chỉ chia sẻ HTTP status, code đã lọc; không chia sẻ API key, cookie, nội dung người học.

## Đã triển khai và chưa triển khai

- MVP: 3 câu hỏi dựa trên nguồn, câu trả lời văn bản/micro, phản hồi nội dung, lưu lịch sử cục bộ.
- **Chưa có:** câu hỏi nối tiếp tự động theo từng câu trả lời, giọng nói AI đọc câu hỏi, chấm điểm, đồng bộ tài khoản qua nhiều thiết bị hay khả năng đối chiếu hình ảnh slide.
- Chỉ đưa chức năng vào phần **kết quả nghiên cứu đã đạt được** sau khi chạy thử thực tế thành công trên Preview và Production.

## Kiểm thử tự động

- `node --test tests/aiDefense.test.js tests/aiDefenseRoute.test.js`
- `bun run lint`
- `bun run build`

Không kiểm thử Gemini thật bằng CI vì không đưa API key vào repository.
