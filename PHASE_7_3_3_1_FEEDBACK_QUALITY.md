# SpeakLab AI – Bước 7.3.3.1: Nâng cao chất lượng nhận xét AI

**Nhánh:** `feature/recording-3-2` (Preview). **Không chỉnh** `main` hoặc Production. Chỉ triển khai Bước 7.3.3.1, chưa triển khai 7.3.3.2–7.3.3.4.

## Thay đổi

- Prompt `buildReviewPrompt` yêu cầu 2 điểm mạnh và 2 điểm cần cải thiện khác nhau, dựa trên chi tiết nội dung có trong đoạn E, không dùng lời khen/chê áp dụng chung cho mọi bài.
- Mỗi mục cần cải thiện có `action` cụ thể, gắn với vấn đề nội dung và nêu hành động bổ sung/chỉnh sửa khả thi.
- Với văn bản ngắn hoặc ASR thiếu dấu, nhận diện sai, không suy đoán lỗi phát âm hoặc năng lực học sinh; không khẳng định thiếu nội dung ngoài phạm vi bản ghi được cung cấp.
- Không chấm điểm, không nêu điểm số tự tạo hay xếp loại; không suy đoán về sự tự tin, ánh mắt, tốc độ, giọng nói hoặc cử chỉ từ TXT.
- Bộ lọc máy chủ `safeFeedbackString` kiểm tra thêm biểu thức chấm điểm và một số nhận xét về biểu hiện không thể xác minh. Kết quả vi phạm sẽ bị từ chối thay vì hiển thị đánh giá thiếu căn cứ.
- Máy chủ luôn thêm giới hạn khách quan về sai sót có thể có của ASR và việc không có dữ liệu âm thanh/hình ảnh; khi có PPTX, nêu rõ chỉ đọc chữ trên slide. Vẫn giới hạn tối đa 4 mục `limitations`.
- Cấu trúc JSON trả về, cách dẫn chứng E, cơ chế lưu nhận xét ở Đợt 7.3.2 và giao diện hiện có không đổi.

## Kiểm thử

- `node --test tests/freeSpeechReview.test.js`: kiểm tra prompt, bản ghi ASR thiếu dấu, kết quả hợp lệ, chặn chấm điểm và suy đoán biểu hiện, cùng thông báo giới hạn không phụ thuộc Gemini.
- Workflow `Check local video library`: kiểm thử các chức năng có liên quan, TypeScript, build. Test dùng dữ liệu giả, không gọi Gemini thật và không trừ lượt Free Tier.
- Vẫn cần nghiệm thu thủ công trên Vercel Preview bằng một bài thuyết trình thực tế. Prompt mới giúp định hướng phản hồi nhưng không thể bảo đảm Gemini luôn đưa ra nhận xét hoàn hảo; bộ lọc theo từ khóa có thể không phát hiện mọi dạng suy đoán, hoặc từ chối một số cách diễn đạt hợp lệ.

## Giữ nguyên

- `gemini-3.5-flash-lite`, Free Tier trên Preview, 5 lượt/tài khoản/ngày, không tự động retry hoặc fallback sang mô hình trả phí.
- Không gửi video/âm thanh hoặc tệp PPTX nguyên bản lên Gemini; không tự gọi API khi mở lại nhận xét đã lưu.
- Không thay đổi ghi hình, nhận diện giọng nói, dữ liệu lịch sử cũ.
- Chưa làm nâng cấp dẫn chứng/đối chiếu slide (7.3.3.2) hoặc đổi giao diện (7.3.3.3).
