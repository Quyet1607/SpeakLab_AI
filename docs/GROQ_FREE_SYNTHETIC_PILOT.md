# SpeakLab_AI — Groq Free Tier trên Vercel Preview

Cập nhật: 17/11/2026 · Nhánh: `feature/groq-synthetic-pilot` · PR #3 (Draft)

## Phạm vi an toàn
- **Chỉ dành cho người vận hành có tài khoản Google vai trò giáo viên.** Không mở nút cho học sinh hoặc khách.
- Có trang riêng tại `/groq-pilot.html` trên **Vercel Preview của nhánh này**; không cần cài Node.js hoặc Bun trên Windows.
- Dữ liệu gửi Groq là bài nói giả lập cố định trong `scripts/groqSyntheticPilot.mjs` và 2 đoạn chữ PPTX giả. Không có đầu vào học sinh từ giao diện, URL, lịch sử, TXT hoặc video.
- API `/api/groq/pilot` chỉ hoạt động khi `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=feature/groq-synthetic-pilot`, phiên cookie Google hợp lệ vai trò `teacher`, và `GROQ_API_KEY` có trong Vercel Preview.
- GET chỉ xem trạng thái, **không gọi Groq**. POST yêu cầu chính xác hai cờ `syntheticOnly` và `confirmOneCall`, kiểm tra cùng origin/JSON và không cho gửi văn bản tùy ý.
- Một lần nhấn tạo tối đa một yêu cầu AI. Chặn nhấn lặp trong bộ nhớ từng Vercel Function instance tối thiểu 60 giây; **đây không phải quota bền vững toàn cục**, nên chỉ dùng thử nội bộ, không dùng cho học sinh.
- API key luôn ở máy chủ; không in vào HTML/JS/log. Không tự gọi lại, không chuyển sang dịch vụ có phí. Model: `openai/gpt-oss-20b` với JSON Schema strict.

## Cấu hình Vercel
1. Mở Project → Settings → Environment Variables.
2. Kiểm tra `GROQ_API_KEY` đã có giá trị và chỉ áp dụng **Preview**, ưu tiên giới hạn nhánh `feature/groq-synthetic-pilot`. Tuyệt đối không dán key lên GitHub hoặc trò chuyện.
3. Kiểm tra `GOOGLE_CLIENT_ID` và `SPEAKLAB_SESSION_SECRET` cũng hoạt động trên Preview. **Đăng nhập Google trên chính tên miền Preview**; nếu Google báo `origin_mismatch`, thêm origin Preview đúng như URL vào Google Cloud OAuth Client.
4. Để tài khoản được nhận là `teacher`, `GOOGLE_DRIVE_OWNER_EMAIL` trên Preview phải đúng email Google của người vận hành. Đây chỉ là nhãn vai trò, không tự bật tính năng Drive.
5. Nếu API báo nhánh không hợp lệ, mở Vercel Settings → Environment Variables → **Automatically expose System Environment Variables**, bật để có `VERCEL_GIT_COMMIT_REF` và `VERCEL_ENV`. Bật/tạo biến môi trường mới cần một deployment mới để có hiệu lực.
6. Đợi Vercel Preview của commit mới báo Ready. Vào `https://speak-lab-ai-git-feature-groq-synthetic-pilot-speak-lab.vercel.app/` rồi đăng nhập Google, sau đó mở `/groq-pilot.html` trên **cùng tên miền**.
7. Nếu trạng thái **Sẵn sàng**, bấm đúng một lần **Chạy thử Groq với dữ liệu giả lập**. Phản hồi được hiển thị kèm 5 tiêu chí và trích dẫn (chỉ khi bộ kiểm chứng của script đã chấp nhận).
8. Nếu báo 401: đăng nhập Google cùng hostname; 403: kiểm tra chủ tài khoản `GOOGLE_DRIVE_OWNER_EMAIL` và origin; 503: kiểm tra `GROQ_API_KEY` và deployment; 429: dừng, không thử liên tục; 502: mô hình trả thiếu bằng chứng hoặc API gặp lỗi, không sử dụng kết quả.

## Kiểm thử tự động
GitHub Actions chạy `node --test tests/groqSyntheticPilot.test.js` và `node --test tests/groqVercelPilotRoute.test.js`, **không dùng API key thật**; kiểm tra chặn môi trường Production, chặn guest/learner, xác nhận nguồn giả lập, CSRF và fail-closed.

## Kiểm thử chất lượng bằng tay
- [ ] Vercel Preview Ready, không lộ key trong response/DevTools.
- [ ] Khi chưa đăng nhập, endpoint trả 401.
- [ ] Chỉ tài khoản người vận hành có vai trò giáo viên được bật nút.
- [ ] JSON có đúng 5 tiêu chí R1–R5.
- [ ] Mọi trích dẫn đúng nguồn TXT hoặc slide mẫu, không bịa phát biểu.
- [ ] Viết tiếng Việt có dấu, không tự bịa điểm hay lời nhận xét hội đồng.
- [ ] Không có dữ liệu của người học thật đi đến Groq.

## Điều kiện mở cho học sinh THCS sau này
**Chưa đủ điều kiện triển khai**: phải thiết kế quyền/đồng thuận của phụ huynh và người học theo trường hợp pháp luật yêu cầu; kiểm chứng hợp đồng, lưu giữ dữ liệu, điều khoản xử lý trẻ em; xây dựng gateway quota bền vững, kiểm quyền phía máy chủ theo buổi luyện và đánh giá chất lượng với giáo viên. Phân nhóm localStorage hiện tại chưa phải ranh giới bảo mật. Chỉ khi hoàn tất các điều kiện mới xem xét kết nối AI với dữ liệu thực.

Nguồn kỹ thuật:
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/legal/services-agreement
- https://console.groq.com/docs/legal/customer-data-processing-addendum
- https://vercel.com/docs/environment-variables/system-environment-variables
