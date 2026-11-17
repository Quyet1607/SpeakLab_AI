# SpeakLab_AI — Groq Provider Adapter

**Nhánh:** feature/groq-synthetic-pilot  
**Bước 2.1:** Tạo adapter dùng chung và kiểm thử offline.  
**Bước 2.2:** Kết nối adapter với Synthetic Pilot bằng dữ liệu giả lập cố định.  
**Bước 2.3:** Siết kiểm chứng dẫn chứng và giới hạn kết luận của R2/R4.

## Thiết kế

- Module: server/groqReviewProvider.js.
- Model cố định: openai/gpt-oss-20b.
- Endpoint: Groq OpenAI-compatible Chat Completions.
- Nhận prompt và schema từ tầng gọi; chuyển schema sang strict JSON Schema.
- API key chỉ được truyền trong Authorization header phía máy chủ.
- Không log prompt, response hoặc API key.
- Không tự retry, không fallback provider, có timeout và thông báo lỗi đã làm sạch.
- Adapter chỉ trả về chuỗi JSON và model; kiểm chứng nghiệp vụ vẫn nằm ở tầng gọi.

## Synthetic Pilot và kiểm chứng nguồn

- scripts/groqSyntheticPilot.mjs gọi requestGroqReview; không gọi endpoint Groq trực tiếp.
- Prompt/schema chỉ chứa bài nói và hai slide giả lập cố định.
- Mô hình chỉ chọn evidenceIds; máy chủ tự chèn trích dẫn nguyên văn từ nguồn cố định.
- R2 bắt buộc có cả câu mở đầu và câu kết thúc. Máy chủ chỉ nhận xét hai dấu mốc này xuất hiện, không kết luận toàn bộ cấu trúc hoặc mạch lập luận.
- R4 bắt buộc ghép từng đoạn chữ slide với câu nói tương ứng. Nhận xét và gợi ý R4 do máy chủ tạo từ các cặp đã xác minh; không dùng kết luận AI về hình ảnh, bố cục, thiết kế hay việc trình chiếu.
- R5 bắt buộc có dẫn chứng cho cả hai giải pháp.
- Các nhận xét tự tạo về giọng nói, phát âm, ánh mắt, cử chỉ, hình ảnh hoặc điểm số bị loại.
- api/groq/pilot.js vẫn giới hạn ở Preview, đúng nhánh, phiên Google role teacher và một lượt gọi.
- api/ai/review.js không thay đổi; Gemini vẫn là provider trong luồng đánh giá hiện hành.

## Kiểm thử

    node --test tests/groqReviewProvider.test.js
    node --test tests/groqSyntheticPilot.test.js
    node --test tests/groqVercelPilotRoute.test.js

Tất cả test dùng fetch mock; không yêu cầu GROQ_API_KEY thật và không gửi request ra Internet.

## Ngoài phạm vi

Không dùng dữ liệu người học thật; không tích hợp API đánh giá học sinh; không thay Gemini; không thay quota hiện tại; không bật Production.
