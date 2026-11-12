# SpeakLab AI – Bước 7.2.1: Lưu bản ghi lời nói riêng

Nhánh: `feature/recording-3-2`. Không sửa `main` / Production.

## Hành vi
- Học sinh chủ động bật micro và đồng ý bắt đầu nhận diện.
- Nhấn **Dừng nhận diện**: chờ kết quả cuối từ Web Speech API rồi lưu các đoạn đã xác nhận vào kho `speaklab_local_transcripts_v1` (localStorage) theo `sessionId` và tài khoản tại thời điểm bắt đầu buổi luyện.
- Nhấn bắt đầu lại trong cùng buổi: các đoạn mới được bổ sung vào bản ghi cùng phiên (không sinh bản ghi trùng).
- **Lịch sử luyện tập → Video đã ghi**: nếu có video với cùng `sessionId`, hiện bản ghi lời nói ngay bên dưới video, có xem, tải TXT UTF-8, xóa riêng.
- Nếu không có video, bản ghi lời nói xuất hiện trong nhóm **Bản ghi lời nói riêng (không có video)**.
- Video vẫn ở IndexedDB `speaklab_local_recordings_v1`; không thay đổi schema, không xóa video cũ.
- Lịch sử lời nói phiên bản 7.2 cũ vẫn đọc từ `speaklab_completed_practice_v1`; mục hiển thị cũ được ẩn khi có bản ghi độc lập của cùng phiên. Dữ liệu cũ không bị xóa hay tự chuyển đổi.
- Không tự tải TXT xuống máy khi nhấn Dừng; file TXT chỉ được tạo và tải khi học sinh chọn **Tải TXT**.

## Tách đoạn theo khoảng ngừng nói (điều chỉnh sau phản hồi)
- Khi trình duyệt trả kết quả nhận diện tạm và có khoảng nghỉ khoảng **1,8 giây**, ghi nhận vị trí kết thúc cụm lời nói trước đó.
- Ưu tiên sự kiện `speechend`/`speechstart` nếu trình duyệt hỗ trợ; dùng độ giãn giữa các lần nhận kết quả làm tín hiệu dự phòng.
- Chỉ tách khi văn bản kết quả **cuối cùng** xác nhận đúng phần tiền tố trước khoảng nghỉ; tuyệt đối không lưu kết quả tạm, không tự thêm dấu câu hay thay đổi từ.
- Bản ghi TXT và Lịch sử hiển thị từng đoạn đã được tách. Bản ghi đã lưu trước khi có cơ chế này không chứa thông tin khoảng nghỉ, nên chỉ có thể tách theo dấu câu/độ dài như trước.
- **Giới hạn:** Web Speech API không bảo đảm cung cấp thời điểm im lặng chính xác trên mọi trình duyệt; một kết quả cuối không có dữ liệu tạm hoặc bị nhà cung cấp sửa quá nhiều có thể không tách được.
- Kiểm thử tự động tại `tests/vietnameseSpeechRecognition.test.js` bổ sung trường hợp nghỉ dài, nghỉ ngắn, thay đổi giả thuyết và sự kiện speechend/speechstart.

## Quyền riêng tư
- Không tự kích hoạt micro hoặc gửi transcript lên backend của SpeakLab.
- Web Speech API của trình duyệt có thể xử lý âm thanh tại máy chủ nhà cung cấp, như đã thông báo trước khi đồng ý.
- Dữ liệu localStorage chỉ ở trình duyệt hiện tại, không phải ranh giới bảo mật giữa các tài khoản chung thiết bị và không đồng bộ giữa thiết bị.
- Không tạo văn bản giả hay nội dung AI bổ sung.

## Kiểm thử và nghiệm thu
- `tests/localTranscriptLibrary.test.js`: lưu, bổ sung khi dừng lại, nhóm tài khoản, xóa độc lập, xuất TXT và lỗi dung lượng.
- Workflow `Check local video library` chạy test mới cùng các test ghi hình, lịch sử, TypeScript check và build.
- Cần kiểm thử thực tế trên trình duyệt: bật nhận diện tiếng Việt → nói → Dừng → mở Lịch sử trước khi Kết thúc buổi; tải TXT và kiểm tra dấu tiếng Việt; tiếp tục nhận diện; kiểm tra ghi video và xóa độc lập.
- Kiểm tra dữ liệu cũ và ghi hình/chia sẻ màn hình không bị ảnh hưởng.
- Không merge main hoặc chuyển Bước 7.3 trước khi người dùng nghiệm thu.
