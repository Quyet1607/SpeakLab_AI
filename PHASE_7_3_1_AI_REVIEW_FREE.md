# SpeakLab_AI – Đợt 7.3.1: Nhận xét bài thuyết trình (TXT + PPTX tùy chọn)

**Phạm vi:** Chỉ `feature/recording-3-2` của `Quyet1607/SpeakLab_AI`. Không merge `main`, không sửa Production. Chưa làm phản biện, giọng nói giám khảo, chấm điểm hoặc báo cáo vĩnh viễn.

## Mô tả chức năng

1. Người học luyện tập, ghi hình và nhận diện giọng nói thành chữ như cũ.
2. Khi kết thúc một buổi có PPTX được tải lên bằng ứng dụng, mã trích xuất **chỉ chữ trong slide** trên trình duyệt và lưu riêng vào `speaklab_local_review_slides_v1`, gắn `sessionId` và `ownerSub`. Không lưu bytes PPTX và không gửi gì lên AI khi kết thúc buổi.
3. Trong **Lịch sử → Bản ghi lời nói**, có nút **Phân tích bài thuyết trình bằng AI**. Người học có thể bổ sung/thay PPTX bất kỳ lúc nào; nếu không có hoặc slide không có chữ vẫn phân tích TXT.
4. Trước khi gọi API, người học phải chủ động tích chọn đồng ý gửi đề tài, mục tiêu, văn bản TXT và văn bản slide (nếu có) đến Gemini Free Tier. Chỉ lúc nhấn nút mới gửi dữ liệu.
5. Backend `POST /api/ai/review` xác thực phiên đăng nhập Google phía server, kiểm tra nguồn HTTPS same-origin, nội dung đầu vào, xác nhận Preview Free Tier và bộ giới hạn lượt. Mô hình **cố định** `gemini-3.5-flash-lite`, không fallback sang API có phí.
6. Kết quả gồm nhận xét tổng quan, 2 điểm mạnh, 2 điểm cần cải thiện kèm hành động, 0–2 đối chiếu slide (nếu có), các giới hạn đánh giá. AI phải chọn ID của đoạn văn bản đã cung cấp để làm dẫn chứng; backend kiểm tra ID có thật và cung cấp đoạn nguồn nguyên văn. Không tính điểm số hoặc đánh giá hình ảnh/âm thanh từ TXT.
7. Kết quả chỉ xem trong phiên hiện tại. Việc lưu thành báo cáo lịch sử sẽ làm ở Đợt 7.3.2.

## Cấu hình trên Vercel Preview

Cấu hình **chỉ cho Preview**, không cấu hình cho Production hoặc `VITE_*`:

- `GEMINI_API_KEY` – API key của dự án Google AI Studio **Free Tier không liên kết thanh toán**.
- `SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED=true` – chủ dự án xác nhận đã kiểm tra Free Tier và không bật thanh toán.
- `SPEAKLAB_RATE_LIMIT_REST_URL` – Upstash Redis REST HTTPS URL.
- `SPEAKLAB_RATE_LIMIT_REST_TOKEN` – Upstash Redis REST token.
- `SPEAKLAB_SESSION_SECRET`, `GOOGLE_CLIENT_ID` – dùng lại cấu hình phiên đăng nhập đã tồn tại.

**Quan trọng:** Xác nhận Free Tier qua biến môi trường KHÔNG thể tự kiểm tra trạng thái thanh toán thực tế ở Google. Chủ dự án phải đảm bảo khóa thuộc một dự án không liên kết billing; không bao giờ bật billing trên dự án đó. Mức miễn phí và điều kiện dịch vụ có thể thay đổi. Upstash cũng phải duy trì gói miễn phí, không nâng cấp.

Không đủ cấu hình: HTTP 503, không gọi mô hình. Hết quota 5 lần/tài khoản/ngày (theo ngày UTC) hoặc Gemini Free Tier đã hết: HTTP 429, không chuyển sang mô hình trả phí. Redis không truy cập được: từ chối yêu cầu.

## Giới hạn dữ liệu và quyền riêng tư

- Chỉ chấp nhận TXT 20–24.000 ký tự, tối đa 40 slide PPTX, tối đa 900 ký tự/slide và 16.000 ký tự slide tổng cộng. Quá giới hạn thì báo lỗi **không cắt thầm lặng**.
- PowerPoint chỉ phân tích text run của Open XML `ppt/slides/slide*.xml`. Không trích xuất thông tin từ biểu đồ dạng ảnh, bảng dưới dạng ảnh, các hiệu ứng động hoặc cửa sổ chia sẻ màn hình.
- Ghi âm, video và toàn bộ bytes của tệp PPTX không gửi lên Gemini. Tệp đã có trên máy từ đầu vẫn cục bộ; chỉ chữ trong slide và TXT được gửi sau khi đồng ý.
- Gemini Free Tier có thể dùng dữ liệu để cải thiện sản phẩm. **Không thử bằng dữ liệu cá nhân nhạy cảm/học sinh thật khi chưa có cơ sở pháp lý và đồng thuận phù hợp.**
- Văn bản slide được lưu cục bộ theo session và tài khoản, nhưng đó **không phải cách phân quyền bảo mật** trên thiết bị dùng chung. Người học có thể chọn `Bỏ nội dung slide` để xóa bản trích xuất.
- Các vị trí dẫn chứng do AI chọn được đối chiếu với danh sách đoạn thật; không chứng minh chắc chắn nội dung AI hiểu đúng, do đó vẫn cần người học/giáo viên kiểm tra kết quả.
- Quá trình phân tích không phát sinh âm thanh giọng nói AI, không tự làm báo cáo chấm điểm và không ảnh hưởng ghi hình.

## Kiểm thử và nghiệm thu

1. `node --test tests/freeSpeechReview.test.js` – consent, giới hạn, Free Tier Preview, dẫn chứng thật/giả, có/không PPTX.
2. `bun test tests/pptxReviewText.test.js` – trích xuất slide từ PPTX, không cần mạng, lưu cục bộ theo phiên.
3. `bun run lint`, `bun run build`, và toàn bộ kiểm thử ghi video/nhận diện/Lịch sử cũ.
4. Chưa đăng nhập: HTTP 401; không đồng ý: HTTP 400; sai Origin: 403; không cấu hình Free Tier hoặc quota store: 503; vượt quota: 429.
5. Dùng đề tài và TXT mẫu không có PPTX để kiểm tra phần điểm mạnh/hạn chế có dẫn chứng.
6. Lặp lại với PPTX thật có text, xác nhận đối chiếu slide xuất hiện và không upload bytes PPTX.
7. Khi không có PPTX, PPTX chỉ có hình ảnh, hoặc dùng chia sẻ màn hình bên ngoài, hệ thống vẫn chỉ phân tích TXT.
8. Thử tải lại trang để kiểm tra văn bản slide gắn đúng session, không gắn nhầm buổi khác.
9. Xác nhận video, ghi chữ, tải TXT, chia sẻ màn hình và lịch sử vẫn hoạt động.

**Lưu ý vận hành:** Nếu GitHub Actions/Vercel Preview chưa build được thì chưa coi là nghiệm thu. Không triển khai Đợt 7.3.2 khi chưa có duyệt.

## Khắc phục thông báo lỗi chung ở bản thử nghiệm (13/11/2026)
- Chuyển mô hình cố định từ Gemini 2.5 Flash-Lite sang **Gemini 3.5 Flash-Lite**, vì tài liệu Google hạn chế một số dự án mới sử dụng dòng 2.5. Mô hình 3.5 Flash-Lite được Google niêm yết có Standard Free Tier; **không bật thanh toán**.
- Tăng ngưỡng đầu ra JSON lên 3.200 token để giảm nguy cơ trả câu trả lời thiếu.
- API trả mã lỗi an toàn, không chứa văn bản của học sinh hoặc khóa bí mật: `GEMINI_ACCESS_DENIED`, `GEMINI_MODEL_UNAVAILABLE`, `GEMINI_REQUEST_REJECTED`, `GEMINI_EMPTY_OUTPUT`, `GEMINI_OUTPUT_LIMIT`, `GEMINI_INVALID_FEEDBACK`, `GEMINI_FREE_QUOTA`, `GEMINI_TEMPORARILY_UNAVAILABLE`.
- UI hiển thị mã lỗi khi thất bại. Nếu vẫn lỗi, vào **Vercel → Deployments → Preview → Functions/Logs**, lọc `/api/ai/review` và xem **mã HTTP cùng mã lỗi**, không gửi log thô có token, cookie hoặc dữ liệu cá nhân.
- Giới hạn 5 lượt/tài khoản/ngày vẫn giữ nguyên; **lượt yêu cầu thất bại sau khi qua bộ đếm có thể vẫn bị tính vào hạn mức nội bộ**, do đó tránh thử liên tục.
- Mã nguồn không tự động xác minh rằng API key thực sự không gắn billing. Chủ dự án phải tự duy trì khóa ở dự án Free Tier không liên kết thanh toán.
- Không có bản sửa nào được thực hiện ở `main` hoặc Production. Sau khi sửa code, Vercel Preview cần build/redeploy để nhận thay đổi.
