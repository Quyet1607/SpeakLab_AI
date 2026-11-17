# SpeakLab AI — Tích hợp Groq vào chức năng AI nhận xét hiện tại

**Nhánh:** `feature/groq-synthetic-pilot`  
**Trạng thái:** Đã kết nối giao diện cũ với API Groq teacher-only trong Preview; **server vẫn khóa gửi mặc định**.

## Phạm vi đã thực hiện

- Sửa trực tiếp `src/features/history/AiSpeechReviewPanel.tsx` (trang Lịch sử luyện tập), không tạo trang nhận xét mới.
- Người học dùng Gemini như cũ. Nếu đang ở đúng nhánh Preview và đăng nhập phiên Google vai trò `teacher`, panel hiển thị lựa chọn giữa `Gemini hiện tại` và `Groq · Bài người lớn tự viết`.
- Groq nhận đề tài, mục tiêu, bản ghi ASR và chữ slide đang có trong chính buổi luyện, không yêu cầu nhập lại. Người vận hành xem toàn bộ JSON dự kiến gửi và phải xác nhận riêng sau khi kiểm tra. Mọi thay đổi trong bài/slide làm vô hiệu xác nhận cũ.
- Bật Groq **chỉ khi** API teacher-only `/api/groq/adult-preview` báo ready từ server. API xác minh nhánh Preview, cookie session, same-origin, input allowlist, quota Redis và biến cấu hình opt-in `SPEAKLAB_GROQ_ADULT_PILOT_ENABLED === 'true'`.
- Giới hạn giai đoạn đầu: văn bản 20–3.500 ký tự, tối đa 3 slide chữ, mỗi slide tối đa 700 ký tự. Không cho phép gửi bài có dấu hiệu rõ về dữ liệu học sinh hoặc thông tin định danh; bộ lọc không bảo đảm phát hiện tất cả.
- Kết quả Groq (nếu hợp lệ) dùng trực tiếp component `AiReviewResults` vốn đang hiển thị nhận xét Gemini, dựa trên hợp đồng `strengths/improvements/slideComparisons`.
- Kết quả Groq thử nghiệm không được lưu vào Lịch sử để tránh nhầm với báo cáo học sinh; Gemini tiếp tục lưu nhận xét như cũ.
- Không tự gọi lại Groq, không đưa API key ra frontend, không thay `/api/ai/review`, không merge main/Production.

## Giới hạn cần minh bạch

- Đây là tích hợp tại vị trí chức năng thật, nhưng **không phải chuyển đổi toàn bộ học sinh từ Gemini sang Groq**.
- Không có cơ chế đủ mạnh để xác nhận tuổi hay tự động phân biệt bài tự viết của giáo viên với bài thật của học sinh. Do vậy, server vẫn khóa gửi cho đến khi chủ vận hành xem xét căn cứ xử lý, thông báo chuyển dữ liệu cho Groq và chỉ cho phép tài liệu người lớn có quyền.
- Groq Free Tier đã hết lượt thử ở thời điểm triển khai; CI chạy với phản hồi mock và kiểm tra build, chưa xác minh chất lượng gọi thật.
- Chưa mở Groq cho bài của học sinh, không coi checkbox người lớn là thay thế cho đồng thuận người đại diện hợp pháp.
- Các trang Groq cũ vẫn tồn tại để không phá thử nghiệm trước đây, nhưng **đường dùng chính cho hướng phát triển mới là panel Lịch sử luyện tập**.

## Vị trí kiểm tra trên Preview

Trang chủ SpeakLab → **Lịch sử luyện tập** → chọn buổi luyện → **AI nhận xét bài thuyết trình** → lựa chọn **Groq · Bài người lớn tự viết** (chỉ khi phiên teacher được xác thực). Khi API chưa được bật, có thể xem dữ liệu nhưng không gửi Groq.

Xem cổng kỹ thuật và rủi ro: `docs/GROQ_ADULT_PREVIEW_GATE_STAGE_2.md`, `docs/GROQ_STUDENT_PRIVACY_DESIGN_PHASE_2_5.md`.

Không có thay đổi nào cho Gemini, database, cookie, quota, main hoặc Production.
