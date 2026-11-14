# SpeakLab AI – Bước 7.3.3.2: Đối chiếu nội dung PowerPoint với lời nói

**Nhánh triển khai:** `feature/recording-3-2` (Vercel Preview). Không sửa `main` hay Production. Chưa triển khai cải tổ giao diện của Bước 7.3.3.3.

## Mục tiêu

Phản hồi về PowerPoint không chỉ nhận xét chung chung. Hệ thống đọc **chữ có thể trích xuất** từ tất cả các slide được cung cấp (tối đa 40 slide, 900 ký tự/slide, 16.000 ký tự tổng); khi người dùng tự nguyện yêu cầu AI phân tích, tạo **6–8 mục đối chiếu chi tiết** nếu đủ slide, ít hơn nếu PPTX có ít slide.

## Hai mức phân tích

1. **Dò từ khóa toàn bộ slide có chữ:** Hàm `buildSlideTextOverview` trên máy chủ tính từ khóa trùng giữa chữ trên slide và toàn bộ bản ghi ASR; mỗi slide được gắn nhãn `shared_keywords`, `no_shared_keywords` hoặc `insufficient_text`. Đây chỉ là **kiểm tra từ vựng**, KHÔNG khẳng định nội dung đã/không được thuyết trình. Những slide không nằm trong phân tích chi tiết được ghi rõ là *chưa đối chiếu chi tiết*.
2. **Đối chiếu ngữ nghĩa có dẫn chứng:** Trong một yêu cầu Gemini Free Tier, mô hình chọn 6–8 slide đáng chú ý nếu có đủ dữ liệu, ưu tiên nội dung quan trọng hoặc có chênh lệch, phân bổ trên cả bài. Mỗi mục gồm:
   - Số slide và trạng thái `matched` / `partial` / `not_found` / `possible_difference`.
   - Nhận xét cụ thể `point`, trích dẫn nguyên văn `slideQuote` từ slide.
   - `spokenQuote` trích nguyên văn trong đúng `evidenceId` nếu tìm thấy nội dung tương ứng.
   - Nội dung tìm thấy `covered`, nội dung chưa tìm thấy/cần kiểm tra `missing`, và gợi ý sửa/luyện tập `action`.
   - Với `not_found`, không được gắn mã E hoặc lời nói giả: `evidenceId` và `spokenQuote` để trống.

## Kiểm soát tính xác thực

- Máy chủ xác minh số slide có tồn tại, các slide chi tiết không trùng nhau, số lượng mục chi tiết phù hợp, trạng thái nằm trong danh sách cho phép.
- `slideQuote` phải thực sự xuất hiện trong chữ trên slide; `spokenQuote` phải xuất hiện trong đoạn E đã nêu. Nếu sai, máy chủ từ chối phản hồi không có căn cứ thay vì tự bổ sung dữ liệu.
- Kết luận *chưa tìm thấy* chỉ áp dụng cho bản ghi ASR gửi vào. **Không xác định được** người học đang chiếu slide nào, thời điểm chuyển slide, biểu đồ, hình ảnh hay hiệu quả trình bày trực quan.
- Không tự gọi lại Gemini để sửa kết quả lỗi: tránh yêu cầu bổ sung ngoài sự đồng ý và không tự tăng tiêu thụ quota.

## Lưu và hiển thị

- `AiSpeechReviewPanel` hiển thị các trường chi tiết trong bố cục hiện có; danh sách dò từ khóa toàn bộ slide được đặt trong phần mở rộng/thu gọn, *không* thiết kế lại giao diện của bước 7.3.3.3.
- `localAiReviewLibrary` lưu thêm `slideOverview` và tối đa 8 đối chiếu chi tiết; các báo cáo kiểu cũ ở Đợt 7.3.2 vẫn hợp lệ, không tự xóa hay chạy lại.
- Bài không có PPTX giữ nguyên nhận xét nội dung TXT và `slideComparisons = []`. Hành động mở báo cáo đã lưu không gọi Gemini.

## Giới hạn và kiểm thử

- 1 yêu cầu Gemini cho một lần phân tích do người học chủ động kích hoạt; vẫn Preview Free Tier, 5 lượt/tài khoản/ngày, không tự đổi mô hình hay bật thanh toán.
- Vì đầu ra có thể gồm đến 8 đối chiếu, tăng giới hạn độ dài **đầu ra** của cùng một yêu cầu Gemini khi có PPTX. Kết quả Gemini có thể thiếu cấu trúc hoặc không đưa ra trích dẫn chính xác; khi đó hệ thống từ chối, không bảo đảm mọi lần phân tích thành công.
- Bộ kiểm thử `tests/freeSpeechReview.test.js` và `tests/localAiReviewLibrary.test.js` bao gồm 40 slide, giới hạn 6–8 đối chiếu, từ khóa sơ bộ, dẫn chứng sai, thiếu dẫn chứng, trùng số slide và tương thích dữ liệu lịch sử.
- Kiểm thử tự động dùng dữ liệu mô phỏng, **không gọi Gemini thật**; cần thử thủ công một bài có PPTX trên Vercel Preview.

**Ngoài phạm vi:** OCR/đọc hình ảnh, đồng bộ trình chiếu với lời nói, chấm điểm, đánh giá cảm xúc/giọng nói, chỉnh sửa giao diện toàn diện và bước 7.3.3.3.

## Sửa lỗi `GEMINI_INVALID_FEEDBACK` với PowerPoint nhiều slide

Khi Gemini trả về 6–8 mục đối chiếu, trước đây **chỉ một** đoạn trích dẫn `slideQuote` hoặc `spokenQuote` không khớp nguyên văn cũng làm từ chối toàn bộ bản nhận xét (mã `GEMINI_INVALID_FEEDBACK`). Lỗi người dùng ghi nhận trên Preview khi bản ghi khoảng 2.146 ký tự và PPTX có 18 slide; ảnh chụp chỉ cho thấy mã lỗi, **không xác định được chính xác mục nào bị sai** vì không lưu hoặc phơi bày dữ liệu người học trong log.

Cơ chế được điều chỉnh mà không gọi Gemini lần hai:
- Yêu cầu Gemini ưu tiên dẫn chứng ngắn, thật; không ép phải bịa cho đủ 6 mục. Schema cho phép ít mục hơn.
- Mỗi đối chiếu vẫn được kiểm tra độc lập: số slide hợp lệ, không trùng, trạng thái hợp lệ, chữ trích có thật trên slide, lời nói trích có thật trong E, các trường nhận xét không vượt quá dữ liệu.
- Mục không vượt qua kiểm tra bị loại **hoàn toàn**, không tự thay trích dẫn bằng nội dung khác. Các mục hợp lệ tiếp tục được hiển thị và lưu. Nếu không có mục chi tiết nào hợp lệ, chỉ hiển thị phần dò từ khóa toàn bộ slide và cảnh báo rõ không có kết luận chi tiết.
- Trả về/lưu `slideReviewStats` (mục tiêu, số Gemini trả về, số hợp lệ, số bị loại) để người dùng nhận biết mức độ đầy đủ. Báo cáo lưu trước đó vẫn đọc được.
- Các lỗi ở phần nhận xét cốt lõi hoặc JSON không hợp lệ vẫn bị từ chối; không cố bịa 2 điểm mạnh/2 điểm cần cải thiện. Hạn mức Free Tier giữ nguyên, **lỗi phản hồi có thể vẫn tính một lượt**.
- Kiểm thử hồi quy có PPTX 18 slide, 40 slide, dữ liệu không hợp lệ, lưu lịch sử, không có PowerPoint, TypeScript và build; không phát sinh yêu cầu Gemini thật trong kiểm thử.

Chưa thể xác nhận 100% chất lượng bằng mô phỏng; cần người dùng thử một lần trên Preview khi còn hạn mức và đối chiếu trực tiếp kết quả với bài thuyết trình.
