import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiReviewResults, filterReviewSlides } from '../src/features/history/AiReviewResults.tsx';

const a = {
  point: 'Bài nói xác định được mục tiêu nghiên cứu.',
  evidenceId: 'E1',
  evidence: 'Hôm nay em trình bày về hệ thống cảnh báo sạt lở đất.',
};

const review = {
  summary: 'Bài thuyết trình nêu mục tiêu nghiên cứu về cảnh báo sạt lở đất.',
  strengths: [a, { point: 'Có giải pháp dùng camera.', evidenceId: 'E2', evidence: 'Mô hình dùng camera AI.' }],
  improvements: [
    { point: 'Thiếu ví dụ thực tế.', evidenceId: 'E3', evidence: 'Hệ thống phát hiện sạt lở.', action: 'Bổ sung ví dụ tình huống cảnh báo.' },
    { point: 'Cần làm rõ quy trình.', evidenceId: 'E4', evidence: 'Hệ thống sẽ gửi cảnh báo.', action: 'Nêu rõ từng bước xử lý tín hiệu.' },
  ],
  slideComparisons: [
    {
      slideNumber: 4, status: 'matched',
      point: 'Bài nói giải thích đúng mục tiêu giám sát.',
      slideQuote: 'Giám sát sạt lở đất', spokenQuote: 'giám sát sạt lở đất',
      evidenceId: 'E1', evidence: 'Giải pháp giám sát sạt lở đất',
      covered: 'Có đề cập mục tiêu theo dõi.',
      missing: 'Không có nội dung khác cần kiểm tra.',
      action: 'Giữ cách giải thích mục tiêu này.',
    },
    {
      slideNumber: 8, status: 'partial',
      point: 'Bài nói mô tả cảm biến nhưng chưa nêu cảnh báo.',
      slideQuote: 'Cảnh báo sớm bằng cảm biến',
      spokenQuote: 'dùng công nghệ cảm biến',
      evidenceId: 'E2', evidence: 'Chúng em dùng công nghệ cảm biến để theo dõi.',
      covered: 'Bản ghi có nhắc đến cảm biến.',
      missing: 'Chưa tìm thấy cơ chế phát cảnh báo.',
      action: 'Bổ sung một ví dụ kích hoạt cảnh báo.',
    },
    {
      slideNumber: 13, status: 'not_found',
      point: 'Chưa tìm thấy nội dung cài đặt Arduino trong bản ghi.',
      slideQuote: 'CÀI ĐẶT HỆ THỐNG',
      spokenQuote: '', evidenceId: '', evidence: '',
      covered: 'Chưa có dẫn chứng tương ứng trong ASR.',
      missing: 'Chưa tìm thấy thao tác chọn board Arduino.',
      action: 'Kiểm tra lại bản ghi hoặc diễn giải ngắn cách cấu hình.',
    },
  ],
  slideReviewStats: { target: 6, received: 4, accepted: 3, rejected: 1 },
  slideOverview: [
    { slideNumber: 4, slideExcerpt: 'Giám sát sạt lở đất', keywordSignal: 'shared_keywords', sharedKeywords: ['giam', 'sat'] },
    { slideNumber: 8, slideExcerpt: 'Cảnh báo sớm bằng cảm biến', keywordSignal: 'no_shared_keywords', sharedKeywords: [] },
    { slideNumber: 13, slideExcerpt: 'CÀI ĐẶT HỆ THỐNG', keywordSignal: 'insufficient_text', sharedKeywords: [] },
    { slideNumber: 18, slideExcerpt: 'Kết luận', keywordSignal: 'no_shared_keywords', sharedKeywords: [] },
  ],
  limitations: ['Chỉ đối chiếu chữ trong PowerPoint, không đánh giá hình ảnh.'],
  source: 'transcript_and_pptx',
  model: 'gemini-3.5-flash-lite',
};

const render = item => renderToStaticMarkup(React.createElement(AiReviewResults, { review: item }));

describe('Phase 7.3.3.3 AI report presentation', () => {
  test('shows summary, actionable improvements and expandable E evidence', () => {
    const html = render(review);
    expect(html).toContain('Nhận xét tổng quan');
    expect(html).toContain('Bài thuyết trình nêu mục tiêu nghiên cứu');
    expect(html).toContain('Điểm mạnh');
    expect(html).toContain('Điểm cần cải thiện');
    expect(html).toContain('Cách cải thiện');
    expect(html).toContain('Bổ sung ví dụ tình huống cảnh báo.');
    expect(html).toContain('Xem đoạn lời nói gốc · E1');
    expect(html).toContain('aria-label="Kết quả nhận xét AI"');
    expect(html).toContain('<details');
  });

  test('displays verbatim slide and ASR excerpts side by side and does not fabricate E for missing speech', () => {
    const html = render(review);
    expect(html).toContain('Slide 4');
    expect(html).toContain('Slide 8');
    expect(html).toContain('Slide 13');
    expect(html).toContain('Chữ trích từ PowerPoint');
    expect(html).toContain('“CÀI ĐẶT HỆ THỐNG”');
    expect(html).toContain('“dùng công nghệ cảm biến”');
    expect(html).toContain('Lời nói tương ứng · E2');
    expect(html).toContain('Chưa tìm thấy dẫn chứng lời nói tương ứng đủ căn cứ');
    expect(html).not.toContain('Lời nói tương ứng · E0');
    expect(html).toContain('Gợi ý cải thiện');
    expect(html).toContain('Đối chiếu bài nói và PowerPoint');
  });

  test('clearly distinguishes verified slides from lexical overview and reports partial results', () => {
    const html = render(review);
    expect(html).toContain('3</strong> mục đối chiếu có dẫn chứng hợp lệ');
    expect(html).toContain('4</strong> mục AI trả về');
    expect(html).toContain('1 mục bị loại');
    expect(html).toContain('Tổng');
    expect(html).toContain('Xem bảng dò từ khóa của 4 slide có chữ');
    expect(html).toContain('Chưa đối chiếu chi tiết');
    expect(html).toContain('Từ khóa trùng');
    expect(html).toContain('không xác định thời điểm chuyển slide');
  });

  test('slide filter separates needs-attention and matched groups without changing the report', () => {
    const items = review.slideComparisons;
    expect(filterReviewSlides(items, 'all')).toHaveLength(3);
    expect(filterReviewSlides(items, 'attention').map(x => x.slideNumber)).toEqual([8, 13]);
    expect(filterReviewSlides(items, 'matched').map(x => x.slideNumber)).toEqual([4]);
    expect(items).toHaveLength(3);
    const html = render(review);
    expect(html).toContain('aria-label="Lọc nhận xét theo tình trạng slide"');
    expect(html).toContain('Cần xem lại');
    expect(html).toContain('Đã tìm thấy');
    expect(html).toContain('aria-pressed="true"');
  });

  test('retains older reports without detailed slide fields', () => {
    const old = {
      ...review,
      slideComparisons: [
        { slideNumber: 1, point: 'Slide đề cập mục tiêu.', evidenceId: 'E2', evidence: 'Có mục tiêu nghiên cứu.' },
      ],
      slideOverview: undefined,
      slideReviewStats: undefined,
    };
    const html = render(old);
    expect(html).toContain('Nhận xét từ bản lưu trước đây');
    expect(html).toContain('Slide đề cập mục tiêu.');
    expect(html).toContain('Xem đoạn lời nói gốc · E2');
    expect(html).not.toContain('Chữ trích từ PowerPoint');
    expect(filterReviewSlides(old.slideComparisons, 'attention')).toHaveLength(0);
  });

  test('transcript-only reports do not pretend to have analyzed PowerPoint', () => {
    const transcriptOnly = {
      ...review, source: 'transcript', slideComparisons: [],
      slideOverview: undefined, slideReviewStats: undefined,
    };
    const html = render(transcriptOnly);
    expect(html).toContain('Nhận xét tổng quan');
    expect(html).toContain('Giới hạn của nhận xét');
    expect(html).not.toContain('Đối chiếu bài nói và PowerPoint');
    expect(html).not.toContain('Xem bảng dò từ khóa');
  });

  test('zero verified slide comparisons displays an explicit no-evidence notice', () => {
    const noEvidence = {
      ...review, slideComparisons: [],
      slideReviewStats: { target: 6, received: 3, accepted: 0, rejected: 3 },
    };
    const html = render(noEvidence);
    expect(html).toContain('Không có mục đối chiếu chi tiết nào được xác minh');
    expect(html).toContain('Xem bảng dò từ khóa của 4 slide');
    expect(html).not.toContain('aria-label="Nhận xét slide 13"');
  });
});
