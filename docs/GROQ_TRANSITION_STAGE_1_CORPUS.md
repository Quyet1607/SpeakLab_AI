# SpeakLab AI — Chuyển đổi Gemini → Groq trên Preview: Bước 1

**Trạng thái:** Chuẩn bị bộ dữ liệu và tiêu chí kiểm thử, **chưa chuyển provider**.  
**Nhánh:** `feature/groq-synthetic-pilot`.

## Mục tiêu

Thiết lập bộ mẫu giả lập đa dạng để sau này so sánh khả năng nhận xét của Groq với hợp đồng đầu ra hiện tại của Gemini. Không được suy luận Groq đạt chất lượng tương đương chỉ từ một lượt thử bài giảm rác nhựa.

## Đã triển khai

- `tests/fixtures/groqSyntheticComparisonCases.js`: 4 bài hoàn toàn hư cấu, các chủ đề tiết kiệm nước, đọc sách, an toàn tài khoản và vườn cây; mỗi bài có đề tài, mục tiêu, transcript, hai chuỗi chữ slide và danh sách kiểm tra dẫn chứng kỳ vọng.
- `tests/groqTransitionCorpus.test.js`: xác minh cấu trúc, dữ liệu giả lập không có địa chỉ email/URL/số điện thoại dài, ít nhất 3 phép kiểm tra mỗi bài, và quan trọng nhất bộ mẫu **không được đưa vào yêu cầu Groq Pilot đang chạy**.
- `.github/workflows/check-local-video-library.yml`: chạy kiểm thử offline trong CI.

## Tiêu chí đối chiếu ở các bước sau (chưa kiểm chứng kết quả)

1. **Cấu trúc:** output hợp lệ theo contract `summary`, `strengths`, `improvements`, `slideComparisons`, `limitations` của giao diện lịch sử hoặc contract R1–R5 được công bố rõ ràng; không đánh đồng hai loại schema.
2. **Dẫn chứng:** nhận xét chỉ dựa trên câu nói và chữ slide được cấp; không tạo trích dẫn, số liệu thực nghiệm, lời nói hay tài liệu mới.
3. **Ranh giới:** không nhận xét giọng nói, ánh mắt, bố cục, màu sắc, chất lượng hình ảnh nếu chỉ có văn bản.
4. **Tính xây dựng:** tiếng Việt có dấu, gợi ý cụ thể, không công bố điểm số tổng.
5. **Tính ổn định:** kiểm thử nhiều chủ đề, đo tỷ lệ kết quả hợp lệ/lỗi, độ trễ và hạn mức, không tự chạy lại khi lỗi.
6. **Chi phí và an toàn:** chỉ gọi khi giáo viên chủ động xác nhận; bảo vệ key và Redis quota; không fallback sang model có phí.

## Điểm dừng bắt buộc

Ở bước này `api/groq/pilot.js` vẫn chỉ nhận đúng hai cờ `syntheticOnly` và `confirmOneCall`; `scripts/groqSyntheticPilot.mjs` vẫn gửi duy nhất bài mẫu giảm rác nhựa. Bộ 4 mẫu mới chỉ là fixture offline, **chưa có lựa chọn mẫu trên Vercel Preview và chưa phát sinh thêm một lượt Groq**.

Không sửa `api/ai/review.js`, `AiSpeechReviewPanel.tsx`, `main` hoặc Production; Gemini vẫn xử lý chức năng hiện có.

## Điều kiện để chuyển sang bước tiếp

- GitHub Actions cho commit mới hoàn thành thành công.
- Xem xét riêng thiết kế endpoint chọn **ID mẫu có trong allowlist server** (không nhận văn bản nhập tự do); review schema bảo đảm phù hợp từng bài chứ không dựa trên chứng cứ gắn cứng của bài giảm rác nhựa.
- Giữ quyền teacher, đúng Preview branch, kiểm tra same-origin và quota Redis.
- Chưa gửi dữ liệu học sinh thật hoặc thực hiện chuyển đổi provider chính cho đến khi đáp ứng các điều kiện pháp lý và kỹ thuật trong `docs/GROQ_STUDENT_PRIVACY_DESIGN_PHASE_2_5.md`.
