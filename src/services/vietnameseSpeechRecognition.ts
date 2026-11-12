/**
 * Phase 7.2 — real browser SpeechRecognition for Vietnamese speech.
 * IMPORTANT: Browser vendors MAY process audio on remote servers. This feature
 * is never auto-started; the learner must explicitly accept the disclosure.
 * SpeakLab itself does not upload audio, transcriptions, or API keys.
 */
import type { SpeechTranscriptSegment } from '../types';

export const SPEECH_SEGMENT_LIMIT = 80;
export const SPEECH_SEGMENT_TEXT_LIMIT = 240;
/** Silence threshold for separating spoken phrases. */
export const SPEECH_PAUSE_MS = 1800;

export function cleanSpeechText(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SPEECH_SEGMENT_TEXT_LIMIT).trim();
}
export function normalizeTranscriptSegments(value: unknown): SpeechTranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  const normalized: SpeechTranscriptSegment[] = [];
  for (const item of value) {
    if (normalized.length >= SPEECH_SEGMENT_LIMIT) break;
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<SpeechTranscriptSegment>;
    if (!Number.isFinite(row.startSeconds) || !Number.isFinite(row.endSeconds) || typeof row.text !== 'string') continue;
    const start = Math.max(0, Math.min(86399, Math.floor(row.startSeconds!)));
    const end = Math.max(start, Math.min(86399, Math.floor(row.endSeconds!)));
    const text = cleanSpeechText(row.text);
    if (text) normalized.push({ startSeconds: start, endSeconds: end, text });
  }
  return normalized;
}

interface BrowserSpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface BrowserSpeechEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechResult>;
}
interface BrowserSpeechError {
  error: string;
}
interface BrowserSpeechEngine {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onerror: ((event: BrowserSpeechError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type BrowserSpeechConstructor = new () => BrowserSpeechEngine;

function getBrowserSpeechConstructor(): BrowserSpeechConstructor | null {
  if (typeof window === 'undefined') return null;
  const target = window as Window & {
    SpeechRecognition?: BrowserSpeechConstructor;
    webkitSpeechRecognition?: BrowserSpeechConstructor;
  };
  return target.SpeechRecognition || target.webkitSpeechRecognition || null;
}

export function isVietnameseSpeechRecognitionSupported(): boolean {
  return getBrowserSpeechConstructor() !== null;
}

export function speechRecognitionErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Trình duyệt từ chối nhận diện lời nói. Hãy kiểm tra quyền micro và cài đặt nhận diện giọng nói.';
    case 'audio-capture':
      return 'Không có âm thanh micro để nhận diện. Kiểm tra lại thiết bị micro.';
    case 'network':
      return 'Dịch vụ nhận diện của trình duyệt gặp lỗi mạng. Hãy thử lại khi kết nối ổn định.';
    case 'language-not-supported':
    case 'language-unavailable':
      return 'Trình duyệt hiện không hỗ trợ nhận diện tiếng Việt.';
    case 'no-speech':
      return 'Chưa nhận diện được lời nói. Hãy thử lại và nói rõ ràng.';
    case 'aborted':
      return 'Phiên nhận diện đã được dừng.';
    default:
      return 'Nhận diện lời nói gặp sự cố. Có thể thử bật lại khi sẵn sàng.';
  }
}

export interface SpeechRecognitionCallbacks {
  onState: (state: 'listening' | 'stopped' | 'error', message?: string) => void;
  onInterim: (text: string) => void;
  onSegment: (segment: SpeechTranscriptSegment) => void;
  getElapsedSeconds: () => number;
}

export class VietnameseBrowserSpeechSession {
  private engine: BrowserSpeechEngine;
  private indices = new Set<number>();
  private firstSeen = new Map<number, number>();
  private latestInterim = new Map<number, string>();
  private pausePrefixes = new Map<number, Array<{ text: string; at: number }>>();
  private lastResultMs: number | null = null;
  private speechEndedMs: number | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private ended = false;
  private lastError: string | null = null;
  private finishStop!: () => void;
  private stopPromise: Promise<void>;

  constructor(private callbacks: SpeechRecognitionCallbacks, private nowMs: () => number = () => Date.now()) {
    const Constructor = getBrowserSpeechConstructor();
    if (!Constructor) throw new Error('Trình duyệt chưa hỗ trợ nhận diện lời nói bằng Web Speech API. Hãy dùng Chrome/Edge tương thích.');
    this.engine = new Constructor();
    this.engine.lang = 'vi-VN';
    this.engine.continuous = true;
    this.engine.interimResults = true;
    this.engine.maxAlternatives = 1;
    this.stopPromise = new Promise<void>(resolve => { this.finishStop = resolve; });
    this.engine.onstart = () => this.callbacks.onState('listening');
    // Browser speech events offer better pause evidence than result delivery alone.
    this.engine.onspeechend = () => {
      this.speechEndedMs = this.nowMs();
      this.scheduleLivePause();
    };
    this.engine.onspeechstart = () => {
      if (this.speechEndedMs !== null && this.nowMs() - this.speechEndedMs >= SPEECH_PAUSE_MS) {
        this.capturePause();
        this.publishInterim();
      }
      this.speechEndedMs = null;
      this.clearPauseTimer();
    };
    this.engine.onresult = event => {
      // Web Speech emits revised hypotheses as the learner speaks. Publish
      // *all* current interim words immediately, rather than showing only
      // the last result (which can look as if words arrive very slowly).
      // The display is provisional; only final results go into history.
      const timeMs = this.nowMs();
      if (this.lastResultMs !== null && timeMs - this.lastResultMs >= SPEECH_PAUSE_MS) {
        // Fallback: some browsers omit onspeechend/onspeechstart.
        // Mark a boundary, but never persist a provisional hypothesis.
        this.capturePause();
      }
      this.lastResultMs = timeMs;
      if (this.speechEndedMs === null) this.scheduleLivePause();
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        const text = cleanSpeechText(result[0]?.transcript || '');
        if (!text || this.indices.has(index)) continue;
        const now = Math.max(0, Math.floor(this.callbacks.getElapsedSeconds()));
        if (!this.firstSeen.has(index)) this.firstSeen.set(index, now);
        if (result.isFinal) {
          this.indices.add(index);
          const startSeconds = this.firstSeen.get(index) ?? now;
          this.firstSeen.delete(index);
          this.emitConfirmedWithPauses(index, text, startSeconds, now);
          this.latestInterim.delete(index);
          this.pausePrefixes.delete(index);
        } else {
          this.latestInterim.set(index, text);
        }
      }
      // Display confirmed pause boundaries immediately, even while listening.
      // Interim content remains provisional and is NEVER saved to history.
      this.publishInterim();
    };
    this.engine.onerror = event => {
      this.clearPauseTimer();
      if (this.stopped && event.error === 'aborted') return;
      this.lastError = speechRecognitionErrorMessage(event.error);
      this.callbacks.onState('error', this.lastError);
    };
    this.engine.onend = () => {
      if (this.ended) return;
      this.clearPauseTimer();
      this.ended = true;
      this.callbacks.onInterim('');
      if (!this.lastError) {
        this.callbacks.onState('stopped', this.stopped ? undefined :
          'Trình duyệt đã tự kết thúc nhận diện (có thể do tạm ngừng nói). Nhấn Bắt đầu để tiếp tục.');
      }
      this.finishStop();
    };
  }

  /** Cancel timers when speech resumes or the learner ends recognition. */
  private clearPauseTimer(): void {
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  /** Update the live text at the pause itself, without stopping recognition. */
  private scheduleLivePause(): void {
    if (this.stopped || this.ended) return;
    this.clearPauseTimer();
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      if (this.stopped || this.ended) return;
      this.capturePause();
      this.publishInterim();
    }, SPEECH_PAUSE_MS);
  }

  private publishInterim(): void {
    const parts: string[] = [];
    for (const [index, text] of [...this.latestInterim].sort(([a], [b]) => a - b)) {
      if (this.indices.has(index)) continue;
      const pauses = this.pausePrefixes.get(index) ?? [];
      let cursor = 0;
      const paragraphs: string[] = [];
      for (const pause of pauses) {
        const prefix = pause.text;
        if (!text.startsWith(prefix) || prefix.length <= cursor ||
          (prefix.length < text.length && !/\s/u.test(text.charAt(prefix.length)))) continue;
        const paragraph = text.slice(cursor, prefix.length).trim();
        if (paragraph) paragraphs.push(paragraph);
        cursor = prefix.length;
      }
      const remainder = text.slice(cursor).trim();
      if (remainder) paragraphs.push(remainder);
      parts.push(paragraphs.join('\n\n') + (cursor === text.length && cursor > 0 ? '\n\n' : ''));
    }
    this.callbacks.onInterim(parts.join(' '));
  }

  /** Snapshot cumulative interim hypotheses; only final recognition is persisted. */
  private capturePause(): void {
    for (const [index, text] of this.latestInterim) {
      if (this.indices.has(index) || !text) continue;
      const existing = this.pausePrefixes.get(index) ?? [];
      if (existing.at(-1)?.text !== text) {
        existing.push({ text, at: Math.max(0, Math.floor(this.callbacks.getElapsedSeconds())) });
        this.pausePrefixes.set(index, existing);
      }
    }
  }

  private emitConfirmedWithPauses(index: number, finalText: string, start: number, end: number): void {
    const pauses = this.pausePrefixes.get(index) ?? [];
    let cursor = 0;
    let partStart = start;
    for (const pause of pauses) {
      // Hypotheses can change. Split only if the final text confirms this
      // exact prefix followed by a word boundary.
      const prefix = pause.text;
      if (!finalText.startsWith(prefix) || prefix.length <= cursor ||
          prefix.length >= finalText.length || !/\s/u.test(finalText.charAt(prefix.length))) continue;
      const part = finalText.slice(cursor, prefix.length).trim();
      if (!part) continue;
      this.callbacks.onSegment({ startSeconds: partStart, endSeconds: Math.max(partStart, pause.at), text: part });
      cursor = prefix.length;
      partStart = Math.max(partStart, pause.at);
    }
    const rest = finalText.slice(cursor).trim();
    if (rest) this.callbacks.onSegment({ startSeconds: partStart, endSeconds: Math.max(end, partStart), text: rest });
  }

  start(): void {
    this.engine.start();
  }

  /** Wait briefly for any final recognition result before ending the practice. */
  async stop(): Promise<void> {
    if (this.ended) return;
    if (!this.stopped) {
      this.stopped = true;
      this.clearPauseTimer();
      try { this.engine.stop(); } catch { this.finishStop(); }
    }
    // A browser implementation can fail to send onend. Never block the UI.
    await Promise.race([
      this.stopPromise,
      new Promise<void>(resolve => setTimeout(resolve, 1800)),
    ]);
  }

  dispose(): void {
    this.stopped = true;
    this.clearPauseTimer();
    this.engine.onstart = null;
    this.engine.onresult = null;
    this.engine.onspeechstart = null;
    this.engine.onspeechend = null;
    this.engine.onerror = null;
    this.engine.onend = null;
    try { this.engine.abort(); } catch { /* already stopped */ }
    this.ended = true;
    this.finishStop();
  }
}
