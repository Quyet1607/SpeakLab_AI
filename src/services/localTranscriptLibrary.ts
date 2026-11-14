/** Phase 7.2.1: independent, device-only speech transcript library.
 * Kept separate from completed practice metadata and video IndexedDB.
 * A downloadable .txt is produced on demand, never uploaded.
 */
import type { SpeechTranscriptSegment } from '../types';
import { normalizeTranscriptSegments } from './vietnameseSpeechRecognition';

const KEY = 'speaklab_local_transcripts_v1';
const MAX_RECORDS = 200;

export interface LocalTranscriptRecord {
  sessionId: string;
  title: string;
  topic: string;
  ownerSub: string | null;
  updatedAt: string;
  segments: SpeechTranscriptSegment[];
}

function readRecords(): LocalTranscriptRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is LocalTranscriptRecord =>
      item !== null && typeof item === 'object' &&
      typeof item.sessionId === 'string' && /^ses_[\w-]{5,100}$/.test(item.sessionId) &&
      typeof item.title === 'string' && typeof item.topic === 'string' &&
      (item.ownerSub === null || typeof item.ownerSub === 'string') &&
      typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) &&
      Array.isArray(item.segments)
    ).slice(0, MAX_RECORDS).map(item => ({
      ...item, segments: normalizeTranscriptSegments(item.segments),
    }));
  } catch { return []; }
}

function writeRecords(records: LocalTranscriptRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    throw new Error('Không lưu được bản ghi lời nói. Hãy kiểm tra dung lượng và quyền lưu trữ trình duyệt.');
  }
}

export function saveLocalTranscript(
  sessionId: string, title: string, topic: string,
  ownerSub: string | null, segments: SpeechTranscriptSegment[],
): LocalTranscriptRecord | null {
  const normalized = normalizeTranscriptSegments(segments);
  if (!normalized.length) return null;
  const record: LocalTranscriptRecord = {
    sessionId, title: title.slice(0, 180), topic: topic.slice(0, 120),
    ownerSub, updatedAt: new Date().toISOString(), segments: normalized,
  };
  const remaining = readRecords().filter(item => !(item.sessionId === sessionId && item.ownerSub === ownerSub));
  writeRecords([record, ...remaining]);
  return record;
}

export function listLocalTranscripts(ownerSub: string | null): LocalTranscriptRecord[] {
  return readRecords().filter(item => item.ownerSub === ownerSub)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteLocalTranscript(sessionId: string, ownerSub: string | null): boolean {
  const records = readRecords();
  const filtered = records.filter(item => !(item.sessionId === sessionId && item.ownerSub === ownerSub));
  if (records.length === filtered.length) return false;
  writeRecords(filtered);
  return true;
}

/** Split recognized text into readable lines without changing or dropping words. */
export function formatTranscriptLines(text: string, maxLength = 90): string[] {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (!normalized) return [];
  const width = Number.isFinite(maxLength) && maxLength > 0 ? Math.floor(maxLength) : 90;
  const sentences = normalized.match(/[^.!?…]+(?:[.!?…]+|$)/gu) || [normalized];
  const lines: string[] = [];

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/u).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (line && candidate.length > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function transcriptFileName(title: string): string {
  const safe = title.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 80) || 'Buoi-luyen';
  return safe + '-loi-noi.txt';
}

export function transcriptToText(record: LocalTranscriptRecord): string {
  const stamp = new Date(record.updatedAt).toLocaleString('vi-VN');
  const time = (seconds: number) =>
    String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
    String(seconds % 60).padStart(2, '0');
  return [
    'SPEAKLAB AI - BẢN GHI LỜI NÓI',
    'Buổi luyện: ' + record.title,
    'Đề tài: ' + record.topic,
    'Ngày lưu: ' + stamp,
    'Thời gian các đoạn chỉ mang tính ước lượng.',
    '',
    ...record.segments.flatMap(s => {
      const lines = formatTranscriptLines(s.text);
      return lines.map((line, index) =>
        (index === 0 ? '[' + time(s.startSeconds) + '–' + time(s.endSeconds) + '] ' : '') + line
      );
    }),
    '',
  ].join('\n');
}
