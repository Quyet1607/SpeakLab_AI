import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import {
  validateReviewRequest, makeEvidenceChunks, buildReviewPrompt,
  parseGroundedReview, isMissingVietnameseDiacritics, buildSlideTextOverview,
} from '../server/freeSpeechReview.js';
import { extractPptxTextForReview } from '../src/services/pptxReviewText.ts';
import { getLocalReviewSlides, saveLocalReviewSlides } from '../src/services/localReviewSlideLibrary.ts';
import {
  getLocalAiReview, saveLocalAiReview, deleteLocalAiReview, reviewInputFingerprint,
} from '../src/services/localAiReviewLibrary.ts';
import { AiReviewResults, filterReviewSlides } from '../src/features/history/AiReviewResults.tsx';

const oldStorage = globalThis.localStorage;
let localData = new Map();
const storage = {
  getItem(key) { return localData.get(key) ?? null; },
  setItem(key, value) { localData.set(key, String(value)); },
  removeItem(key) { localData.delete(key); },
};
beforeAll(() => { globalThis.localStorage = storage; });
beforeEach(() => { localData = new Map(); });
afterAll(() => { globalThis.localStorage = oldStorage; });

const sessionId = 'ses_acceptance_2026';
const ownerSub = '123456789';
const topic = 'Ứng dụng AI và IoT để cảnh báo sạt lở đất';
const oneSentence = 'Nhóm em nghiên cứu hệ thống cảnh báo sạt lở đất, sử dụng camera AI, cảm biến và Arduino để thông báo nguy cơ thiên tai cho người dân.';
const transcript = Array.from({ length: 18 }, (_, i) => (i + 1) + '. ' + oneSentence).join(' ');

function request(transcriptText = transcript, slides = []) {
  return {
    consent: true, sessionId, topic,
    topicDescription: 'Thực nghiệm trong chủ đề cảnh báo thiên tai',
    speakingGoal: 'Giải thích mô hình nghiên cứu và đề xuất giải pháp',
    transcript: transcriptText,
    slides,
  };
}

async function makePptx(slides) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  slides.forEach((text, index) => {
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    zip.file('ppt/slides/slide' + (index + 1) + '.xml',
      '<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:t>' + safe + '</a:t></p:sld>');
  });
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return new File([bytes], 'He-thong-canh-bao-sat-lo.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

function reviewPayload(evidence, slides = [], includeBadSlide = false) {
  const evidenceId = evidence[0].id;
  const spokenQuote = evidence[0].text.slice(0, 70);
  const raw = {
    summary: 'Bài thuyết trình giới thiệu hệ thống cảnh báo sạt lở đất, trình bày mục tiêu và giải pháp công nghệ dựa trên camera AI.',
    strengths: [
      { point: 'Bài nói đã nêu mục tiêu nghiên cứu và giải pháp cảnh báo sạt lở đất.', evidenceId },
      { point: 'Người học đã đề cập đến các cảm biến và mô hình Arduino.', evidenceId },
    ],
    improvements: [
      {
        point: 'Phần giải thích tín hiệu cảnh báo cần có ví dụ cụ thể.',
        evidenceId, action: 'Bổ sung một tình huống thực tế về ngưỡng phát hiện nguy cơ sạt lở.',
      },
      {
        point: 'Cần liên kết mô hình đề xuất với điều kiện triển khai tại địa phương.',
        evidenceId, action: 'Giải thích cách camera và cảm biến được bố trí ở khu vực nghiên cứu.',
      },
    ],
    slideComparisons: [],
    limitations: ['Văn bản ASR có thể thiếu ý khi trình duyệt nhận diện chưa đầy đủ.'],
  };
  if (slides.length) {
    raw.slideComparisons = slides.map((slide, i) => ({
      slideNumber: slide.number,
      status: i === 0 ? 'matched' : i === 1 ? 'partial' : 'not_found',
      point: 'Bản ghi được đối chiếu với nội dung nghiên cứu tại slide ' + slide.number + '.',
      slideQuote: slide.text,
      spokenQuote: i <= 1 ? spokenQuote : '',
      evidenceId: i <= 1 ? evidenceId : '',
      covered: i <= 1
        ? 'Đã tìm thấy nội dung mô hình cảnh báo trong bản ghi lời nói.'
        : 'Chưa nhận diện được đoạn lời nói liên quan đến slide này.',
      missing: 'Cần kiểm tra thêm nội dung giải thích công nghệ cảm biến trong bản ghi.',
      action: 'Bổ sung ví dụ thực tế để làm rõ ý chính của slide này.',
    }));
    if (includeBadSlide) raw.slideComparisons[2].slideQuote = 'Nội dung hoàn toàn do AI bịa ra';
  }
  return raw;
}

function markup(review) {
  return renderToStaticMarkup(React.createElement(AiReviewResults, { review }));
}

describe('Phase 7.3.3.4 – end-to-end acceptance without external Gemini calls', () => {
  test('18-slide PPTX and 2,000+ chars: extract, attribute, save and display partial evidence', async () => {
    expect(transcript.length).toBeGreaterThan(2000);
    expect(transcript.length).toBeLessThan(4000);
    const inputSlides = Array.from({ length: 18 }, (_, i) =>
      'Slide ' + (i + 1) + ': Cảnh báo sạt lở đất sử dụng camera và cảm biến.');
    const pptx = await extractPptxTextForReview(await makePptx(inputSlides));
    expect(pptx.slideCount).toBe(18);
    expect(pptx.slides).toHaveLength(18);
    const storedSlides = saveLocalReviewSlides(sessionId, ownerSub, pptx);
    expect(getLocalReviewSlides(sessionId, ownerSub)?.slides).toEqual(storedSlides.slides);

    const input = validateReviewRequest(request(transcript, storedSlides.slides));
    const evidence = makeEvidenceChunks(input.transcript);
    expect(buildReviewPrompt(input, evidence)).toContain('tiếng Việt CÓ DẤU');
    const output = parseGroundedReview(
      JSON.stringify(reviewPayload(evidence, input.slides, true)), evidence, input.slides,
    );
    expect(output.slideOverview).toHaveLength(18);
    expect(output.slideReviewStats).toEqual({ target: 18, received: 18, accepted: 17, rejected: 1 });
    expect(output.slideComparisons.map(s => s.slideNumber)).toEqual([1, 2, ...Array.from({ length: 15 }, (_, i) => i + 4)]);
    expect(output.slideComparisons[0].spokenQuote).toBe(evidence[0].text.slice(0, 70));
    expect(output.slideComparisons.every(s => s.slideQuote !== 'Nội dung hoàn toàn do AI bịa ra')).toBe(true);

    const fingerprint = reviewInputFingerprint(input);
    saveLocalAiReview({
      sessionId, ownerSub, inputFingerprint: fingerprint, topic: input.topic,
      topicDescription: input.topicDescription, speakingGoal: input.speakingGoal,
      transcriptLength: input.transcript.length,
      slideName: pptx.name, slideCount: pptx.slideCount, review: output,
    });
    const loaded = getLocalAiReview(sessionId, ownerSub);
    expect(loaded.review).toEqual(output);
    const html = markup(loaded.review);
    expect(html).toContain('Đã đối chiếu chi tiết: 17/18 slide có chữ');
    expect(html).not.toContain('Nhận xét đối chiếu chưa đầy đủ');
    expect(html).not.toContain('1 mục bị loại');
    expect(html).toContain('Xem bảng dò từ khóa của 18 slide');
    expect(html).toContain('Lời nói tương ứng · E1');
    expect(html).toContain('Chưa tìm thấy dẫn chứng lời nói tương ứng');
    expect(html).not.toContain('Nội dung hoàn toàn do AI bịa ra');

    // Changing slides invalidates the fingerprint without rewriting the report.
    expect(reviewInputFingerprint({ ...input, slides: [{ ...input.slides[0], text: 'Nội dung đã đổi' }, ...input.slides.slice(1)] }))
      .not.toBe(fingerprint);
    expect(deleteLocalAiReview(sessionId, ownerSub)).toBe(true);
    expect(getLocalAiReview(sessionId, ownerSub)).toBeNull();
    expect(getLocalReviewSlides(sessionId, ownerSub)).not.toBeNull();
  });

  test('no PPTX: content feedback remains available without invented slide citations', () => {
    const input = validateReviewRequest(request());
    const evidence = makeEvidenceChunks(input.transcript);
    const payload = reviewPayload(evidence);
    payload.slideComparisons = [{ slideNumber: 1, point: 'Mô hình giả', evidenceId: 'E1' }];
    const output = parseGroundedReview(JSON.stringify(payload), evidence, []);
    expect(output.source).toBe('transcript');
    expect(output.slideOverview).toHaveLength(0);
    expect(output.slideComparisons).toHaveLength(0);
    expect(markup(output)).not.toContain('Đối chiếu bài nói và PowerPoint');
    expect(markup(output)).toContain('Điểm cần cải thiện');
  });

  test('40-slide deck and ASR limits preserve data or reject clearly instead of truncating', async () => {
    const slides = Array.from({ length: 40 }, (_, i) => 'Slide ' + (i + 1) + ': Nội dung cảnh báo lũ quét và sạt lở.');
    const pptx = await extractPptxTextForReview(await makePptx(slides));
    const input = validateReviewRequest(request(transcript, pptx.slides));
    expect(input.slides).toHaveLength(40);
    expect(buildSlideTextOverview(input.slides, input.transcript)).toHaveLength(40);
    const evidence = makeEvidenceChunks(input.transcript);
    const allSlides = parseGroundedReview(
      JSON.stringify(reviewPayload(evidence, input.slides)), evidence, input.slides,
    );
    expect(allSlides.slideReviewStats).toEqual({
      target: 40, received: 40, accepted: 40, rejected: 0,
    });
    expect(allSlides.slideComparisons.at(-1).slideNumber).toBe(40);
    await expect(extractPptxTextForReview(await makePptx([...slides, 'Slide thứ 41'])))
      .rejects.toThrow(/40 slide/);
    expect(() => validateReviewRequest(request('a'.repeat(24001), []))).toThrow();
    expect(() => validateReviewRequest(request('Quá ngắn', []))).toThrow();
    expect(() => validateReviewRequest(request(transcript, [...pptx.slides, { number: 41, text: 'Quá giới hạn' }]))).toThrow();
    expect(() => validateReviewRequest(request(transcript, [pptx.slides[0], pptx.slides[0]]))).toThrow();
  });

  test('noisy ASR stays verbatim while author-written Vietnamese is accented', () => {
    const noisy = 'hom nay em gioi thieu he thong canh bao sat lo dat bang cam bien camera va arduino khi co mua lon';
    const evidence = makeEvidenceChunks(noisy);
    const source = reviewPayload(evidence);
    expect(isMissingVietnameseDiacritics(source)).toBe(false);
    const result = parseGroundedReview(JSON.stringify(source), evidence, []);
    expect(result.strengths[0].evidence).toBe(noisy);
    const unaccented = reviewPayload(evidence);
    unaccented.improvements[0].action =
      'Can them mot vi du thuc te ve he thong canh bao sat lo dat va giai thich cac buoc xu ly thong tin';
    expect(isMissingVietnameseDiacritics(unaccented)).toBe(true);
    expect(() => parseGroundedReview(JSON.stringify(unaccented), evidence, []))
      .toThrow(/không có dấu/);
  });

  test('older saved review renders and filtering does not mutate stored data', () => {
    const evidence = makeEvidenceChunks(transcript);
    const older = {
      ...parseGroundedReview(JSON.stringify(reviewPayload(evidence)), evidence, []),
      slideComparisons: [{
        slideNumber: 1, point: 'Slide minh họa đúng mục tiêu nghiên cứu.',
        evidenceId: 'E1', evidence: evidence[0].text,
      }],
      source: 'transcript_and_pptx',
      slideOverview: undefined, slideReviewStats: undefined,
    };
    saveLocalAiReview({
      sessionId, ownerSub, inputFingerprint: reviewInputFingerprint({ ...request(), slides: [] }), topic,
      topicDescription: 'Thực nghiệm', speakingGoal: 'Giới thiệu mô hình',
      transcriptLength: transcript.length, slideName: 'slides.pptx', slideCount: 1, review: older,
    });
    const loaded = getLocalAiReview(sessionId, ownerSub);
    expect(markup(loaded.review)).toContain('Nhận xét từ bản lưu trước đây');
    expect(filterReviewSlides(loaded.review.slideComparisons, 'attention')).toHaveLength(0);
    expect(filterReviewSlides(loaded.review.slideComparisons, 'all')).toHaveLength(1);
    expect(getLocalAiReview(sessionId, ownerSub).review).toEqual(older);
  });

  test('React escapes script-looking model prose without rendering executable markup', () => {
    const evidence = makeEvidenceChunks(transcript);
    const output = parseGroundedReview(JSON.stringify(reviewPayload(evidence)), evidence, []);
    output.summary = 'Bài nói nêu nội dung nghiên cứu <script>window.alert(1)</script> nhưng không tự chạy mã.';
    const html = markup(output);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Giới hạn của nhận xét');
  });
});
