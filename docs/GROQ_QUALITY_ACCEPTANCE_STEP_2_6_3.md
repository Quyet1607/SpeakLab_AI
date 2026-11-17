# SpeakLab AI — Bước 2.6.3: Kiểm tra chất lượng Groq Synthetic Pilot

Nhánh: `feature/groq-synthetic-pilot`. Phạm vi: kiểm thử offline, không gửi thêm request Groq thật và không mở dữ liệu học sinh.

## Kết quả xem xét mã nguồn

- `src/features/history/AiSpeechReviewPanel.tsx` gọi `POST /api/ai/review`, thông báo đồng ý với **Google Gemini**.
- `api/ai/review.js` trực tiếp sử dụng `GoogleGenAI` và `GEMINI_API_KEY`. Đó là lý do giao diện đánh giá chính trên Vercel Preview vẫn hiển thị Gemini. Triển khai Groq pilot không tự đổi provider.
- `api/groq/pilot.js` sử dụng `scripts/groqSyntheticPilot.mjs` với bài nói và hai đoạn chữ slide cố định; chỉ chấp nhận lệnh `syntheticOnly: true` từ teacher trên Preview đúng nhánh.
- Kết quả thực tế người vận hành chụp trên Vercel Preview cho thấy thành công một lượt gọi và trả R1–R5. Đây là **một mẫu thành công**, không thể suy ra chất lượng ổn định trên dữ liệu bất kỳ.
- R2 chỉ có bằng chứng mở đầu và kết thúc: đủ xác nhận hai dấu mốc, chưa đủ chứng minh tính mạch lạc của toàn bộ bài nói.
- R4 chỉ ghép chữ slide với lời nói, không thể đánh giá thiết kế hoặc việc trình chiếu.
- Dẫn chứng được lấy từ văn bản giả lập cố định phía máy chủ; mô hình chỉ chọn evidenceIds.

## Kiểm thử bổ sung

`tests/groqQualityAcceptance.test.js` kiểm thử với các response giả lập:
1. Kiểm tra đủ R1–R5 cùng dẫn chứng được đối chiếu.
2. Phủ định kết luận quá mức ở R2 và nhận xét hình ảnh ở R4.
3. Từ chối điểm số hoặc mô tả giọng nói không có dữ liệu.
4. Từ chối thiếu bằng chứng bắt buộc.
5. Kiểm tra prompt giả lập không chứa dữ liệu tài khoản/học sinh và không yêu cầu điểm số.

Các test dùng mô phỏng, không kiểm thử lần hai trên Groq API.

## Điều kiện trước khi đổi Gemini sang Groq trong chức năng nhận xét chính

**Chưa cho phép đổi** API chính sang Groq bằng cách đổi key hoặc tên model. Contract của Gemini và Groq pilot khác nhau và Groq pilot chỉ nhận dữ liệu giả lập. Trước khi thực hiện cho người học cần:
- Hoàn tất các cổng pháp lý, đồng thuận người đại diện (khi áp dụng), kiểm chứng server-side, quyền dữ liệu và các yêu cầu an toàn đã nêu trong `docs/GROQ_STUDENT_PRIVACY_DESIGN_PHASE_2_5.md`.
- Thiết kế và kiểm thử review route Groq riêng cho dữ liệu được phép, schema phù hợp kết quả người học, quota và bảo mật; không tái sử dụng pilot làm cổng nhận transcript thật.
- Nghiệm thu trên Preview với dữ liệu mô phỏng trước khi cân nhắc người dùng thật; cập nhật giao diện và chính sách đồng thuận chính xác với provider.
- Không gộp vào main và không bật Production trước khi có xác nhận riêng.

**Đề xuất bước kế tiếp:** 2.6.4 kiểm thử lỗi/giới hạn, sau đó lập kế hoạch tích hợp Preview **teacher-only và synthetic-only** nếu cần trình bày Groq ngay trong ứng dụng mà không gửi dữ liệu học sinh.
