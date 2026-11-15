import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import JSZip from 'jszip';
import { extractPptxTextForReview } from '../src/services/pptxReviewText.ts';
import {
  saveLocalReviewSlides, getLocalReviewSlides, deleteLocalReviewSlides,
} from '../src/services/localReviewSlideLibrary.ts';

const previousStorage = globalThis.localStorage;
let saved = new Map();
const storage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => { saved.set(key, value); },
  removeItem: key => { saved.delete(key); },
};

beforeAll(() => { globalThis.localStorage = storage; });
afterAll(() => { globalThis.localStorage = previousStorage; });

async function makePptx(text = 'AI hỗ trợ học sinh và giáo viên') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:t>' + text + '</a:t></p:sld>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return new File([bytes], 'Bai-thuyet-trinh.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

describe('Phase 7.3.1 optional PPTX review evidence', () => {
  test('extracts editable slide text locally, without uploading file', async () => {
    const file = await makePptx();
    const result = await extractPptxTextForReview(file);
    expect(result.name).toBe('Bai-thuyet-trinh.pptx');
    expect(result.slideCount).toBe(1);
    expect(result.slides).toEqual([{ number: 1, text: 'AI hỗ trợ học sinh và giáo viên' }]);
  });

  test('accepts image-only slides as empty text and refuses bad file types', async () => {
    expect((await extractPptxTextForReview(await makePptx(''))).slides).toEqual([]);
    await expect(extractPptxTextForReview(new File(['x'], 'fake.pptx'))).rejects.toThrow();
    await expect(extractPptxTextForReview(new File(['x'], 'fake.pdf'))).rejects.toThrow();
  });

  test('keeps slide evidence per session/account, separate from transcripts and videos', async () => {
    saved = new Map();
    const info = await extractPptxTextForReview(await makePptx());
    const stored = saveLocalReviewSlides('ses_123456', '123456789', info);
    expect(stored?.slides).toHaveLength(1);
    expect(getLocalReviewSlides('ses_123456', '123456789')?.name).toBe(info.name);
    expect(getLocalReviewSlides('ses_123456', '99999999')).toBeNull();
    expect(getLocalReviewSlides('ses_765432', '123456789')).toBeNull();
    expect(deleteLocalReviewSlides('ses_123456', '123456789')).toBe(true);
    expect(getLocalReviewSlides('ses_123456', '123456789')).toBeNull();
  });
});
