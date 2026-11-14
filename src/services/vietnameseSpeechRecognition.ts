/**
 * Phase 7.2 — real browser SpeechRecognition for Vietnamese speech.
 * IMPORTANT: Browser vendors MAY process audio on remote servers. This feature
 * is never auto-started; the learner must explicitly accept the disclosure.
 * SpeakLab itself does not upload audio, transcriptions, or API keys.
 */
import type { SpeechTranscriptSegment } from '../types';

export const SPEECH_SEGMENT_LIMIT = 500;
export const SPEECH_SEGMENT_TEXT_LIMIT = 2000;

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

export const SPEECH_PAUSE_THRESHOLD_MS = 1200;

export interface SpeechRecognitionCallbacks {
  onState: (state: 'listening' | 'stopped' | 'error', message?: string) => void;
  onInterim: (text: string) => void;
  onSegment: (segment: SpeechTranscriptSegment, segmentId: number) => void;
  /** A browser may confirm an interim phrase after the silence timer has already emitted it. */
  onSegmentUpdate?: (segmentId: number, segment: SpeechTranscriptSegment) => void;
  getElapsedSeconds: () => number;
}

interface EmittedSpeechSegment {
  segment: SpeechTranscriptSegment;
  texts: Map<number, string>;
}

export class VietnameseBrowserSpeechSession {
  private engine: BrowserSpeechEngine;
  private finalizedIndices = new Set<number>();
  private firstSeen = new Map<number, number>();
  private activeTexts = new Map<number, string>();
  private activeIndices = new Set<number>();
  private emittedSegmentByIndex = new Map<number, number>();
  /** Text already emitted before the current segment when Chrome reuses an interim result index. */
  private cumulativePrefixByIndex = new Map<number, string>();
  private emittedSegments = new Map<number, EmittedSpeechSegment>();
  private nextSegmentId = 1;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSpeechElapsedSeconds: number | null = null;
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
    this.engine.onresult = event => {
      let interimChanged = false;
      let receivedFinal = false;

      // Web Speech can keep a phrase provisional for longer than a natural pause.
      // Keep its latest text and split locally after a short period without updates.
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        const text = cleanSpeechText(result[0]?.transcript || '');
        if (!text || this.finalizedIndices.has(index)) continue;

        const now = Math.max(0, Math.floor(this.callbacks.getElapsedSeconds()));
        const emittedId = this.emittedSegmentByIndex.get(index);
        if (emittedId !== undefined) {
          const emitted = this.emittedSegments.get(emittedId);
          if (emitted) {
            const previousSegmentText = emitted.texts.get(index) ?? '';
            const previousPrefix = this.cumulativePrefixByIndex.get(index) ?? '';
            const previousCumulativeText = this.joinSpeechText(previousPrefix, previousSegmentText);
            const appendedText = this.extractSpeechSuffix(text, previousCumulativeText);
            const hasFollowingResult = index + 1 < event.results.length &&
              Boolean(cleanSpeechText(event.results[index + 1]?.[0]?.transcript || ''));

            if (result.isFinal && hasFollowingResult) {
              // When Chrome finalizes this index and exposes the next phrase at
              // another index in the same event, this is a late confirmation of
              // the old segment, not a continuation of it.
              const correctedText = this.extractSpeechSuffix(text, previousPrefix);
              if (correctedText && correctedText !== previousSegmentText) {
                emitted.texts.set(index, correctedText);
                this.publishSegmentUpdate(emittedId);
              }
              this.finalizedIndices.add(index);
            } else if (appendedText) {
              // Chrome may keep extending the same interim result index after a
              // long pause. Treat the newly appended words as a new utterance,
              // rather than attaching them to the segment already emitted.
              this.cumulativePrefixByIndex.set(index, previousCumulativeText);
              this.emittedSegmentByIndex.delete(index);
              this.firstSeen.set(index, now);
              this.activeTexts.set(index, appendedText);
              this.activeIndices.add(index);
              if (result.isFinal) {
                this.finalizedIndices.add(index);
                receivedFinal = true;
              } else {
                interimChanged = true;
              }
            } else if (result.isFinal) {
              // A late final result usually confirms/corrects the previous
              // phrase. If the browser restarted this index entirely, treat it
              // as a new final utterance instead of silently discarding it.
              const correctedText = this.extractSpeechSuffix(text, previousPrefix);
              if (correctedText === null) {
                this.cumulativePrefixByIndex.set(index, '');
                this.emittedSegmentByIndex.delete(index);
                this.firstSeen.set(index, now);
                this.activeTexts.set(index, text);
                this.activeIndices.add(index);
                this.finalizedIndices.add(index);
                receivedFinal = true;
              } else {
                if (correctedText && correctedText !== previousSegmentText) {
                  emitted.texts.set(index, correctedText);
                  this.publishSegmentUpdate(emittedId);
                }
                this.finalizedIndices.add(index);
              }
            } else {
              const correctedText = this.extractSpeechSuffix(text, previousPrefix);
              if (correctedText === null) {
                // Some browser versions restart the interim result instead of
                // keeping the old phrase as a cumulative prefix.
                this.cumulativePrefixByIndex.set(index, '');
                this.emittedSegmentByIndex.delete(index);
                this.firstSeen.set(index, now);
                this.activeTexts.set(index, text);
                this.activeIndices.add(index);
                interimChanged = true;
              } else if (correctedText !== previousSegmentText) {
                // A change after the pause is a new phrase unless the browser
                // is still extending the current cumulative transcript.
                const continuesCurrentPhrase = this.extractSpeechSuffix(text, previousCumulativeText) !== null;
                if (continuesCurrentPhrase) {
                  emitted.texts.set(index, correctedText);
                  this.publishSegmentUpdate(emittedId);
                } else {
                  this.cumulativePrefixByIndex.set(index, '');
                  this.emittedSegmentByIndex.delete(index);
                  this.firstSeen.set(index, now);
                  this.activeTexts.set(index, text);
                  this.activeIndices.add(index);
                  interimChanged = true;
                }
              }
            }
          }
          continue;
        }

        const prefix = this.cumulativePrefixByIndex.get(index) ?? '';
        const segmentText = this.extractSpeechSuffix(text, prefix) ?? text;
        if (!this.firstSeen.has(index)) this.firstSeen.set(index, now);
        const previous = this.activeTexts.get(index);
        this.activeTexts.set(index, segmentText);
        this.activeIndices.add(index);

        if (result.isFinal) {
          this.finalizedIndices.add(index);
          receivedFinal = true;
        } else if (previous !== segmentText) {
          interimChanged = true;
        }
      }

      if (interimChanged) {
        this.lastSpeechElapsedSeconds = Math.max(0, Math.floor(this.callbacks.getElapsedSeconds()));
        this.schedulePauseFlush();
      } else if (receivedFinal && !this.pauseTimer && this.activeIndices.size > 0) {
        // Some browser implementations only return final text. Save it without
        // waiting for a timer that cannot be started from an interim hypothesis.
        this.flushActiveUtterance();
      }

      this.callbacks.onInterim(this.getActiveText());
    };
    this.engine.onerror = event => {
      if (this.stopped && event.error === 'aborted') return;
      this.lastError = speechRecognitionErrorMessage(event.error);
      this.callbacks.onState('error', this.lastError);
    };
    this.engine.onend = () => {
      if (this.ended) return;
      this.ended = true;
      this.flushActiveUtterance();
      this.callbacks.onInterim('');
      if (!this.lastError) {
        this.callbacks.onState('stopped', this.stopped ? undefined :
          'Trình duyệt đã tự kết thúc nhận diện (có thể do tạm ngừng nói). Nhấn Bắt đầu để tiếp tục.');
      }
      this.finishStop();
    };
  }

  start(): void {
    this.engine.start();
  }

  /** Wait briefly for final browser results, then flush any remaining phrase. */
  async stop(): Promise<void> {
    if (this.ended) return;
    if (!this.stopped) {
      this.stopped = true;
      try { this.engine.stop(); } catch { this.finishStop(); }
    }
    // A browser implementation can fail to send onend. Never block the UI.
    await Promise.race([
      this.stopPromise,
      new Promise<void>(resolve => setTimeout(resolve, 1800)),
    ]);
    this.flushActiveUtterance();
  }

  dispose(): void {
    this.stopped = true;
    this.flushActiveUtterance();
    this.engine.onstart = null;
    this.engine.onresult = null;
    this.engine.onerror = null;
    this.engine.onend = null;
    try { this.engine.abort(); } catch { /* already stopped */ }
    this.ended = true;
    this.finishStop();
  }

  private schedulePauseFlush(): void {
    this.clearPauseTimer();
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      this.flushActiveUtterance();
    }, SPEECH_PAUSE_THRESHOLD_MS);
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private joinSpeechText(prefix: string, text: string): string {
    return [prefix.trim(), text.trim()].filter(Boolean).join(' ');
  }

  /** Return the part after a known cumulative prefix, or null if it is not a prefix. */
  private extractSpeechSuffix(text: string, prefix: string): string | null {
    const cleanText = cleanSpeechText(text);
    const cleanPrefix = cleanSpeechText(prefix);
    if (!cleanPrefix) return cleanText;
    if (cleanText === cleanPrefix) return '';
    if (!cleanText.toLowerCase().startsWith(cleanPrefix.toLowerCase())) return null;
    const boundary = cleanText.charAt(cleanPrefix.length);
    if (boundary && !/[\s,.;:!?…—-]/u.test(boundary)) return null;
    return cleanText.slice(cleanPrefix.length).replace(/^[\s,.;:!?…—-]+/u, '').trim();
  }

  private getActiveText(): string {
    return [...this.activeTexts]
      .filter(([index]) => this.activeIndices.has(index))
      .sort(([a], [b]) => a - b)
      .map(([, value]) => value)
      .join(' ');
  }

  private flushActiveUtterance(): void {
    this.clearPauseTimer();
    const indices = [...this.activeIndices]
      .filter(index => this.activeTexts.has(index))
      .sort((a, b) => a - b);
    if (indices.length === 0) {
      this.lastSpeechElapsedSeconds = null;
      return;
    }

    const texts = new Map<number, string>();
    for (const index of indices) texts.set(index, this.activeTexts.get(index)!);
    const now = Math.max(0, Math.floor(this.callbacks.getElapsedSeconds()));
    const starts = indices
      .map(index => this.firstSeen.get(index))
      .filter((value): value is number => value !== undefined);
    const startSeconds = starts.length > 0 ? Math.min(...starts) : now;
    const endSeconds = Math.max(startSeconds, this.lastSpeechElapsedSeconds ?? now);
    const segmentId = this.nextSegmentId++;
    const segment: SpeechTranscriptSegment = {
      startSeconds,
      endSeconds,
      text: indices.map(index => texts.get(index)!).join(' '),
    };

    this.emittedSegments.set(segmentId, { segment, texts });
    for (const index of indices) {
      this.emittedSegmentByIndex.set(index, segmentId);
      this.firstSeen.delete(index);
      this.activeTexts.delete(index);
      this.activeIndices.delete(index);
    }
    this.lastSpeechElapsedSeconds = null;
    this.callbacks.onSegment(segment, segmentId);
    this.callbacks.onInterim(this.getActiveText());
  }

  private publishSegmentUpdate(segmentId: number): void {
    const emitted = this.emittedSegments.get(segmentId);
    if (!emitted || !this.callbacks.onSegmentUpdate) return;
    const text = [...emitted.texts]
      .sort(([a], [b]) => a - b)
      .map(([, value]) => value)
      .join(' ');
    emitted.segment = { ...emitted.segment, text };
    this.callbacks.onSegmentUpdate(segmentId, emitted.segment);
  }
}
