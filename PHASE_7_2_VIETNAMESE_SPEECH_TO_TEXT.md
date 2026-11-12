# SpeakLab AI – Bước 7.2: Lời nói tiếng Việt → Văn bản

**Phạm vi**: Nhánh `feature/recording-3-2` (Preview) — không sửa main/Production, không triển khai các Bước 7.3–7.6.

## Mục tiêu
Nhận diện **lời nói thực tế** của học sinh từ micro bằng Web Speech API, ghi văn bản được nhận diện và mốc thời gian tương đối của từng đoạn để học sinh có thể đối chiếu sau buổi luyện.

## Cách dùng
1. Vào phòng luyện, bật micro. Camera/PowerPoint không bắt buộc.
2. Bấm **Lời nói** trên thanh tiêu đề để mở bảng ghi lời nói.
3. Đọc lưu ý quyền riêng tư rồi chủ động nhấn **Tôi đồng ý, bắt đầu**.
4. Nói tiếng Việt; giao diện hiện lời đang nghe (tạm thời) và các câu đã nhận diện cuối cùng. Chỉ câu đã xác nhận mới được lưu.
5. Có thể bấm **Dừng nhận diện** để tạm ngừng mà không ảnh hưởng video hay chia sẻ màn hình. Muốn tiếp tục thì nhấn bắt đầu lại.
6. Kết thúc buổi luyện qua nút **Kết thúc**, ứng dụng đợi bộ nhận diện trả kết quả cuối (giới hạn 1,8 giây) rồi lưu bản ghi chữ với phiên luyện trên trình duyệt.
7. Vào **Lịch sử luyện tập**, mở **Lời nói đã nhận diện**, xem câu và thời gian xấp xỉ, hoặc chọn **Xóa riêng bản ghi chữ** (không xóa video).

## Bảo vệ quyền riêng tư và giới hạn quan trọng
- **Không tự động nhận diện âm thanh** khi vào phòng, bật micro hoặc bấm ghi video. Cần thao tác đồng ý riêng.
- Web Speech API có thể dùng dịch vụ nhận diện trên máy chủ nhà cung cấp trình duyệt (chẳng hạn Chrome). Tùy trình duyệt, **âm thanh có thể rời khỏi thiết bị** để xử lý. Giao diện hiển thị cảnh báo này trước khi bắt đầu. SpeakLab AI không gọi API chuyển giọng nói hay lưu âm thanh lên máy chủ của ứng dụng.
- Không hỗ trợ mọi trình duyệt/thiết bị. Trình duyệt không hỗ trợ sẽ hiện thông báo, không tạo văn bản giả. Khi trình duyệt tự dừng do im lặng, học sinh cần bật lại chủ động.
- Giọng nói được nhận diện có thể sai dấu, từ ngữ hoặc bị ngắt câu; các mốc bắt đầu/kết thúc từng đoạn tính theo sự kiện từ trình duyệt và **chỉ mang tính ước lượng**, không phải căn chỉnh thời gian từng từ.
- Lưu tối đa **80 đoạn × 240 ký tự** cho mỗi buổi luyện trong localStorage. Mốc thời gian chỉ được lưu cho các câu cuối cùng, không lưu từ ngữ dự đoán đang hiện.
- Văn bản chỉ lưu trong trình duyệt, phân nhóm theo tài khoản Google tại giao diện; không đồng bộ giữa các máy và **không phải phân quyền truy cập an toàn giữa các tài khoản chung thiết bị**. Có thể xóa bản ghi chữ độc lập. Xóa dữ liệu trang web sẽ xóa văn bản đã lưu.
- Chưa có AI hỏi đáp, phân tích lời nói, chấm điểm, nhận xét hay tổng hợp báo cáo kỹ năng. Các chức năng ấy thuộc Bước 7.3 trở đi.

## Kiểm tra kỹ thuật và nghiệm thu
1. GitHub Actions `Check local video library`: chạy `bun test tests/vietnameseSpeechRecognition.test.js`, `bun test tests/localPracticeHistory.test.js`, `bun run lint`, `bun run build`; xác nhận kết quả thực tế trên GitHub.
2. Kiểm tra Vercel Preview `feature/recording-3-2` đã build thành công (nếu bị giới hạn lượt build, chưa thể xác nhận UI mới).
3. Vào phòng **không có PowerPoint**, bật micro, mở **Lời nói**. Kiểm tra bảng không nhận diện khi chưa bấm đồng ý.
4. Nhấn bắt đầu, nói một đoạn ngắn tiếng Việt, xem dòng chữ tạm và một đoạn đã xác nhận; dừng nhận diện. Kiểm tra **video ghi hình độc lập** trước/sau.
5. Vào lại hoặc ghi lần hai khi cùng phòng; đảm bảo không nhân đôi đoạn cũ.
6. Kết thúc buổi, vào Lịch sử, mở nội dung bản ghi chữ; làm mới trang vẫn thấy, không mất video.
7. Bấm xóa bản ghi chữ của buổi đó, xác nhận không xóa video, tên đề tài hay tổng số buổi.
8. Nếu trình duyệt không hỗ trợ Web Speech, xác nhận có thông báo và không tự tạo bản ghi chữ; có thể thử Chrome/Edge tương thích để kiểm nghiệm.
9. Kiểm tra cảnh báo đồng ý nêu rõ âm thanh **có thể được trình duyệt xử lý trên máy chủ bên ngoài**.

**Không merge vào main** khi chưa nghiệm thu đầy đủ. Kết quả ghi hình hiện tại vẫn là trọng tâm được bảo toàn.
