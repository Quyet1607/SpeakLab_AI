/**
 * Phase 8.3: evidence availability report for completed, device-local practice.
 * This is NOT an automated rubric score. Do not persist quotes, TXT, PPTX,
 * video blobs, login tokens or Gemini output in this report store.
 * Account grouping on the same browser is NOT a security boundary.
 */
import type { PracticeSession } from '../types';
import { listCompletedPracticeSessions } from './localPracticeHistory';
import { getLocalReviewSlides } from './localReviewSlideLibrary';
import { reviewInputFingerprint } from './localAiReviewLibrary';

const KEY = 'speaklab_assessment_reports_v1';
const VERSION = 1;
const MAX_RECORDS = 200;
type CriterionId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type CriterionAvailability = 'source_available' | 'insufficient_data';
export type AssessmentEvidenceSource = 'asr_transcript' | 'pptx_text' | 'practice_goal';

export type AssessmentCriterion = {
  id: CriterionId;
  title: string;
  state: CriterionAvailability;
  sources: AssessmentEvidenceSource[];
  note: string;
};

export type LocalAssessmentReport = {
  schemaVersion: 1;
  sessionId: string;
  ownerSub: string;
  createdAt: string;
  sourceFingerprint: string;
  /** Only source availability, never evaluation or performance scores. */
  criteria: AssessmentCriterion[];
  observations: {
    durationSeconds: number;
    slideCountMetadata: number;
    transcriptSegmentCount: number;
    transcriptCharacterCount: number;
    pptxTextSlideCount: number;
  };
  overallScore: null;
};

type StoredAssessment = {
  schemaVersion: 1;
  sessionId: string;
  ownerSub: string;
  createdAt: string;
  sourceFingerprint: string;
};

const criterionLabels: Record<CriterionId, string> = {
  R1: 'Nội dung và độ bám đề tài',
  R2: 'Cấu trúc và tính mạch lạc',
  R3: 'Lập luận và dẫn chứng',
  R4: 'Đối chiếu nội dung PowerPoint',
  R5: 'Đáp ứng mục tiêu luyện tập',
};

function validOwner(owner: string): boolean {
  return owner === 'guest' || /^[0-9]{5,64}$/u.test(owner);
}

function validSessionId(id: string): boolean {
  return /^ses_[\w-]{5,100}$/u.test(id);
}

function validStored(value: unknown): value is StoredAssessment {
  if (!value || typeof value !== 'object') return false;
  const x = value as Partial<StoredAssessment>;
  return x.schemaVersion === 1 &&
    typeof x.sessionId === 'string' && validSessionId(x.sessionId) &&
    typeof x.ownerSub === 'string' && validOwner(x.ownerSub) &&
    typeof x.createdAt === 'string' && Number.isFinite(Date.parse(x.createdAt)) &&
    typeof x.sourceFingerprint === 'string' && /^[a-f0-9]{8}$/u.test(x.sourceFingerprint);
}

function readAll(): StoredAssessment[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data.filter(validStored).slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

function textOf(session: PracticeSession): string {
  return (session.transcriptSegments || []).map(x => x.text).filter(Boolean).join('\n').trim();
}

function buildFromSession(session: PracticeSession, ownerSub: string, createdAt: string): LocalAssessmentReport {
  const slides = getLocalReviewSlides(session.id, ownerSub);
  const text = textOf(session);
  const hasTranscript = text.length >= 20;
  const hasPptx = !!slides?.slides.some(s => s.text.trim());
  const hasGoal = !!session.speakingGoal?.trim();

  const fingerprint = reviewInputFingerprint({
    topic: session.topic,
    topicDescription: session.topicDescription,
    speakingGoal: session.speakingGoal,
    transcript: text,
    slides: slides?.slides || [],
  });
  const make = (
    id: CriterionId, ready: boolean, sources: AssessmentEvidenceSource[],
    yes: string, no: string,
  ): AssessmentCriterion => ({
    id, title: criterionLabels[id],
    state: ready ? 'source_available' : 'insufficient_data',
    sources: ready ? sources : [],
    note: ready ? yes : no,
  });
  return {
    schemaVersion: VERSION,
    sessionId: session.id,
    ownerSub,
    createdAt,
    sourceFingerprint: fingerprint,
    observations: {
      durationSeconds: session.durationSeconds,
      slideCountMetadata: session.slideCount,
      transcriptSegmentCount: session.transcriptSegments?.length || 0,
      transcriptCharacterCount: text.length,
      pptxTextSlideCount: slides?.slides.length || 0,
    },
    criteria: [
      make('R1', hasTranscript, ['asr_transcript'],
        'Có chữ ASR để người học tự đối chiếu với đề tài; chưa đánh giá chất lượng nội dung.',
        'Không có bản ghi lời nói đủ dài để xem xét nội dung.'),
      make('R2', hasTranscript, ['asr_transcript'],
        'Có chữ ASR để xem xét bố cục; không suy ra cách thể hiện bằng giọng nói.',
        'Thiếu bản ghi lời nói để xem xét bố cục.'),
      make('R3', hasTranscript, ['asr_transcript'],
        'Có chữ ASR để kiểm tra luận điểm và dẫn chứng; chưa kiểm chứng tính đúng đắn.',
        'Thiếu bản ghi lời nói để xem xét lập luận.'),
      make('R4', hasTranscript && hasPptx, ['asr_transcript', 'pptx_text'],
        'Có TXT và chữ PPTX để đối chiếu; không xác định slide đã chiếu hoặc mức độ khớp.',
        'Cần cả bản ghi lời nói và chữ trích xuất từ PPTX để đối chiếu.'),
      make('R5', hasTranscript && hasGoal, ['practice_goal', 'asr_transcript'],
        'Có mục tiêu và TXT để người học tự đối chiếu; chưa kết luận đạt mục tiêu.',
        'Cần mục tiêu luyện tập cụ thể và bản ghi lời nói.'),
    ],
    overallScore: null,
  };
}

/** Recompute from the currently visible local session, not an arbitrary caller object. */
export function previewAssessmentReport(sessionId: string, ownerSub: string): LocalAssessmentReport | null {
  if (!validSessionId(sessionId) || !validOwner(ownerSub)) return null;
  const session = listCompletedPracticeSessions(ownerSub).find(s => s.id === sessionId);
  if (!session) return null;
  return buildFromSession(session, ownerSub, new Date().toISOString());
}

/** Save only a source fingerprint and identifiers. The report is rebuilt on reading. */
export function saveAssessmentReport(sessionId: string, ownerSub: string): LocalAssessmentReport {
  const report = previewAssessmentReport(sessionId, ownerSub);
  if (!report) throw new Error('Không tìm thấy buổi luyện thuộc chế độ tài khoản hiện tại.');
  const entry: StoredAssessment = {
    schemaVersion: 1, sessionId, ownerSub,
    createdAt: report.createdAt, sourceFingerprint: report.sourceFingerprint,
  };
  const others = readAll().filter(item => !(item.sessionId === sessionId && item.ownerSub === ownerSub));
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...others].slice(0, MAX_RECORDS)));
  } catch {
    throw new Error('Không thể lưu báo cáo trên trình duyệt. Hãy kiểm tra dung lượng.');
  }
  return report;
}

/** A changed or deleted source is NEVER represented as an up-to-date report. */
export function getAssessmentReport(sessionId: string, ownerSub: string):
  { report: LocalAssessmentReport; stale: boolean } | null {
  if (!validSessionId(sessionId) || !validOwner(ownerSub)) return null;
  const stored = readAll().find(item => item.sessionId === sessionId && item.ownerSub === ownerSub);
  if (!stored) return null;
  const current = previewAssessmentReport(sessionId, ownerSub);
  if (!current) return null;
  return {
    report: { ...current, createdAt: stored.createdAt },
    stale: current.sourceFingerprint !== stored.sourceFingerprint,
  };
}

export function listAssessmentReports(ownerSub: string):
  Array<{ report: LocalAssessmentReport; stale: boolean }> {
  if (!validOwner(ownerSub)) return [];
  return readAll().filter(item => item.ownerSub === ownerSub)
    .map(item => getAssessmentReport(item.sessionId, ownerSub))
    .filter((item): item is { report: LocalAssessmentReport; stale: boolean } => item !== null);
}

export function deleteAssessmentReport(sessionId: string, ownerSub: string): boolean {
  if (!validSessionId(sessionId) || !validOwner(ownerSub)) return false;
  const entries = readAll();
  const remaining = entries.filter(x => !(x.sessionId === sessionId && x.ownerSub === ownerSub));
  if (entries.length === remaining.length) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(remaining));
  } catch {
    throw new Error('Không thể xóa báo cáo trên trình duyệt.');
  }
  return true;
}
