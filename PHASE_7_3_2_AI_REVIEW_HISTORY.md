# SpeakLab AI – Đợt 7.3.2: Lưu nhận xét AI trong Lịch sử luyện tập

**Phạm vi:** Chỉ nhánh `feature/recording-3-2`. Không sửa `main`, không triển khai Production.

## Mục tiêu

Sau khi người học chủ động yêu cầu Gemini nhận xét, kết quả được lưu cục bộ theo `sessionId` và tài khoản để có thể mở lại từ **Lịch sử luyện tập** mà không gọi API lần nữa.

## Hành vi

- Lưu nhận xét tổng quan, 2 điểm mạnh, 2 điểm cần cải thiện, dẫn chứng TXT, đối chiếu slide (nếu có), giới hạn đánh giá và tên mô hình.
- Dữ liệu được lưu ở `speaklab_local_ai_reviews_v1`, tách khỏi video, bản ghi TXT và metadata buổi luyện.
- Mỗi buổi luyện/tài khoản có một bản nhận xét mới nhất. Khi phân tích lại thành công, bản mới thay thế bản cũ; không tạo nhiều bản sao cho cùng một buổi.
- Mở lại Lịch sử chỉ đọc kết quả cục bộ, không gọi Gemini và không tiêu tốn hạn mức 5 lượt/ngày.
- Dấu vân tay nội dung được dùng để nhận biết đề tài, mục tiêu, TXT hoặc chữ trong PPTX đã thay đổi. Nếu thay đổi, kết quả cũ vẫn có thể xem nhưng được cảnh báo là đã cũ; người học chủ động đồng ý và bấm phân tích lại nếu muốn cập nhật.
- Có thể xóa riêng nhận xét AI mà không xóa TXT hoặc video. Khi xóa bản ghi TXT của một buổi, nhận xét AI gắn với bản ghi đó cũng được xóa; video vẫn giữ nguyên.

## Quyền riêng tư và giới hạn

- Chỉ lưu trong localStorage của trình duyệt hiện tại; không gửi báo cáo lên máy chủ SpeakLab và không đồng bộ giữa thiết bị.
- `ownerSub` chỉ dùng để phân nhóm dữ liệu ở giao diện, không phải ranh giới bảo mật giữa các tài khoản dùng chung thiết bị.
- Xóa dữ liệu trang web/trình duyệt có thể làm mất nhận xét đã lưu.
- Dấu vân tay nội dung là mã phát hiện thay đổi không mang tính mật mã; không dùng để xác thực hay bảo vệ dữ liệu.
- Lưu trữ có giới hạn 200 báo cáo. Nếu trình duyệt hết dung lượng, giao diện thông báo không lưu được; kết quả vẫn hiển thị trong phiên hiện tại.

## Kiểm thử

- `tests/localAiReviewLibrary.test.js`: lưu/đọc lại, phân nhóm tài khoản và phiên, thay thế bản cũ, xóa độc lập, nhận biết thay đổi đầu vào, từ chối dữ liệu sai và lỗi dung lượng.
- Workflow `Check local video library` chạy kiểm thử mới, TypeScript check và build Preview.
- Kiểm thử thủ công trên Preview: phân tích một buổi; tải lại trang; mở lại Lịch sử; xác nhận nhận xét còn mà không phát sinh yêu cầu Gemini; thay PPTX để thấy cảnh báo kết quả cũ; phân tích lại; xóa nhận xét riêng; xóa TXT và xác nhận video còn.

## Ngoài phạm vi

Không thêm chấm điểm, phản biện, giám khảo đọc thành tiếng, báo cáo đám mây, đồng bộ nhiều thiết bị hoặc thay đổi API Gemini Free Tier. Không thay đổi giới hạn 5 lượt/tài khoản/ngày và không thêm dịch vụ trả phí.
