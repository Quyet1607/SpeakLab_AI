# SpeakLab AI – Bước 7.3.3.4: Kiểm thử và nghiệm thu hệ thống nhận xét AI

**Nhánh:** `feature/recording-3-2` (Vercel Preview); không chỉnh `main` hoặc Production.

## Phạm vi và phương pháp

Kiểm tra từ văn bản bài nói, chữ trong PPTX và phản hồi Gemini mô phỏng tới bộ lọc dẫn chứng, lưu lịch sử và hiển thị kết quả. Không sử dụng tài khoản người học, bản ghi thực, API Gemini trả phí hay lượt phân tích thật trong kiểm thử tự động.

**Bộ kiểm thử mới:** `tests/aiReviewAcceptance.test.js`, được chạy trong `.github/workflows/check-local-video-library.yml`.

## Ma trận kiểm thử tự động

| Tình huống | Điều cần xác nhận |
|---|---|
| Bài 18 slide và bản ghi hơn 2.000 ký tự | Đọc chữ PPTX, tạo đoạn E, đối chiếu, loại mục thiếu căn cứ, lưu báo cáo, đọc lại và hiển thị được |
| PPTX tối đa 40 slide | Dò chữ toàn bộ 40 slide; từ chối tệp 41 slide thay vì âm thầm bỏ slide |
| Không có PPTX | Chỉ nhận xét TXT, không hiển thị đối chiếu slide tự tạo |
| Bản ghi quá ngắn/dài hơn 24.000 ký tự | Từ chối rõ ràng, không tự cắt bớt nội dung |
| Đoạn trích AI không tồn tại | Loại chính mục sai, giữ các mục đối chiếu xác minh được; hiển thị số lượng mục bị loại |
| ASR thiếu dấu / nhận diện sai | Giữ nguyên lời nói làm dẫn chứng, không tự sửa chữ nguồn |
| Tiếng Việt trong phản hồi AI | Phát hiện phản hồi hoàn toàn không dấu và cả trường nhận xét riêng lẻ bị mất dấu trong báo cáo có phần khác đúng dấu |
| Báo cáo được lưu từ phiên trước | Mở lại được, không di chuyển/xóa/chuyển đổi dữ liệu cũ |
| Bộ lọc slide | Chỉ thay đổi danh sách đang hiển thị; không sửa dữ liệu lưu |
| Nội dung có thẻ HTML giả | React escape văn bản, không biến nội dung phản hồi thành HTML thực thi |
| Bảo mật API, hạn mức, nguồn gọi | Giữ các kiểm thử độc lập hiện có về đăng nhập, đồng ý, same-origin và Free Tier |

## Kết quả chạy trên GitHub

- **Workflow:** `Check local video library`.
- **Run:** `43583418045`, commit `ef339e9f574f945ba8727816a35dbe740e3b70a4`.
- **Kết quả:** success, bao gồm test AI review, PPTX, lưu lịch sử, bộ kiểm thử tích hợp, TypeScript check và build Preview.
- **Vercel:** trạng thái Success trên cùng commit.

**Lỗi phát hiện và khắc phục trong bước này:** Bộ kiểm tra tiếng Việt có dấu trước đây dùng tỷ lệ dấu trên *toàn bộ* phần nhận xét, vì vậy phần tổng quan có dấu có thể khiến một gợi ý không dấu bị lọt qua. Đã thêm kiểm tra riêng từng trường nhận xét đủ dài. Các trích dẫn `slideQuote`, `spokenQuote` và chữ nguồn ASR/PPTX không bị sửa.

## Nghiệm thu thủ công cần thực hiện trên Preview

1. Mở **Lịch sử luyện tập**, chọn một buổi có TXT và báo cáo AI đã lưu. Xác minh bản cũ vẫn hiển thị và không yêu cầu Gemini.
2. Thử bộ lọc **Tất cả / Cần xem lại / Đã tìm thấy**; mở phần E, xem trích dẫn PPTX và bản ghi lời nói, kiểm tra nội dung thật với tài liệu của mình.
3. Thử phần tổng quan chữ trên toàn bộ slide, xem ghi chú **chưa đối chiếu chi tiết** và hiểu đây chỉ là dò từ khóa, không phải kết luận người học bỏ qua slide.
4. Nếu còn lượt Free Tier và tự nguyện, chủ động phân tích **một** buổi có PPTX (có thể dùng lại bài 18 slide) để đánh giá chất lượng phản hồi Gemini thật, dấu tiếng Việt, trích dẫn và tốc độ xử lý.
5. Tải lại trang để kiểm tra lưu nhận xét; xóa riêng nhận xét và xác nhận video/TXT không bị xóa.
6. Kiểm tra bản Preview trên điện thoại: trích dẫn slide/TXT xếp thành một cột, chữ không tràn.

## Những gì chưa được chứng minh bằng kiểm thử tự động

- Chưa sử dụng micro/trình duyệt thực để nghiệm thu chất lượng ASR hoặc độ trễ.
- Chưa gọi Gemini thật với PowerPoint của người dùng; không thể bảo đảm mọi phản hồi đều có chất lượng ngữ nghĩa hoặc trả về đúng số mục.
- Chưa xác minh trực tiếp trên thiết bị của người học việc lưu localStorage, giao diện và thời gian xử lý.
- Bộ kiểm tra theo từ khóa hoặc dấu tiếng Việt là cơ chế phòng lỗi, không thể thay thế việc người học đối chiếu nguồn thật; các lỗi ngữ nghĩa tinh vi vẫn có thể xảy ra.

## Quyết định

**Đạt nghiệm thu kỹ thuật tự động** cho Bước 7.3.3.4. **Chờ người dùng nghiệm thu thủ công trên Preview** trước khi chốt toàn bộ Đợt 7.3.3 hoặc triển khai bước khác.

Giữ nguyên Gemini Free Tier (5 lượt/tài khoản/ngày), một yêu cầu do người học chủ động kích hoạt, không tự retry và không triển khai Production.
