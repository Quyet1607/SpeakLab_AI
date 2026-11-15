import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
  clearGuestLocalReviewSlides, getLocalReviewSlides, saveLocalReviewSlides,
} from '../src/services/localReviewSlideLibrary.ts';

const previousStorage = globalThis.localStorage;
const memory = new Map();
beforeAll(() => {
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, String(value)); },
    removeItem: key => memory.delete(key),
  };
});
beforeEach(() => memory.clear());
afterAll(() => { globalThis.localStorage = previousStorage; });

describe('Google-owned local slide text library', () => {
  test('guest slide text is removed without touching a Google-owned record', () => {
    const pptx = { name: 'Bai-thuyet-trinh.pptx', slideCount: 1, slides: [{ number: 1, text: 'Nội dung nghiên cứu' }] };
    saveLocalReviewSlides('ses_test_12345', '12345', pptx);
    const [googleRecord] = JSON.parse(memory.get('speaklab_local_review_slides_v1'));
    memory.set('speaklab_local_review_slides_v1', JSON.stringify([
      { ...googleRecord, sessionId: 'ses_guest_12345', ownerSub: null, name: 'Slide khách' },
      googleRecord,
    ]));

    expect(clearGuestLocalReviewSlides()).toBe(1);
    expect(getLocalReviewSlides('ses_test_12345', '12345')?.name).toBe('Bai-thuyet-trinh.pptx');
    expect(JSON.parse(memory.get('speaklab_local_review_slides_v1'))).toHaveLength(1);
  });

  test('does not allow saving slide text without a Google owner', () => {
    const pptx = { name: 'Bai-thuyet-trinh.pptx', slideCount: 1, slides: [{ number: 1, text: 'Nội dung nghiên cứu' }] };
    expect(() => saveLocalReviewSlides('ses_test_12345', '', pptx)).toThrow('Không xác định được buổi luyện');
  });
});
