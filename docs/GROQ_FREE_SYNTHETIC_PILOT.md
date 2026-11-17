# SpeakLab_AI — Groq Synthetic Pilot

**Nhánh:** feature/groq-synthetic-pilot  
**Mục tiêu:** Kiểm thử Groq Free Tier với dữ liệu thuyết trình giả lập cố định, không dùng dữ liệu học sinh thật.

## Luồng provider sau Bước 2.2

- scripts/groqSyntheticPilot.mjs không tự gọi endpoint Groq nữa.
- Mọi yêu cầu live từ synthetic pilot được gửi qua server/groqReviewProvider.js.
- Prompt và JSON Schema vẫn được tạo từ mẫu giả lập cố định trong script.
- Kết quả trả về vẫn được kiểm tra bằng validateReview trước khi được trả về route hoặc hiển thị.
- API api/groq/pilot.js vẫn giữ nguyên điều kiện Preview, nhánh được phép, phiên Google role teacher, same-origin và hai cờ xác nhận.
- Không nhận transcript, PPTX, video, file tải lên, lịch sử hay dữ liệu do người dùng truyền vào.
- Không có thay đổi tới api/ai/review.js; Gemini vẫn là provider đang phục vụ luồng đánh giá hiện tại.

## Kiểm thử

    node --test tests/groqReviewProvider.test.js
    node --test tests/groqSyntheticPilot.test.js
    node --test tests/groqVercelPilotRoute.test.js

Các bài kiểm thử dùng fetch mock, không cần API key thật và không tạo request mạng. Live pilot vẫn cần người vận hành đăng nhập Google trên Vercel Preview và chủ động nhấn đúng một lần.

## Giới hạn còn lại

- Quota pilot hiện vẫn throttle theo từng Vercel Function instance, không phải quota bền vững toàn cục.
- Chưa tích hợp Groq với dữ liệu luyện tập của người học.
- Chưa hoàn tất đánh giá chất lượng bằng người dùng thật.
- Chưa có kết luận về đồng thuận phụ huynh, điều khoản xử lý dữ liệu trẻ em và lưu giữ dữ liệu.
- Không bật Production.
