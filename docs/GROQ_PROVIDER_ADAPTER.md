# SpeakLab_AI — Bước 2.1: Groq Provider Adapter

**Nhánh:** feature/groq-synthetic-pilot  
**Phạm vi:** Chỉ tạo lớp provider độc lập và kiểm thử bằng API mock. Không bật Groq cho học sinh, không thay đổi giao diện, không thay đổi Gemini endpoint, không triển khai Production.

## Thiết kế

- Module mới: server/groqReviewProvider.js.
- Mô hình cố định: openai/gpt-oss-20b, giống mô hình đã dùng trong Groq synthetic pilot.
- Đầu vào adapter: prompt và schema nhận xét đã được xây dựng ở tầng nghiệp vụ.
- Adapter chuyển schema kiểu Gemini hiện dùng trong api/ai/review.js sang strict JSON Schema cho endpoint chat completions tương thích OpenAI.
- Adapter chỉ trả về text JSON và tên model. Bộ nghiệp vụ hiện có tiếp tục chịu trách nhiệm kiểm chứng kết quả qua parseGroundedReview trong server/freeSpeechReview.js.
- Không tự retry, không fallback sang provider khác, không ghi log prompt/response/key, không trả lỗi thô của upstream.
- API key chỉ được truyền vào server-side function; không đưa key vào request body.

## Cách ly trong Bước 2.1

- Không có route nào import hoặc gọi adapter mới.
- api/ai/review.js vẫn sử dụng Gemini như trước.
- api/groq/pilot.js vẫn chỉ nhận hai cờ xác nhận và gọi dữ liệu giả lập cố định.
- Kiểm thử adapter thay fetch bằng mock; không cần API key thật và không tạo request mạng.
- Không thêm nút, thay giao diện, thay dữ liệu lưu hoặc kết nối adapter với báo cáo học sinh.

## Kiểm chứng

Chạy:

    node --test tests/groqReviewProvider.test.js
    node --test tests/freeSpeechReview.test.js

Bộ test adapter xác nhận:
1. Schema được chuyển thành strict JSON Schema, mọi thuộc tính object đều required và không cho phép thuộc tính ngoài.
2. Mô hình và endpoint cố định, không có key trong body.
3. Phản hồi mock có thể đi qua đúng bộ kiểm chứng parseGroundedReview đang dùng.
4. Dẫn chứng giả, JSON sai, phản hồi bị cắt, lỗi quota, lỗi xác thực và lỗi mạng đều bị từ chối an toàn.
5. Chỉ gửi một request; không tự retry khi gặp lỗi.

## Chưa thực hiện

- Chưa tích hợp Groq vào POST /api/ai/review.
- Chưa chuyển quota cá nhân/toàn hệ thống sang Redis cho Groq.
- Chưa gọi Groq thật từ adapter mới.
- Chưa xử lý đồng thuận phụ huynh, dữ liệu trẻ em hoặc chuyển dữ liệu xuyên biên giới.
- Chưa thay Gemini, chưa mở cho học sinh và chưa triển khai Production.

Các nội dung trên thuộc các bước tiếp theo, không nằm trong phạm vi Bước 2.1.
