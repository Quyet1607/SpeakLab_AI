/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserProfile,
  PracticeMode,
  VirtualParticipant,
  PresentationDeck,
  PracticeSession,
  EvaluationReport,
  PracticeModeType
} from '../types';

export const mockPracticeModes: PracticeMode[] = [
  {
    id: 'basic',
    title: 'Luyện thuyết trình cơ bản',
    tagline: 'Rèn luyện phong thái, nhịp nói và kiểm soát thời gian',
    description: 'Phòng luyện tập tự do với thính giả mô phỏng lắng nghe thân thiện. Thích hợp chuẩn bị bài nói trước lớp hoặc thuyết trình nhóm.',
    defaultDurationMinutes: 10,
    juryCount: 1,
    audienceCount: 5,
    difficulty: 'Cơ bản',
    highlightFeatures: [
      'Thính giả mô phỏng chăm chú lắng nghe',
      'Đo lường tốc độ nói và kiểm soát thời lượng',
      'Nhắc nhở nhẹ nhàng khi chuyển slide',
    ],
  },
  {
    id: 'defense',
    title: 'Luyện bảo vệ trước ban giám khảo',
    tagline: 'Mô phỏng hội đồng thẩm định đồ án và nghiên cứu khoa học',
    description: 'Hội đồng giám khảo mô phỏng gồm các chuyên gia phản biện. Giám khảo sẽ chú ý ghi chép tính logic, phương pháp và tính thuyết phục của luận điểm.',
    defaultDurationMinutes: 12,
    juryCount: 3,
    audienceCount: 3,
    difficulty: 'Nâng cao',
    highlightFeatures: [
      'Hội đồng giám khảo ghi chép phản biện chuyên sâu',
      'Phát hiện lỗ hổng lập luận và số liệu',
      'Đánh giá phong thái tự tin và khả năng tương tác mắt',
    ],
  },
  {
    id: 'debate',
    title: 'Luyện phản biện & xử lý tình huống',
    tagline: 'Tập phản xạ trước câu hỏi hóc búa và áp lực phòng họp',
    description: 'Các tình huống mô phỏng thính giả ngắt lời, đặt câu hỏi xoáy sâu vào số liệu, yêu cầu bạn giữ bình tĩnh và lập luận phản bác sắc bén.',
    defaultDurationMinutes: 10,
    juryCount: 2,
    audienceCount: 4,
    difficulty: 'Chuyên sâu',
    highlightFeatures: [
      'Tình huống chất vấn ngẫu nhiên mô phỏng',
      'Đánh giá phản xạ ngôn ngữ và độ trôi chảy khi chịu áp lực',
      'Phân tích khoảng ngập ngừng và tần suất từ đệm',
    ],
  },
];

export const mockPresentationDecks: PresentationDeck[] = [
  {
    id: 'deck_ai_waste',
    title: 'Dự án: Trí tuệ Nhân tạo trong Phân loại Rác Học đường',
    category: 'Khoa học Kỹ thuật',
    description: 'Báo cáo giải pháp phân loại rác tự động tích hợp Camera thị giác máy tính tại trường THPT.',
    slides: [
      {
        id: 's1',
        slideNumber: 1,
        title: 'Trí tuệ Nhân tạo trong Phân loại Rác Học đường',
        subtitle: 'Đề tài Nghiên cứu Khoa học Kỹ thuật Cấp Trường 2026',
        contentPoints: [
          'Học sinh thực hiện: Nguyễn Minh Quân - Lớp 11A1',
          'Giáo viên hướng dẫn: ThS. Lê Văn Dũng',
          'Mục tiêu: Giảm thiểu 65% rác lẫn tạp chất tại căng-tin trường học',
        ],
        keyHighlight: 'Dự án hướng đến mô hình học đường xanh và tự động hóa',
        speakerNotes: 'Kính chào thầy cô trong hội đồng và các bạn. Hôm nay em xin phép trình bày dự án ứng dụng Computer Vision để phân loại rác thông minh ngay tại điểm xả rác.',
        visualGraphicType: 'chart',
      },
      {
        id: 's2',
        slideNumber: 2,
        title: '1. Đặt vấn đề & Thực trạng tại các trường THPT',
        subtitle: 'Khoảng 70% học sinh chưa phân loại rác đúng thùng quy định',
        contentPoints: [
          'Khảo sát 450 học sinh: 82% nhận thức được tầm quan trọng nhưng hay nhầm lẫn',
          'Thùng rác hữu cơ thường xuyên bị lẫn nhựa và túi nilon',
          'Chi phí xử lý thứ cấp tại trường học tốn kém nhân lực',
        ],
        keyHighlight: 'Vấn đề cốt lõi: Thiếu công cụ hỗ trợ phân loại tức thì tại chỗ',
        speakerNotes: 'Nhìn vào số liệu khảo sát, chúng ta thấy một nghịch lý: học sinh có ý thức cao nhưng thiếu thói quen và sự trợ giúp trực quan ngay khi vứt rác.',
        visualGraphicType: 'process',
      },
      {
        id: 's3',
        slideNumber: 3,
        title: '2. Giải pháp kỹ thuật: SmartBin AI Box',
        subtitle: 'Mô hình nhận diện vật thể nhẹ chạy trên thiết bị biên nhúng',
        contentPoints: [
          'Camera góc rộng nhận diện vật phẩm trong vòng 350 miligiây',
          'Độ chính xác phân loại đạt 94.2% trên 1.200 mẫu ảnh rác phổ biến',
          'Cửa lật tự động mở đúng ngăn: Hữu cơ - Nhựa tái chế - Rác vô cơ khác',
        ],
        keyHighlight: 'Chi phí linh kiện dưới 850.000 VNĐ cho mỗi modul tích hợp',
        speakerNotes: 'Em đã tối ưu hóa mô hình MobileNetV3 để chạy mượt mà trên phần cứng chi phí thấp, hoàn toàn khả thi nhân rộng ra 30 lớp học.',
        visualGraphicType: 'comparison',
      },
      {
        id: 's4',
        slideNumber: 4,
        title: '3. Kết quả thử nghiệm thực tế trong 4 tuần',
        subtitle: 'Thử nghiệm tại Căng-tin tầng 1 THPT Chuyên',
        contentPoints: [
          'Thu gom và phân loại chính xác hơn 3.400 lượt xả rác',
          'Tỷ lệ tạp chất lẫn trong rác hữu cơ giảm từ 38% xuống còn 6.5%',
          'Học sinh hào hứng tương tác qua màn hình LED hướng dẫn vui nhộn',
        ],
        keyHighlight: 'Giảm 75% thời gian dọn dẹp hàng ngày của nhân viên vệ sinh',
        speakerNotes: 'Sau 4 tuần thử nghiệm, hiệu quả thực tế đã chứng minh công nghệ AI có thể thay đổi hành vi xả rác của học sinh một cách rất tự nhiên.',
        visualGraphicType: 'chart',
      },
      {
        id: 's5',
        slideNumber: 5,
        title: '4. Kết luận & Hướng phát triển tiếp theo',
        subtitle: 'Kế hoạch mở rộng và kết nối dữ liệu bảo vệ môi trường',
        contentPoints: [
          'Bổ sung cảm biến đo độ ẩm và dung lượng đầy thùng rác',
          'Xây dựng bảng xếp hạng thi đua "Lớp học Xanh" qua ứng dụng',
          'Đăng ký sáng chế giải pháp hữu ích cấp địa phương',
        ],
        keyHighlight: 'Em xin trân trọng cảm ơn hội đồng và sẵn sàng nhận phản biện!',
        speakerNotes: 'Em xin chân thành cảm ơn thầy cô ban giám khảo đã lắng nghe. Em rất mong nhận được những góp ý quý báu để hoàn thiện đề tài.',
        visualGraphicType: 'conclusion',
      },
    ],
  },
  {
    id: 'deck_bioplastic',
    title: 'Khởi nghiệp Xanh: Bao bì Sinh học từ Vỏ Trấu',
    category: 'Môi trường & Khởi nghiệp',
    description: 'Kế hoạch kinh doanh sản phẩm đóng gói thân thiện môi trường từ phụ phẩm nông nghiệp.',
    slides: [
      {
        id: 'bp1',
        slideNumber: 1,
        title: 'Bao bì Sinh học EcoHusk từ Vỏ Trấu',
        subtitle: 'Dự án Khởi nghiệp Học sinh - Sinh viên 2026',
        contentPoints: [
          'Giải pháp thay thế hộp xốp dùng một lần tại chuỗi F&B',
          '100% phân hủy tự nhiên trong 60 ngày',
          'Tận dụng nguồn nguyên liệu nông nghiệp dồi dào',
        ],
        speakerNotes: 'Xin chào mọi người. Hôm nay tôi mang đến một giải pháp biến hàng triệu tấn vỏ trấu bỏ đi thành bao bì xanh.',
        visualGraphicType: 'conclusion',
      },
      {
        id: 'bp2',
        slideNumber: 2,
        title: 'Tiềm năng thị trường & Lợi thế cạnh tranh',
        subtitle: 'Nhu cầu chuyển dịch sang vật liệu bao bì bền vững',
        contentPoints: [
          'Quy mô thị trường bao bì F&B tại Việt Nam tăng trưởng 14%/năm',
          'Giá thành cạnh tranh hơn 25% so với sản phẩm bã mía nhập khẩu',
          'Độ bền nhiệt lên tới 120 độ C, an toàn với lò vi sóng',
        ],
        speakerNotes: 'Lợi thế lớn nhất của EcoHusk là nguồn nguyên liệu tại chỗ rẻ và quy trình ép nhiệt thân thiện không dùng hóa chất độc hại.',
        visualGraphicType: 'comparison',
      },
      {
        id: 'bp3',
        slideNumber: 3,
        title: 'Chiến lược phân phối & Hướng đi tương lai',
        subtitle: 'Hợp tác cùng 12 chuỗi cà phê và đồ ăn nhanh học đường',
        contentPoints: [
          'Phân phối ban đầu qua mạng lưới trường học và căng-tin',
          'Chứng nhận an toàn thực phẩm theo tiêu chuẩn quốc gia',
          'Tái đầu tư 15% lợi nhuận vào quỹ phát triển mầm xanh',
        ],
        speakerNotes: 'Mục tiêu của chúng tôi không chỉ là bán sản phẩm mà là kiến tạo phong cách tiêu dùng xanh cho thế hệ trẻ.',
        visualGraphicType: 'chart',
      },
    ],
  },
];

// Unified participant pool (15 unique persons)
export const fullParticipantPool: VirtualParticipant[] = [
  // Judges (5 members)
  {
    id: 'p_judge_1',
    name: 'TS. Trần Hoàng Minh',
    role: 'judge',
    title: 'Trưởng ban Giám khảo · ĐH Khoa học Tự nhiên',
    avatarInitials: 'TM',
    avatarBg: '#5A7D65',
    status: 'analyzing',
    statusText: 'Đang theo dõi số liệu và phương pháp',
    isMuted: true,
    isSpeaking: false,
    feedbackNote: 'Luận điểm phần mở đầu rõ ràng. Chú ý làm rõ chi phí linh kiện phần cứng.',
  },
  {
    id: 'p_judge_2',
    name: 'ThS. Lê Thu Hà',
    role: 'judge',
    title: 'Giám khảo Chuyên môn · Cố vấn Kỹ năng Nói',
    avatarInitials: 'TH',
    avatarBg: '#4A6D56',
    status: 'taking_notes',
    statusText: 'Đang ghi chép nhịp điệu & phong thái',
    isMuted: true,
    isSpeaking: false,
    feedbackNote: 'Tốc độ nói ban đầu rất vừa phải. Giữ vững giao tiếp mắt với hội đồng.',
  },
  {
    id: 'p_judge_3',
    name: 'ThS. Nguyễn Quốc Bảo',
    role: 'judge',
    title: 'Giám khảo Công nghệ · Viện Đổi mới Sáng tạo',
    avatarInitials: 'QB',
    avatarBg: '#6E8F7A',
    status: 'preparing_question',
    statusText: 'Chuẩn bị câu hỏi phản biện về thuật toán',
    isMuted: true,
    isSpeaking: false,
    feedbackNote: 'Cần giải thích thêm cơ chế chống nghẽn ảnh khi học sinh vứt rác dồn dập.',
  },
  {
    id: 'p_judge_4',
    name: 'PGS.TS. Đặng Thanh Tùng',
    role: 'judge',
    title: 'Giám khảo Phương pháp · Viện Khoa học Giáo dục',
    avatarInitials: 'TT',
    avatarBg: '#3F5E49',
    status: 'analyzing',
    statusText: 'Đánh giá tính ứng dụng đề tài',
    isMuted: true,
    isSpeaking: false,
    feedbackNote: 'Phương pháp chọn mẫu khảo sát học sinh căng-tin khá tin cậy.',
  },
  {
    id: 'p_judge_5',
    name: 'ThS. Hoàng Mai Chi',
    role: 'judge',
    title: 'Giám khảo Kỹ năng · HLV Tranh biện Trẻ',
    avatarInitials: 'MC',
    avatarBg: '#52755E',
    status: 'agreeing',
    statusText: 'Gật đầu đồng tình với luận điểm',
    isMuted: true,
    isSpeaking: false,
    feedbackNote: 'Tư thế đứng thẳng, ánh mắt bao quát tốt.',
  },

  // Audience (10 members)
  {
    id: 'p_aud_1',
    name: 'Phạm Hải Đăng',
    role: 'audience',
    title: 'Thính giả Học sinh · Đại diện CLB STEM',
    avatarInitials: 'HĐ',
    avatarBg: '#7A9A85',
    status: 'listening',
    statusText: 'Chăm chú lắng nghe phần kết quả',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_2',
    name: 'Vũ Ngọc Khánh Ly',
    role: 'audience',
    title: 'Thính giả Học sinh · Lớp 11 Văn',
    avatarInitials: 'KL',
    avatarBg: '#668772',
    status: 'agreeing',
    statusText: 'Gật đầu đồng tình với dẫn chứng',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_3',
    name: 'Đoàn Thanh niên Trường',
    role: 'audience',
    title: 'Đại biểu Giám sát Ngoại khóa',
    avatarInitials: 'ĐT',
    avatarBg: '#557560',
    status: 'listening',
    statusText: 'Theo dõi tiến độ buổi bảo vệ',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_4',
    name: 'Bùi Quang Huy',
    role: 'audience',
    title: 'Thính giả Học sinh · Lớp 10 Tin',
    avatarInitials: 'QH',
    avatarBg: '#5E806B',
    status: 'taking_notes',
    statusText: 'Ghi chú thuật toán MobileNet',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_5',
    name: 'Đỗ Minh Châu',
    role: 'audience',
    title: 'Thành viên CLB Môi trường Xanh',
    avatarInitials: 'MC',
    avatarBg: '#4E7059',
    status: 'listening',
    statusText: 'Quan tâm giải pháp rác hữu cơ',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_6',
    name: 'Trần Đức Anh',
    role: 'audience',
    title: 'Học sinh Khối 12 · Ban Tự nhiên',
    avatarInitials: 'ĐA',
    avatarBg: '#72937E',
    status: 'listening',
    statusText: 'Lắng nghe phần chi phí chế tạo',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_7',
    name: 'Lê Hoàng Yến',
    role: 'audience',
    title: 'Ban Truyền thông Đoàn trường',
    avatarInitials: 'HY',
    avatarBg: '#62836E',
    status: 'agreeing',
    statusText: 'Ghi hình tư liệu buổi bảo vệ',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_8',
    name: 'Nguyễn Hữu Nam',
    role: 'audience',
    title: 'CLB Nghiên cứu Khoa học Trẻ',
    avatarInitials: 'HN',
    avatarBg: '#577863',
    status: 'taking_notes',
    statusText: 'Ghi chú số liệu 3.400 lượt xả rác',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_9',
    name: 'Mai Thảo Linh',
    role: 'audience',
    title: 'Đại biểu Học sinh Tiêu biểu Khối 11',
    avatarInitials: 'TL',
    avatarBg: '#688974',
    status: 'listening',
    statusText: 'Theo dõi bài thuyết trình',
    isMuted: true,
    isSpeaking: false,
  },
  {
    id: 'p_aud_10',
    name: 'Trịnh Văn An',
    role: 'audience',
    title: 'Thính giả Quan sát viên Học đường',
    avatarInitials: 'VA',
    avatarBg: '#4A6955',
    status: 'listening',
    statusText: 'Chăm chú lắng nghe',
    isMuted: true,
    isSpeaking: false,
  },
];

/**
 * Generator function providing EXACT number of participants requested
 * with realistic allocation of judges vs audience based on mode.
 */
export function generateVirtualParticipants(count: number, mode: PracticeModeType): VirtualParticipant[] {
  const judgesPool = fullParticipantPool.filter((p) => p.role === 'judge');
  const audiencePool = fullParticipantPool.filter((p) => p.role === 'audience');

  let targetJudgeCount = 1;
  if (mode === 'defense') {
    if (count <= 3) targetJudgeCount = 2;
    else if (count <= 6) targetJudgeCount = 3;
    else if (count <= 10) targetJudgeCount = 4;
    else targetJudgeCount = 5;
  } else if (mode === 'debate') {
    if (count <= 3) targetJudgeCount = 1;
    else if (count <= 6) targetJudgeCount = 2;
    else if (count <= 10) targetJudgeCount = 3;
    else targetJudgeCount = 4;
  } else {
    // basic mode
    if (count <= 3) targetJudgeCount = 1;
    else if (count <= 6) targetJudgeCount = 1;
    else targetJudgeCount = 2;
  }

  // Ensure judge count does not exceed count - 1 (leave at least 1 audience if count > 1)
  targetJudgeCount = Math.min(targetJudgeCount, Math.max(1, count - 1));
  targetJudgeCount = Math.min(targetJudgeCount, judgesPool.length);

  const targetAudienceCount = count - targetJudgeCount;

  const selectedJudges = judgesPool.slice(0, targetJudgeCount);
  const selectedAudience = audiencePool.slice(0, targetAudienceCount);

  return [...selectedJudges, ...selectedAudience];
}

// 6 unified practice sessions
export const mockPracticeSessions: PracticeSession[] = [
  {
    id: 'ses_01',
    title: 'Bảo vệ Đề tài: Phân loại Rác Thông minh bằng AI',
    mode: 'defense',
    modeTitle: 'Luyện bảo vệ trước ban giám khảo',
    topic: 'Khoa học Kỹ thuật',
    durationSeconds: 745, // 12m25s
    slideCount: 5,
    participantCount: 6,
    createdAt: '10:15 - 10/11/2026',
    status: 'completed',
    score: 8.8,
    reportId: 'rep_01',
  },
  {
    id: 'ses_02',
    title: 'Thử giọng: Kỹ năng Tranh biện Tự do trước đám đông',
    mode: 'debate',
    modeTitle: 'Luyện phản biện & xử lý tình huống',
    topic: 'Kỹ năng mềm',
    durationSeconds: 580, // 9m40s
    slideCount: 4,
    participantCount: 6,
    createdAt: '15:30 - 08/11/2026',
    status: 'completed',
    score: 7.9,
    reportId: 'rep_02',
  },
  {
    id: 'ses_03',
    title: 'Giới thiệu Dự án Khởi nghiệp Bao bì EcoHusk',
    mode: 'basic',
    modeTitle: 'Luyện thuyết trình cơ bản',
    topic: 'Môi trường',
    durationSeconds: 720, // 12m00s
    slideCount: 3,
    participantCount: 6,
    createdAt: '09:00 - 05/11/2026',
    status: 'completed',
    score: 8.4,
    reportId: 'rep_03',
  },
  {
    id: 'ses_04',
    title: 'Bài nói Lịch sử: Cuộc cách mạng Công nghiệp lần 4',
    mode: 'basic',
    modeTitle: 'Luyện thuyết trình cơ bản',
    topic: 'Lịch sử & Xã hội',
    durationSeconds: 840, // 14m00s
    slideCount: 5,
    participantCount: 3,
    createdAt: '14:20 - 01/11/2026',
    status: 'completed',
    score: 8.0,
    reportId: 'rep_04',
  },
  {
    id: 'ses_05',
    title: 'Bảo vệ Đề án Xã hội: Văn hóa Ứng xử Học đường',
    mode: 'defense',
    modeTitle: 'Luyện bảo vệ trước ban giám khảo',
    topic: 'Khoa học Xã hội',
    durationSeconds: 660, // 11m00s
    slideCount: 5,
    participantCount: 6,
    createdAt: '16:00 - 28/10/2026',
    status: 'completed',
    score: 8.2,
    reportId: 'rep_05',
  },
  {
    id: 'ses_06',
    title: 'Thuyết trình Chuyên đề Sinh học: Rừng ngập mặn Cần Giờ',
    mode: 'basic',
    modeTitle: 'Luyện thuyết trình cơ bản',
    topic: 'Sinh thái học',
    durationSeconds: 775, // 12m55s
    slideCount: 4,
    participantCount: 3,
    createdAt: '08:45 - 24/10/2026',
    status: 'completed',
    score: 8.5,
    reportId: 'rep_06',
  },
];

// Calculate exact mathematical stats from sessions:
// Total duration = 745 + 580 + 720 + 840 + 660 + 775 = 4320s = 72 minutes (1.2 giờ)
// Average = 72 / 6 = 12 phút / buổi
export const mockCurrentUser: UserProfile = {
  id: 'usr_01',
  fullName: 'Nguyễn Minh Quân',
  roleDescription: 'Học sinh Lớp 11A1 - Ban Tự nhiên',
  school: 'Trường THPT Chuyên Khoa học Tự nhiên',
  grade: 'Khối 11',
  avatarInitials: 'MQ',
  stats: {
    totalSessions: mockPracticeSessions.length, // 6
    totalPracticeMinutes: 72,                   // 1.2 giờ
    avgMinutesPerSession: 12,                   // 12 phút / buổi
    totalReports: mockPracticeSessions.filter((s) => !!s.reportId).length, // 6
    improvementPercentage: 32,                 // +32% (Chỉ số minh họa)
  },
};

export const mockDefaultReport: EvaluationReport = {
  id: 'rep_01',
  sessionId: 'ses_01',
  sessionTitle: 'Bảo vệ Đề tài: Phân loại Rác Thông minh bằng AI',
  modeTitle: 'Luyện bảo vệ trước ban giám khảo',
  dateFormatted: '10/11/2026 · 10:15',
  durationFormatted: '12 phút 25 giây',
  overallScore: 8.8,
  metrics: {
    speechPaceWpm: 128,         // Optimal is 120-140 WPM
    fillerWordsCount: 7,        // e.g., "à", "ừm"
    eyeContactPercentage: 84,   // 84%
    clarityScore: 9.0,
    structureScore: 8.7,
    defenseScore: 8.5,
  },
  speechPaceTrend: [
    { time: '02:00', wpm: 120, status: 'good' },
    { time: '04:00', wpm: 148, status: 'fast' },
    { time: '06:00', wpm: 125, status: 'good' },
    { time: '08:00', wpm: 118, status: 'good' },
    { time: '10:00', wpm: 135, status: 'good' },
    { time: '12:00', wpm: 122, status: 'good' },
  ],
  fillerWordBreakdown: [
    { word: 'à / à thì', count: 3 },
    { word: 'ừm', count: 2 },
    { word: 'như vậy là', count: 2 },
  ],
  timelineEvents: [
    {
      timeInSeconds: 75,
      timeFormatted: '01:15',
      type: 'positive',
      title: 'Mở đầu ấn tượng & rõ ràng',
      description: 'Giọng nói tự tin, giới thiệu mục tiêu dự án mạch lạc, tạo được chú ý cho hội đồng.',
      slideNumber: 1,
    },
    {
      timeInSeconds: 230,
      timeFormatted: '03:50',
      type: 'warning',
      title: 'Tốc độ nói tăng nhanh (148 từ/phút)',
      description: 'Khi trình bày số liệu khảo sát, bạn nói hơi vội và xuất hiện 2 từ đệm "ừm". Nên dừng 1-2 giây sau khi đưa ra số liệu.',
      slideNumber: 2,
    },
    {
      timeInSeconds: 410,
      timeFormatted: '06:50',
      type: 'positive',
      title: 'Giải thích kỹ thuật sống động',
      description: 'Mô tả nguyên lý camera thị giác máy tính rõ ràng, dùng ví dụ trực quan dễ hiểu.',
      slideNumber: 3,
    },
    {
      timeInSeconds: 580,
      timeFormatted: '09:40',
      type: 'question',
      title: 'Giám khảo đặt câu hỏi phản biện',
      description: 'TS. Trần Hoàng Minh hỏi về khả năng chống nước và độ bền cơ học khi đặt ngoài trời.',
      slideNumber: 4,
    },
    {
      timeInSeconds: 670,
      timeFormatted: '11:10',
      type: 'positive',
      title: 'Phản hồi bình tĩnh & có số liệu',
      description: 'Trích dẫn thử nghiệm 4 tuần tại căng-tin để bảo vệ tính khả thi rất thuyết phục.',
      slideNumber: 5,
    },
  ],
  strengths: [
    'Phong thái tự tin, duy trì hướng nhìn vào hội đồng đạt 84% thời lượng.',
    'Bố cục slide cân đối, chuyển tiếp giữa các ý tự nhiên và logic.',
    'Xử lý câu hỏi phản biện của giám khảo điềm tĩnh, bám sát số liệu thực tế.',
    'Tốc độ nói trung bình 128 từ/phút - thuộc khoảng lý tưởng cho bài thuyết trình học thuật.',
  ],
  improvements: [
    'Chú ý kiểm soát nhịp thở ở phút thứ 3-4 khi bắt đầu trình bày bảng số liệu khảo sát.',
    'Cần hạn chế thói quen nói "à thì" khi suy nghĩ trước câu trả lời phản biện.',
    'Có thể tăng cường ngôn ngữ cơ thể (cử chỉ tay mở) khi nhấn mạnh thông điệp then chốt ở slide kết luận.',
  ],
  juryFeedback: [
    {
      judgeName: 'TS. Trần Hoàng Minh',
      judgeTitle: 'Trưởng ban Giám khảo · ĐH Khoa học Tự nhiên',
      comment: 'Đề tài có tính ứng dụng thực tế rất cao. Em nắm chắc phần cứng và số liệu thử nghiệm. Khả năng bảo vệ trước câu hỏi chất vấn vượt mong đợi so với lứa tuổi THPT.',
      score: 9.0,
    },
    {
      judgeName: 'ThS. Lê Thu Hà',
      judgeTitle: 'Giám khảo Kỹ năng Tranh biện & Thuyết trình',
      comment: 'Giọng nói truyền cảm, âm lượng tốt. Nếu em biết chèn các khoảng lặng có chủ đích sau mỗi kết luận quan trọng, bài nói sẽ càng cuốn hút hơn nữa.',
      score: 8.8,
    },
    {
      judgeName: 'ThS. Nguyễn Quốc Bảo',
      judgeTitle: 'Giám khảo Đổi mới Sáng tạo',
      comment: 'Slide trình bày thẩm mỹ và không bị nhồi nhét chữ. Phần trả lời về thuật toán MobileNetV3 tương đối chắc chắn.',
      score: 8.5,
    },
  ],
};
