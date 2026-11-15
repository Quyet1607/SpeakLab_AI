# SpeakLab AI — Bước 6.8.2: Google Identity (Preview only)

## Đã triển khai
- Backend xác minh chữ ký RS256 của Google ID token dựa vào bộ khóa công khai xoay vòng của Google; kiểm tra issuer, client audience, thời gian hết hạn, subject, email_verified.
- \`GET /api/auth/config\`: chỉ trả về **Client ID công khai**, không có Client Secret, refresh token hoặc setup key.
- \`POST /api/auth/verify\`: nhận ID token ngắn hạn qua HTTPS và xác minh; trả về \`teacher\` nếu email đã được xác minh khớp \`GOOGLE_DRIVE_OWNER_EMAIL\`, ngược lại trả về \`unregistered\`. Không tạo quyền học sinh tự động.
- \`src/components/auth/GoogleIdentityTest.tsx\`: đặt tại **Cài đặt → Tài khoản học sinh**, người dùng chủ động nhấn đăng nhập Google. Mã thông báo chỉ dùng một lần để kiểm tra và **không lưu trong localStorage, IndexedDB hay cookie**.
- Các phiên giả lập và thư viện video cục bộ vẫn giữ nguyên. Không có chức năng cloud upload, cloud playback, delete cloud.

## Bước giáo viên cần cấu hình để thử nút Google
Trong Google Cloud Console (project SpeakLab AI) → Google Auth Platform → Clients → \`SpeakLab AI - Drive Backend\`:
- **Authorized JavaScript origins:** thêm origin đúng của Preview, **không có path hoặc dấu / ở cuối**:
  \`https://speak-lab-ai-git-feature-recording-3-2-speak-lab.vercel.app\`
- Giữ nguyên Authorized redirect URI cho OAuth teacher Drive, không thay.
- Lưu cấu hình. Quá trình Google cập nhật có thể cần thêm thời gian.
- Trong Vercel, các biến hiện có \`GOOGLE_CLIENT_ID\` và \`GOOGLE_DRIVE_OWNER_EMAIL\` phải thuộc **Preview**.

Sau khi Vercel tự động deploy Preview mới nhất: mở Preview → **Cài đặt → Tài khoản học sinh → Xác thực Google (thử nghiệm)**. Đăng nhập thử. Nếu trả về \`Giáo viên\` hoặc \`Chưa được ghi danh\` thì xác minh danh tính phía server hoạt động; **chưa phải phiên đăng nhập ứng dụng**.

## Điều kiện trước khi đồng bộ video học sinh
**Không được bật cloud storage hoặc giả định userId từ trình duyệt là tin cậy.**

1. Cơ chế ghi danh lớp (danh sách học sinh được phép sử dụng), liên kết Google \`sub\` không đổi với người học; teacher-only admin operations. Quyền học sinh không được suy từ email chưa được đăng ký.
2. Chọn kho metadata server-side: \`recordingId, ownerSub, sessionId, driveFileId, status\`, với chính sách truy cập owner-only; bài toán chia sẻ lớp và cha mẹ học sinh cần chính sách bảo mật.
3. Cơ chế xác thực **mỗi API request** bằng bearer token còn hạn hoặc server session an toàn; API không tin cậy \`userId\` client gửi. \`POST /api/auth/verify\` hiện tại chỉ xác nhận token tại thời điểm đăng nhập, **không cấp session cookie**.
4. OAuth teacher Drive có refresh token lưu bằng secret store an toàn. Testing consent token có thời hạn; không đưa refresh token ra browser.
5. Upload theo phiên resumable/chunks qua đường truyền cho phép CORS hoặc kho trung gian có kiểm soát; Vercel Function không thích hợp làm proxy toàn bộ video lớn.
6. Stream/video playback theo chủ sở hữu, HTTP Range phù hợp và xóa file Drive chỉ sau khi xác minh owner từ DB.
7. Đồng ý thu thập và lưu video của người học trước khi upload, không cung cấp share link Drive công khai.
8. Thử nghiệm riêng Preview, hoàn chỉnh mới merge lên main.

## Lưu ý
- Biến \`GOOGLE_DRIVE_FOLDER_ID\` tại Preview phải là thư mục do SpeakLab tạo (không phải thư mục cũ tạo thủ công).
- Không đăng mã thông báo Google, Client Secret, setup key hoặc video học sinh lên GitHub, Vercel logs, hay ChatGPT.
- Chưa triển khai database hay ghi danh, nên Google sign-in lúc này là **bước kỹ thuật thử nghiệm**, không phải hệ thống phân quyền đã hoàn chỉnh.
