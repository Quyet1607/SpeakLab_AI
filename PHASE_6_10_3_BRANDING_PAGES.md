# SpeakLab AI — Bước 6.10.3: Chuẩn bị Branding và thông tin quyền riêng tư

## Đã triển khai trên Preview
- Hai trang tĩnh:
  - `/privacy.html` — Chính sách quyền riêng tư (bản dự thảo tiếng Việt).
  - `/terms.html` — Điều khoản sử dụng (bản dự thảo tiếng Việt).
- CSS chung: `public/legal.css`; các trang nằm trong Vite `public/` để phục vụ ở URL gốc của mỗi deployment.
- Liên kết ở mục `Cài đặt → Quyền riêng tư` và cuối thanh menu.
- Làm rõ rằng video mới chỉ lưu ở IndexedDB; cookie Google là phiên đăng nhập; Google Drive chưa bật; lịch sử cục bộ chưa cách ly dữ liệu thật giữa người dùng chung máy.
- Không thay đổi camera, micro, PowerPoint, phòng luyện tập, lịch sử video hoặc OAuth backend.

## Liên kết kiểm tra ở Preview
- `https://speak-lab-ai-git-feature-recording-3-2-speak-lab.vercel.app/privacy.html`
- `https://speak-lab-ai-git-feature-recording-3-2-speak-lab.vercel.app/terms.html`

Sau khi Vercel báo Ready, mở hai URL này từ cửa sổ ẩn danh **không đăng nhập Vercel**; bảo đảm trang được truy cập qua HTTPS, đúng tiêu đề, không hiện 404 hay trang chặn truy cập. Nếu Vercel Deployment Protection chặn, không được coi là chính sách công khai.

## Điều chưa đủ để xuất bản OAuth
- Các văn bản vẫn là **dự thảo**. Chưa có xác nhận chính thức của đơn vị vận hành, thông tin liên hệ hỗ trợ và các nội dung pháp lý áp dụng với người chưa thành niên.
- Không đưa URL Preview vào Google Cloud Branding để dùng cho OAuth Production khi chưa kiểm chứng tên miền và yêu cầu xác minh.
- Trang chính sách trước khi phát hành phải ghi đúng luồng sử dụng Google Drive **khi thực sự đã bật**, thời gian lưu giữ và yêu cầu xóa, chia sẻ, liên hệ, cách thức rút lại đồng ý.
- Chuyển Google OAuth External Testing sang Production có thể cần bổ sung thông tin thương hiệu, tên miền sở hữu và quy trình xác minh theo scopes; không đồng nghĩa với việc deploy website lên Production.
- Giai đoạn này **chưa lưu refresh token giáo viên**, chưa bật upload, playback hay xóa video Drive.

## Gợi ý kiểm thử
1. Mở cả hai URL ở cửa sổ ẩn danh.
2. Kiểm tra liên kết Chính sách và Điều khoản từ trang `Cài đặt → Quyền riêng tư`.
3. Kiểm tra liên kết qua menu trái.
4. Kiểm tra bộ phận ghi hình / lịch sử video trên Preview vẫn hoạt động; không xóa video cũ.
5. Chỉ khi có duyệt nội dung và địa chỉ công khai chính thức mới điền vào Google Cloud Branding.

## Nhánh và phạm vi
Chỉ `feature/recording-3-2`; **không merge main/Production**. Không tạo lớp học, không thêm Supabase.
