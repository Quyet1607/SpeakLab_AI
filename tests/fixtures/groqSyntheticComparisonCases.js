/**
 * Curated, server-owned fictional speaking samples for offline Groq/Gemini
 * contract comparison. NOT wired to an HTTP route or AI provider.
 *
 * Each example is original, fictional and contains no student submission.
 * expectedChecks describe the evidence a reviewer must consider, NOT scores.
 */
export const SYNTHETIC_COMPARISON_CASES = Object.freeze([
  {
    id: 'water-conservation',
    label: 'Tiết kiệm nước',
    topic: 'Giảm lãng phí nước sinh hoạt',
    goal: 'Đề xuất hai cách tiết kiệm nước và nói rõ giới hạn bằng chứng',
    transcript: 'Hôm nay tôi trình bày về cách tiết kiệm nước. Cách thứ nhất là khóa vòi trong khi đánh răng. Cách thứ hai là dùng nước rửa rau để tưới cây phù hợp. Tôi chưa đo được lượng nước tiết kiệm từ hai cách này nên chưa thể kết luận hiệu quả. Xin cảm ơn.',
    slides: ['Tiết kiệm nước: Khóa vòi khi đánh răng', 'Tận dụng nước rửa rau để tưới cây'],
    expectedChecks: ['Hai giải pháp có trong bản nói', 'Không có số liệu đo lượng nước', 'Đối chiếu chữ ở hai slide, không nhận xét thiết kế'],
  },
  {
    id: 'reading-habit',
    label: 'Thói quen đọc sách',
    topic: 'Xây dựng thói quen đọc sách tại nhà',
    goal: 'Giải thích hai biện pháp hình thành thói quen đọc sách',
    transcript: 'Tôi sẽ nói về thói quen đọc sách. Biện pháp đầu tiên là dành mười lăm phút mỗi tối để đọc. Một biện pháp nữa là ghi lại câu hỏi sau khi đọc xong. Tôi chưa khảo sát được liệu hai cách này có cải thiện khả năng đọc hiểu. Xin kết thúc phần trình bày.',
    slides: ['Mỗi tối đọc mười lăm phút', 'Ghi câu hỏi sau khi đọc'],
    expectedChecks: ['Có hai biện pháp cụ thể', 'Không suy diễn rằng đọc hiểu đã được cải thiện', 'Bài chỉ có chữ để đối chiếu'],
  },
  {
    id: 'online-safety',
    label: 'An toàn trực tuyến',
    topic: 'Bảo vệ tài khoản khi sử dụng Internet',
    goal: 'Trình bày hai biện pháp phòng ngừa và tránh khẳng định quá mức',
    transcript: 'Tôi giới thiệu hai cách bảo vệ tài khoản. Trước hết nên đặt mật khẩu dài và không chia sẻ mật khẩu. Sau đó có thể bật xác thực hai bước khi dịch vụ hỗ trợ. Tôi chưa có khảo sát hay thí nghiệm để chứng minh mức giảm rủi ro. Cảm ơn người nghe.',
    slides: ['Mật khẩu dài, không chia sẻ', 'Bật xác thực hai bước khi có hỗ trợ'],
    expectedChecks: ['Đối chiếu cả hai biện pháp với slide', 'Không tự tạo tỷ lệ giảm rủi ro', 'Không suy đoán giọng nói hoặc ánh mắt'],
  },
  {
    id: 'school-garden',
    label: 'Vườn cây cộng đồng',
    topic: 'Chăm sóc vườn cây chung',
    goal: 'Nêu hai hành động cụ thể và giới hạn việc đánh giá hiệu quả',
    transcript: 'Hôm nay tôi nói về việc chăm sóc vườn cây chung. Nhóm có thể chia lịch tưới theo tuần. Ngoài ra chúng ta có thể thu gom lá khô để ủ phân đúng cách. Tôi chưa theo dõi sự phát triển của cây nên không biết hai cách này hiệu quả đến mức nào. Xin cảm ơn.',
    slides: ['Phân công lịch tưới cây', 'Ủ lá khô để chăm sóc đất'],
    expectedChecks: ['Nêu đủ hai hành động', 'Không bịa kết quả cây phát triển', 'Không nhận xét hình ảnh và bố cục slide'],
  },
]);
