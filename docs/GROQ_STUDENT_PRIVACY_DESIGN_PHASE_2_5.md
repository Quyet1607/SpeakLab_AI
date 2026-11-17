# SpeakLab_AI — Bước 2.5: Thiết kế bảo vệ dữ liệu học sinh THCS

Ngày rà soát: 17/11/2026. Nhánh: `feature/groq-synthetic-pilot`. Trạng thái: **DESIGN ONLY / KHÔNG CHO PHÉP DỮ LIỆU HỌC SINH**.

## 1. Phạm vi và quy tắc triển khai

- Chỉ lập thiết kế, ma trận dữ liệu/quyền và tiêu chí nghiệm thu. Không sửa route, giao diện, cookie, quota, tài khoản hoặc chính sách đã công bố.
- `api/groq/pilot.js` vẫn chỉ cho người vận hành có phiên Google vai trò teacher và **dữ liệu giả lập cố định** trên đúng Vercel Preview; không nhận input học sinh.
- `api/ai/review.js` vẫn là luồng Gemini Preview hiện tại; `main` và Production không thay đổi.
- Mặc định từ chối gửi dữ liệu học sinh đến mọi AI bên thứ ba cho đến khi chủ vận hành hoàn tất các cổng kiểm soát bên dưới.
- Khuyến nghị nghiệm thu pháp lý riêng với luật sư/chuyên gia bảo vệ dữ liệu trước khi mở cho học sinh.

## 2. Các phát hiện từ mã nguồn

1. `src/features/history/AiSpeechReviewPanel.tsx`: checkbox `consent` (state in-memory) gửi `consent: true` kèm `sessionId`, `topic`, `topicDescription`, `speakingGoal`, `transcript`, `slides`. Checkbox không tạo hồ sơ xác nhận của người đại diện.
2. `api/ai/review.js`: kiểm tra session cookie và same-origin; dữ liệu ASR/PPTX được đưa vào prompt sau validate. Hiện chưa có bước kiểm chứng hồ sơ đồng thuận người đại diện theo từng mục đích, nhà cung cấp và phiên bản chính sách.
3. `src/services/localAiReviewLibrary.ts`: báo cáo lưu trong `localStorage`, phân nhóm theo `ownerSub`, không phải cách ly bảo mật trên thiết bị dùng chung; xóa nhận xét cục bộ không có tác dụng xóa thông tin đã được nhà cung cấp xử lý.
4. `public/privacy.html`, `public/terms.html`: mô tả hiện tại tập trung Gemini Preview; thiếu chính sách vận hành Groq thật, thông tin tổ chức chịu trách nhiệm và kênh liên hệ chính thức, quy trình quyền của người chưa thành niên; tài liệu vẫn ghi là dự thảo.
5. `api/groq/pilot.js`: chặn production/nhánh không hợp lệ, yêu cầu teacher và quota Redis; chỉ gửi dữ liệu giả lập cố định. Không mở rộng endpoint này để nhận văn bản người dùng.

## 3. Ma trận dữ liệu (thiết kế đề xuất)

| Dữ liệu | Trong thiết bị | Gửi Groq tương lai | Ghi chú |
|---|---|---|---|
| Video, âm thanh ghi hình | Có thể, theo thao tác người dùng | **Không** | Không thêm URL tệp vào prompt |
| Tệp PPTX nguyên bản, hình ảnh slide | Có thể, để trích chữ | **Không** | Chỉ xem xét chữ đã chọn |
| Transcript ASR | Có | **Chỉ khi đủ cổng pháp lý và đồng thuận** | Là dữ liệu rủi ro cao: dễ chứa thông tin cá nhân |
| Chữ trích PPTX | Có | **Chỉ khi đủ cổng pháp lý và đồng thuận** | Cần quét thông tin định danh/sensitive |
| Đề tài, mục tiêu, mô tả | Có | **Chỉ khi đủ cổng pháp lý và đồng thuận** | Có thể chứa tên/trường/lớp |
| Google subject, email, tên, cookie, token | Chỉ nơi thực sự cần thiết | **Không** | Không chèn vào AI prompt |
| ID yêu cầu ngẫu nhiên, mã phiên xử lý | Phía server, ngắn hạn | Hạn chế tối đa | Không liên kết lại tới học sinh ở nhà cung cấp |
| Nhận xét AI đã xác minh | Có thể ở thiết bị | Không cần gửi lại | Có thể xóa theo phiên; minh bạch giới hạn xóa |

**Lưu ý:** việc loại bỏ tên, email và trường không bảo đảm ẩn danh nếu transcript tự chứa thông tin có thể nhận diện; dữ liệu vẫn có thể là dữ liệu cá nhân. Không quảng cáo “ẩn danh hoàn toàn”.

## 4. Thiết kế quyền truy cập và hồ sơ đồng thuận

### Cổng A — Pháp lý, bắt buộc trước khi gửi dữ liệu thật
- Xác định chủ thể kiểm soát/xử lý dữ liệu, đầu mối liên hệ, mục đích cụ thể và căn cứ xử lý.
- Xác định nhóm tuổi/đối tượng học sinh và yêu cầu pháp luật tương ứng, không suy diễn rằng một checkbox của học sinh đủ.
- Có quy trình xác nhận người đại diện hợp lệ khi cần, phù hợp khả năng kiểm tra và chống giả mạo; tài khoản học sinh tự đăng nhập không thay thế chứng cứ này.
- Rà soát việc truyền dữ liệu qua biên giới, vai trò nhà cung cấp và phụ xử lý, tài liệu tác động/hồ sơ liên quan và trường hợp miễn trừ; không mặc định có hoặc không có miễn trừ.
- Công bố chính sách quyền riêng tư và điều khoản chính thức với Groq, thời hạn lưu giữ, quyền truy cập, rút lại đồng ý và kênh tiếp nhận yêu cầu.
- Kiểm tra tính năng Zero Data Retention (nếu đủ điều kiện) và điều khoản cụ thể với Groq. Bật ZDR không tự động đáp ứng mọi nghĩa vụ pháp lý.

### Cổng B — Chứng cứ đồng thuận có thể kiểm tra
Thiết kế một hồ sơ **phía server** độc lập với `localStorage`:
- Mã hồ sơ ngẫu nhiên; mã học sinh pseudonymous; bên xác nhận (học sinh / người đại diện hợp pháp theo yêu cầu / bên được ủy quyền có căn cứ); trạng thái xác minh.
- Provider, mục đích xử lý, loại dữ liệu dự định gửi, phiên bản chính sách, thời gian đồng ý, cách xác minh, thời điểm thu hồi và hết hạn.
- Lưu tối thiểu dữ liệu chứng minh, phân quyền truy cập, chính sách lưu giữ; không ghi plaintext transcript vào bản ghi đồng thuận.
- Thiết kế tách thông báo và chọn đồng ý cho ASR trình duyệt, lưu video, gửi nội dung tới Groq; không ép đồng ý Groq mới được luyện tập cục bộ.
- Kiểm tra đồng thuận **trên máy chủ tại thời điểm gửi**; không dựa vào `consent: true` từ client. Không có hồ sơ hợp lệ => `403`, không gọi Groq.
- Thu hồi hiệu lực cho các request tiếp theo ngay khi kiểm chứng; xử lý yêu cầu đối với dữ liệu đã gửi theo chính sách nhà cung cấp và pháp luật áp dụng, không hứa xóa tức thì mọi bản sao bên thứ ba.

### Cổng C — Kiểm soát nội dung và cô lập
- Tách role `learner`/`teacher` và quyền xử lý dữ liệu cá nhân; giáo viên không mặc nhiên truy cập bài của người học.
- Không coi `ownerSub` của báo cáo localStorage là ranh giới bảo mật; đề xuất dùng thiết bị cá nhân hoặc triển khai kho bảo mật có phân quyền server-side trước khi hỗ trợ thiết bị chia sẻ.
- Loại tối đa trường định danh ở phần metadata; xem xét các quy tắc chặn/che thông tin định danh (tên, số điện thoại, email, địa chỉ, ID, trường/lớp, thông tin sức khỏe), nhưng không cam kết nhận diện hết nội dung nhạy cảm trong văn bản tự do.
- Giới hạn độ dài, loại nội dung nguy cơ cao, dữ liệu có tính nhận dạng và tệp nhập vào; fail closed nếu không đánh giá được tính an toàn.
- Chặn log prompt/response ở app server; không đưa bí mật vào frontend; phân biệt công cụ ASR của trình duyệt và Groq: âm thanh có thể đã được xử lý qua dịch vụ của trình duyệt theo cấu hình.
- Groq provider chỉ cấp qua backend sau khi xác thực, đồng thuận, quota Redis và kiểm tra nguồn yêu cầu.

### Cổng D — Quyền dữ liệu, kiểm thử, giám sát
- Tách xóa dữ liệu cục bộ, xóa record phía server (nếu có), thu hồi đồng thuận, và yêu cầu nhà xử lý bên ngoài.
- Có quy trình truy cập/xem, xuất và xóa theo phạm vi quyền hợp lệ; quy trình sự cố và phản hồi yêu cầu.
- Trước khi sử dụng thực: tests guest/learner/teacher, consent thiếu/hết hạn/thu hồi, giả mạo vai trò, thiết bị dùng chung, dữ liệu có định danh, request đồng thời, quota lỗi, Redis lỗi, Groq lỗi, rò rỉ API key, xóa và xuất dữ liệu.
- Kiểm thử đầu tiên bằng mock và bài giả lập; chưa kiểm thử bằng dữ liệu học sinh thật.

## 5. Giao diện dự kiến (CHƯA TRIỂN KHAI)
1. Trang giải thích các mục đích và nhà cung cấp; có thể từ chối Groq nhưng vẫn luyện tập.
2. Kiểm tra trạng thái đồng thuận hợp lệ và quyền gửi dữ liệu (server-authoritative).
3. Màn hình xem trước **chính xác nội dung văn bản sẽ gửi** và cảnh báo nội dung định danh.
4. Gửi một lần, hiển thị kết quả đã qua bộ kiểm chứng; lưu cục bộ tùy lựa chọn.
5. Công cụ thu hồi đồng thuận, xóa bản cục bộ và đầu mối gửi yêu cầu liên quan đến dữ liệu bên thứ ba.

## 6. Điều kiện Go/No-Go

**NO-GO hiện tại.** Không bật Groq cho học sinh, không merge PR #3, không dùng dữ liệu thật, không cập nhật chính sách công khai như thể đã tuân thủ.

Chỉ xem xét triển khai sau khi chủ vận hành chốt và kiểm chứng: danh tính/chủ thể dữ liệu, quy trình đại diện hợp pháp, hồ sơ đồng thuận server-side, đánh giá chuyển dữ liệu quốc tế, chính sách/kênh hỗ trợ, quota và bảo mật, thử nghiệm người lớn tình nguyện không chứa dữ liệu học sinh, nghiệm thu độc lập.

## 7. Nguồn đối chiếu pháp lý và vận hành (cần chuyên gia xác nhận trường hợp áp dụng)
- Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, hiệu lực 01/01/2026: https://vanban.chinhphu.vn/?docid=214590&pageid=27160
- Điều 24, bản PDF chính thức: https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/91qh.signed.pdf
- Groq Services Agreement (cập nhật 22/06/2026), điều 2, 3, 6: https://console.groq.com/docs/legal/services-agreement
- Groq Your Data / Data Controls: https://console.groq.com/docs/your-data

Tài liệu này là thiết kế kỹ thuật sơ bộ, không phải ý kiến pháp lý hoặc chứng nhận tuân thủ.
