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

## Tự động tách đoạn NGAY KHI ĐANG NGHE (bổ sung)
- Không cần bấm **Dừng nhận diện** để ngắt đoạn. Ngay sau khoảng ngừng nói xấp xỉ 1,8 giây, văn bản **tạm thời** trên bảng Lời nói → Văn bản tự xuống đoạn và hiện thông báo `Đã tự tách đoạn`.
- Hệ thống vẫn tiếp tục nghe và cập nhật lời nói sau đó ở đoạn mới; không tự dừng micro hoặc ghi hình.
- Sử dụng sự kiện `speechend` của trình duyệt (khi có), đồng thời dự phòng bằng khoảng không có cập nhật kết quả nhận diện. Tín hiệu dự phòng không bảo đảm phân biệt hoàn toàn độ trễ của dịch vụ với khoảng ngừng nói.
- Chỉ các kết quả `isFinal` được lưu vào kho lời nói. Khi trình duyệt xác nhận văn bản, điểm ngắt được áp dụng nếu từ ngữ trước đó vẫn khớp. Nếu nhận diện sửa lại câu, đoạn tạm có thể được sắp xếp lại để tránh ghi sai hoặc lặp chữ.
- Nhấn **Dừng nhận diện** vẫn lưu bản ghi đã xác nhận, độc lập với hành động ngắt đoạn tự động.
- Test `tests/vietnameseSpeechRecognition.test.js` kiểm tra có xuống đoạn trong lúc phiên nhận diện vẫn chạy, không cần nhấn Stop.

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

## Quyết định cập nhật theo yêu cầu người dùng
- Không tự động ngắt đoạn theo khoảng lặng và không chờ 1,8 giây.
- Giữ văn bản nhận diện liên tục; chỉ lưu các kết quả cuối (isFinal) do trình duyệt xác nhận khi người học bấm Dừng nhận diện.
- Chỉ lưu văn bản TXT riêng; không tạo MP3/WAV vì video ghi hình đã chứa âm thanh.
- Bản ghi TXT được liên kết với video bằng sessionId, tải được trong Lịch sử và dành làm dữ liệu đầu vào cho AI ở giai đoạn sau.
- Đã tăng giới hạn lưu trữ từ 80 lên 500 đoạn, và giới hạn nội dung mỗi đoạn từ 240 lên 2.000 ký tự để giảm nguy cơ cắt cụt transcript dài.
