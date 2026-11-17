# SpeakLab AI — Bước 2.6.4: Kiểm thử lỗi Groq và hạn mức

**Nhánh:** `feature/groq-synthetic-pilot`  
**Phạm vi:** kiểm thử mock/offline, không gọi Groq hay Redis thật, không dùng dữ liệu học sinh.

## Đã rà soát và bổ sung

- Redis quota: từ chối trước Groq khi hết hạn mức một tài khoản/ngày, toàn hệ thống/ngày, toàn hệ thống/phút, đồng thời; Redis lỗi trả 503. Mã lỗi quota được đối chiếu với allowlist trước khi trả ra UI, không chuyển nguyên văn thông báo nội bộ.
- Groq: kiểm tra 429 (hết hạn), timeout, JSON không hợp lệ, kết quả không đạt Rubric, vượt giới hạn token, phản hồi từ chối, khóa/model không khả dụng, lỗi HTTP và mạng.
- Những lỗi trên dùng thông báo cố định để tránh lộ API key, prompt hoặc lỗi phía nhà cung cấp. Không có retry tự động hoặc fallback sang model có phí.
- Sau khi đã đặt chỗ quota, handler vẫn gọi release trong finally cả khi Groq lỗi; test kiểm tra đúng một lượt gọi và đúng một lần release.
- `GET /api/groq/pilot` chỉ xác minh điều kiện cấu hình, không tiêu quota.

## Lệnh kiểm thử

```sh
node --test tests/groqFailureAndQuotaAcceptance.test.js
node --test tests/groqPilotQuota.test.js
node --test tests/groqReviewProvider.test.js
node --test tests/groqVercelPilotRoute.test.js
```

Các bài test chạy trong GitHub Actions qua `.github/workflows/check-local-video-library.yml`.

## Giới hạn và quyết định

Kiểm thử mock chứng minh nhánh logic dự kiến nhưng **không chứng minh** Redis thật đang khả dụng, giới hạn thực tế từ Groq, hay timeout và khôi phục kết nối trong hạ tầng Vercel. Một lượt Groq dữ liệu giả lập đã được người vận hành kiểm thử trước đó; không phát sinh lượt gọi mới ở bước này.

Chưa đổi `/api/ai/review` từ Gemini sang Groq; không gửi transcript/PPTX/video người học tới Groq, không gộp `main` và không mở Production. Chỉ xem xét Bước 2.6.5 sau khi GitHub Actions của bước 2.6.4 hoàn tất thành công.
