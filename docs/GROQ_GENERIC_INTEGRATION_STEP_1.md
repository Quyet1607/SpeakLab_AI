# SpeakLab AI — Giai đoạn tích hợp Groq cho bài nói không cố định: Bước 1

**Nhánh:** `feature/groq-synthetic-pilot`  
**Trạng thái:** phát triển phần lõi, chưa cho phép gửi dữ liệu thật qua HTTP. Không sử dụng quota Groq.

## Đã làm

Tạo `server/groqGenericReviewEngine.js` để thử tích hợp với **đầu vào bài nói và chữ slide không cố định**, thay vì chỉ bốn chủ đề cố định của Groq Pilot.

- Dùng chính `validateReviewRequest` để kiểm tra bản ghi, đề tài, phiên và tối đa 40 slide chữ.
- Dùng `makeEvidenceChunks`, `buildReviewPrompt` cùng dạng JSON đầu ra hiện hữu: `summary`, 2 `strengths`, 2 `improvements`, `slideComparisons`, `limitations`.
- Chỉ một lời gọi `requestGroqReview`; không gọi lại hoặc chuyển sang nhà cung cấp trả phí.
- Dùng `parseGroundedReview` kiểm chứng dẫn chứng câu nói, chữ slide, văn bản tiếng Việt, thông tin không được suy đoán. Không hiển thị như đã phân tích đủ slide nếu chỉ xác minh được một phần; khi đầu ra thiếu mục chi tiết phải từ chối.
- Gắn định danh model Groq thật trong kết quả, không mạo danh Gemini.

Thêm `tests/groqGenericReviewEngine.test.js`: dữ liệu bài nói người lớn tự viết không phải mẫu cố định, 0/2 slide, lời gọi provider mock duy nhất, thiếu consent, trích dẫn sai, thiếu slide, output cấu trúc sai và xác nhận Gemini vẫn hoạt động như trước.

## Ranh giới chưa vượt qua

**Phần lõi chưa có HTTP endpoint hoặc nút sử dụng thực tế.** `consent:true` ở đây chỉ là hợp đồng kỹ thuật sẵn có cho phần kiểm thử, không chứng minh quyền xử lý hay đồng thuận hợp lệ của người lớn hoặc học sinh. Trước khi nối route, cần đánh giá cách xác nhận bài thuộc người trưởng thành, công bố dữ liệu được gửi đến Groq, quy trình đồng thuận phù hợp, kiểm tra thông tin nhạy cảm và các nghĩa vụ pháp lý liên quan. Không được coi việc xác thực teacher hoặc checkbox là đủ.

`api/ai/review.js` và luồng học sinh vẫn dùng Gemini. Không sửa Production/main, không dùng dữ liệu học sinh thật, không bật route cho Groq qua script tự động, không gọi Groq trong CI.

## Bước tiếp theo nếu kiểm thử qua

Thiết kế một khu vực Preview cô lập cho giáo viên/người vận hành xem trước và xác nhận nội dung bài do người lớn tự cung cấp; bảo vệ ngay trước lời gọi Groq bằng các cổng quyền riêng tư và Redis quota, có cơ chế ngăn dữ liệu học sinh. Chỉ bật sau khi các điều kiện được chủ vận hành kiểm chứng. Sau đó mới nghiệm thu live bằng đúng một bài thử tự nguyện phù hợp.

Tài liệu kỹ thuật này không phải chứng nhận pháp lý.
