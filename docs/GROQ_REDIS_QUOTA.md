# Groq Synthetic Pilot — Bước 2.4: Redis quota chung

Triển khai riêng trên nhánh feature/groq-synthetic-pilot. **Không thay đổi hạn mức Gemini và không mở AI cho học sinh.**

## Mục tiêu và giới hạn kỹ thuật

Redis (Upstash REST EVAL) lưu trạng thái chung giữa các Vercel Functions. Một lệnh Lua nguyên tử kiểm tra và đặt chỗ trước khi gọi Groq. Các mức cố định cho thử nghiệm:

- 3 lượt cho một tài khoản vận hành / ngày UTC
- 12 lượt toàn hệ thống / ngày UTC
- 2 lượt toàn hệ thống / phút UTC
- Tối đa 1 yêu cầu đang chạy đồng thời toàn hệ thống

Hạn mức rất thận trọng và **không đại diện hạn mức chính thức của Groq**. Các giới hạn của Groq còn phụ thuộc RPM/RPD/TPM/TPD, model và tổ chức. Do đó phần mềm này không đảm bảo tài khoản không phát sinh chi phí nếu người vận hành tự bật thanh toán tại Groq. Giữ tài khoản ở Free Tier và không cấu hình bất kỳ mô hình có phí nào.

## Cấu hình Vercel Preview

Vercel → Settings → Environment Variables, chỉ chọn Preview, ưu tiên giới hạn nhánh feature/groq-synthetic-pilot:

- SPEAKLAB_RATE_LIMIT_REST_URL — HTTPS Redis REST URL, không phải URL truy cập trình duyệt.
- SPEAKLAB_RATE_LIMIT_REST_TOKEN — Redis **standard read/write** REST token; không dùng readonly.
- SPEAKLAB_SESSION_SECRET — secret đăng nhập đủ dài và dùng để tạo HMAC che Google subject ID.
- GROQ_API_KEY — key Groq của chủ vận hành.

Có thể dùng **cùng Redis mà Gemini dùng**, các khóa đã được đặt prefix khác (speaklab:groq:pilot:). Hãy bảo đảm hạn mức dịch vụ Redis của bạn phù hợp; không đưa token/secret vào GitHub, URL hoặc ảnh chụp.

Sau khi lưu hoặc thay đổi env, thực hiện deployment mới ở Preview. Nếu thiếu Redis URL/token/secret, GET /api/groq/pilot trả 503, không hiển thị nút chạy. GET chỉ kiểm tra sự tồn tại của cấu hình, không gửi request Redis. POST nếu Redis gặp lỗi/timeout hoặc không xác minh được quota sẽ trả 503 và **không gọi Groq**.

## Cơ chế quota

- Một lệnh EVAL kiểm tra các counters + ZSET lease đồng thời, rồi chỉ tăng counter khi được chấp nhận.
- Danh tính Google subject được biến đổi qua HMAC-SHA256 dùng secret phía máy chủ; Redis không chứa ID Google nguyên văn.
- Các counter được tính theo ngày và phút UTC, không tự hoàn số lượt khi Groq thất bại để tránh lạm dụng và lỗi gọi lặp không rõ trạng thái.
- Lease đồng thời 45 giây, và được giải phóng trong finally sau khi Groq trả lời; nếu Function ngắt đột ngột hoặc Redis lỗi lúc giải phóng, lease tự hết hạn. **Không phải distributed queue**.
- Các lỗi 429 cho hạn mức cá nhân, toàn hệ thống, phút và đồng thời; không tự thử lại và không chuyển API trả phí.
- Không thay api/ai/review.js, không thay Gemini, không nhận TXT/PPTX/video thật, không lưu báo cáo học sinh.

## Kiểm thử

GitHub Actions chạy các test offline/mocked:

    node --test tests/groqPilotQuota.test.js
    node --test tests/groqVercelPilotRoute.test.js
    node --test tests/groqSyntheticPilot.test.js

Bộ test mô phỏng Redis EVAL và kiểm tra cấu trúc script Lua. **Không chứng minh kết nối với Redis thật**. Cần nghiệm thu Preview với Redis đã cấu hình và một lượt Groq có chủ đích sau khi CI thành công; chưa kết luận an toàn triển khai Production.

Nguồn: https://upstash.com/docs/redis/features/restapi
