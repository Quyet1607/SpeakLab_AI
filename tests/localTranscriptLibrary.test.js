import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
  saveLocalTranscript, listLocalTranscripts, deleteLocalTranscript,
  clearGuestLocalTranscripts, transcriptToText, transcriptFileName, formatTranscriptLines,
} from '../src/services/localTranscriptLibrary.ts';

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

describe('Phase 7.2.1 Google-owned local transcript library', () => {
  test('saves on stop independently of completed session metadata and video', () => {
    const item = saveLocalTranscript('ses_test_12345', 'Buổi luyện thử', 'Giáo dục', '12345', segments);
    expect(item?.segments).toHaveLength(1);
    expect(listLocalTranscripts('12345')).toHaveLength(1);
    expect(memory.has('speaklab_completed_practice_v1')).toBe(false);
    expect(memory.has('speaklab_local_recordings_v1')).toBe(false);
    expect(transcriptToText(item)).toContain('Xin chào các bạn');
    expect(transcriptFileName('Bài luyện: 1')).toBe('Bài luyện 1-loi-noi.txt');
  });

  test('splits punctuated sentences onto individual lines in TXT', () => {
    const record = saveLocalTranscript('ses_test_12345', 'Bài nói', 'Chủ đề', '12345', [
      { startSeconds: 0, endSeconds: 9, text: 'Xin chào các bạn. Hôm nay tôi trình bày đề tài này! Cuối cùng xin cảm ơn?' },
    ]);
    expect(formatTranscriptLines(record.segments[0].text)).toEqual([
      'Xin chào các bạn.', 'Hôm nay tôi trình bày đề tài này!', 'Cuối cùng xin cảm ơn?',
    ]);
    const text = transcriptToText(record);
    expect(text).toContain('Xin chào các bạn.\nHôm nay tôi trình bày đề tài này!\nCuối cùng xin cảm ơn?');
  });

  test('wraps unpunctuated long recognition text without adding or dropping words', () => {
    const words = 'Tôi đang luyện tập thuyết trình về an toàn thông tin trên mạng và cần có bản ghi lời nói dễ đọc hơn sau khi dừng lại'.split(' ');
    const input = words.join(' ');
    const lines = formatTranscriptLines(input, 45);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every(line => line.length <= 45)).toBe(true);
    expect(lines.join(' ')).toBe(input);
  });

  test('later stop extends same transcript, without duplicate records', () => {
    saveLocalTranscript('ses_test_12345', 'Buổi luyện thử', 'Giáo dục', '12345', segments);
    saveLocalTranscript('ses_test_12345', 'Buổi luyện thử', 'Giáo dục', '12345',
      [...segments, { startSeconds: 8, endSeconds: 10, text: 'Tôi xin trình bày' }]);
    expect(listLocalTranscripts('12345')).toHaveLength(1);
    expect(listLocalTranscripts('12345')[0].segments).toHaveLength(2);
  });

  test('separate Google accounts and independent deletion', () => {
    saveLocalTranscript('ses_test_12345', 'Buổi luyện A', 'A', '12345', segments);
    saveLocalTranscript('ses_test_12345', 'Buổi luyện B', 'B', '67890', segments);
    expect(listLocalTranscripts('12345')).toHaveLength(1);
    expect(listLocalTranscripts('67890')).toHaveLength(1);
    expect(deleteLocalTranscript('ses_test_12345', '67890')).toBe(true);
    expect(listLocalTranscripts('12345')).toHaveLength(1);
    expect(listLocalTranscripts('67890')).toHaveLength(0);
  });

  test('guest transcripts are deleted without touching Google-owned transcripts', () => {
    saveLocalTranscript('ses_test_12345', 'Buổi luyện A', 'A', '12345', segments);
    const [googleRecord] = JSON.parse(memory.get('speaklab_local_transcripts_v1'));
    memory.set('speaklab_local_transcripts_v1', JSON.stringify([
      { ...googleRecord, sessionId: 'ses_guest_12345', ownerSub: null, title: 'Bản ghi khách' },
      googleRecord,
    ]));
    expect(clearGuestLocalTranscripts()).toBe(1);
    expect(listLocalTranscripts('12345')).toHaveLength(1);
    expect(JSON.parse(memory.get('speaklab_local_transcripts_v1'))).toHaveLength(1);
  });

  test('refuses to save a transcript without a Google owner', () => {
    expect(() => saveLocalTranscript('ses_test_12345', 'A', 'B', '', segments)).toThrow('Vui lòng đăng nhập Google');
    expect(saveLocalTranscript('ses_test_12345', 'A', 'B', '12345', [])).toBeNull();
    expect(listLocalTranscripts('12345')).toHaveLength(0);
  });

  test('storage errors surface rather than claiming success', () => {
    globalThis.localStorage.setItem = () => { throw new Error('quota'); };
    expect(() => saveLocalTranscript('ses_test_12345', 'A', 'B', '12345', segments)).toThrow('Không lưu được');
  });
});
