# SpeakLab AI — Groq Preview: Bước 3, một lượt tối ưu chất lượng tiếng Việt

**Nhánh:** `feature/groq-synthetic-pilot`. **Không gọi Groq live, không dùng thêm quota.**

## Vấn đề ghi nhận

Ảnh thử nghiệm thực tế trên Vercel với chủ đề **An toàn trực tuyến** cho thấy R1/R3/R5 đôi khi lặp lại mã nội bộ như `OPEN`, `LIMIT`, `SOLUTION_1`; một số đề xuất nói về kiểm tra dẫn chứng thay vì hướng dẫn học sinh cải thiện nội dung.

## Cách xử lý cuối cùng trong bước này

1. Các mã chứng cứ chỉ được Groq trả về dưới trường `evidenceIds` và được máy chủ dùng kiểm tra. Phần `quote` được dựng bằng đúng câu nguồn server (không kèm nhãn mã).
2. R1, R3, R5 với **bốn bài giả lập cố định** sử dụng phản hồi tiếng Việt được chuẩn bị và rà soát theo từng chủ đề; R2, R4 sử dụng diễn giải thận trọng đã định nghĩa sẵn. Điều này cố ý thay thế phần bình luận và gợi ý do Groq tạo trong bối cảnh pilot mẫu cố định, để ngăn câu chữ chung chung/lộ mã/khẳng định quá mức.
3. Prompt được cải thiện nhằm hạn chế sinh mã kỹ thuật và đưa ra lời khuyên bám chủ đề; phản hồi vẫn phải qua kiểm tra đúng 5 mục R1–R5, các evidenceIds được cấp phép và các tập bằng chứng bắt buộc. Không chấp nhận thêm nội dung người dùng.
4. Trường summary và limitations do Groq tạo tiếp tục được kiểm chứng về kích thước, mã nội bộ, nhận xét giọng/ánh mắt/thiết kế và điểm số. Nếu không hợp lệ, API trả lỗi an toàn, không retry.
5. Giữ nguyên đăng nhập teacher, chi nhánh Preview, Redis quota, model Free Tier pilot, không sửa `/api/ai/review` của Gemini.

## Kiểm thử offline

- `tests/groqVietnameseFeedbackStage3.test.js`: kiểm tra cả bốn bài không lộ mã trong comment/suggestion/quote; các ví dụ đề xuất đúng chủ đề; lời bình luận chung chung không được hiển thị; loại bỏ điểm số và lời nói vượt nguồn; quotes không do AI tự chế.
- `tests/groqMultiSamplePilot.test.js`: duy trì các hợp đồng dẫn chứng, allowlist mẫu, giới hạn dữ liệu, một lần gọi mock và JSON output.
- `.github/workflows/check-local-video-library.yml`: bổ sung test vào CI, kèm lint/build của ứng dụng.

## Giới hạn và điểm dừng

**Đây là phản hồi đã chuẩn hóa riêng cho 4 bài giả lập**, không phải bằng chứng AI nhận xét tự do được mọi bài khác. Việc thay nội dung model bằng bản soạn trước phải được công bố minh bạch: Groq tham gia vào quá trình chọn mã dẫn chứng và tạo phần summary/limitations sau kiểm chứng, nhưng bình luận R1–R5 hiển thị theo khuôn riêng đã duyệt. Bài giảm rác nhựa ban đầu sử dụng bộ xử lý khác, chưa được thay đổi trong bước này.

Chưa kiểm thử live 4 bài sau thay đổi; không yêu cầu người vận hành tiêu tốn thêm lượt Free Tier trong bước này. CI thành công chứng minh chất lượng *cấu trúc và dữ liệu giả lập trên mock*, không chứng minh Groq live, khả năng thay Gemini cho bài thật hoặc chất lượng thống kê.

Không merge `main`, không cập nhật Production, không thêm dữ liệu học sinh thật.
