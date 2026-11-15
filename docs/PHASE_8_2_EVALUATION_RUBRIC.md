# Giai đoạn 8 · Bước 8.2 — Đặc tả Rubric báo cáo đánh giá

Ngày thiết kế: 15/11/2026  
Nhánh: `feature/evaluation-report-8-1`  
Trạng thái: **Đề xuất để nghiệm thu — chưa triển khai tính điểm hoặc sửa giao diện**  
Căn cứ mã nguồn: `docs/PHASE_8_1_REPORT_AUDIT.md`, `src/services/localPracticeHistory.ts`, `src/services/localAiReviewLibrary.ts`, `src/services/localReviewSlideLibrary.ts`, `src/features/history/AiSpeechReviewPanel.tsx`.

## 1. Mục đích
Tạo báo cáo **giúp người học tự cải thiện**, không phải điểm thi hay đánh giá chính thức của giáo viên. Mọi phát biểu đánh giá phải truy ngược được đến thông tin buổi luyện, câu chữ được nhận diện và/hoặc chữ trong PPTX. Không có bằng chứng thì hiển thị **Chưa đủ dữ liệu**, tuyệt đối không dùng nội dung `mockDefaultReport` hay tự gán điểm.

Báo cáo gồm hai tầng:
1. **Thông tin quan sát/đo đếm:** buổi luyện, thời lượng, số slide theo metadata, trạng thái video/TXT/PPTX, độ dài bản ghi và số đoạn lời nói; có thể báo số từ/phút **ước tính theo phương pháp được công bố** nếu đủ transcript và thời lượng hợp lệ.
2. **Rubric nội dung:** nhận xét có căn cứ; Gemini chỉ đóng góp nhận xét tham khảo khi người dùng đã tự nguyện phân tích và bản lưu còn hợp lệ. Bản Production không mặc định dùng Gemini.

## 2. Danh mục tiêu chí (đề xuất)

| Mã | Tiêu chí | Trọng số **khi có chấm điểm được thẩm định** | Dữ liệu bắt buộc | Nội dung cần xem xét |
| --- | --- | ---: | --- | --- |
| R1 | Nội dung và độ bám đề tài | 30% | Đề tài/mục tiêu, transcript đủ đọc | Các ý chính liên quan đề tài; nêu được nội dung cụ thể, không gán tính đúng sai của số liệu chưa kiểm chứng |
| R2 | Cấu trúc và tính mạch lạc | 25% | Transcript đủ đọc | Có mở bài, phần triển khai, kết luận/chuyển ý **khi nội dung thực sự thể hiện**; không suy ra nhịp độ hay chất giọng |
| R3 | Lập luận và dẫn chứng | 20% | Transcript đủ đọc | Có luận điểm, lý giải và ví dụ/dẫn chứng; phân biệt “đã nêu” với “đã được kiểm chứng” |
| R4 | Đối chiếu nội dung PowerPoint | 15% | Transcript + chữ PPTX trích xuất | Chỉ đánh giá sự tương ứng về **nội dung văn bản**; không suy ra slide nào đã được chiếu, không xem thiếu từ khóa là bỏ qua slide |
| R5 | Đáp ứng mục tiêu tự đặt ra | 10% | Mục tiêu luyện tập cụ thể + transcript | Có dấu hiệu nội dung phù hợp mục tiêu; không đánh giá nếu mục tiêu không rõ hoặc không thể xác minh từ chữ |

Các trọng số **chưa được sử dụng để tự động tính điểm**. Nếu muốn dùng điểm tổng hợp trong giai đoạn sau phải thẩm định rubric với giáo viên, thử nghiệm độ nhất quán và quy tắc xử lý dữ liệu thiếu. Không lấy 5 trọng số trên để tự động nội suy thành điểm 10 lúc này.

## 3. Mức độ và trạng thái theo tiêu chí

### Thang mô tả đề xuất, KHÔNG tự động áp dụng cho người học
- **Mức 3 — Thể hiện rõ:** nhiều bằng chứng rõ ràng, phù hợp trực tiếp với mô tả của tiêu chí.
- **Mức 2 — Thể hiện một phần:** có bằng chứng nhưng thiếu một số thành phần quan trọng.
- **Mức 1 — Cần cải thiện:** có bằng chứng trực tiếp cho thấy yêu cầu chưa được đáp ứng đầy đủ; nêu điều cần sửa cụ thể.
- **Mức 0 — Chưa thể hiện trong nguồn được xét:** chỉ dùng khi nguồn **đủ độ bao phủ**, đã xem xét cẩn thận và có căn cứ; KHÔNG biến lỗi ASR, thiếu slide hay im lặng của một nguồn thành điểm 0.
- **Chưa đủ dữ liệu:** không có transcript, transcript quá ngắn/đứt đoạn, thiếu PPTX/mục tiêu, nguồn lỗi hoặc không đủ tin cậy.
- **Không áp dụng:** tiêu chí không phù hợp với loại bài luyện đã chọn; phải nêu lý do.

**Ở MVP:** chỉ trình bày đánh giá định tính và dẫn chứng; không hiện mức 0–3 tự động, điểm tổng, xếp hạng hoặc so sánh tiến bộ khi chưa có quy trình thẩm định.

## 4. Quy tắc xác thực bằng chứng
1. Từng nhận xét cần lưu **tiêu chí**, **nguồn**, **trích dẫn chính xác từ nguồn**, **tham chiếu đoạn transcript hoặc slide**, **giới hạn kết luận** và **gợi ý cải thiện**.
2. Trích dẫn từ ASR phải đối chiếu với text còn lưu; mốc thời gian ASR chỉ ước lượng, không hứa đồng bộ từ chính xác với video. Trích dẫn slide phải đối chiếu text PPTX; không tạo nội dung mới.
3. Bằng chứng từ Gemini: sử dụng `strengths`, `improvements`, `slideComparisons` kèm `evidenceId`/`evidence`, `status`, `slideQuote` và `spokenQuote` nếu đã qua validator của thư viện. Các dòng `slideOverview` dò từ khóa chỉ là tín hiệu, **không phải** kết luận đánh giá.
4. `inputFingerprint` trong kho AI chỉ phục vụ cảnh báo nội dung thay đổi, **không phải chứng cứ bảo mật**. Nếu transcript, mục tiêu hoặc PPTX đã khác với đầu vào cũ, đánh dấu **nhận xét đã cũ**, không dùng kết quả đó để chấm điểm.
5. Không bịa lời nói người học, không giả danh lời giám khảo. Một câu được trích từ bản ghi ASR vẫn có thể bị nhận sai; cho phép người dùng xem nguồn và tự xác minh.
6. Thiếu Gemini hoặc API bị chặn ở Production **không làm mất** thông tin thực về thời lượng, lịch sử và video.

## 5. Ma trận khả dụng dữ liệu

| Tình huống | Báo cáo được phép hiển thị | Không được hiển thị |
| --- | --- | --- |
| Chỉ metadata buổi luyện | Thông tin buổi luyện, thời lượng, chế độ, trạng thái video/TXT | Điểm, nhận xét suy diễn về nội dung, tốc độ nói thật |
| Có TXT/ASR, không PPTX | Mục R1/R2/R3 có thể được **xem xét định tính** nếu nguồn đủ; số chữ và mốc ASR có chú thích | R4; kết luận về ánh mắt, biểu cảm, ngữ điệu |
| Có TXT và PPTX | Bổ sung đối chiếu chữ ở R4, đánh dấu mức bao phủ/tình trạng từng slide | Khẳng định người học đã trình chiếu slide đó |
| Không có mục tiêu rõ | R1–R4 nếu có nguồn | R5; thay bằng “Chưa đủ dữ liệu: thiếu mục tiêu cụ thể” |
| Có nhận xét Gemini đã lưu hợp lệ | Hiển thị nhận xét tham khảo có dẫn chứng và nhãn nguồn; so fingerprint | Điểm rubric tự động hoặc lời nhận xét “giám khảo thật” |
| Không đăng nhập / Production khóa Gemini | Thông tin và dữ liệu cục bộ của khách/Google theo nhóm tương ứng | Ép đăng nhập để xem báo cáo cơ bản; gọi Gemini ngầm |
| Video đã xóa | Thông tin, transcript và các dữ liệu còn lưu | Khung video giả, mốc đồng bộ với video đã mất |

## 6. Đề xuất định dạng dữ liệu báo cáo (để triển khai 8.3)
Định dạng dự kiến, **chưa phải API đã triển khai**:

```ts
type RubricCriterionId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
type AssessmentState = 'observed' | 'insufficient_data' | 'not_applicable';
type EvidenceOrigin = 'session_metadata' | 'asr_transcript' | 'pptx_text' | 'saved_ai_review';

type CriterionResult = {
  id: RubricCriterionId;
  state: AssessmentState;
  summary?: string;
  evidence: Array<{
    origin: EvidenceOrigin;
    quote?: string;
    segmentIndex?: number; // estimated ASR segment, not precise word alignment
    slideNumber?: number;
  }>;
  recommendation?: string;
  limitations: string[];
};

type PracticeAssessment = {
  schemaVersion: 1;
  sessionId: string;
  ownerSub: 'guest' | string; // validate Google ID and scope, not free-form in implementation
  createdAt: string;
  provenance: 'local_observations' | 'saved_ai_review';
  sourceFingerprint: string; // change detection only
  criteria: CriterionResult[];
  overallScore: null; // no automatic total score in MVP
};
```

Các trường trên cần kiểm tra tính hợp lệ, giới hạn kích thước, khả năng đọc lịch sử cũ, không sao chép tên/tokens Google hay blob video vào `localStorage`. Video tiếp tục ở IndexedDB. Khi đổi nhóm chủ sở hữu, không được đọc nhầm báo cáo của nhóm khác trên giao diện; lưu ý lưu trữ trên trình duyệt dùng chung không phải cách ly bảo mật.

## 7. Quy tắc kiểm thử nghiệm thu Rubric
- [ ] Transcript trống hoặc không tồn tại: R1–R5 không phát sinh điểm hoặc nhận xét đánh giá có vẻ xác thực.
- [ ] Có metadata nhưng không TXT: vẫn xem báo cáo dữ kiện; không hiển thị điểm mẫu 8.8.
- [ ] TXT không PPTX: R4 ghi “Chưa đủ dữ liệu”, không gán điểm 0.
- [ ] Không có mục tiêu: R5 ghi “Chưa đủ dữ liệu”, không gán điểm 0.
- [ ] PPTX trích chữ rỗng, slide ảnh: không khẳng định “đã bỏ qua slide”.
- [ ] Gemini không khả dụng trên Production hoặc hết quota: báo cáo cục bộ vẫn hoạt động.
- [ ] Trích dẫn Gemini không khớp nguồn, review stale, review legacy thiếu trường: không dùng làm đánh giá có nguồn; hiện cảnh báo.
- [ ] Chuyển Guest ↔ Google: bản báo cáo được lọc đúng chủ sở hữu, không xóa/làm thay đổi dữ liệu cũ.
- [ ] Reload, xóa video, thiếu bộ nhớ, xóa riêng TXT/review/slides: không tạo báo cáo giả hoặc phá lịch sử.
- [ ] Export PDF chỉ hiển thị khi xuất báo cáo thực; không có dữ liệu thì giải thích, không tạo chứng nhận hội đồng.

## 8. Điểm dừng Bước 8.2
Hoàn thành **đặc tả thiết kế** trên nhánh phát triển, không sửa đường dẫn người dùng, không thay đổi `src/` hoặc API. Trước Bước 8.3 cần chủ dự án duyệt Rubric và chọn mức đánh giá định tính; việc thêm điểm số chỉ được xem xét khi có cơ sở thẩm định độc lập.
