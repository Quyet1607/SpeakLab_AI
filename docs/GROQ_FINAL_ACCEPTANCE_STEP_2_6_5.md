# SpeakLab AI — Bước 2.6.5: Tổng nghiệm thu Groq Synthetic Pilot

**Ngày tổng hợp:** 17/11/2026  
**Repository:** `Quyet1607/SpeakLab_AI`  
**Nhánh:** `feature/groq-synthetic-pilot`  
**Phạm vi:** tổng hợp và xác minh bằng chứng hiện có; **không thay đổi route, UI, quyền, quota, provider, Production hoặc main**.

## 1. Quyết định

| Phạm vi | Quyết định | Căn cứ và giới hạn |
|---|---|---|
| Pilot riêng `/groq-pilot.html` trên Vercel Preview, teacher-only, bài giả lập cố định | **GO — giới hạn** | Có một lượt chạy thành công được người vận hành cung cấp ảnh; API/Redis/provider đã có kiểm thử mock. Không phải kết luận độ tin cậy thống kê |
| Bổ sung điểm truy cập tới pilot trong giao diện ứng dụng Preview, vẫn teacher-only và synthetic-only | **CÓ THỂ THIẾT KẾ BƯỚC RIÊNG**, cần duyệt và kiểm thử | Chưa triển khai trong 2.6.5; không được tự gửi transcript/PPTX/video người học |
| Groq xử lý bài thuyết trình thật hoặc thay Gemini trong `/api/ai/review` | **NO-GO** | Chưa hoàn thành các cổng đồng thuận, quyền riêng tư, kiểm soát dữ liệu và review contract |
| Gộp PR #3 vào `main` hoặc bật Production | **NO-GO** | Phạm vi pilot hiện tại cố tình giới hạn Preview, đúng nhánh |

## 2. Bằng chứng theo bước

| Bước | Hiện trạng | Bằng chứng |
|---|---|---|
| 2.6.1 Cấu hình và sẵn sàng Preview | Đạt kiểm thử offline; GET không thử kết nối Redis thật | `docs/GROQ_PREVIEW_READINESS_STEP_2_6_1.md`, `tests/groqPreviewReadiness.test.js`; Actions [#384](https://github.com/Quyet1607/SpeakLab_AI/actions/runs/44047679883) và owner [#109](https://github.com/Quyet1607/SpeakLab_AI/actions/runs/44047679837): success |
| 2.6.2 Lượt gọi Groq thật | Người vận hành cung cấp ảnh Vercel Preview hiển thị phản hồi R1–R5 và thông báo nhận được kết quả | Một mẫu giả lập cố định về giảm rác nhựa; **không** có dữ liệu đo độ trễ, chi phí, độ ổn định nhiều lượt hoặc log độc lập để tái kiểm chứng |
| 2.6.3 Rubric và dẫn chứng | Đạt bộ kiểm thử chất lượng mock, R2 chỉ khẳng định mở/kết, R4 chỉ đối chiếu chữ | `docs/GROQ_QUALITY_ACCEPTANCE_STEP_2_6_3.md`, `tests/groqQualityAcceptance.test.js`; Actions [#388](https://github.com/Quyet1607/SpeakLab_AI/actions/runs/44052930098): success |
| 2.6.4 Fail-closed, quota, lỗi provider | Đạt kiểm thử offline, an toàn thông báo lỗi và không tự retry | `docs/GROQ_FAILURE_QUOTA_STEP_2_6_4.md`, `tests/groqFailureAndQuotaAcceptance.test.js`; Actions [#394](https://github.com/Quyet1607/SpeakLab_AI/actions/runs/44056693795) và owner [#116](https://github.com/Quyet1607/SpeakLab_AI/actions/runs/44056693744): success |

Các kết quả GitHub Actions trên là của **commit trước báo cáo này**. Bước 2.6.5 cần kiểm tra CI của commit chứa chính báo cáo trước khi tuyên bố tổng nghiệm thu cuối cùng.

## 3. Ranh giới an toàn xác nhận từ mã nguồn

- `api/groq/pilot.js` yêu cầu `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=feature/groq-synthetic-pilot`, session Google hợp lệ vai trò `teacher`, nội dung POST đúng `{ "syntheticOnly": true, "confirmOneCall": true }`, kiểm tra same-origin và đặt chỗ quota Redis trước khi gửi Groq.
- `scripts/groqSyntheticPilot.mjs` dùng một `SAMPLE` cố định và chỉ cho mô hình lựa chọn evidence IDs; trích dẫn nguyên văn được gán ở server. Bài giả lập, không truyền nội dung học sinh từ client.
- `server/groqPilotQuota.js` áp dụng hạn mức thử thận trọng: 3 lượt/tài khoản/ngày UTC, 12 lượt toàn hệ thống/ngày UTC, 2 lượt/phút UTC và một request đồng thời. Đây **không phải** hạn mức chính thức của Groq; số lượt không được hoàn lại khi provider lỗi.
- `server/groqReviewProvider.js` cố định mô hình `openai/gpt-oss-20b`, không retry, không fallback sang mô hình có phí, làm sạch lỗi provider.
- Các test offline không chứng minh Redis thật còn hạn mức, tài khoản Groq còn Free Tier hoặc không có billing. Cần kiểm tra trên bảng điều khiển nhà cung cấp, không đưa credential vào báo cáo.
- Static page `public/groq-pilot.html` không đồng nghĩa API được mở công khai: yêu cầu thực thi vẫn qua các guard ở backend. Không xem `noindex` là xác thực.

## 4. Vì sao SpeakLab vẫn dùng Gemini

- `src/features/history/AiSpeechReviewPanel.tsx` gọi `POST /api/ai/review`, hiển thị thông báo đồng thuận cho Google Gemini.
- `api/ai/review.js` khởi tạo `GoogleGenAI` từ `GEMINI_API_KEY`; endpoint này chưa được đổi sang Groq.
- Output contract của pilot `criteria: R1–R5` khác contract của nhận xét lịch sử hiện tại (`strengths`, `improvements`, `slideComparisons`, `limitations`). Không thể chỉ đổi API key để thay provider.

## 5. Các điều kiện còn thiếu trước khi dùng bài thuyết trình thật

Theo `docs/GROQ_STUDENT_PRIVACY_DESIGN_PHASE_2_5.md`:

1. Chốt chủ thể kiểm soát/xử lý, chính sách dữ liệu, điều kiện của Groq, đánh giá chuyển dữ liệu và các căn cứ/đồng thuận phù hợp cho đối tượng học sinh, có chuyên gia xác nhận việc áp dụng.
2. Hoàn tất hồ sơ đồng thuận/đại diện hợp pháp khi cần **phía server**; xác minh theo nhà cung cấp, mục đích, thời điểm và phiên bản chính sách; cơ chế thu hồi.
3. Có kiểm soát dữ liệu định danh, quyền đọc/xóa/xuất, bảo vệ thiết bị dùng chung, xử lý sự cố và kiểm thử mối đe dọa.
4. Thiết kế tuyến Groq riêng cho **dữ liệu được phép**, giữ schema và bộ kiểm chứng tương thích giao diện; kiểm tra bảo mật/quota có thực và nghiệm thu phù hợp trước khi quyết định chuyển provider.
5. Không suy diễn `consent: true` của client đã đáp ứng điều kiện đồng thuận học sinh; không mô tả `localStorage` như kho bảo mật.

## 6. Phương án triển khai Preview tiếp theo (chưa thực hiện)

**Bước đề xuất sau nghiệm thu, cần phê duyệt riêng:** đưa nút/đường dẫn `Thử Groq (dữ liệu giả lập)` vào giao diện SpeakLab Preview, chỉ hiển thị với role teacher trong bản Preview đúng nhánh. Nút dẫn đến pilot hiện có; server tiếp tục chặn role, origin, branch, input và quota. Không thay `AiSpeechReviewPanel`, không thay tên/đồng thuận Gemini thành Groq, không đưa dữ liệu người dùng vào pilot.

**Tiêu chí nghiệm thu bước giao diện sau này:** giáo viên thấy được nút; learner/guest không thấy nút và API vẫn từ chối; không dùng dữ liệu thật; production không hiển thị nút; regression tests/lint/build đạt; bản Preview được chủ dự án kiểm tra.

## 7. Kết luận giới hạn

**GO:** Chỉ giữ và có thể mở rộng *truy cập giao diện* cho pilot dữ liệu giả lập, đúng teacher + Preview + nhánh được phép, với bước triển khai/kiểm thử riêng.

**NO-GO:** Thay Gemini bằng Groq cho bài thật, xử lý dữ liệu học sinh, merge `main`, Production. Không đưa ra tuyên bố tuân thủ pháp lý hay độ chính xác trên bài thật từ một lượt thử giả lập.

**Không thực hiện ở Bước 2.6.5:** không gọi Groq thật, không thay route/feature, không đổi quota/secret, không cập nhật điều khoản công khai, không merge PR #3.
