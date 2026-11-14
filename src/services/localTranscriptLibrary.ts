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
  ownerSub: string;
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
      typeof item.ownerSub === 'string' && /^[0-9]{5,64}$/.test(item.ownerSub) &&
      typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) &&
      Array.isArray(item.segments)
    ).slice(0, MAX_RECORDS).map(item => ({
      ...item, segments: normalizeTranscriptSegments(item.segments),
    }));
  } catch { return []; }
}

/** Remove legacy guest/unassigned transcripts without touching Google-owned records. */
export function clearGuestLocalTranscripts(): number {
  const raw = localStorage.getItem(KEY);
  if (!raw) return 0;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return 0; }
  if (!Array.isArray(data)) return 0;
  const retained = data.filter(item => {
    if (!item || typeof item !== 'object') return true;
    const owner = (item as { ownerSub?: unknown }).ownerSub;
    return owner !== null && owner !== undefined;
  });
  const removed = data.length - retained.length;
  if (removed > 0) writeRecords(retained as LocalTranscriptRecord[]);
  return removed;
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
  ownerSub: string, segments: SpeechTranscriptSegment[],
): LocalTranscriptRecord | null {
  if (!/^[0-9]{5,64}$/.test(ownerSub)) throw new Error('Vui lòng đăng nhập Google để lưu bản ghi lời nói.');
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

export function listLocalTranscripts(ownerSub: string): LocalTranscriptRecord[] {
  return readRecords().filter(item => item.ownerSub === ownerSub)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteLocalTranscript(sessionId: string, ownerSub: string): boolean {
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
