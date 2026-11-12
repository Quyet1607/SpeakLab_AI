/**
 * Local-only completed practice metadata. Video blobs remain in IndexedDB.
 * Browser storage is NOT secure account isolation or cloud synchronization.
 * Never persist PresentationSource.file, File, MediaStream, OAuth data or tokens.
 */
import type { PracticeSession, PracticeModeType, SpeechTranscriptSegment } from '../types';
import { normalizeTranscriptSegments, SPEECH_SEGMENT_LIMIT } from './vietnameseSpeechRecognition';
import { normalizePracticeBrief, PRACTICE_BRIEF_LIMITS } from './practiceBrief';

const KEY = 'speaklab_completed_practice_v1';
const LIMIT = 200;
type StoredEntry = {
  id: string;
  title: string;
  mode: PracticeModeType;
  modeTitle: string;
  topic: string;
  topicDescription?: string;
  speakingGoal?: string;
  transcriptSegments?: SpeechTranscriptSegment[];
  durationSeconds: number;
  slideCount: number;
  participantCount: number;
  completedAt: string;
  ownerSub: string | null;
};

function validEntry(item: unknown): item is StoredEntry {
  if (!item || typeof item !== 'object') return false;
  const e = item as Partial<StoredEntry>;
  return typeof e.id === 'string' && /^ses_[\w-]{5,100}$/.test(e.id) &&
    typeof e.title === 'string' && e.title.length <= 180 &&
    ['basic', 'defense', 'debate'].includes(String(e.mode)) &&
    typeof e.modeTitle === 'string' && e.modeTitle.length <= 100 &&
    typeof e.topic === 'string' && e.topic.length <= 120 &&
    (e.topicDescription === undefined || typeof e.topicDescription === 'string' && e.topicDescription.length <= PRACTICE_BRIEF_LIMITS.topicDescription) &&
    (e.speakingGoal === undefined || typeof e.speakingGoal === 'string' && e.speakingGoal.length <= PRACTICE_BRIEF_LIMITS.speakingGoal) &&
    (e.transcriptSegments === undefined || Array.isArray(e.transcriptSegments) && e.transcriptSegments.length <= SPEECH_SEGMENT_LIMIT &&
      normalizeTranscriptSegments(e.transcriptSegments).length === e.transcriptSegments.length) &&
    Number.isInteger(e.durationSeconds) && e.durationSeconds! >= 0 && e.durationSeconds! < 86400 &&
    Number.isInteger(e.slideCount) && e.slideCount! >= 0 && e.slideCount! <= 10000 &&
    Number.isInteger(e.participantCount) && e.participantCount! >= 0 && e.participantCount! <= 1000 &&
    typeof e.completedAt === 'string' && Number.isFinite(Date.parse(e.completedAt)) &&
    (e.ownerSub === null || typeof e.ownerSub === 'string' && /^[0-9]{5,64}$/.test(e.ownerSub));
}

function readAll(): StoredEntry[] {
  try {
    const json = localStorage.getItem(KEY);
    if (!json) return [];
    const data: unknown = JSON.parse(json);
    return Array.isArray(data) ? data.filter(validEntry).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function listCompletedPracticeSessions(ownerSub: string | null): PracticeSession[] {
  return readAll()
    .filter(item => item.ownerSub === ownerSub)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .map(({ completedAt, ownerSub: _ownerSub, ...item }) => ({
      ...item,
      ...(item.transcriptSegments ? { transcriptSegments: normalizeTranscriptSegments(item.transcriptSegments) } : {}),
      createdAt: new Date(completedAt).toLocaleString('vi-VN'),
      status: 'completed' as const,
    }));
}

export function saveCompletedPracticeSession(
  session: PracticeSession,
  durationSeconds: number,
  ownerSub: string | null,
): void {
  const now = new Date().toISOString();
  const brief = normalizePracticeBrief({
    topicTitle: session.topic,
    topicDescription: session.topicDescription,
    speakingGoal: session.speakingGoal,
  });
  const entry: StoredEntry = {
    id: session.id,
    title: session.title.slice(0, 180),
    mode: session.mode,
    modeTitle: session.modeTitle.slice(0, 100),
    topic: brief.topicTitle,
    ...(brief.topicDescription ? { topicDescription: brief.topicDescription } : {}),
    ...(brief.speakingGoal ? { speakingGoal: brief.speakingGoal } : {}),
    ...(session.transcriptSegments?.length
      ? { transcriptSegments: normalizeTranscriptSegments(session.transcriptSegments) }
      : {}),
    durationSeconds: Math.min(86399, Math.max(0, Math.floor(durationSeconds))),
    slideCount: session.slideCount,
    participantCount: session.participantCount,
    completedAt: now,
    ownerSub,
  };
  if (!validEntry(entry)) throw new Error('Thông tin buổi luyện chưa hợp lệ.');
  const remaining = readAll().filter(item => item.id !== entry.id);
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...remaining].slice(0, LIMIT)));
  } catch {
    throw new Error('Trình duyệt không lưu được lịch sử buổi luyện. Hãy kiểm tra dung lượng hoặc cài đặt quyền lưu trữ.');
  }
}

/** Delete speech-to-text only, without touching the completed session or video. */
export function deleteCompletedPracticeTranscript(sessionId: string, ownerSub: string | null): boolean {
  const all = readAll();
  const item = all.find(entry => entry.id === sessionId && entry.ownerSub === ownerSub);
  if (!item || !item.transcriptSegments?.length) return false;
  const updated = all.map(entry =>
    entry === item ? { ...entry, transcriptSegments: undefined } : entry
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    throw new Error('Không xóa được bản ghi chữ trên trình duyệt. Hãy kiểm tra quyền lưu trữ.');
  }
  return true;
}
