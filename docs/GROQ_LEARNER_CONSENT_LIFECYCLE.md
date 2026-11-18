# SpeakLab AI — Quy trình yêu cầu và thu hồi đồng thuận Groq trong chức năng nhận xét học sinh

**Nhánh:** `feature/groq-synthetic-pilot`. **Bước này KHÔNG gửi dữ liệu học sinh sang Groq, không gộp main hay Production.**

## Đã thực hiện ngay trong luồng chính

- Học sinh vào **Lịch sử luyện tập → AI nhận xét bài thuyết trình**, thấy thông tin rằng Groq là nhà cung cấp bên ngoài và loại văn bản có thể được gửi nếu được phê duyệt.
- Khi người vận hành cho phép nhận **yêu cầu xét duyệt** qua `SPEAKLAB_GROQ_CONSENT_REQUESTS_ENABLED=true` trên Preview, học sinh chỉ có thể gửi *yêu cầu*. Máy chủ ghi một mã yêu cầu băm theo Google subject vào Redis, có thời hạn 30 ngày, không nhận tên người đại diện, email, bản ghi, slide, file hay bất kỳ nội dung thuyết trình nào. Yêu cầu này KHÔNG cấp quyền.
- Hiển thị trạng thái `not_requested`, `pending_verification`, `record_on_file`, `withdrawn`. GET trạng thái không dùng API Groq.
- Học sinh có thể **thu hồi yêu cầu/quyền** bằng thao tác riêng. Lệnh Redis Lua duy nhất đánh dấu `status: revoked`, `revokedAt` ở hồ sơ cấp quyền *nếu có* và xóa yêu cầu chờ, giữ nguyên TTL của hồ sơ, không bao giờ biến `pending` thành `verified`.
- `/api/ai/groq-review` vẫn buộc xác nhận signed Google learner, consent `verified` phía Redis, mục đích và nhà cung cấp, thời hạn/chưa thu hồi, chính sách, kiểm soát nội dung và quota ngay trước yêu cầu. Checkbox chỉ là một xác nhận bổ sung, không có quyền phê duyệt.
- Không có endpoint để học sinh, giáo viên thông thường hay trình duyệt tự đánh dấu hồ sơ là `verified` hoặc tự tạo `verificationReference`.

## Chưa hoàn thành để mở Groq cho học sinh

1. **Chính sách/thông báo chính thức:** nội dung dành cho học sinh và người đại diện, tổ chức/đầu mối liên hệ, mục đích, phạm vi chuyển tới Groq, lưu giữ, quyền từ chối, thu hồi và quy trình đối với dữ liệu đã được xử lý ở nhà cung cấp.
2. **Quy trình xác minh người đại diện thực sự:** có bằng chứng, người chịu trách nhiệm và cách xử lý chứng cứ tối thiểu an toàn; chưa tự động hóa việc xác minh pháp lý chỉ bằng email hoặc checkbox.
3. **Quy trình phê duyệt quản trị phù hợp:** bản ghi `verified` phải được tạo bởi người vận hành có quyền và sau khi xác minh; không dùng trang học sinh để cấp quyền, không suy diễn giáo viên tự mặc định là người đại diện.
4. **Rà soát pháp lý/bên xử lý:** bao gồm khả năng xử lý dữ liệu của trẻ em và nghĩa vụ dữ liệu chuyển ra nước ngoài theo thực tế triển khai.
5. **Nghiệm thu Groq thật và khả năng quay lại:** trước khi đổi Gemini thành nhà cung cấp chính.

**Trạng thái NO-GO:** không bật `SPEAKLAB_GROQ_STUDENT_REVIEW_ENABLED` cho học sinh. Chỉ bật biến nhận yêu cầu riêng khi đã có thông báo phù hợp và người phụ trách xử lý; không tự động bật ở commit.

## Bảo mật cần theo dõi trước khi vận hành

- Yêu cầu pending không phải bằng chứng đồng thuận; có thể hết hạn hoặc bị thu hồi.
- Thu hồi chặn lần gọi tiếp theo sau khi máy chủ đọc hồ sơ mới, không thể bảo đảm hủy ngay yêu cầu Groq đã gửi hoặc xóa mọi bản sao do nhà cung cấp giữ.
- Redis chỉ lưu trạng thái tối thiểu băm ID trong bước này; dữ liệu học sinh vẫn có thể nhận diện từ nội dung bài, vì vậy việc lọc email/điện thoại không được coi là ẩn danh.
- Phần workflow này đang **chỉ cho phép thao tác trên Preview**; để dùng Production phải được thẩm định riêng, không tái sử dụng flag thử nghiệm.
