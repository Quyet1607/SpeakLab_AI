# SpeakLab AI – Đối chiếu chi tiết toàn bộ slide có chữ

**Nhánh:** `feature/recording-3-2`; chỉ Vercel Preview. Không chỉnh `main` hoặc Production.

## Quyết định sản phẩm

Theo yêu cầu nghiệm thu, SpeakLab không còn cố định mục tiêu 6–8 slide. Đối chiếu chi tiết được **yêu cầu cho từng slide có chữ**, tối đa 40 slide theo giới hạn đầu vào hiện tại, giữ đúng `slideNumber`. Slide không có chữ trích xuất được từ PPTX không được giả định là đã được đọc hoặc phân tích hình ảnh.

## Triển khai

- `buildReviewPrompt` yêu cầu Gemini trả về một mục `slideComparisons` cho từng slide có chữ, không ưu tiên chỉ slide đầu và không lược slide cuối. Khi không thể tìm thấy lời nói, sử dụng `not_found`, không tự đặt dẫn chứng E.
- `api/ai/review.js` tiếp tục **một** lần `generateContent` cho mỗi hành động phân tích do người dùng chủ động thực hiện. Schema hỗ trợ tối đa 40 mục. Ngưỡng `maxOutputTokens` tăng theo số slide, tối đa 42.000, thấp hơn mức tối đa 65.536 của Gemini 3.5 Flash-Lite. Không retry hoặc gọi mô hình trả phí.
- Máy chủ kiểm tra độc lập số slide, văn bản trích dẫn từ slide và ASR, dấu tiếng Việt và nội dung được phép. Mục thiếu căn cứ bị loại; các mục hợp lệ vẫn được trả về và lưu. Phần đánh giá tổng quan vẫn phải qua kiểm tra như trước.
- `slideReviewStats.target` là tổng số slide có chữ; `accepted` là số mục đã được xác minh. Trường hợp thiếu mục không bị báo là phân tích xong. `slideOverview` luôn là dò từ khóa sơ bộ, không phải phân tích ngữ nghĩa.
- `localAiReviewLibrary` cho phép lưu đến 40 mục đối chiếu chi tiết và mục tiêu 40 slide. Báo cáo cũ với 1–8 mục vẫn được đọc, không tự cập nhật hoặc tiêu tốn lượt Gemini.
- Giao diện hiển thị **“Đã đối chiếu chi tiết: x/y slide có chữ”**, trong đó `y` lấy từ danh sách slide có chữ thực tế. Nếu còn thiếu, chỉ ghi rõ số slide chưa có phân tích chi tiết trong văn bản trung tính; không hiển thị khung cảnh báo kỹ thuật màu vàng đã được loại bỏ trước đó.

## Giới hạn và trung thực kết quả

- Mô hình có giới hạn đầu ra tối đa 65.536 token nhưng mức cấp phát đầu ra của mỗi lời gọi thực tế có thể không đủ hoặc phụ thuộc Free Tier. Việc yêu cầu đủ 18/40 mục **không bảo đảm Gemini sẽ luôn trả đủ 18/40 mục hợp lệ**.
- Nếu nhận xét không đủ token, phản hồi lỗi định dạng, hoặc một số dẫn chứng không hợp lệ, hệ thống không tự chi tiêu thêm lượt để hoàn tất. Các slide thiếu vẫn hiện **chưa đối chiếu chi tiết**.
- Không chuyển việc dò từ khóa thành kết luận người học bỏ qua nội dung; không có cơ chế đo chính xác thời gian chiếu từng slide.
- Phân tích lại bằng Gemini sẽ tiêu hao một lượt trong hạn mức 5 lượt/tài khoản/ngày, và hạn mức thực tế của nhà cung cấp vẫn có thể hạn chế số yêu cầu/tokens.

## Kiểm thử

- `tests/freeSpeechReview.test.js`: 40 slide có đủ 40 mục, tình huống trả ít mục hơn, dẫn chứng sai ở một slide không khiến các mục khác mất.
- `tests/aiReviewAcceptance.test.js`: PPTX 18 slide, nhận xét đủ 18 mục với một mục bị loại, bản 40 slide và các giới hạn ASR/PPTX, phần trích dẫn và lưu lịch sử.
- `tests/localAiReviewLibrary.test.js`: lưu và đọc lại toàn bộ 40 mục.
- `tests/aiReviewResults.test.js`: hiển thị số slide đã đối chiếu trên tổng số có chữ.
- GitHub Actions, TypeScript và Vercel Preview đều đã được kiểm tra thành công trên commit mã nguồn `762cd4585193df8ac86af4b60a29491209d29ecf`.
- Chưa gọi Gemini thật trên PowerPoint của người dùng trong kiểm thử; cần người dùng chủ động thử trên Preview để xác nhận số mục thật và chất lượng đối chiếu.
