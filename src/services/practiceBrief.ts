/**
 * Phase 7.1: structured context explicitly supplied by the learner.
 * No AI inference, API requests, audio processing, or uploading involved.
 */
export const PRACTICE_BRIEF_LIMITS = {
  topicTitle: 120,
  topicDescription: 800,
  speakingGoal: 400,
} as const;

export interface PracticeBrief {
  topicTitle: string;
  topicDescription: string;
  speakingGoal: string;
}

/** Normalize user input, keeping descriptions readable and within local storage limits. */
export function normalizePracticeBrief(value: Partial<PracticeBrief>): PracticeBrief {
  const singleLine = (text: string | undefined, max: number): string =>
    (text || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  const multiLine = (text: string | undefined, max: number): string =>
    (text || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
      .split('\n').map(s => s.replace(/\s+/g, ' ').trim()).join('\n').trim().slice(0, max).trim();
  return {
    topicTitle: singleLine(value.topicTitle, PRACTICE_BRIEF_LIMITS.topicTitle),
    topicDescription: multiLine(value.topicDescription, PRACTICE_BRIEF_LIMITS.topicDescription),
    speakingGoal: multiLine(value.speakingGoal, PRACTICE_BRIEF_LIMITS.speakingGoal),
  };
}

export function validatePracticeBrief(value: Partial<PracticeBrief>): string | null {
  if (!normalizePracticeBrief(value).topicTitle) {
    return 'Vui lòng nhập tên đề tài trước khi vào phòng luyện tập.';
  }
  return null;
}
