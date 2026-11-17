# SpeakLab_AI — Groq Synthetic Pilot

**Nhánh:** feature/groq-synthetic-pilot  
**Mục tiêu:** Kiểm thử Groq Free Tier với dữ liệu thuyết trình giả lập cố định, không dùng dữ liệu học sinh thật.

## Luồng provider sau Bước 2.3

- scripts/groqSyntheticPilot.mjs gửi yêu cầu qua server/groqReviewProvider.js.
- Prompt và JSON Schema dùng bài nói cùng hai slide giả lập cố định.
- Mô hình chỉ chọn evidenceIds; máy chủ tự chèn trích dẫn nguyên văn.
- R1 yêu cầu ít nhất một dẫn chứng đúng nguồn.
- R2 yêu cầu đồng thời câu mở đầu và câu kết thúc; hệ thống không suy rộng thành kết luận về toàn bộ cấu trúc.
- R3 chỉ được nhận xét giới hạn bằng chứng thực nghiệm đã nêu.
- R4 ghép đủ chữ của từng slide với câu nói tương ứng. Nhận xét R4 được tạo từ các cặp văn bản đã xác minh; không đánh giá hình ảnh, bố cục, thiết kế hoặc việc trình chiếu.
- R5 yêu cầu dẫn chứng cho cả hai giải pháp.
- Nhận xét không có căn cứ về giọng nói, phát âm, ánh mắt, cử chỉ, hình ảnh và điểm số bị loại.
- Kết quả chỉ được hiển thị sau validateReview.
- API api/groq/pilot.js vẫn giữ nguyên điều kiện Preview, nhánh được phép, phiên Google role teacher, same-origin và xác nhận một lần.
- Không nhận transcript, PPTX, video, file tải lên, lịch sử hay dữ liệu do người dùng truyền vào.
- Không thay đổi api/ai/review.js; Gemini vẫn là provider trong luồng đánh giá hiện tại.

## Kiểm thử

    node --test tests/groqReviewProvider.test.js
    node --test tests/groqSyntheticPilot.test.js
    node --test tests/groqVercelPilotRoute.test.js

Các bài kiểm thử dùng fetch mock, không cần API key thật và không tạo request mạng. Live pilot vẫn cần người vận hành đăng nhập Google trên Vercel Preview và chủ động nhấn đúng một lần.

## Giới hạn còn lại

- Quota pilot vẫn throttle theo từng Vercel Function instance, không phải quota bền vững toàn cục.
- Chưa tích hợp Groq với dữ liệu luyện tập của người học.
- Chưa hoàn tất đánh giá chất lượng bằng người dùng thật.
- Chưa có kết luận về đồng thuận phụ huynh, điều khoản xử lý dữ liệu trẻ em và lưu giữ dữ liệu.
- Không bật Production.
