# SpeakLab AI — Chuyển đổi Groq trên Preview: Bước 2 (chọn mẫu giả lập)

**Nhánh:** `feature/groq-synthetic-pilot`  
**Phạm vi:** giáo viên đã đăng nhập Google trên đúng Vercel Preview. Không bật dùng nội dung bài học sinh thật.

## Thay đổi

- Trang `/groq-pilot.html` thêm danh sách 5 lựa chọn: bài giảm rác nhựa ban đầu và 4 mẫu giả lập bổ sung (tiết kiệm nước, đọc sách, an toàn trực tuyến, vườn cây).
- `public/groq-pilot.js` chỉ gửi `{syntheticOnly:true,confirmOneCall:true}` hoặc thêm đúng `caseId` thuộc danh sách. Người dùng không được nhập văn bản, tải tệp hoặc sửa prompt trên giao diện. Nút chạy và danh sách bị khóa ngay sau một lần bấm; không tự retry.
- `api/groq/pilot.js` chỉ chấp nhận đúng 2 trường cho mẫu cũ hoặc đúng 3 trường khi `caseId` nằm trong allowlist phía máy chủ; mọi giá trị không hợp lệ và trường lạ bị từ chối trước Redis/Groq.
- `server/groqSyntheticCases.js` lấy nguyên bản từ các mẫu giả lập lưu ở repo, dựng dẫn chứng riêng cho từng mẫu, yêu cầu Groq chỉ chọn mã dẫn chứng, xác minh R1–R5 và thay nhận xét R2/R4 bằng kết luận thận trọng dựa vào chữ.
- Redis quota, quyền teacher, origin, nhánh Preview, giới hạn Free Tier và lỗi an toàn giữ nguyên. `api/ai/review.js` vẫn dùng Gemini.

## Kiểm thử

`tests/groqMultiSamplePilot.test.js` mô phỏng bốn mẫu, kiểm tra dẫn chứng xuất phát từ transcript/slide đúng mẫu, lựa chọn ID hợp lệ, lỗi ID, dữ liệu tùy ý, một lượt request sau khi đặt chỗ Redis và xuất JSON schema hợp lệ. `tests/groqTransitionCorpus.test.js` được cập nhật để kiểm tra hợp đồng allowlist mới.

GitHub Actions chạy thêm các test trên, bên cạnh toàn bộ kiểm thử đã có. Chỉ đánh dấu hoàn tất sau khi CI thành công.

## Giới hạn

- Chưa có kết quả kiểm thử live cho bốn mẫu mới. Người vận hành cần xác minh bằng tài khoản teacher trên Vercel Preview, có thể tiêu thụ quota Groq Free Tier.
- Bộ kiểm thử offline không chứng minh chất lượng Groq trên bốn mẫu hay độ ổn định mạng thực tế.
- Không dùng dữ liệu người học, không thay Gemini, không gộp vào main hoặc Production.
