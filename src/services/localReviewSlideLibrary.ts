/** Local-only slide TEXT per completed session. Never stores PPTX bytes or uploads. */
import type { ReviewPptxText, ReviewSlide } from './pptxReviewText';

const KEY = 'speaklab_local_review_slides_v1';
const MAX_RECORDS = 100;

export type LocalReviewSlides = {
  sessionId: string;
  ownerSub: string | null;
  name: string;
  slideCount: number;
  slides: ReviewSlide[];
  savedAt: string;
};

function readAll(): LocalReviewSlides[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is LocalReviewSlides => {
      const x = item as Partial<LocalReviewSlides> | null;
      return !!x && typeof x.sessionId === 'string' &&
        /^ses_[\w-]{5,100}$/u.test(x.sessionId) &&
        (x.ownerSub === null || typeof x.ownerSub === 'string' && /^[0-9]{5,64}$/u.test(x.ownerSub)) &&
        typeof x.name === 'string' && x.name.length <= 150 &&
        Number.isInteger(x.slideCount) && x.slideCount! >= 1 && x.slideCount! <= 40 &&
        Array.isArray(x.slides) && x.slides.length <= 40 &&
        x.slides.every(s => Number.isInteger(s?.number) && typeof s?.text === 'string' && s.text.length <= 900) &&
        typeof x.savedAt === 'string';
    }).slice(0, MAX_RECORDS);
  } catch { return []; }
}

export function getLocalReviewSlides(sessionId: string, ownerSub: string | null): LocalReviewSlides | null {
  return readAll().find(item => item.sessionId === sessionId && item.ownerSub === ownerSub) || null;
}

export function saveLocalReviewSlides(
  sessionId: string, ownerSub: string | null, pptx: ReviewPptxText,
): LocalReviewSlides | null {
  if (!pptx.slides.length) return null;
  if (!/^ses_[\w-]{5,100}$/u.test(sessionId) ||
      (ownerSub !== null && !/^[0-9]{5,64}$/u.test(ownerSub))) {
    throw new Error('Không xác định được buổi luyện để lưu nội dung slide.');
  }
  const record: LocalReviewSlides = {
    sessionId, ownerSub, name: pptx.name.slice(0, 150),
    slideCount: pptx.slideCount, slides: pptx.slides,
    savedAt: new Date().toISOString(),
  };
  const all = readAll().filter(x => !(x.sessionId === sessionId && x.ownerSub === ownerSub));
  try { localStorage.setItem(KEY, JSON.stringify([record, ...all].slice(0, MAX_RECORDS))); }
  catch { throw new Error('Không đủ dung lượng để lưu văn bản slide trên trình duyệt.'); }
  return record;
}

export function deleteLocalReviewSlides(sessionId: string, ownerSub: string | null): boolean {
  const all = readAll();
  const filtered = all.filter(x => !(x.sessionId === sessionId && x.ownerSub === ownerSub));
  if (all.length === filtered.length) return false;
  localStorage.setItem(KEY, JSON.stringify(filtered));
  return true;
}
