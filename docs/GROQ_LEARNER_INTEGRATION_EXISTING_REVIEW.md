# SpeakLab AI — Tích hợp Groq cho học sinh ngay trong nhận xét bài thuyết trình

**Nhánh:** `feature/groq-synthetic-pilot`  
**Mục tiêu:** Không làm thêm trang Groq độc lập hay thử bài cố định; chỉ phát triển tại **Lịch sử luyện tập → AI nhận xét bài thuyết trình**.

## Đã triển khai

1. `server/groqLearnerConsentGate.js`: cổng đồng thuận riêng cho người học. Kiểm tra trực tiếp Redis phía máy chủ theo Google subject đã băm HMAC, provider `groq`, mục đích `student-presentation-text-review`, phạm vi ba nhóm dữ liệu, trạng thái xác minh/phê duyệt, phiên bản thông báo, dấu thời gian, hiệu lực tối đa 90 ngày, tham chiếu đối chứng và trạng thái thu hồi. Không chấp nhận `consent:true` hay bất kỳ metadata nào từ trình duyệt làm chứng cứ thay thế.
2. `api/ai/groq-review.js`: API xử lý Groq bên trong tính năng AI của SpeakLab, **không phải trang mới**. Có GET trạng thái sẵn sàng (không gọi AI), POST bài nói + chữ slide sau khi xác thực learner session, same-origin, input allowlist, kiểm tra nguồn định danh rõ ràng, hồ sơ Redis hợp lệ và quota Redis; gọi tối đa một lượt Groq, xác minh qua `runGenericGroqReview`/`parseGroundedReview`, không retry hoặc gửi khóa ra frontend.
3. `src/features/history/AiSpeechReviewPanel.tsx`: sử dụng chung component báo cáo `AiReviewResults` và kết quả lưu cục bộ; khi máy chủ xác minh đã có quyền Groq, học sinh thấy lựa chọn Groq ở **đúng vị trí chức năng nhận xét hiện hành**, xem toàn bộ văn bản và xác nhận gửi. Nếu không có quyền, Gemini vẫn hoạt động như trước, không tự chuyển provider hay gửi nội dung.
4. `tests/groqLearnerConsentAndRoute.test.js`: kiểm thử grant hợp lệ, chưa có, chưa xác minh, sai phạm vi, sai người, thu hồi, hết hạn, lỗi Redis, production, nguồn gốc sai, payload giả và lỗi provider. Không có cuộc gọi Groq thật.

## Điều kiện triển khai / trách nhiệm vận hành còn thiếu

**Trạng thái NO-GO hiện tại**. Không đặt `SPEAKLAB_GROQ_STUDENT_REVIEW_ENABLED=true` để xử lý học sinh cho đến khi:

- Có thông báo/quyền riêng tư chính thức phù hợp với Groq, đầu mối chịu trách nhiệm, quy trình nhận yêu cầu dữ liệu và cơ sở xử lý rõ ràng.
- Có quy trình xác minh người đại diện hợp pháp và học sinh theo yêu cầu áp dụng; người vận hành lưu chứng cứ ở hệ thống bảo mật có quyền truy cập, cấp bản ghi được xác minh **từ phía máy chủ**. Chưa có giao diện hoặc API cấp/thu hồi hồ sơ đồng thuận; hiện chỉ có bước *kiểm tra* hồ sơ (deny-by-default).
- Rà soát nghĩa vụ chuyển dữ liệu ra bên ngoài, cam kết nhà cung cấp, thời hạn lưu giữ, thu hồi và giới hạn dữ liệu. Bộ lọc email/điện thoại/căn cước trong route không phát hiện mọi thông tin cá nhân, không thể thay thế việc kiểm soát nội dung.
- Kiểm tra độc lập mô hình Groq thật và hạn mức cho các bài nhiều slide, không dùng nội dung học sinh trong giai đoạn NO-GO.
- Sau khi hoàn tất các điều kiện, chỉ bật biến cho đúng nhánh Preview, với hồ sơ đồng thuận riêng cho từng học sinh đã xác minh và quota Redis.

**Định dạng record mà cổng chấp nhận** là hợp đồng kỹ thuật nội bộ, không phải chứng nhận pháp lý. Các trường không được tạo bởi browser hoặc lấy từ checkbox; record phải có bằng chứng độc lập thực sự. Redis key chỉ là mã Google subject băm HMAC, không lưu transcript trong hồ sơ.

## Không thay đổi

- `api/ai/review.js` (Gemini), giao diện nhận xét, quy trình PPTX và báo cáo học sinh cũ vẫn được giữ lại.
- Không tạo nút mới ngoài luồng AI nhận xét; không gộp `main`, không sửa Production, không gọi Groq để kiểm thử.
- Không quảng cáo rằng Groq đã sẵn sàng cho dữ liệu học sinh. CI chỉ kiểm tra luồng logic và phản hồi mock, chưa chứng minh đủ điều kiện pháp lý hoặc chất lượng Groq thật.
