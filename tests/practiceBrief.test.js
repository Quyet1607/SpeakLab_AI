import { describe, expect, test } from 'bun:test';
import {
  normalizePracticeBrief, validatePracticeBrief, PRACTICE_BRIEF_LIMITS,
} from '../src/services/practiceBrief.ts';
import { sessionService } from '../src/services/sessionService.ts';

describe('phase 7.1 learner-entered practice brief', () => {
  test('requires a real topic, never silently fills a sample topic', () => {
    expect(validatePracticeBrief({ topicTitle: '    ' })).toContain('nhập tên đề tài');
    expect(validatePracticeBrief({ topicTitle: '\n\t' })).toContain('nhập tên đề tài');
    expect(validatePracticeBrief({ topicTitle: 'Phát triển ứng dụng học tập' })).toBeNull();
  });

  test('normalizes newlines and limits the length of every field', () => {
    const brief = normalizePracticeBrief({
      topicTitle: '  Kỹ năng   thuyết trình \t',
      topicDescription: ' Bối cảnh học tập\r\n Nội dung khảo sát\n',
      speakingGoal: '  Trả lời   phản biện \n  rõ ràng   ',
    });
    expect(brief.topicTitle).toBe('Kỹ năng thuyết trình');
    expect(brief.topicDescription).toBe('Bối cảnh học tập\nNội dung khảo sát');
    expect(brief.speakingGoal).toBe('Trả lời phản biện\nrõ ràng');
    const long = normalizePracticeBrief({
      topicTitle: 'A'.repeat(400),
      topicDescription: 'B'.repeat(1600),
      speakingGoal: 'C'.repeat(900),
    });
    expect(long.topicTitle.length).toBe(PRACTICE_BRIEF_LIMITS.topicTitle);
    expect(long.topicDescription.length).toBe(PRACTICE_BRIEF_LIMITS.topicDescription);
    expect(long.speakingGoal.length).toBe(PRACTICE_BRIEF_LIMITS.speakingGoal);
  });

  test('creates a practice session from the user brief, not from demo PPTX content', () => {
    const session = sessionService.createSession({
      title: 'Luyện bảo vệ lần 1',
      topicTitle: 'Ứng dụng AI hỗ trợ học tập',
      topicDescription: 'Khảo sát các nhu cầu của học sinh.',
      speakingGoal: 'Trình bày giải pháp rõ ràng.',
      modeId: 'defense',
      deckId: 'deck_ai_waste',
      durationMinutes: 12,
      participantCount: 6,
      presentationSource: { type: 'none', name: 'Không trình chiếu', slideCount: 0, status: 'ready' },
    });
    expect(session.title).toBe('Luyện bảo vệ lần 1');
    expect(session.topic).toBe('Ứng dụng AI hỗ trợ học tập');
    expect(session.topicDescription).toBe('Khảo sát các nhu cầu của học sinh.');
    expect(session.speakingGoal).toBe('Trình bày giải pháp rõ ràng.');
    expect(session.slideCount).toBe(0);
    expect(session.reportId).toBeUndefined();
    expect(session.score).toBeUndefined();
  });

  test('keeps PowerPoint optional, with no source file copied into the brief', () => {
    const s = sessionService.createSession({
      title: 'Luyện 2',
      topicTitle: 'Học an toàn trên mạng',
      topicDescription: '',
      speakingGoal: '',
      modeId: 'basic',
      deckId: 'deck_ai_waste',
      durationMinutes: 5,
      participantCount: 3,
    });
    expect(s.topic).toBe('Học an toàn trên mạng');
    expect(s.slideCount).toBe(0);
    expect(s.topicDescription).toBeUndefined();
    expect(s.speakingGoal).toBeUndefined();
  });
});
