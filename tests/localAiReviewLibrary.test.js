import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
  deleteLocalAiReview, getLocalAiReview, reviewInputFingerprint, saveLocalAiReview,
} from '../src/services/localAiReviewLibrary.ts';

const previousStorage = globalThis.localStorage;
const memory = new Map();

beforeAll(() => {
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, String(value)); },
    removeItem: key => memory.delete(key),
  };
});
beforeEach(() => memory.clear());
afterAll(() => { globalThis.localStorage = previousStorage; });

const input = {
  topic: 'Bảo vệ dữ liệu cá nhân',
  topicDescription: 'Thực hành an toàn số',
  speakingGoal: 'Giải thích lập luận và đề xuất giải pháp',
  transcript: 'Hôm nay em trình bày về bảo vệ dữ liệu cá nhân. Chúng ta cần dùng mật khẩu mạnh.',
  slides: [{ number: 1, text: 'Mật khẩu mạnh và xác thực nhiều bước' }],
};

const review = {
  summary: 'Bài nói nêu đúng chủ đề và đề xuất được giải pháp bảo vệ tài khoản.',
  strengths: [
    { point: 'Nêu rõ chủ đề ngay phần mở đầu.', evidenceId: 'E1', evidence: 'Hôm nay em trình bày về bảo vệ dữ liệu cá nhân.' },
    { point: 'Đề cập đến giải pháp cụ thể.', evidenceId: 'E2', evidence: 'Chúng ta cần dùng mật khẩu mạnh.' },
  ],
  improvements: [
    { point: 'Cần giải thích vì sao mật khẩu mạnh có tác dụng.', evidenceId: 'E2', evidence: 'Chúng ta cần dùng mật khẩu mạnh.', action: 'Thêm ví dụ về nguy cơ đoán mật khẩu.' },
    { point: 'Nên kết luận và nhắc lại thông điệp chính.', evidenceId: 'E1', evidence: 'Hôm nay em trình bày về bảo vệ dữ liệu cá nhân.', action: 'Tóm tắt hai biện pháp quan trọng ở cuối bài.' },
  ],
  slideComparisons: [
    { point: 'Slide minh họa đúng giải pháp được trình bày.', evidenceId: 'E2', evidence: 'Chúng ta cần dùng mật khẩu mạnh.', slideNumber: 1 },
  ],
  limitations: ['Chỉ đánh giá văn bản nhận diện, không đánh giá hình ảnh hoặc giọng nói.'],
  source: 'transcript_and_pptx',
  model: 'gemini-3.5-flash-lite',
};

function makeRecord(overrides = {}) {
  return {
    sessionId: 'ses_test_12345',
    ownerSub: '123456789',
    inputFingerprint: reviewInputFingerprint(input),
    topic: input.topic,
    topicDescription: input.topicDescription,
    speakingGoal: input.speakingGoal,
    transcriptLength: input.transcript.length,
    slideName: 'Bai-thuyet-trinh.pptx',
    slideCount: 1,
    review,
    ...overrides,
  };
}

describe('Phase 7.3.2 local AI review library', () => {
  test('saves a review by session and account and reloads it without API access', () => {
    const saved = saveLocalAiReview(makeRecord());
    const loaded = getLocalAiReview('ses_test_12345', '123456789');

    expect(saved.createdAt).toBeTruthy();
    expect(loaded?.review.summary).toBe(review.summary);
    expect(loaded?.review.strengths[0].evidence).toContain('bảo vệ dữ liệu');
    expect(loaded?.slideName).toBe('Bai-thuyet-trinh.pptx');
    expect(memory.has('speaklab_local_ai_reviews_v1')).toBe(true);
    expect(memory.has('speaklab_local_transcripts_v1')).toBe(false);
    expect(memory.has('speaklab_local_recordings_v1')).toBe(false);
  });

  test('keeps reports separated by account and session', () => {
    saveLocalAiReview(makeRecord());
    saveLocalAiReview(makeRecord({
      sessionId: 'ses_other_12345',
      ownerSub: '987654321',
    }));

    expect(getLocalAiReview('ses_test_12345', '987654321')).toBeNull();
    expect(getLocalAiReview('ses_other_12345', '123456789')).toBeNull();
    expect(getLocalAiReview('ses_other_12345', '987654321')?.review.summary).toBe(review.summary);
  });

  test('replaces the previous report for the same session instead of duplicating it', () => {
    saveLocalAiReview(makeRecord());
    saveLocalAiReview(makeRecord({
      review: { ...review, summary: 'Nhận xét mới sau khi phân tích lại.' },
    }));

    const raw = JSON.parse(memory.get('speaklab_local_ai_reviews_v1'));
    expect(raw).toHaveLength(1);
    expect(getLocalAiReview('ses_test_12345', '123456789')?.review.summary)
      .toBe('Nhận xét mới sau khi phân tích lại.');
  });

  test('deletes only the AI review and leaves transcript/video storage untouched', () => {
    memory.set('speaklab_local_transcripts_v1', 'transcript-data');
    memory.set('speaklab_local_recordings_v1', 'video-data');
    saveLocalAiReview(makeRecord());

    expect(deleteLocalAiReview('ses_test_12345', '123456789')).toBe(true);
    expect(getLocalAiReview('ses_test_12345', '123456789')).toBeNull();
    expect(memory.get('speaklab_local_transcripts_v1')).toBe('transcript-data');
    expect(memory.get('speaklab_local_recordings_v1')).toBe('video-data');
    expect(deleteLocalAiReview('ses_test_12345', '123456789')).toBe(false);
  });

  test('fingerprint changes when topic, transcript or slide text changes', () => {
    const original = reviewInputFingerprint(input);
    expect(reviewInputFingerprint(input)).toBe(original);
    expect(reviewInputFingerprint({ ...input, transcript: input.transcript + ' Ý mới.' })).not.toBe(original);
    expect(reviewInputFingerprint({ ...input, topic: 'Chủ đề khác' })).not.toBe(original);
    expect(reviewInputFingerprint({
      ...input, slides: [{ number: 1, text: 'Nội dung slide đã thay đổi' }],
    })).not.toBe(original);
  });

  test('rejects invalid account IDs, evidence and oversized review data', () => {
    expect(() => saveLocalAiReview(makeRecord({ ownerSub: null }))).toThrow();
    expect(() => saveLocalAiReview(makeRecord({ inputFingerprint: 'not-a-hash' }))).toThrow();
    expect(() => saveLocalAiReview(makeRecord({
      review: { ...review, strengths: [{ ...review.strengths[0], evidenceId: 'E9999' }, review.strengths[1]] },
    }))).toThrow();
    expect(() => saveLocalAiReview(makeRecord({
      review: { ...review, summary: 'x'.repeat(851) },
    }))).toThrow();
  });

  test('reports local storage quota failures instead of pretending the report was saved', () => {
    const workingStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: key => workingStorage.getItem(key),
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: key => workingStorage.removeItem(key),
    };
    try {
      expect(() => saveLocalAiReview(makeRecord())).toThrow(/Không lưu được nhận xét AI/u);
    } finally {
      globalThis.localStorage = workingStorage;
    }
  });
});
