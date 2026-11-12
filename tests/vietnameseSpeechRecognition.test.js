import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  VietnameseBrowserSpeechSession,
  isVietnameseSpeechRecognitionSupported,
  normalizeTranscriptSegments,
  speechRecognitionErrorMessage,
} from '../src/services/vietnameseSpeechRecognition.ts';

const previousWindow = globalThis.window;

class FakeRecognition {
  static current = null;
  constructor() {
    this.lang = '';
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 0;
    this.started = false;
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    FakeRecognition.current = this;
  }
  start() {
    this.started = true;
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
}

beforeAll(() => {
  globalThis.window = { SpeechRecognition: FakeRecognition };
});
afterAll(() => {
  globalThis.window = previousWindow;
});

describe('Phase 7.2 Vietnamese browser speech recognition', () => {
  test('does not start recording or microphone automatically', async () => {
    let seconds = 5;
    const segments = [];
    const states = [];
    const interim = [];
    const s = new VietnameseBrowserSpeechSession({
      onState: (...args) => states.push(args),
      onInterim: text => interim.push(text),
      onSegment: part => segments.push(part),
      getElapsedSeconds: () => seconds,
    });
    const engine = FakeRecognition.current;
    expect(engine.started).toBe(false);
    expect(engine.lang).toBe('vi-VN');
    expect(engine.continuous).toBe(true);
    expect(engine.interimResults).toBe(true);
    expect(isVietnameseSpeechRecognitionSupported()).toBe(true);

    s.start();
    expect(engine.started).toBe(true);
    expect(states[0][0]).toBe('listening');

    engine.onresult({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: ' Chào các bạn ' } }],
    });
    expect(interim.at(-1)).toBe('Chào các bạn');
    expect(segments).toHaveLength(0); // Never persist interim guesses.

    seconds = 9;
    engine.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: ' Chào các bạn ' } }],
    });
    expect(segments).toEqual([{ startSeconds: 5, endSeconds: 9, text: 'Chào các bạn' }]);
    engine.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: ' Chào các bạn ' } }],
    });
    expect(segments).toHaveLength(1); // Final results may be repeated.
    await s.stop();
    expect(states.at(-1)[0]).toBe('stopped');
  });

  test('streams every provisional result immediately, including earlier unfinalized words', async () => {
    const live = [];
    const confirmed = [];
    const s = new VietnameseBrowserSpeechSession({
      onState: () => {},
      onInterim: text => live.push(text),
      onSegment: part => confirmed.push(part),
      getElapsedSeconds: () => 12,
    });
    s.start();
    const engine = FakeRecognition.current;
    engine.onresult({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'Tôi xin' } }],
    });
    expect(live.at(-1)).toBe('Tôi xin');

    // Chrome may update only the newest index while another phrase remains
    // provisional. The previous implementation showed just the last phrase.
    engine.onresult({
      resultIndex: 1,
      results: [
        { isFinal: false, 0: { transcript: 'Tôi xin' } },
        { isFinal: false, 0: { transcript: 'giới thiệu đề tài' } },
      ],
    });
    expect(live.at(-1)).toBe('Tôi xin giới thiệu đề tài');
    expect(confirmed).toHaveLength(0);

    engine.onresult({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: 'Tôi xin' } },
        { isFinal: false, 0: { transcript: 'giới thiệu đề tài hôm nay' } },
      ],
    });
    expect(confirmed).toHaveLength(1);
    expect(live.at(-1)).toBe('giới thiệu đề tài hôm nay');
    await s.stop();
  });

  test('a new user-initiated recognition session may resume at a later timestamp', async () => {
    const parts = [];
    let seconds = 50;
    const s = new VietnameseBrowserSpeechSession({
      onState: () => {}, onInterim: () => {},
      onSegment: p => parts.push(p),
      getElapsedSeconds: () => seconds,
    });
    s.start();
    const engine = FakeRecognition.current;
    engine.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Đây là lần thử lại' } }],
    });
    expect(parts).toEqual([{ startSeconds: 50, endSeconds: 50, text: 'Đây là lần thử lại' }]);
    await s.stop();
  });

  test('normalization excludes corrupt entries and limits stored text/segments', () => {
    const data = [
      { startSeconds: 3.9, endSeconds: 8.2, text: '   Kỹ năng  giao tiếp   ' },
      { startSeconds: -8, endSeconds: -1, text: 'Câu 2' },
      { startSeconds: NaN, endSeconds: 5, text: 'Sai' },
      { startSeconds: 6, endSeconds: 7, text: '' },
    ];
    expect(normalizeTranscriptSegments(data)).toEqual([
      { startSeconds: 3, endSeconds: 8, text: 'Kỹ năng giao tiếp' },
      { startSeconds: 0, endSeconds: 0, text: 'Câu 2' },
    ]);
    expect(normalizeTranscriptSegments(Array(200).fill({ startSeconds: 0, endSeconds: 1, text: 'Thử' }))).toHaveLength(80);
    expect(normalizeTranscriptSegments('not an array')).toEqual([]);
  });

  test('permission failures are reported, not replaced with fabricated transcripts', () => {
    expect(speechRecognitionErrorMessage('not-allowed')).toContain('từ chối');
    expect(speechRecognitionErrorMessage('network')).toContain('mạng');
  });
});
