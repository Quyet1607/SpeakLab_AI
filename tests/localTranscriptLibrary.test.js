import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { saveLocalTranscript, listLocalTranscripts, deleteLocalTranscript, transcriptToText, transcriptFileName } from '../src/services/localTranscriptLibrary.ts';

const oldStorage = globalThis.localStorage;
const memory = new Map();
beforeAll(() => {
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, String(value)); },
    removeItem: key => memory.delete(key),
  };
});
beforeEach(() => memory.clear());
afterAll(() => { globalThis.localStorage = oldStorage; });

const segments = [{ startSeconds: 2, endSeconds: 5, text: 'Xin chào các bạn' }];

describe('Phase 7.2.1 separate local transcript library', () => {
  test('saves on stop independently of completed session metadata and video', () => {
    const item = saveLocalTranscript('ses_test_12345', 'Buổi luyện thử', 'Giáo dục', null, segments);
    expect(item?.segments).toHaveLength(1);
    expect(listLocalTranscripts(null)).toHaveLength(1);
    expect(memory.has('speaklab_completed_practice_v1')).toBe(false);
    expect(memory.has('speaklab_local_recordings_v1')).toBe(false);
    expect(transcriptToText(item)).toContain('Xin chào các bạn');
    expect(transcriptFileName('Bài luyện: 1')).toBe('Bài luyện 1-loi-noi.txt');
  });

  test('later stop extends same transcript, without duplicate records', () => {
    saveLocalTranscript('ses_test_12345', 'Buổi luyện thử', 'Giáo dục', null, segments);
    saveLocalTranscript('ses_test_12345', 'Buổi luyện thử', 'Giáo dục', null,
      [...segments, { startSeconds: 8, endSeconds: 10, text: 'Tôi xin trình bày' }]);
    expect(listLocalTranscripts(null)).toHaveLength(1);
    expect(listLocalTranscripts(null)[0].segments).toHaveLength(2);
  });

  test('separate user groups and independent deletion', () => {
    saveLocalTranscript('ses_test_12345', 'Buổi luyện A', 'A', '12345', segments);
    saveLocalTranscript('ses_test_12345', 'Buổi luyện B', 'B', null, segments);
    expect(listLocalTranscripts(null)).toHaveLength(1);
    expect(listLocalTranscripts('12345')).toHaveLength(1);
    expect(deleteLocalTranscript('ses_test_12345', null)).toBe(true);
    expect(listLocalTranscripts('12345')).toHaveLength(1);
    expect(listLocalTranscripts(null)).toHaveLength(0);
  });

  test('invalid and provisional-only input is not stored', () => {
    expect(saveLocalTranscript('ses_test_12345', 'A', 'B', null, [])).toBeNull();
    expect(listLocalTranscripts(null)).toHaveLength(0);
  });

  test('storage errors surface rather than claiming success', () => {
    globalThis.localStorage.setItem = () => { throw new Error('quota'); };
    expect(() => saveLocalTranscript('ses_test_12345', 'A', 'B', null, segments)).toThrow('Không lưu được');
  });
});
