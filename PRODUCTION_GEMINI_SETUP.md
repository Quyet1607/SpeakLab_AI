# Kích hoạt Gemini trên Vercel Production – SpeakLab AI

## Nguyên nhân và bản sửa

Nhánh `main` ban đầu sử dụng `ensureFreePreview()` để từ chối mọi yêu cầu có `VERCEL_ENV=production` trước khi gọi Gemini. Bản sửa dùng `ensureFreeReviewConfigured()`: Preview giữ nguyên, còn Production chỉ được phép khi chủ dự án chủ động bật. Production mặc định **tắt**.

## Biến môi trường Production

Vào **Vercel → Project → Settings → Environment Variables**, chọn phạm vi **Production**:

| Biến | Giá trị / ý nghĩa |
| --- | --- |
| `GEMINI_API_KEY` | Khóa API Gemini phía server, không công khai |
| `SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED` | `true`, xác nhận thủ công bạn đã kiểm tra tier/billing/quota |
| `SPEAKLAB_GEMINI_PRODUCTION_ENABLED` | `true`, công tắc riêng để bật Production |
| `SPEAKLAB_RATE_LIMIT_REST_URL` | URL HTTPS Upstash Redis REST |
| `SPEAKLAB_RATE_LIMIT_REST_TOKEN` | Token Redis REST |
| `GOOGLE_CLIENT_ID` | Google Identity Services Web Client ID |
| `SPEAKLAB_SESSION_SECRET` | Chuỗi bí mật ngẫu nhiên phía máy chủ, tối thiểu 32 byte |

Không đặt secret trong biến `VITE_*`, không commit `.env` hoặc secret lên GitHub.

**Quan trọng:** `SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED=true` chỉ là xác nhận của người vận hành, không xác minh được trạng thái billing/quota của Google. Giới hạn 5 lượt/ngày trong app không bảo đảm dịch vụ miễn phí hay ngăn tất cả chi phí. Chủ dự án phải kiểm tra chính sách tier/model/quota/billing hiện hành và điều khoản xử lý dữ liệu của Google, nhất là trước khi dùng với dữ liệu học sinh.

## Google Sign-in và redeploy

Thêm origin của domain Production (ví dụ `https://example.com`) vào **Google Cloud Console → OAuth Web Client → Authorized JavaScript origins**. Đây là đăng nhập Google trên website, không phải OAuth Google Drive (vẫn chỉ hoạt động ở Preview).

Sau khi thiết lập biến môi trường, triển khai bản sửa lên nhánh Production rồi **redeploy**. Vercel không áp dụng biến môi trường mới cho deployment đã tồn tại. Có thể tắt nhanh AI trên Production bằng cách đặt `SPEAKLAB_GEMINI_PRODUCTION_ENABLED=false` rồi redeploy.

## Kiểm thử Production

1. Mở đúng domain Production, đăng nhập Google.
2. Chọn một bản ghi mẫu không nhạy cảm, chủ động đồng ý gửi văn bản và bấm phân tích.
3. Nếu lỗi, mở **DevTools → Network → /api/ai/review**, ghi lại HTTP status và `code`/`error` trong JSON; xem Vercel Function Logs nếu cần. Không chia sẻ API key, cookie, token hoặc nội dung học sinh.

| HTTP status / code | Cách kiểm tra |
| --- | --- |
| 503 `SPEAKLAB_AI_PRODUCTION_DISABLED` | Bật `SPEAKLAB_GEMINI_PRODUCTION_ENABLED=true` ở Production và redeploy |
| 503 `SPEAKLAB_AI_NOT_CONFIGURED` | Kiểm tra `GEMINI_API_KEY` và `SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED` |
| 503 `SPEAKLAB_FREE_TIER_GUARD` | Redis REST chưa cấu hình, lỗi kết nối hoặc không khả dụng |
| 429 `SPEAKLAB_FREE_TIER_GUARD` | Đã vượt 5 lượt/ngày của SpeakLab |
| 401 | Chưa đăng nhập Google hợp lệ trên Production |
| 403 | Kiểm tra origin, host, HTTPS và bảo vệ Vercel |
| 404 hoặc HTML thay vì JSON | Kiểm tra đường dẫn function, Vercel Deployment Protection hoặc Firewall |
| 429/503 `GEMINI_*` | Kiểm tra quyền key, model và quota phía Google |

Bản sửa **không** tắt giới hạn lượt, không mở CORS tùy tiện, không đưa Gemini API key ra frontend và không mở các tính năng Drive bị giới hạn ở Preview.

## Chạy kiểm thử

```bash
node --test tests/freeSpeechReview.test.js tests/productionReleaseGuards.test.js tests/aiReviewRoute.test.js
npm run lint
npm run build
```

Các kiểm thử tự động không xác nhận được kết nối Gemini thật hay cấu hình bí mật của Vercel.
