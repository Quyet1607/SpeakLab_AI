/** Extract ONLY editable slide text locally from a PPTX. Never upload the file. */
import JSZip from 'jszip';
import { MAX_PPTX_SIZE_BYTES } from './pptxService';

export type ReviewSlide = { number: number; text: string };
export type ReviewPptxText = {
  name: string;
  slides: ReviewSlide[];
  slideCount: number;
};

/** Parse Open XML text runs; images, graphs, screenshots and diagrams are not recognized. */
export async function extractPptxTextForReview(file: File): Promise<ReviewPptxText> {
  if (!file.name.toLowerCase().endsWith('.pptx') || file.size === 0 ||
    file.size > MAX_PPTX_SIZE_BYTES) {
    throw new Error('Chỉ đọc PowerPoint .pptx hợp lệ, tối đa 30 MB.');
  }
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
  catch { throw new Error('Không đọc được cấu trúc tệp PPTX.'); }
  if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) {
    throw new Error('Tệp không phải PowerPoint Open XML hợp lệ.');
  }

  const names = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/iu.test(p))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/iu)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/iu)?.[1] || 0));
  if (!names.length) throw new Error('PowerPoint không có slide.');
  if (names.length > 40) throw new Error('Tạm thời chỉ phân tích PPTX có tối đa 40 slide.');
  const slides: ReviewSlide[] = [];
  let totalChars = 0;
  for (const path of names) {
    const xml = await zip.file(path)!.async('text');
    let content: string;
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('Một slide có XML không hợp lệ.');
      content = [...doc.getElementsByTagNameNS('*', 't')].map(node => node.textContent || '')
        .join(' ').replace(/\s+/gu, ' ').trim();
    } else {
      // In headless test environments, no DOMParser is available.
      content = [...xml.matchAll(/<(?:[\w-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?t>/giu)]
        .map(match => match[1].replace(/&amp;/gu, '&').replace(/&lt;/gu, '<')
          .replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&apos;/gu, "'"))
        .join(' ').replace(/\s+/gu, ' ').trim();
    }
    if (content.length > 900) {
      throw new Error('Một slide có hơn 900 ký tự; hãy rút gọn nội dung trước khi phân tích để tránh bỏ sót.');
    }
    totalChars += content.length;
    if (totalChars > 16000) throw new Error('Tổng nội dung slide quá dài để phân tích miễn phí.');
    const number = Number(path.match(/slide(\d+)\.xml/iu)?.[1]);
    if (content) slides.push({ number, text: content });
  }
  return { name: file.name.slice(0, 150), slides, slideCount: names.length };
}
