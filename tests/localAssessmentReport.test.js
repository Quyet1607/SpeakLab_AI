import { beforeEach, afterAll, describe, expect, test } from 'bun:test';
import { saveCompletedPracticeSession, deleteCompletedPracticeTranscript } from '../src/services/localPracticeHistory.ts';
import { saveLocalReviewSlides, deleteLocalReviewSlides } from '../src/services/localReviewSlideLibrary.ts';
import {
  previewAssessmentReport, saveAssessmentReport, getAssessmentReport,
  listAssessmentReports, deleteAssessmentReport,
} from '../src/services/localAssessmentReport.ts';

const previous = globalThis.localStorage;
const store = new Map();
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: key => store.delete(key),
};
beforeEach(() => store.clear());
afterAll(() => { globalThis.localStorage = previous; });

const owner = '12345678901234567890';
const guest = 'guest';
const sample = {
  id: 'ses_assessment_12345',
  title: 'Buổi luyện thực tế',
  topic: 'Bảo vệ môi trường',
  topicDescription: 'Giảm rác nhựa',
  speakingGoal: 'Giải thích giải pháp',
  mode: 'basic', modeTitle: 'Cơ bản',
  durationSeconds: 180, slideCount: 2, participantCount: 2,
  status: 'completed', createdAt: '15/11/2026',
  transcriptSegments: [
    { startSeconds: 1, endSeconds: 10, text: 'Hôm nay em trình bày cách giảm rác nhựa trong trường học.' },
  ],
};
const pptx = { name: 'Ke-hoach.pptx', slideCount: 2, slides: [
  { number: 1, text: 'Giảm rác nhựa' }, { number: 2, text: 'Giải pháp phân loại rác' },
] };
const save = (session = sample, who = owner) => saveCompletedPracticeSession(session, 180, who);

describe('Phase 8.3 local assessment evidence records', () => {
  test('refuses to invent reports for missing sessions and other owners', () => {
    expect(previewAssessmentReport(sample.id, owner)).toBeNull();
    expect(() => saveAssessmentReport(sample.id, owner)).toThrow();
    save(sample, guest);
    expect(previewAssessmentReport(sample.id, owner)).toBeNull();
    expect(getAssessmentReport(sample.id, owner)).toBeNull();
    expect(listAssessmentReports(owner)).toEqual([]);
  });

  test('uses real session metadata and unavailable criteria, never mock scores', () => {
    save({ ...sample, transcriptSegments: undefined, speakingGoal: undefined }, guest);
    const report = saveAssessmentReport(sample.id, guest);
    expect(report.overallScore).toBeNull();
    expect(report.observations.durationSeconds).toBe(180);
    expect(report.observations.transcriptCharacterCount).toBe(0);
    expect(report.criteria).toHaveLength(5);
    expect(report.criteria.every(c => c.state === 'insufficient_data')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('8.8');
    expect(getAssessmentReport(sample.id, guest)?.stale).toBe(false);
  });

  test('uses TXT, goal and PPTX as source availability only; stores no source text', () => {
    save();
    saveLocalReviewSlides(sample.id, owner, pptx);
    const report = saveAssessmentReport(sample.id, owner);
    expect(report.criteria.map(x => x.state)).toEqual(Array(5).fill('source_available'));
    expect(report.overallScore).toBeNull();
    expect(report.observations.pptxTextSlideCount).toBe(2);
    const raw = store.get('speaklab_assessment_reports_v1');
    expect(raw).not.toContain(sample.topic);
    expect(raw).not.toContain(sample.transcriptSegments[0].text);
    expect(raw).not.toContain('Giải pháp phân loại rác');
    expect(raw).not.toContain('video');
  });

  test('editing or deleting source makes saved snapshot stale; rebuilt output has no old TXT', () => {
    save();
    saveAssessmentReport(sample.id, owner);
    expect(getAssessmentReport(sample.id, owner)?.stale).toBe(false);
    deleteCompletedPracticeTranscript(sample.id, owner);
    const stored = getAssessmentReport(sample.id, owner);
    expect(stored?.stale).toBe(true);
    expect(stored?.report.observations.transcriptCharacterCount).toBe(0);
    expect(stored?.report.criteria[0].state).toBe('insufficient_data');
    expect(JSON.stringify(stored)).not.toContain(sample.transcriptSegments[0].text);
    saveAssessmentReport(sample.id, owner);
    expect(getAssessmentReport(sample.id, owner)?.stale).toBe(false);
  });

  test('deleting slide text marks stored report stale and R4 unavailable', () => {
    save(); saveLocalReviewSlides(sample.id, owner, pptx);
    saveAssessmentReport(sample.id, owner);
    deleteLocalReviewSlides(sample.id, owner);
    const stored = getAssessmentReport(sample.id, owner);
    expect(stored?.stale).toBe(true);
    expect(stored?.report.criteria.find(x => x.id === 'R4')?.state).toBe('insufficient_data');
  });

  test('same session ID in guest and Google groups is handled independently', () => {
    save(sample, guest);
    save(sample, owner);
    saveAssessmentReport(sample.id, guest);
    saveAssessmentReport(sample.id, owner);
    expect(listAssessmentReports(guest)).toHaveLength(1);
    expect(listAssessmentReports(owner)).toHaveLength(1);
    expect(deleteAssessmentReport(sample.id, guest)).toBe(true);
    expect(getAssessmentReport(sample.id, guest)).toBeNull();
    expect(getAssessmentReport(sample.id, owner)).not.toBeNull();
  });

  test('corrupt and fabricated records are ignored, not treated as valid reports', () => {
    save();
    store.set('speaklab_assessment_reports_v1', '[{"sessionId":"ses_fake_12345","ownerSub":"guest","sourceFingerprint":"00000000","schemaVersion":1,"createdAt":"bad"}]');
    expect(listAssessmentReports(guest)).toEqual([]);
    store.set('speaklab_assessment_reports_v1', '{broken');
    expect(listAssessmentReports(owner)).toEqual([]);
  });
});
