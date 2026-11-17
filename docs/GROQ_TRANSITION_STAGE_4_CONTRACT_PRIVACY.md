# SpeakLab AI — Bước 4: Hợp đồng dữ liệu Groq và cổng riêng tư (chỉ offline)

**Nhánh:** `feature/groq-synthetic-pilot`  
**Quyết định:** **NO-GO** cho việc đưa transcript/PPTX người học tới Groq hoặc thay Gemini trong `/api/ai/review`.

## 1. Khác biệt xác nhận từ mã nguồn

| Thành phần | Gemini: nhận xét hiện tại | Groq Pilot |
|---|---|---|
| Đường gọi | `POST /api/ai/review` | `GET/POST /api/groq/pilot` |
| Đầu vào | `sessionId, topic, topicDescription, speakingGoal, transcript, slides, consent` với xác thực session/same-origin và quota | Chỉ hai cờ kiểm thử, hoặc thêm đúng `caseId` được chọn từ allowlist giả lập cố định phía server |
| Nguồn dữ liệu | Nội dung ASR và chữ slide trong bài thực | Chỉ mẫu hư cấu phía máy chủ |
| Đầu ra | `summary, strengths[2], improvements[2], slideComparisons[], limitations[]` với `slideOverview`, `source`, `model`, bằng chứng `E#` | `summary, criteria[R1..R5], limitations` với chứng cứ nội bộ `OPEN/SOLUTION_1/...` |
| Kiểm chứng | `parseGroundedReview`: xác minh evidence IDs, trích dẫn lời nói và slide, tiếng Việt có dấu; từ chối hoặc loại bỏ claim thiếu chứng cứ | `validateSyntheticCaseReview`: kiểm tra chứng cứ của mẫu, áp dụng nhận xét đã chuẩn hóa cho bốn chủ đề |
| Cấp phép | Consent checkbox của UI áp dụng riêng cho luồng hiện tại, **không phải** đồng thuận người đại diện hợp pháp cho Groq | Teacher-only + Preview đúng nhánh; không có dữ liệu học sinh |

**Hệ quả:** Không thay `GoogleGenAI` bằng lời gọi Groq trong route hiện tại; R1–R5 không đủ để trực tiếp nuôi UI lịch sử và consent chưa đáp ứng yêu cầu dự kiến của provider mới.

## 2. Thành phần Bước 4 được triển khai

- `server/groqOfflineContractRehearsal.js`: dựng báo cáo hư cấu theo **hợp đồng hiển thị hiện hành** từ 4 fixture giả lập cố định và chạy qua chính `parseGroundedReview`. Hoàn toàn offline, không nhập nội dung tự do, không gửi AI, không nhận token/consent.
- `tests/groqTransitionContractGate.test.js`: xác nhận 4 fixture có hai điểm mạnh, hai điểm cải thiện, đối chiếu hai slide, dẫn chứng hợp lệ; ID lạ bị chặn; endpoint Groq không nhận bài thật; endpoint Gemini và màn hình lịch sử không bị thay; checkbox không được xem là giấy phép Groq.
- CI chạy test mới cùng lint/build và các regression tests.

**Quan trọng:** Hàm dựng báo cáo mô phỏng không phải adapter chuyển output Groq R1–R5 thành schema của Gemini, không chứng minh Groq đã đáp ứng contract. Nó chỉ là mốc chuẩn để xây dựng và kiểm thử adapter tương lai mà không cần API key.

## 3. Cổng cần hoàn thành trước khi có route Groq cho bài thật

1. **Pháp lý:** người kiểm soát/xử lý, căn cứ phù hợp, đối tượng người chưa thành niên, đại diện hợp pháp khi cần, chuyển dữ liệu và chính sách nhà cung cấp, công bố quyền/xử lý dữ liệu, đánh giá pháp lý độc lập.
2. **Đồng thuận có chứng cứ phía server:** người đồng ý/đại diện, phiên bản thông báo, mục đích và provider Groq, loại dữ liệu, xác minh và thu hồi; kiểm tra trước mỗi yêu cầu gửi. `consent: true` của client không đủ.
3. **Dữ liệu:** xem trước chính xác các trường sẽ gửi, giảm định danh, chặn dữ liệu nhạy cảm không phù hợp, không chuyển video/âm thanh/PPTX nguyên bản, kiểm tra log/retention.
4. **Bảo mật và vận hành:** cookie signed, CSRF/same-origin, hạn mức Redis, thử lỗi kết nối, quyền xóa/xuất, kiểm toán, không ghi plaintext transcript, không tự retry/fallback trả phí.
5. **Hợp đồng đầu ra:** schema tương thích UI, prompt tiếng Việt có dấu, xác minh chứng cứ E# + chữ slide nhiều trang và đo chất lượng bằng nhiều bài giả lập; nếu thất bại phải fail closed, không thay kết quả không đạt bằng khẳng định chắc chắn.
6. **Nghiệm thu:** kiểm thử mock và thử nghiệm độc lập với dữ liệu phù hợp, kiểm chứng chi phí và ranh giới quyền; chỉ bật khi có chấp thuận rõ ràng riêng.

## 4. Phạm vi không thay đổi

- Giữ nguyên `api/ai/review.js`, `AiSpeechReviewPanel.tsx`, hệ thống Gemini, database/cookie, quota, policy công khai và Vercel Production.
- Không mở endpoint Groq cho người học, không dùng dữ liệu học sinh thật, không tạo hồ sơ đồng thuận giả hoặc đánh dấu pháp lý là đã thông qua.
- Không tiêu thụ lượt Groq Free Tier; không merge `main`.

**Tham chiếu thiết kế quyền riêng tư:** `docs/GROQ_STUDENT_PRIVACY_DESIGN_PHASE_2_5.md`. Các vấn đề pháp lý còn cần chuyên gia đánh giá, tài liệu kỹ thuật này không phải chứng nhận tuân thủ.
