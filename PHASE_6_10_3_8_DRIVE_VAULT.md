# SpeakLab AI — Bước 6.10.3.8: cấp quyền Google Drive bằng bản mã hóa

## Mục tiêu
Giữ **Google Drive của giáo viên** làm kho video duy nhất, không sử dụng Supabase và không yêu cầu học sinh truy cập Drive. **Chỉ thao tác trên nhánh \`feature/recording-3-2\` và Vercel Preview.** Production/main không thay đổi.

## Những gì đã thay đổi trong backend
- \`server/driveTokenVault.js\`: tạo bản mã hóa AES-256-GCM, IV ngẫu nhiên mỗi lần; khóa 32 byte từ \`SPEAKLAB_DRIVE_VAULT_KEY\`. Ràng buộc ciphertext (AAD) với OAuth Client ID, folder ID và email chủ Drive.
- \`api/google-drive/oauth/callback.js\`: sau khi xác minh email chủ Drive và thư mục đúng quyền, callback chỉ hiển thị **bản mã hóa refresh token** (không hiển thị token gốc) nếu đã cấu hình Vault Key; nếu chưa có khóa hoặc Google không cấp refresh token thì không có bản mã hóa.
- \`server/driveVideoReader.js\`: đọc refresh token thông qua \`getDriveRefreshToken()\`, **không dùng biến plaintext \`GOOGLE_REFRESH_TOKEN\`**.
- \`api/google-drive/status.js\`: cho biết khóa Vault có hợp lệ, bản mã hóa giải mã được hay chưa (chỉ boolean, tuyệt đối không trả token). Trạng thái video upload/play/delete luôn là false.
- Bộ kiểm thử ngoại tuyến AES-GCM + phân quyền: \`npm run test:drive\`, chạy ở GitHub Actions.

## Chỉ dẫn cấu hình dành cho giáo viên (Preview)
**Bước A. Tạo khóa mã hóa ngẫu nhiên và giữ bí mật:**
Mở PowerShell trên máy cá nhân (không chạy lệnh này trong Console của trình duyệt):

\`\`\`powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
\`\`\`

- Sao chép **kết quả**, không gửi khóa cho ChatGPT, GitHub, screenshot hoặc học sinh.
- Trong **Vercel → speak-lab-ai → Settings → Environment Variables**, thêm biến máy chủ:
  \`SPEAKLAB_DRIVE_VAULT_KEY\` = khóa vừa tạo, chỉ cho **Preview**.
- Khóa mới **khác** \`SPEAKLAB_SESSION_SECRET\` và \`GOOGLE_OAUTH_SETUP_KEY\`. Không dùng tiền tố \`VITE_\`.
- Redeploy **Preview** để nhận biến mới.

**Bước B. Cấp lại quyền chủ Drive:**
- Đến URL Preview đúng host đã khai trong \`GOOGLE_OAUTH_REDIRECT_URI\`:
  \`https://speak-lab-ai-git-feature-recording-3-2-speak-lab.vercel.app/api/google-drive/oauth/start\`
- Nhập \`GOOGLE_OAUTH_SETUP_KEY\` trên biểu mẫu HTTPS. Không gửi khóa trong chat.
- Chọn **đúng tài khoản Google sở hữu thư mục** và đồng ý với phạm vi \`drive.file\`.
- Callback xác minh email và quyền truy cập thư mục; nếu Google trả **refresh token mới**, trang sẽ hiển thị bản mã hóa dạng \`slv1....\` trong ô chỉ đọc. **Không chụp ảnh hoặc gửi chuỗi này.**
- Nếu Google không trả refresh token, ứng dụng hiển thị thông báo và không bật cloud. Không dùng công cụ bên ngoài để lấy token.

**Bước C. Lưu bản mã hóa vào Vercel Preview:**
- Thêm \`GOOGLE_DRIVE_REFRESH_TOKEN_ENC\` = bản mã hóa \`slv1....\` vừa tạo, chỉ cho **Preview**. Chọn loại biến **Sensitive** nếu Vercel hỗ trợ.
- Kiểm tra \`GOOGLE_DRIVE_FOLDER_ID\`, \`GOOGLE_CLIENT_ID\`, \`GOOGLE_DRIVE_OWNER_EMAIL\` trên Vercel vẫn đúng như lúc mã hóa; sửa những trường này sẽ làm ciphertext không giải mã được (phải cấp lại quyền).
- Redeploy Preview.
- Mở \`/api/google-drive/status\`: mong đợi \`configured.vaultKey=true\`, \`configured.ownerAuthorization=true\`, trong khi \`videoUploadEnabled=false\`, \`playbackFromDriveEnabled=false\`, \`deleteOnDriveEnabled=false\`.
- Các boolean này **chỉ chứng minh cấu hình có thể giải mã**, chưa chứng minh Google chấp nhận refresh token hay quyền Drive còn hiệu lực. Bước kiểm tra thực tế dùng API đọc riêng và sẽ được thực hiện sau khi xét duyệt an toàn.

## Các giới hạn vẫn tồn tại
- Google OAuth app đang **Testing**, refresh token cho Drive có thể hết hạn sau 7 ngày. Đây chỉ là giải pháp thử nghiệm, không phải kết nối dài hạn cho học sinh sử dụng.
- Không thêm quyền truy cập Drive cho học sinh trực tiếp. Không chia sẻ folder công khai.
- Không thay đổi hoặc xóa bất cứ bản ghi video cũ nào trong IndexedDB.
- Vercel Functions hạn chế payload lớn; chưa có resumable upload/playback phù hợp, nên không kích hoạt upload/xóa.
- Phải có bước đồng thuận, rà soát bảo mật, kiểm thử hai tài khoản và xác minh OAuth trước khi dùng video thật của học sinh.

## Kiểm thử và phát hành
- Các test Node kiểm tra bản mã hóa bị thay đổi, sai key/owner/folder/client và token không hợp lệ đều bị từ chối.
- Workflow GitHub Actions ở nhánh Preview chạy lại khi các file Drive thay đổi. Chỉ coi là hoàn thành khi job **Success**.
- Chỉ sau khi thử nghiệm trên Preview mới xem xét merge có kiểm soát vào main.
