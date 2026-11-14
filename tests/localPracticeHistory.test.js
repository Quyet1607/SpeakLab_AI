import { describe, expect, test, beforeEach } from 'bun:test';
import {
  listCompletedPracticeSessions,
  saveCompletedPracticeSession,
  deleteCompletedPracticeTranscript,
  clearGuestPracticeHistory,
} from '../src/services/localPracticeHistory.ts';

let store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
  },
});
const session = {
  id: 'ses_1794521870123',
  title: 'Luyện thuyết trình thật',
  mode: 'defense',
  modeTitle: 'Luyện bảo vệ đề tài',
  topic: 'Bài nghiên cứu khoa học',
  durationSeconds: 1200,
  participantCount: 6,
  slideCount: 5,
  createdAt: 'Vừa xong',
  status: 'in_progress',
  presentationSource: { type: 'pptx', file: { fakeSensitiveBinary: true } },
  reportId: 'rep_01',
  score: 8.3,
};
beforeEach(() => { store = new Map(); });

describe('device-only completed practice history', () => {
  test('initial history is empty, not populated with demonstration sessions', () => {
    expect(listCompletedPracticeSessions('12345678901234567890')).toEqual([]);
  });
  test('stores actual elapsed time and excludes demo scores, report references and PPTX', () => {
    saveCompletedPracticeSession(session, 36, '12345678901234567890');
    const own = listCompletedPracticeSessions('12345678901234567890');
    expect(own).toHaveLength(1);
    expect(own[0].durationSeconds).toBe(36);
    expect(own[0].reportId).toBeUndefined();
    expect(own[0].score).toBeUndefined();
    expect(own[0].presentationSource).toBeUndefined();
    expect(own[0].status).toBe('completed');
    expect(JSON.stringify([...store.values()])).not.toContain('fakeSensitiveBinary');
  });
  test('persists the real topic description and speaking goal, not PPTX files', () => {
    const current = {
      ...session,
      topic: 'Đề tài học sinh tự chọn',
      topicDescription: 'Mô tả do người học nhập\nNêu nội dung nghiên cứu',
      speakingGoal: 'Tập trình bày mạch lạc và phản biện có dẫn chứng',
    };
    saveCompletedPracticeSession(current, 42, '12345678901234567890');
    const [reloaded] = listCompletedPracticeSessions('12345678901234567890');
    expect(reloaded.topic).toBe('Đề tài học sinh tự chọn');
    expect(reloaded.topicDescription).toBe(current.topicDescription);
    expect(reloaded.speakingGoal).toBe(current.speakingGoal);
    expect(JSON.stringify([...store.values()])).not.toContain('fakeSensitiveBinary');
  });
  test('legacy records without optional brief fields still remain readable', () => {
    saveCompletedPracticeSession(session, 31, '12345678901234567890');
    const [legacy] = listCompletedPracticeSessions('12345678901234567890');
    expect(legacy).toBeDefined();
    expect(legacy.topicDescription).toBeUndefined();
    expect(legacy.speakingGoal).toBeUndefined();
  });
  test('guest history is removed while Google-owned history is preserved', () => {
    saveCompletedPracticeSession(session, 43, '12345678901234567890');
    const [googleEntry] = JSON.parse(store.get('speaklab_completed_practice_v1'));
    store.set('speaklab_completed_practice_v1', JSON.stringify([
      { ...googleEntry, id: 'ses_guest_12345', ownerSub: null, title: 'Lịch sử khách' },
      googleEntry,
    ]));
    expect(clearGuestPracticeHistory()).toBe(1);
    expect(listCompletedPracticeSessions('12345678901234567890')).toHaveLength(1);
    expect(listCompletedPracticeSessions('11111111111111111111')).toHaveLength(0);
    expect(JSON.parse(store.get('speaklab_completed_practice_v1'))).toHaveLength(1);
  });
  test('saves actual recognized speech and can delete text without deleting the session or video', () => {
    const spoken = {
      ...session,
      transcriptSegments: [
        { startSeconds: 2, endSeconds: 6, text: 'Giới thiệu nội dung học tập' },
        { startSeconds: 10, endSeconds: 14, text: 'Trả lời câu hỏi phản biện' },
      ],
    };
    saveCompletedPracticeSession(spoken, 45, '12345678901234567890');
    const [retrieved] = listCompletedPracticeSessions('12345678901234567890');
    expect(retrieved.transcriptSegments).toEqual(spoken.transcriptSegments);
    expect(deleteCompletedPracticeTranscript(spoken.id, '11111111111111111111')).toBe(false);
    expect(deleteCompletedPracticeTranscript(spoken.id, '12345678901234567890')).toBe(true);
    const [afterDeletion] = listCompletedPracticeSessions('12345678901234567890');
    expect(afterDeletion.id).toBe(spoken.id);
    expect(afterDeletion.title).toBe(spoken.title);
    expect(afterDeletion.transcriptSegments).toBeUndefined();
  });

  test('same session ID is updated rather than duplicated', () => {
    saveCompletedPracticeSession(session, 30, '12345678901234567890');
    saveCompletedPracticeSession(session, 45, '12345678901234567890');
    expect(listCompletedPracticeSessions('12345678901234567890')).toHaveLength(1);
    expect(listCompletedPracticeSessions('12345678901234567890')[0].durationSeconds).toBe(45);
  });
  test('corrupt browser data is ignored, not executed', () => {
    store.set('speaklab_completed_practice_v1', '{invalid_json');
    expect(listCompletedPracticeSessions('12345678901234567890')).toEqual([]);
  });
});
