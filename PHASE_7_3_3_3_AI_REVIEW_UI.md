# SpeakLab AI – Bước 7.3.3.3: Giao diện nhận xét AI dễ đọc

**Phạm vi:** chỉ nhánh `feature/recording-3-2`, Vercel Preview. Không sửa `main`, không triển khai Production, không thay đổi API Gemini hoặc cơ chế phân tích của Bước 7.3.3.2.

## Mục tiêu

Giúp học sinh đọc nhanh nhận xét, xác minh nội dung PowerPoint và bản ghi lời nói tương ứng, xác định slide cần cải thiện và xem lại báo cáo đã lưu mà không dùng thêm lượt Gemini.

## Thiết kế đã áp dụng

- Tách phần hiển thị báo cáo thành thành phần `src/features/history/AiReviewResults.tsx`. Phần gọi API, xác nhận chia sẻ, tải PPTX, xóa/lưu báo cáo vẫn ở `AiSpeechReviewPanel.tsx`, không đổi hành vi.
- **Nhận xét tổng quan** thành thẻ rõ ràng; **điểm mạnh** và **điểm cần cải thiện** chia hai khu vực, hiển thị một cột ở màn hình hẹp. Mỗi cải thiện có ô gợi ý thực hiện riêng.
- **Dẫn chứng E** dùng phần mở rộng/thu gọn. Văn bản từ bản ghi được hiển thị nguyên văn, không tự sửa dấu hoặc diễn đạt lại.
- **Các slide đối chiếu chi tiết** có nhãn trạng thái `matched`, `partial`, `not_found`, `possible_difference`; trích văn bản PPTX và bản ghi ASR đặt cạnh nhau ở màn hình rộng, xếp dọc trên điện thoại.
- Phân biệt rõ nội dung đã tìm thấy, nội dung cần kiểm tra và hành động gợi ý; khi `not_found` không hiện trích dẫn lời nói tự tạo.
- Bộ lọc **Tất cả / Cần xem lại / Đã tìm thấy** chỉ tác động đến danh sách hiển thị; không thay đổi hoặc xóa báo cáo đã lưu. Nhóm cần xem lại gồm `partial`, `not_found`, `possible_difference`. Các báo cáo cũ không có trạng thái vẫn nằm trong **Tất cả**.
- Tóm tắt số mục đã xác thực / Gemini trả về / mục tiêu; cảnh báo rõ nếu dữ liệu đối chiếu chưa đầy đủ. Phần dò từ khóa toàn bộ slide nằm trong khung mở rộng, được gắn nhãn **không phải kết luận nội dung**, ghi rõ những slide chưa được đối chiếu chi tiết.
- Giới hạn đánh giá vẫn được trình bày ở cuối báo cáo. Các tiêu đề có ID riêng theo từng phiên hiển thị để hỗ trợ khả năng truy cập.

## Tương thích, an toàn

- Dùng lại `AiSpeechReview` và dữ liệu lưu từ 7.3.2–7.3.3.2. Không di chuyển, xóa, ghi lại hay chuyển đổi dữ liệu cũ; không phân tích lại báo cáo đã lưu.
- Không thay đổi nhận diện giọng nói, ghi hình, TXT/PPTX, hạn mức, xác thực hoặc prompt AI.
- Không tạo bản nhận xét, điểm số, trích dẫn hay kết luận mới tại giao diện.
- Nội dung nhận xét và trích dẫn chỉ hiển thị như text trong React, không dùng `dangerouslySetInnerHTML`.
- Vẫn không thể xác định thời điểm người học chiếu một slide từ văn bản PPTX/ASR.

## Kiểm thử và nghiệm thu

- `tests/aiReviewResults.test.js` kiểm tra hiển thị tổng quan, gợi ý luyện tập, E mở rộng, so sánh slide/TXT, dữ liệu không tìm thấy, nhóm lọc, cảnh báo thiếu dẫn chứng, tương thích báo cáo cũ và không có PPTX.
- GitHub Actions `Check local video library` bổ sung kiểm thử này cùng các bước kiểm thử đã có, TypeScript check và build.
- Cần nghiệm thu thủ công trên Vercel Preview với báo cáo 18 slide: mở lại Lịch sử, lọc Cần xem lại, mở trích dẫn E, xem bảng dò từ khóa; xác nhận không có lời gọi Gemini khi chỉ xem kết quả.

**Bước kế tiếp:** 7.3.3.4 – kiểm thử nghiệm thu toàn bộ với dữ liệu thực và các tình huống ASR/PPTX. Không tự động triển khai trong bước này.
