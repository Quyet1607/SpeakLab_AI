# SpeakLab_AI — Groq Provider Adapter

**Nhánh:** feature/groq-synthetic-pilot  
**Bước 2.1:** Tạo adapter dùng chung và kiểm thử offline.  
**Bước 2.2:** Kết nối adapter với Synthetic Pilot bằng dữ liệu giả lập cố định.

## Thiết kế

- Module: server/groqReviewProvider.js.
- Model cố định: openai/gpt-oss-20b.
- Endpoint: Groq OpenAI-compatible Chat Completions.
- Nhận prompt và schema từ tầng gọi; chuyển schema sang strict JSON Schema.
- API key chỉ được truyền trong Authorization header phía máy chủ.
- Không log prompt, response hoặc API key.
- Không tự retry, không fallback provider, có timeout và thông báo lỗi đã làm sạch.
- Adapter chỉ trả về chuỗi JSON và model; kiểm chứng nghiệp vụ vẫn nằm ở tầng gọi.

## Sử dụng trong Synthetic Pilot

- scripts/groqSyntheticPilot.mjs gọi requestGroqReview thay vì gọi fetch trực tiếp.
- Prompt/schema vẫn xuất phát từ makeRequest() với transcript và hai slide giả lập cố định.
- Sau khi adapter trả về, validateReview kiểm tra đủ 5 tiêu chí R1–R5, evidence ID đúng nguồn và không có điểm số giả.
- api/groq/pilot.js giữ nguyên; trang Preview vẫn chỉ chạy một bài giả lập cố định với xác thực teacher.
- api/ai/review.js không thay đổi; Gemini vẫn được sử dụng trong luồng đánh giá hiện hành.

## Kiểm thử

    node --test tests/groqReviewProvider.test.js
    node --test tests/groqSyntheticPilot.test.js
    node --test tests/groqVercelPilotRoute.test.js

Tất cả test dùng fetch mock; không yêu cầu GROQ_API_KEY thật và không gửi request ra Internet.

## Ngoài phạm vi

Không dùng dữ liệu người học thật; không tích hợp API đánh giá học sinh; không thay Gemini; không thay quota hiện tại; không bật Production.
