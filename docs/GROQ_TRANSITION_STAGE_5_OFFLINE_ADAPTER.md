# SpeakLab AI — Bước 5: Bộ chuyển đổi kết quả Groq Pilot sang định dạng SpeakLab (chỉ offline)

**Nhánh:** `feature/groq-synthetic-pilot`  
**Phạm vi:** mô-đun chuyển đổi độc lập và kiểm thử mock. **Không gửi yêu cầu Groq thật, không nhận dữ liệu học sinh.**

## 1. Vấn đề cần giải quyết

- Groq Pilot với bốn mẫu giả lập cố định hiện xuất `summary`, `criteria[R1–R5]`, `limitations`, cùng mã dẫn chứng `OPEN/SOLUTION_1/...`.
- Giao diện nhận xét lịch sử đang dùng `summary`, `strengths[2]`, `improvements[2]`, `slideComparisons[]`, `slideOverview`, `limitations[]` và dẫn chứng `E#`. Việc đổi tên trường trực tiếp không cung cấp đầy đủ bằng chứng.
- Mục tiêu của Bước 5 là **thử nghiệm khả năng chuyển dạng hợp đồng hiển thị**, không phải xác nhận Groq có thể thay Gemini cho dữ liệu thật.

## 2. Triển khai

`server/groqSyntheticReviewAdapter.js`:

1. Nhận duy nhất `caseId` thuộc 4 mẫu giả lập và đối tượng kết quả R1–R5.
2. Chạy lại `validateSyntheticCaseReview` để kiểm chứng đầy đủ 5 mục, evidenceIds và câu chữ. Không tin trường `quote` do bên gọi tự đưa vào.
3. Xây dựng chứng cứ `E#` từ bản ghi mẫu cố định với `makeEvidenceChunks`, không tạo trích dẫn mới.
4. Ánh xạ phần nội dung đã chuẩn hóa của R1/R5 sang hai điểm mạnh; R3 và nhận xét thận trọng về chuyển ý sang hai điểm cần cải thiện; tạo hai đối chiếu slide ở trạng thái `possible_difference`. Không kết luận đã trình chiếu thành công, không suy diễn kỹ năng thể hiện.
5. Truyền đầu ra chuyển đổi qua **chính** `parseGroundedReview` đang xác minh kết quả trong SpeakLab. Nếu thiếu hai điểm mạnh/hai cải thiện/hai đối chiếu slide hợp lệ thì từ chối.
6. Gắn `model: groq-synthetic-contract-offline` để không giả danh Gemini hay tuyên bố đây là kết quả Groq thật. Không có API mới hoặc khóa provider trong mô-đun.

`tests/groqSyntheticReviewAdapterStep5.test.js` thực hiện đối chiếu 4 bài, kiểm tra chứng cứ không bị bịa, giá trị ID sai, thiếu tiêu chí, điểm số trái phép, các trạng thái slide thận trọng và đảm bảo đường gọi Gemini hiện tại không đổi.

## 3. Phạm vi chứng minh / không chứng minh

**Có thể xác nhận bằng CI:** Dữ liệu R1–R5 giả lập đã qua kiểm chứng *có thể được chuẩn hóa* thành định dạng giao diện SpeakLab trên bốn mẫu hư cấu và được kiểm chứng tiếp bằng bộ xác minh hiện tại.

**Không chứng minh:** bất cứ bài học sinh nào có thể được chuyển dạng đúng; Groq có thể tạo nhận xét theo schema `strengths/improvements` trên bài thật; kết quả tương đương chất lượng Gemini; đã giải quyết đồng thuận/pháp lý; dữ liệu slide hình ảnh được phân tích. Bài giảm rác nhựa đầu tiên không thuộc bốn mẫu của adapter này.

## 4. Giới hạn giữ nguyên

- Không thay `api/ai/review.js` và `AiSpeechReviewPanel.tsx`; Gemini tiếp tục đảm nhiệm nhận xét bài thực tế trên Preview.
- Không mở rộng `api/groq/pilot.js` cho bản ghi/số liệu người học. Groq Pilot chỉ chấp nhận mã mẫu cố định và role giáo viên trên Preview đúng nhánh.
- Không gửi nội dung người học tới Groq, không thay policy/cookie/quota, không merge `main` hoặc đưa lên Production.
- Các cổng đồng thuận, bảo vệ dữ liệu và kiểm chứng pháp lý ở `docs/GROQ_STUDENT_PRIVACY_DESIGN_PHASE_2_5.md` vẫn **NO-GO**.

**Điểm dừng:** chỉ nghiệm thu sau khi workflow GitHub Actions của commit cuối báo `Success`. Chưa kích hoạt tích hợp trực tiếp giữa adapter và bất kỳ route nào.
