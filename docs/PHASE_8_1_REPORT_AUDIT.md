# Giai đoạn 8 · Bước 8.1 — Kiểm kê Báo cáo đánh giá

Ngày rà soát: 15/11/2026  
Nhánh làm việc: `feature/evaluation-report-8-1` (tạo từ `main` sau merge PR #1)

## Phạm vi và kết luận
Đây là kiểm kê **mã nguồn**, chưa thay đổi UI, thuật toán chấm điểm hoặc dữ liệu người dùng. Trang Báo cáo đánh giá chi tiết hiện **là Demo**, không phải kết quả đánh giá tự động từ buổi luyện.

## Bằng chứng từ mã nguồn
| Thành phần | Hiện trạng | Vấn đề / hành động giai đoạn sau |
| --- | --- | --- |
| `src/services/reportService.ts` | Chứa Map khởi tạo chỉ có `rep_01`; `getReportById` trả `mockDefaultReport` cả khi không thấy ID, `getLatestReport` cũng trả báo cáo mẫu | **Nguy cơ hiển thị báo cáo của buổi giả cho ID khác**. Cần trả `null`/trạng thái chưa có báo cáo thay vì thay thế bằng dữ liệu mẫu |
| `src/data/mockData.ts` | Có `mockDefaultReport` với điểm tổng 8.8, nhịp nói, giao tiếp mắt, từ đệm, timeline, nhận xét hội đồng; các buổi mẫu có `reportId` | Dữ liệu minh họa tuyệt đối không được coi là điểm thực |
| `src/App.tsx` | `selectedReportId` mặc định `rep_01`; chọn buổi không có `reportId` lại dùng `rep_01` và truyền `reportService.getReportById` cho `ReportPage` | Cần liên kết báo cáo **theo sessionId và nhóm dữ liệu khách/Google**, không dùng fallback `rep_01` |
| `src/pages/ReportPage.tsx` | Có `DemoNotice`, video chỉ là khung mô phỏng, đồng hồ mặc định 01:15; tổng thời lượng hardcode `12:25` và mẫu số `745`; nút PDF chỉ bật thông báo | Thay thế bằng video thật/empty state; timeline chỉ có khi có mốc hợp lệ; nút PDF phải có chức năng thật hoặc không hiển thị |
| `src/pages/HistoryPage.tsx` | Điểm hiển thị có nhãn Demo; chỉ có nút xem báo cáo nếu `session.reportId` | Báo cáo thực cần được tạo/lưu rồi đọc lại từ lịch sử, không bịa điểm khi chưa đánh giá |
| `src/pages/DashboardPage.tsx` | Hiện chỉ số báo cáo; ghi rõ chưa có báo cáo tự động từ dữ liệu thực | Tổng báo cáo và tiến bộ phải lấy từ bản đánh giá đã lưu; chưa có dữ liệu phải hiển thị — |
| `src/features/history/AiSpeechReviewPanel.tsx` | Có nhận xét Gemini dựa trên TXT/PPTX, lưu cục bộ theo `sessionId` và `ownerSub` | Đây là **nhận xét nội dung tùy chọn** riêng, không phải báo cáo có rubric tổng hợp; Gemini Preview-only, Production khóa |
| `src/services/localPracticeHistory.ts` | Lưu metadata buổi luyện và các đoạn lời nói thực trên trình duyệt; hỗ trợ `guest` và Google | Có thể dùng tiêu đề, thời lượng, mode, mốc transcript; không suy diễn chất lượng âm thanh hay hình ảnh |
| `src/services/localVideoLibrary.ts` | Lưu video bằng IndexedDB, phân nhóm guest/Google chỉ ở tầng giao diện | Phát lại phải lấy video đúng buổi và đúng nhóm; không được tự động tải lên đám mây |

## Dữ liệu đủ điều kiện sử dụng ngay
- **Quan sát trực tiếp:** tiêu đề và thời gian buổi luyện, thời lượng đã lưu, chế độ, số lượng slide theo metadata, lời nói dạng TXT (nếu được người dùng bật và lưu), các đoạn lời nói với mốc thời gian ước lượng, video cục bộ nếu còn.
- **Có điều kiện:** văn bản trích từ PPTX và nhận xét Gemini **đã lưu**, chỉ khi có dữ liệu tương ứng; trạng thái/nguồn nhận xét phải được ghi rõ.
- **Không có dữ liệu đánh giá hợp lệ trong mã hiện tại:** tỷ lệ giao tiếp mắt, chất lượng biểu cảm, tốc độ nói âm học, ngữ điệu/độ rõ tiếng nói, thời điểm thực sự trình chiếu từng slide, điểm phản biện của hội đồng, lời giám khảo, điểm tổng hợp mặc định.
- **Tốc độ chữ/phút:** chỉ có thể là ước lượng từ transcript và thời lượng/mốc nhận diện (nếu phương pháp được mô tả rõ), không tự động được gọi là tốc độ phát âm chính xác; không lấy ngưỡng Demo 120–140 như chuẩn áp dụng mặc định.

## Đề xuất triển khai sau bước 8.1
1. **8.2 — Chốt cấu trúc báo cáo và rubric:** tiêu chí, bằng chứng, trạng thái “chưa đủ dữ liệu/không đánh giá”, cách tính điểm có điều kiện; tách quan sát máy đo và ý kiến AI.
2. **8.3 — Dữ liệu báo cáo thực, có lưu cục bộ:** khóa theo `sessionId` + `ownerSub`; không lẫn khách/Google; không thay thế báo cáo thiếu bằng `mockDefaultReport`. Duy trì compatibility với lịch sử cũ.
3. **8.4 — UI báo cáo:** chỉ render số liệu có nguồn; phát video thật nếu hiện diện; không hiển thị phát biểu hội đồng như đã xảy ra nếu chúng là mô phỏng.
4. **8.5–8.6 — Lịch sử và xuất PDF:** chỉ đếm báo cáo thực, xuất báo cáo dựa trên dữ liệu lưu thật và chú thích giới hạn đánh giá.
5. **8.7 — Kiểm thử:** dữ liệu thiếu TXT/video/PPTX, chuyển Guest/Google, reload trình duyệt, không lẫn chủ sở hữu, giới hạn dung lượng, chống báo cáo giả; kiểm tra CI trước PR vào main.

## Nguyên tắc phát hành
- Không đưa điểm Demo hoặc nhận xét giám khảo mô phỏng vào kết quả có vẻ chính thức.
- Không yêu cầu dịch vụ AI trả phí; không tự động bật Gemini/Drive trên Production.
- Không tác động `main` trong bước rà soát này.
- **Điểm dừng:** sau 8.1, thống nhất rubric và phạm vi 8.2 trước khi sửa code chấm điểm hoặc giao diện.
