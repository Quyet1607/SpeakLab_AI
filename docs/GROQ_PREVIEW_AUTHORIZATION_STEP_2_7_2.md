# SpeakLab AI — Bước 2.7.2: Nghiệm thu xác thực và phân quyền Groq Preview

**Nhánh**: `feature/groq-synthetic-pilot`  
**Phạm vi**: kiểm thử tự động với cookie ký giả lập, dữ liệu cố định và Groq/Redis mock; không dùng tài khoản học sinh thật hay phát sinh API call Groq.

## Cấu trúc phân quyền đã đối chiếu

1. **Giao diện**: `src/App.tsx` chỉ hiển thị lối truy cập nếu `/api/auth/session` trả danh tính đăng nhập vai trò `teacher` và `GET /api/groq/pilot` trả `ready: true`, `syntheticOnly: true`, đúng tên nhánh Preview. Giao diện không phải biện pháp phân quyền bảo mật.
2. **Backend**: `api/groq/pilot.js` kiểm tra `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=feature/groq-synthetic-pilot`, đọc phiên Google bằng `readSession`, buộc vai trò `teacher`, kiểm tra yêu cầu cùng nguồn trước khi POST, khóa Groq/quota Redis và cấu trúc lệnh `{syntheticOnly:true,confirmOneCall:true}`.
3. **Cookie**: `server/sessionCookie.js` xác thực HMAC, hạn sử dụng và cấu trúc danh tính; nội dung cookie có thay đổi mà không có chữ ký hợp lệ bị từ chối.
4. **Dữ liệu**: `api/groq/pilot.js` không nhận transcript, tệp PPTX, video, tên học sinh hoặc thông tin luyện tập; `scripts/groqSyntheticPilot.mjs` dựng prompt từ mẫu cố định phía server.
5. **URL trực tiếp**: Trang tĩnh `/groq-pilot.html` có thể được mở trên đường dẫn trực tiếp. Điều này **không** đồng nghĩa người chưa được cấp quyền chạy được API. API backend phải từ chối đối tượng không hợp lệ.

## Ma trận kiểm thử bổ sung

Bộ `tests/groqPreviewAuthorizationStep2712.test.js` thực hiện:

| Tình huống | Kết quả dự kiến |
|---|---|
| Teacher có cookie ký hợp lệ, đúng Preview | GET 200 không gọi Groq; POST lệnh giả lập được phép, mock đúng một lượt |
| Guest không có cookie | GET/POST 401 |
| Learner có cookie ký hợp lệ | GET/POST 403 |
| Cookie hết hạn hoặc sai chữ ký | GET/POST 401 |
| Sửa role learner thành teacher nhưng giữ chữ ký cũ | GET/POST 401 |
| Production, Development, sai/mất tên nhánh | GET/POST 404 |
| POST Origin sai, khác host, HTTP hoặc cross-site | 403 |
| POST chèn transcript, slides, sessionId, topic, consent | 400 |
| POST sai method hoặc media type | 405 / 415 |

Trong các trường hợp bị từ chối, số lượt gọi Redis quota và Groq mock phải bằng **0**.

## Kiểm thử và điều kiện hoàn thành

```bash
node --test tests/groqPreviewAuthorizationStep2712.test.js
node --test tests/groqPreviewDashboardEntry.test.js
node --test tests/groqStudentDataBoundary.test.js
node --test tests/groqVercelPilotRoute.test.js
```

GitHub Actions được cấu hình chạy test mới, kèm kiểm tra TypeScript và build. Không tuyên bố đạt trước khi CI của commit cuối có kết quả Success.

## Giới hạn

- Bộ kiểm thử dùng fixture; không thay thế một cuộc kiểm thử xuyên suốt trên Vercel bằng tài khoản learner/guest và teacher thật. Việc này sẽ thuộc bước kiểm tra Preview tiếp theo.
- Việc ẩn nút frontend không phải ranh giới bảo mật, và trang HTML tĩnh vẫn có thể truy cập trực tiếp.
- Không chứng minh việc tuân thủ pháp luật dữ liệu học sinh hoặc tính sẵn sàng xử lý bài thật.
- Không thay `/api/ai/review` (Gemini), không sửa quota, không thêm Groq cho learner, không thay Production/`main`, không triển khai Bước 2.7.3.
