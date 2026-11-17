# SpeakLab AI — Groq cho bài người lớn tự viết: Preview Gate (giai đoạn tích hợp thực tế, bước 2)

**Nhánh:** `feature/groq-synthetic-pilot`. **Quyền gửi mặc định: OFF.**

## Đã xây dựng

- Trang tách biệt `/groq-adult-preview.html`, dành riêng giáo viên vận hành. Nhập nội dung bài do người lớn tự viết, đề tài, mục tiêu, tối đa ba đoạn chữ slide; không có tải PPTX/video/âm thanh.
- Hiển thị toàn bộ payload dự định gửi; nếu sửa nội dung, các ô xác nhận bị xóa. Chỉ cho phép nút gửi nếu người vận hành chủ động xác nhận bài tự viết, quyền chuyển dữ liệu ra Groq và một lần gọi.
- `GET/POST /api/groq/adult-preview`: GET trạng thái quyền, POST được khóa mặc định trừ khi `SPEAKLAB_GROQ_ADULT_PILOT_ENABLED=true` trên Preview đã được quản trị viên phê duyệt. Không tự bật biến này.
- Yêu cầu nhánh chính xác, teacher session, same-origin, JSON, allowlist cấu trúc POST, tối đa 3.500 ký tự transcript, 3 slide chữ (mỗi slide 700 ký tự), từ chối biểu thức định danh rõ ràng và nội dung nói về học sinh/lớp/trường.
- Dùng Redis quota và bộ `runGenericGroqReview` để gọi tối đa một lần. Không retry, không dùng model trả phí thay thế, không log nội dung và không lưu kết quả lên máy chủ SpeakLab.
- Kết quả được xác minh qua `parseGroundedReview` và hiển thị thành summary/strengths/improvements/slideComparisons/limitations ở khu vực riêng. Chỉ render qua `textContent`.
- Không sửa `api/ai/review.js`, `AiSpeechReviewPanel.tsx`, Gemini, main hoặc Production.

## Giới hạn cần biết

**Không dùng dữ liệu học sinh.** Ô tự xác nhận của giáo viên và biểu thức lọc chỉ làm giảm nguy cơ, không xác minh tuổi, quyền xử lý hoặc tự động phát hiện hết thông tin định danh. Vì thế tính năng gửi bị tắt mặc định ở máy chủ, và chỉ quản trị viên được chủ động mở sau khi xác minh việc sử dụng tài liệu của người lớn và thông báo/quyền riêng tư phù hợp.

Hệ thống không lưu nội dung *trên máy chủ SpeakLab*, nhưng gửi tới Groq có thể phát sinh việc xử lý/lưu dữ liệu theo điều khoản nhà cung cấp; không khẳng định xóa được toàn bộ dữ liệu bên thứ ba.

**Điều kiện thủ công trước khi bật:**

1. Xác nhận tài khoản vận hành đúng teacher và đang xem đúng Vercel Preview nhánh `feature/groq-synthetic-pilot`.
2. Chỉ dùng bài do chính người lớn tự viết, không chứa thông tin người thật, thông tin học sinh, tên trường/lớp, thông tin nhạy cảm hoặc tài liệu của bên thứ ba.
3. Kiểm tra điều khoản xử lý dữ liệu của Groq và thông báo rõ dữ liệu sẽ chuyển tới nhà cung cấp bên ngoài. Xác minh đủ điều kiện pháp lý trước khi cho phép xử lý dữ liệu thực tế.
4. Kiểm tra `GROQ_API_KEY`, Redis quota, Free Tier, rồi mới cân nhắc bật `SPEAKLAB_GROQ_ADULT_PILOT_ENABLED=true` **chỉ trên Preview**. Giữ OFF tại Production.
5. Chỉ thực hiện một lần kiểm chứng live với tài liệu phù hợp khi đã đáp ứng các bước trên; không cần lặp lại cho mọi bài.

## Kiểm thử

`tests/groqAdultPreviewRoute.test.js` kiểm tra khóa mặc định, teacher-only, wrong-origin, request/confirmation thiếu, mã học sinh/email/điện thoại, lượng slide, quota, một lần gọi mock và không lộ dữ liệu khi lỗi. Bộ kiểm thử này **không tiêu thụ Groq Free Tier** và không phải nghiệm thu pháp lý.

Không bật Groq cho học sinh; chưa thay Gemini và chưa merge vào `main`.
