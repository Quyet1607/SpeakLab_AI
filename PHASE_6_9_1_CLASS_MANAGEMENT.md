# SpeakLab AI — Bước 6.9.1A: Quản lý lớp học (Preview)

## Đã triển khai
- Trang **Quản lý lớp** trong menu trái; giao diện responsive theo bộ màu trắng/xanh lá SpeakLab AI.
- Tạo lớp thử nghiệm: tên lớp và năm học, kiểm tra trùng tên trong cùng năm học.
- Thêm học sinh giả lập: tên, mã học sinh, kiểm tra trùng mã trong cùng lớp.
- Chọn lớp, xem danh sách học sinh, tìm kiếm theo tên hoặc mã.
- Xóa học sinh/lớp với hộp thoại xác nhận; xóa lớp xóa toàn bộ danh sách của lớp trong dữ liệu **cục bộ**, KHÔNG xóa dữ liệu/video Google Drive.
- Dữ liệu lưu ở localStorage của **trình duyệt hiện tại**; chỉ dành cho kiểm thử giao diện, không đồng bộ thiết bị khác.
- Không thay đổi lịch sử video, camera, micro, trình chiếu PowerPoint, phòng luyện tập, OAuth Drive.
- Không có dữ liệu học sinh thật được đưa vào mã nguồn.

## Hướng dẫn thử
1. Đợi Vercel Preview của nhánh `feature/recording-3-2` hiển thị Ready.
2. Mở `https://speak-lab-ai-git-feature-recording-3-2-speak-lab.vercel.app`.
3. Chọn **Quản lý lớp** trên menu trái (di động: mở menu bằng biểu tượng ☰).
4. Tạo lớp với tên giả lập `Lớp Demo 11A1`, năm học `2026–2027`.
5. Thêm học sinh giả lập `Học sinh Mẫu A`, mã `DEMO001`.
6. Kiểm tra tìm kiếm, trùng mã, xóa học sinh, thử F5 giữ được dữ liệu.
7. Kiểm tra lại lịch sử video và phòng luyện tập không bị ảnh hưởng.

## Giới hạn và an toàn
**Bản này chưa có chức năng phân quyền thực sự.** Người bất kỳ mở Preview đều có thể quản lý dữ liệu thử nghiệm *trên chính thiết bị của họ*; Google Sign-In hiện chỉ xác minh danh tính tạm thời và không tạo session. Vì vậy:
- **Không nhập tên, email, số điện thoại hoặc thông tin thật của học sinh.**
- Không sử dụng dữ liệu localStorage làm danh sách học sinh được phê duyệt hoặc dùng để quyết định quyền truy cập video.
- Dữ liệu có thể mất khi xóa bộ nhớ trình duyệt, không tồn tại liên thiết bị.
- Không đưa dữ liệu này lên Production trước khi có xác thực giáo viên, cơ sở dữ liệu và quyền ghi danh server-side.

## Các giai đoạn tiếp theo
**6.9.1B**: Chọn cơ sở dữ liệu server-side; tạo bảng lớp, học sinh, giáo viên và liên kết `Google sub`, unique constraints, audit logs. Chỉ API đã xác thực giáo viên mới được thêm/xóa học sinh.

**6.9.1C**: Gắn Google Sign-In vào server session an toàn, phân quyền giáo viên/học sinh, bảo vệ API và trang quản lý lớp theo quyền thực; xác minh bản thân học sinh có thể truy cập chính xác thông tin của mình.

**6.9.2+**: Tích hợp Drive video, metadata owner, streaming có xác thực và xóa theo owner.

## Quy tắc phát hành
Chỉ làm trên `feature/recording-3-2`, chưa merge vào `main`. Khi có backend xác thực, cơ sở dữ liệu và kiểm thử quyền học sinh, tiến hành PR và rà soát trước khi triển khai Production.
