/** Local-only slide TEXT per completed session. Never stores PPTX bytes or uploads. */
import type { ReviewPptxText, ReviewSlide } from './pptxReviewText';

const KEY = 'speaklab_local_review_slides_v1';
const MAX_RECORDS = 100;

export type LocalReviewSlides = {
  sessionId: string;
  ownerSub: string;
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
        typeof x.ownerSub === 'string' && /^[0-9]{5,64}$/u.test(x.ownerSub) &&
        typeof x.name === 'string' && x.name.length <= 150 &&
        Number.isInteger(x.slideCount) && x.slideCount! >= 1 && x.slideCount! <= 40 &&
        Array.isArray(x.slides) && x.slides.length <= 40 &&
        x.slides.every(s => Number.isInteger(s?.number) && typeof s?.text === 'string' && s.text.length <= 900) &&
        typeof x.savedAt === 'string';
    }).slice(0, MAX_RECORDS);
  } catch { return []; }
}

/** Remove legacy guest/unassigned slide text while retaining Google-owned records. */
export function clearGuestLocalReviewSlides(): number {
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
  if (removed > 0) {
    try { localStorage.setItem(KEY, JSON.stringify(retained)); }
    catch { throw new Error('Không thể xóa nội dung slide của tài khoản khách.'); }
  }
  return removed;
}

export function getLocalReviewSlides(sessionId: string, ownerSub: string): LocalReviewSlides | null {
  return readAll().find(item => item.sessionId === sessionId && item.ownerSub === ownerSub) || null;
}

export function saveLocalReviewSlides(
  sessionId: string, ownerSub: string, pptx: ReviewPptxText,
): LocalReviewSlides | null {
  if (!pptx.slides.length) return null;
  if (!/^ses_[\w-]{5,100}$/u.test(sessionId) || !/^[0-9]{5,64}$/u.test(ownerSub)) {
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

export function deleteLocalReviewSlides(sessionId: string, ownerSub: string): boolean {
  const all = readAll();
  const filtered = all.filter(x => !(x.sessionId === sessionId && x.ownerSub === ownerSub));
  if (all.length === filtered.length) return false;
  localStorage.setItem(KEY, JSON.stringify(filtered));
  return true;
}
