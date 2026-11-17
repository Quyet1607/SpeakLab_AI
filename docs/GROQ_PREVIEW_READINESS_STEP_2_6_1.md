# SpeakLab AI — Bước 2.6.1: Kiểm tra sẵn sàng Groq Preview (không gọi thật)

**Nhánh:** `feature/groq-synthetic-pilot`  
**Phạm vi:** Chỉ rà soát cấu hình, phân quyền và kiểm thử offline. **Không thực hiện Bước 2.6.2**.

## Những gì đã xác minh từ mã nguồn

- `GET /api/groq/pilot` chỉ trả `ready: true` khi Vercel là `preview`, commit ref chính xác `feature/groq-synthetic-pilot`, có session Google được máy chủ xác thực với role `teacher`, có `GROQ_API_KEY` không rỗng và có cấu hình Redis có định dạng hợp lệ.
- Session là cookie ký HMAC phía server; tài khoản khách hoặc role `learner` không được dùng pilot. Trên máy chủ, `SPEAKLAB_SESSION_SECRET` phải là chuỗi base64 hợp lệ đủ mạnh để đọc cookie.
- Redis quota cần `SPEAKLAB_RATE_LIMIT_REST_URL` HTTPS không có đường dẫn, `SPEAKLAB_RATE_LIMIT_REST_TOKEN` và `SPEAKLAB_SESSION_SECRET`. Tất cả phải ở server-side environment; không chia sẻ giá trị trong GitHub hoặc ảnh.
- GET **không** gọi Redis, **không** gọi Groq và **không** tiêu thụ quota. Khi lỗi, API trả thông báo tổng quát, không in token, key hoặc session secret.
- `POST` còn phải vượt qua same-origin, schema lệnh giả lập, kiểm tra quota Redis trước khi thực hiện Groq. Production và nhánh khác trả 404.

## Cần kiểm tra thủ công trên Vercel (không đọc giá trị bí mật)

1. Chọn dự án SpeakLab trên Vercel > Settings > Environment Variables.
2. Xác nhận có `GROQ_API_KEY`, `SPEAKLAB_RATE_LIMIT_REST_URL`, `SPEAKLAB_RATE_LIMIT_REST_TOKEN`, `SPEAKLAB_SESSION_SECRET` áp dụng cho **Preview**, đúng nhánh; không chụp hoặc sao chép giá trị.
3. Sau khi thay đổi cấu hình, tạo deployment Preview mới để biến có hiệu lực.
4. Đăng nhập Google tài khoản teacher trên **đúng tên miền Preview** và mở `/groq-pilot.html`. Nếu GET báo sẵn sàng, kết luận duy nhất là **cấu hình có mặt/đúng hình thức và quyền truy cập vượt qua bước kiểm tra tĩnh**.
5. Không nhấn nút “Chạy thử Groq” trong 2.6.1. Việc nhấn nút thuộc Bước 2.6.2 và tiêu thụ quota thật.

## Kiểm thử tự động

```sh
node --test tests/groqPreviewReadiness.test.js
node --test tests/groqStudentDataBoundary.test.js
node --test tests/groqVercelPilotRoute.test.js
```

GitHub Actions chạy kiểm thử này khi cập nhật nhánh `feature/groq-synthetic-pilot`; toàn bộ phụ thuộc trong test đều offline/mock, không sử dụng API key thực và không cần truy cập Redis.

## Giới hạn kết luận / điều kiện chuyển bước

**Chưa thể khẳng định** Vercel đã được cấu hình chính xác, Redis REST token có quyền truy cập, Redis đang hoạt động, Groq API key còn hợp lệ hay Groq Free Tier còn hạn mức chỉ bằng kiểm thử offline hoặc GET. Những điểm này cần kiểm tra riêng và có kiểm soát ở Bước 2.6.2. Không gửi bài học sinh thật, không merge vào main và không chuyển sang Production.
