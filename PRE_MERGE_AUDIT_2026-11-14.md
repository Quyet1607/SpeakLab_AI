# SpeakLab AI – Rà soát trước khi gộp vào main

**Ngày:** 14/11/2026 (Asia/Ho_Chi_Minh)  
**Nhánh nguồn:** `feature/recording-3-2`  
**Nhánh đích:** `main`  
**Trạng thái:** DRAFT / CHƯA CHO PHÉP MERGE.

## 1. Phạm vi

Đây là nhánh phát triển dài nhiều giai đoạn, không chỉ các bản sửa AI mới nhất. So sánh ban đầu cho thấy 323 commit đi trước `main`, không có commit trên `main` bị thiếu ở nhánh tính năng, thay đổi 96 tệp tại thời điểm kiểm tra. Các nhóm thay đổi gồm:

- Google Identity, cookie phiên đăng nhập, API xác thực.
- Google Drive OAuth riêng cho giáo viên, mã hóa refresh token, kiểm tra quyền chủ sở hữu, chức năng đọc danh sách Drive mặc định tắt.
- Phòng luyện tập mô phỏng, camera, chia sẻ màn hình, ghi video và lưu IndexedDB cục bộ.
- Lịch sử luyện tập, thư viện văn bản lời nói, nguồn PPTX và nhận diện giọng nói tiếng Việt.
- Gemini Free Tier nhận xét tự nguyện từ ASR/PPTX, kiểm chứng dẫn chứng, tối đa 40 slide có chữ trong một lượt yêu cầu.
- Trang pháp lý, tài liệu, test và workflow.

## 2. Những vấn đề đã xử lý trước PR

1. **Thiếu CI ở Pull Request vào main.** Hai workflow `check-local-video-library.yml` và `drive-ownership-tests.yml` đã được bổ sung trigger `pull_request` hướng tới `main` (không giới hạn thay đổi), đồng thời giữ trigger push để tiếp tục thử nghiệm.
2. **Thiếu công khai luồng dữ liệu Gemini.** Đã cập nhật `public/privacy.html`, `docs/privacy.html`, `public/terms.html`, `docs/terms.html` về việc người dùng tự đồng ý gửi đề tài, mục tiêu, chữ ASR/PPTX đến Gemini, giới hạn và lưu trữ cục bộ; bản pháp lý vẫn là dự thảo.
3. **Khả năng kích hoạt nhầm Drive trên Production.** `readOAuthConfig` và API danh sách video Drive nay yêu cầu `VERCEL_ENV=preview` cùng các khóa/flag chuyên biệt. Google Drive upload, playback, delete vẫn không được bật.
4. **Thiếu test bảo vệ phiên Google trước phát hành.** Đã thêm test offline cho JWT Google đã ký, kiểm tra audience/issuer/expiration/signature, cookie ký và bảo vệ same-origin; thêm test Production không thể sử dụng Gemini Free Tier hoặc mở Drive bằng cách sao chép biến môi trường.
5. **CI release mới** đã thêm các test `googleIdentityRelease.test.js` và `productionReleaseGuards.test.js`.

## 3. Trạng thái kiểm tra kỹ thuật

| Thành phần | Bằng chứng / giới hạn |
|---|---|
| Diff so với main | Không diverge tại thời điểm kiểm tra; phạm vi lớn, cần PR review |
| GitHub Actions | Bộ Bun/Node về video, mic ASR, PPTX, lịch sử, Gemini, bảo mật, TypeScript, build; cần theo dõi lại trên commit PR cuối |
| Google Drive | Workflow offline owner authorization; không chạy Google Drive thật |
| Google JWT | Test tạo RSA/JWKS mô phỏng; không phát hành token thật |
| Gemini | Test API/định dạng/dẫn chứng, không gọi Gemini thật, không chứng minh mọi bài dài trả đủ 40 slide |
| Media | Test logic ghi hình/track, không thay thế nghiệm thu trình duyệt/camera/micro thật |
| Vercel Preview | Kiểm tra triển khai branch; không đồng nghĩa Production đã được cấu hình |
| Tài liệu | Đã công khai việc chuyển nội dung ASR/PPTX khi người dùng đồng ý; cần chủ ứng dụng phê duyệt bản pháp lý |

## 4. Các điều kiện CHƯA ĐẠT để cho phép merge / phát hành Production

- [ ] **Kiểm thử thủ công:** luyện tập từ đầu tới cuối trên điện thoại/PC thật, cho phép và dừng micro/camera, chuyển nguồn chia sẻ, ghi hình, lưu/xem/tải/xóa video, tải PPTX, nhận diện ASR, Lịch sử và khôi phục sau tải lại trang.
- [ ] **Gemini thực tế:** nếu định đưa AI vào Production, cần kiểm thử 18–40 slide có chữ, tỷ lệ nhận xét hợp lệ và giới hạn thời gian/token/Free Tier; API hiện cố ý bị khóa ở Production. Không tự mở khóa hoặc đổi sang trả phí bằng bước merge này.
- [ ] **Cấu hình Production:** xác nhận `GOOGLE_CLIENT_ID`, `SPEAKLAB_SESSION_SECRET`, tên miền và OAuth authorized JavaScript origins; các biến này cần thiết cho đăng nhập. Không sao chép khóa/tokens Drive hoặc Gemini Preview vào Production.
- [ ] **Dữ liệu người dùng:** video IndexedDB, lịch sử/transcript/AI localStorage là **theo origin và thiết bị**. Dữ liệu trên Preview sẽ không tự chuyển sang tên miền Production; cần sao lưu/tải xuống dữ liệu quan trọng. Nhóm theo tài khoản Google trên trình duyệt không phải phân quyền bảo mật vật lý với thiết bị dùng chung.
- [ ] **Nội dung mô phỏng:** trang Report và hội đồng giả lập vẫn chứa điểm số/nhận xét minh họa; phải giữ nhãn Demo rõ ràng và không coi đó là kết quả sư phạm thật.
- [ ] **Quyền riêng tư/pháp lý:** chủ ứng dụng rà soát, phê duyệt các trang Privacy/Terms, quy trình đồng ý phù hợp cho người chưa thành niên và kênh liên hệ hỗ trợ trước khi triển khai rộng.
- [ ] **Quản trị GitHub:** `main` chưa bật branch protection / required checks tại thời điểm kiểm tra. Cần cấu hình GitHub branch rules để yêu cầu kiểm thử/PR review trước merge.
- [ ] **Triển khai/rollback:** chốt phiên bản Production hiện tại và phương án quay lại nếu sau merge chức năng lỗi; kiểm tra Vercel project/domain tương ứng Production.

## 5. Quy trình gộp an toàn

1. Tạo PR **Draft**: `feature/recording-3-2` → `main`; không bấm Merge.
2. Đợi cả **Check local video library** và **Drive owner authorization tests** chạy thành công trên **event pull_request**; xác nhận trạng thái mergeable.
3. Hoàn thành checklist thiết bị thực, xử lý blocker và chụp lại bằng chứng trên PR.
4. Rà soát thay đổi cuối, xác nhận chủ ứng dụng đồng ý gộp; bật required checks nếu có quyền.
5. Sau khi được phê duyệt mới thực hiện merge, theo dõi Production và có phương án rollback.

**Không có kiểm thử tự động nào chứng minh rằng Production đã sẵn sàng nhận lưu trữ đám mây hoặc nhận xét Gemini.**
