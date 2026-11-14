/** Phase 7.3.2: device-only storage for AI speaking reviews. */
export type AiReviewPoint = {
  point: string;
  evidenceId: string;
  evidence: string;
  action?: string;
  slideNumber?: number;
};

export type AiReviewSlidePoint = AiReviewPoint & {
  slideNumber: number;
  /** Optional detailed fields: older saved reviews remain readable. */
  status?: 'matched' | 'partial' | 'not_found' | 'possible_difference';
  slideQuote?: string;
  spokenQuote?: string;
  covered?: string;
  missing?: string;
  action?: string;
};

export type AiSlideTextOverview = {
  slideNumber: number;
  slideExcerpt: string;
  keywordSignal: 'shared_keywords' | 'no_shared_keywords' | 'insufficient_text';
  sharedKeywords: string[];
};

export type AiSlideReviewStats = {
  target: number;
  received: number;
  accepted: number;
  rejected: number;
};

export type AiSpeechReview = {
  summary: string;
  strengths: AiReviewPoint[];
  improvements: AiReviewPoint[];
  slideComparisons: AiReviewSlidePoint[];
  slideOverview?: AiSlideTextOverview[];
  slideReviewStats?: AiSlideReviewStats;
  limitations: string[];
  source: 'transcript' | 'transcript_and_pptx';
  model: string;
};

export type LocalAiReviewReport = {
  sessionId: string;
  ownerSub: string;
  createdAt: string;
  inputFingerprint: string;
  topic: string;
  topicDescription: string;
  speakingGoal: string;
  transcriptLength: number;
  slideName: string;
  slideCount: number;
  review: AiSpeechReview;
};

const KEY = 'speaklab_local_ai_reviews_v1';
const MAX_RECORDS = 200;

function validPoint(value: unknown, withAction: boolean, withSlide: boolean): value is AiReviewPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<AiReviewPoint>;
  return typeof point.point === 'string' && point.point.length > 0 && point.point.length <= 500 &&
    typeof point.evidenceId === 'string' && /^E[1-9][0-9]{0,2}$/u.test(point.evidenceId) &&
    typeof point.evidence === 'string' && point.evidence.length > 0 && point.evidence.length <= 650 &&
    (withAction
      ? typeof point.action === 'string' && point.action.length > 0 && point.action.length <= 400
      : point.action === undefined) &&
    (withSlide
      ? Number.isInteger(point.slideNumber) && point.slideNumber! >= 1 && point.slideNumber! <= 500
      : point.slideNumber === undefined);
}

function validSlidePoint(value: unknown): value is AiReviewSlidePoint {
  if (!value || typeof value !== 'object') return false;
  const x = value as Partial<AiReviewSlidePoint>;
  if (x.status === undefined) return validPoint(value, false, true); // Phase 7.3.2 reports
  if (!['matched', 'partial', 'not_found', 'possible_difference'].includes(x.status) ||
      !Number.isInteger(x.slideNumber) || x.slideNumber! < 1 || x.slideNumber! > 500 ||
      typeof x.point !== 'string' || x.point.length < 8 || x.point.length > 450 ||
      typeof x.slideQuote !== 'string' || x.slideQuote.length < 1 || x.slideQuote.length > 220 ||
      typeof x.spokenQuote !== 'string' || x.spokenQuote.length > 220 ||
      typeof x.covered !== 'string' || x.covered.length < 8 || x.covered.length > 400 ||
      typeof x.missing !== 'string' || x.missing.length < 8 || x.missing.length > 400 ||
      typeof x.action !== 'string' || x.action.length < 8 || x.action.length > 400 ||
      typeof x.evidenceId !== 'string' || typeof x.evidence !== 'string' || x.evidence.length > 650) return false;
  return x.status === 'not_found'
    ? x.evidenceId === '' && x.evidence === '' && x.spokenQuote === ''
    : /^E[1-9][0-9]{0,2}$/u.test(x.evidenceId) && x.evidence.length > 0 && x.spokenQuote.length >= 4;
}

function validSlideOverview(value: unknown): value is AiSlideTextOverview[] {
  return Array.isArray(value) && value.length <= 40 &&
    value.every((x: Partial<AiSlideTextOverview> | null) => !!x &&
      Number.isInteger(x.slideNumber) && x.slideNumber! >= 1 && x.slideNumber! <= 500 &&
      typeof x.slideExcerpt === 'string' && x.slideExcerpt.length <= 140 &&
      ['shared_keywords', 'no_shared_keywords', 'insufficient_text'].includes(x.keywordSignal || '') &&
      Array.isArray(x.sharedKeywords) && x.sharedKeywords.length <= 4 &&
      x.sharedKeywords.every(word => typeof word === 'string' && word.length <= 100)) &&
    new Set(value.map(x => x.slideNumber)).size === value.length;
}

function validSlideReviewStats(value: unknown, validCount: number): value is AiSlideReviewStats {
  if (!value || typeof value !== 'object') return false;
  const stats = value as Partial<AiSlideReviewStats>;
  return Number.isInteger(stats.target) && stats.target! >= 1 && stats.target! <= 6 &&
    Number.isInteger(stats.received) && stats.received! >= 0 && stats.received! <= 100 &&
    Number.isInteger(stats.accepted) && stats.accepted === validCount &&
    Number.isInteger(stats.rejected) && stats.rejected! >= 0 &&
    stats.received === stats.accepted + stats.rejected;
}

function validReview(value: unknown): value is AiSpeechReview {
  if (!value || typeof value !== 'object') return false;
  const review = value as Partial<AiSpeechReview>;
  return typeof review.summary === 'string' && review.summary.length >= 1 && review.summary.length <= 850 &&
    Array.isArray(review.strengths) && review.strengths.length === 2 &&
    review.strengths.every(point => validPoint(point, false, false)) &&
    Array.isArray(review.improvements) && review.improvements.length === 2 &&
    review.improvements.every(point => validPoint(point, true, false)) &&
    Array.isArray(review.slideComparisons) && review.slideComparisons.length <= 8 &&
    review.slideComparisons.every(validSlidePoint) &&
    new Set(review.slideComparisons.map(point => point.slideNumber)).size === review.slideComparisons.length &&
    (review.slideOverview === undefined || validSlideOverview(review.slideOverview)) &&
    (review.slideReviewStats === undefined ||
      validSlideReviewStats(review.slideReviewStats, review.slideComparisons.length)) &&
    Array.isArray(review.limitations) && review.limitations.length <= 4 &&
    review.limitations.every(item => typeof item === 'string' && item.length <= 300) &&
    (review.source === 'transcript' || review.source === 'transcript_and_pptx') &&
    typeof review.model === 'string' && review.model.length > 0 && review.model.length <= 80;
}

function validRecord(value: unknown): value is LocalAiReviewReport {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalAiReviewReport>;
  return typeof item.sessionId === 'string' && /^ses_[\w-]{5,100}$/u.test(item.sessionId) &&
    typeof item.ownerSub === 'string' && /^[0-9]{5,64}$/u.test(item.ownerSub) &&
    typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.inputFingerprint === 'string' && /^[a-f0-9]{8}$/u.test(item.inputFingerprint) &&
    typeof item.topic === 'string' && item.topic.length <= 120 &&
    typeof item.topicDescription === 'string' && item.topicDescription.length <= 800 &&
    typeof item.speakingGoal === 'string' && item.speakingGoal.length <= 400 &&
    Number.isInteger(item.transcriptLength) && item.transcriptLength! >= 20 && item.transcriptLength! <= 24000 &&
    typeof item.slideName === 'string' && item.slideName.length <= 150 &&
    Number.isInteger(item.slideCount) && item.slideCount! >= 0 && item.slideCount! <= 40 &&
    validReview(item.review);
}

function readAll(): LocalAiReviewReport[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data.filter(validRecord).slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

function writeAll(records: LocalAiReviewReport[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    throw new Error('Không lưu được nhận xét AI trên trình duyệt. Hãy kiểm tra dung lượng lưu trữ.');
  }
}

/** A change detector only; this non-cryptographic hash is not used for security. */
export function reviewInputFingerprint(input: {
  topic: string;
  topicDescription?: string;
  speakingGoal?: string;
  transcript: string;
  slides: Array<{ number: number; text: string }>;
}): string {
  const serialized = JSON.stringify([
    input.topic,
    input.topicDescription || '',
    input.speakingGoal || '',
    input.transcript,
    input.slides.map(slide => [slide.number, slide.text]),
  ]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index++) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getLocalAiReview(sessionId: string, ownerSub: string | null): LocalAiReviewReport | null {
  if (!ownerSub) return null;
  return readAll().find(item => item.sessionId === sessionId && item.ownerSub === ownerSub) || null;
}

export function saveLocalAiReview(
  report: Omit<LocalAiReviewReport, 'createdAt'>,
): LocalAiReviewReport {
  if (!/^ses_[\w-]{5,100}$/u.test(report.sessionId) ||
      !/^[0-9]{5,64}$/u.test(report.ownerSub) ||
      !/^[a-f0-9]{8}$/u.test(report.inputFingerprint) ||
      !validReview(report.review)) {
    throw new Error('Thông tin nhận xét AI chưa hợp lệ để lưu.');
  }
  const record: LocalAiReviewReport = {
    ...report,
    createdAt: new Date().toISOString(),
  };
  if (!validRecord(record)) throw new Error('Thông tin nhận xét AI vượt giới hạn lưu trữ.');
  const remaining = readAll().filter(item =>
    !(item.sessionId === record.sessionId && item.ownerSub === record.ownerSub));
  writeAll([record, ...remaining]);
  return record;
}

export function deleteLocalAiReview(sessionId: string, ownerSub: string | null): boolean {
  if (!ownerSub) return false;
  const records = readAll();
  const filtered = records.filter(item => !(item.sessionId === sessionId && item.ownerSub === ownerSub));
  if (records.length === filtered.length) return false;
  writeAll(filtered);
  return true;
}
