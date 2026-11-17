# GroqCloud Free Tier — chạy thử an toàn bằng dữ liệu giả lập

Ngày cập nhật: 17/11/2026. Phạm vi: **proof of concept trên máy người vận hành**, không phải tích hợp học sinh vào SpeakLab_AI.

## Nguyên tắc
- Chỉ chạy `scripts/groqSyntheticPilot.mjs`: dữ liệu TXT và slide được **viết cố định trong mã**, 100% giả lập. Không có đầu vào từ người dùng, tệp hoặc lịch sử học sinh.
- **Không tạo** endpoint frontend, không cấu hình `GROQ_API_KEY` trên Vercel, không thay đổi Gemini Preview/Production, không gửi dữ liệu học sinh thật.
- Mặc định chạy `node scripts/groqSyntheticPilot.mjs` chỉ kiểm tra offline; **chỉ** lệnh có `--live` mới gửi một request Groq.
- Mô hình mặc định `openai/gpt-oss-20b`, là mô hình Groq hiện có hỗ trợ structured JSON strict. Không mặc định dùng Qwen vì model Qwen hiện trên Groq có thể là Preview hoặc không nằm trong Free Tier.
- Kết quả được kiểm tra đủ năm tiêu chí, không được chứa điểm số và các trích dẫn phải có thật trong TXT hoặc PPTX giả lập tương ứng. Mọi lỗi bị từ chối thay vì biến thành báo cáo học sinh.
- Lệnh không ghi API key, dữ liệu đầu vào hay phản hồi vào tệp/đám mây. Console có thể hiển thị **kết quả giả lập** nếu vượt kiểm tra.
- Không bật Billing/Developer plan. Nếu Free Tier báo hết quota (HTTP 429), dừng; không gọi lại và không tự chuyển sang mô hình trả phí.

## Tài khoản và bảo vệ dữ liệu trước khi có học sinh THCS
Theo Groq Services Agreement (22/06/2026) phần 6.3, bên vận hành ứng dụng dành cho người chưa đủ tuổi chịu trách nhiệm về các luật liên quan và dữ liệu trẻ em. Đây **không phải** giấy xác nhận ứng dụng đủ điều kiện. Cần kiểm tra điều khoản mô hình, DPA, phân quyền máy chủ, xử lý xuyên biên giới, thông báo và đồng thuận pháp lý trước khi xử lý dữ liệu học sinh thật.

Groq công bố inference requests mặc định không lưu Customer Data, nhưng có thể lưu tạm để chống lạm dụng/vận hành, tối đa 30 ngày. Trên Console > Data Controls, kiểm tra Zero Data Retention (ZDR); ZDR không thay thế việc tuân thủ pháp luật.

Tài liệu:
- https://console.groq.com/docs/legal/services-agreement
- https://console.groq.com/docs/legal/customer-data-processing-addendum
- https://console.groq.com/docs/your-data
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/models

## Hướng dẫn Windows PowerShell

1. Mở https://console.groq.com và tự tạo tài khoản (người vận hành từ 18 tuổi trở lên), chọn Free. Không bật thanh toán. Vào https://console.groq.com/keys để tự tạo API key. **Không gửi key qua ChatGPT/GitHub hay ảnh chụp.**
2. Tải/clone repository và checkout nhánh `feature/groq-synthetic-pilot`. Cài Node.js LTS nếu chưa có.
3. Tại thư mục repo chạy kiểm thử offline:

```powershell
node --test tests/groqSyntheticPilot.test.js
node scripts/groqSyntheticPilot.mjs
```

4. Chỉ khi đã kiểm tra đang dùng Free Tier, nhập key tạm trong chính PowerShell này bằng nhập ẩn:

```powershell
$secret = Read-Host "Nhập Groq API Key (ẩn)" -AsSecureString
$env:GROQ_API_KEY = [System.Net.NetworkCredential]::new("", $secret).Password
node scripts/groqSyntheticPilot.mjs --live
Remove-Item Env:GROQ_API_KEY
Remove-Variable secret
```

Nếu script báo 429, dừng thử (quota miễn phí). Nếu báo nguồn không khớp, đó là phát hiện chất lượng chưa đạt; không sửa validator để né kiểm tra.

## Tiêu chí đánh giá đợt thử
- [ ] Có tài khoản Groq Free, xác minh được model trong console và hạn mức theo tài khoản.
- [x] Tạo được chương trình test với bài nói giả, không nhận dữ liệu học sinh.
- [ ] Gửi thành công **một** lời gọi API thật bằng key chỉ có trên máy người vận hành (chưa thực hiện vì không có key).
- [ ] JSON trả về đủ 5 mục R1–R5.
- [ ] 100% câu trích dẫn trùng nguồn tương ứng.
- [ ] Không có điểm /10 hoặc kết luận ánh mắt, ngữ điệu, khả năng cá nhân.
- [ ] Nhận xét tiếng Việt có dấu và gợi ý cụ thể, giáo viên kiểm tra thủ công.
- [ ] Hoàn thành kiểm tra pháp lý, đồng thuận, DPA, lưu trữ và rủi ro trẻ em trước khi dùng dữ liệu thật.

## Điều kiện trước khi tích hợp SpeakLab_AI
Không nối script này vào app; không bật nút dùng API cho học sinh. Muốn đi xa hơn phải thiết kế backend xác thực phiên, kiểm quyền server-side (hiện lịch sử chia bằng nhãn localStorage, chưa phải biện pháp cách ly bảo mật), quota theo người dùng, cấu hình feature flag mặc định off, kiểm tra dữ liệu cá nhân và cơ chế từ chối tự động khi hết hạn mức.
