/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { parse as parseWebPpt, renderSlideToSvg, type Presentation, type Slide } from '@web-ppt/core';
import { PptxDocumentInfo, PresentationSource } from '../types';

/**
 * Maximum allowed PowerPoint file size in megabytes.
 * Configured as a constant so it can be adjusted easily in future releases.
 */
export const MAX_PPTX_SIZE_MB = 30;
export const MAX_PPTX_SIZE_BYTES = MAX_PPTX_SIZE_MB * 1024 * 1024;

/**
 * Format bytes to readable Vietnamese format (e.g. "8,5 MB", "420 KB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Validates and extracts basic structure from a real PowerPoint (.pptx) file.
 * Operates purely client-side without sending data to any external server.
 */
export async function validateAndParsePptx(file: File): Promise<PptxDocumentInfo> {
  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();

  // 1. Extension and Format Validation
  if (lowerName.endsWith('.ppt')) {
    throw new Error(
      'Định dạng PowerPoint cũ (.ppt) chưa được hỗ trợ. Vui lòng mở tệp trên PowerPoint hoặc WPS và lưu lại thành định dạng .pptx (Office Open XML).'
    );
  }

  if (lowerName.endsWith('.pptm')) {
    throw new Error(
      'Tệp PowerPoint chứa macro (.pptm) không được hỗ trợ để đảm bảo an toàn. Vui lòng chuyển sang định dạng .pptx tiêu chuẩn.'
    );
  }

  if (lowerName.endsWith('.pdf')) {
    throw new Error(
      'Định dạng PDF chưa được hỗ trợ trong Đợt 2.1. Vui lòng chọn tệp bản trình chiếu PowerPoint (.pptx).'
    );
  }

  if (!lowerName.endsWith('.pptx')) {
    const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
    throw new Error(
      `Định dạng tệp "${ext || 'không xác định'}" không hợp lệ. SpeakLab AI chỉ chấp nhận tệp Microsoft PowerPoint (.pptx).`
    );
  }

  // 2. File Size Validation
  if (file.size === 0) {
    throw new Error('Tệp tải lên rỗng (0 bytes). Vui lòng kiểm tra lại tệp PowerPoint của bạn.');
  }

  if (file.size > MAX_PPTX_SIZE_BYTES) {
    throw new Error(
      `Dung lượng tệp (${formatFileSize(file.size)}) vượt quá giới hạn tối đa ${MAX_PPTX_SIZE_MB} MB. Vui lòng nén bớt hình ảnh chất lượng cao trong slide hoặc chọn tệp nhỏ hơn.`
    );
  }

  // 3. ZIP Structure & Office Open XML Packaging Validation
  let zip: JSZip;
  try {
    const arrayBuffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (err) {
    throw new Error(
      'Tệp bị lỗi cấu trúc nén hoặc không phải là tệp Microsoft PowerPoint (.pptx) hợp lệ. Tệp có thể đã bị đổi phần mở rộng từ định dạng khác hoặc bị hỏng dữ liệu.'
    );
  }

  // Check required Office Open XML core files
  const contentTypesEntry = zip.file('[Content_Types].xml');
  if (!contentTypesEntry) {
    throw new Error(
      'Tệp thiếu thành phần cốt lõi [Content_Types].xml của chuẩn Office Open XML. Đây không phải là tệp PowerPoint .pptx hợp chuẩn.'
    );
  }

  const presentationEntry = zip.file('ppt/presentation.xml');
  if (!presentationEntry) {
    throw new Error(
      'Tệp không chứa cấu trúc trình chiếu ppt/presentation.xml. Vui lòng kiểm tra lại tệp bản trình bày PowerPoint của bạn.'
    );
  }

  // 4. Accurate Slide Count Extraction from ppt/presentation.xml
  let slideCount = 0;
  let presentationXmlText = '';
  try {
    presentationXmlText = await presentationEntry.async('text');
  } catch (err) {
    throw new Error(
      'Không thể giải nén dữ liệu ppt/presentation.xml bên trong tệp PowerPoint. Tệp có thể đã bị hỏng.'
    );
  }

  // Check with DOMParser if available in browser
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(presentationXmlText, 'application/xml');
      const parserErrors = xmlDoc.getElementsByTagName('parsererror');

      if (parserErrors.length === 0) {
        const sldIdNodes = xmlDoc.getElementsByTagNameNS('*', 'sldId');
        if (sldIdNodes && sldIdNodes.length > 0) {
          slideCount = sldIdNodes.length;
        }
      }
    } catch {
      // Proceed to regex fallback
    }
  }

  // Fallback 1: Regex matching <p:sldId or <sldId tags in presentation.xml
  if (slideCount === 0 && presentationXmlText) {
    const regexMatches = presentationXmlText.match(/<(?:\w+:)?sldId\b/gi);
    if (regexMatches) {
      slideCount = regexMatches.length;
    }
  }

  // Fallback 2: Count ppt/slides/slide*.xml entries in the zip archive
  if (slideCount === 0) {
    const slideEntries = Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(path)
    );
    if (slideEntries.length > 0) {
      slideCount = slideEntries.length;
    }
  }

  if (slideCount === 0) {
    throw new Error(
      'Tệp PowerPoint hợp lệ nhưng không tìm thấy bất kỳ trang slide nào trong tài liệu. Vui lòng chọn tệp có nội dung trình chiếu.'
    );
  }

  return {
    file,
    name: fileName,
    sizeBytes: file.size,
    sizeFormatted: formatFileSize(file.size),
    slideCount,
    parsedAt: new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    status: 'valid',
  };
}

/**
 * In-memory session store for uploaded PPTX documents and their parsed @web-ppt/core models.
 * Keeps the uploaded file and SVG render cache in memory across client-side page transitions.
 * Does NOT persist File objects to localStorage.
 */
class PptxSessionStore {
  private currentPptx: PptxDocumentInfo | null = null;
  private parsedPresentation: Presentation | null = null;
  private svgCache = new Map<number, string>();
  private loadPromise: Promise<Presentation | null> | null = null;

  private currentSource: PresentationSource = {
    type: 'demo',
    deckId: 'deck_ai_waste',
    name: 'Bảo vệ Đề tài: Phân loại Rác Thông minh bằng AI',
    slideCount: 6,
    status: 'ready',
  };

  getPptx(): PptxDocumentInfo | null {
    return this.currentPptx;
  }

  setPptx(info: PptxDocumentInfo | null) {
    if (this.currentPptx?.file !== info?.file) {
      this.disposeCurrent();
    }
    this.currentPptx = info;
    if (info) {
      this.currentSource = {
        type: 'pptx',
        pptxInfo: info,
        name: info.name,
        slideCount: info.slideCount,
        status: 'ready',
      };
    } else {
      this.currentSource = {
        type: 'demo',
        deckId: 'deck_ai_waste',
        name: 'Bảo vệ Đề tài: Phân loại Rác Thông minh bằng AI',
        slideCount: 6,
        status: 'ready',
      };
    }
  }

  /**
   * Loads and parses the full Presentation model via @web-ppt/core.
   * Caches the presentation instance so repeated calls are instant.
   */
  async loadPresentation(file?: File): Promise<Presentation | null> {
    const targetFile = file || this.currentPptx?.file;
    if (!targetFile) return null;

    if (this.parsedPresentation) {
      return this.parsedPresentation;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const pres = await parseWebPpt(targetFile);
        this.parsedPresentation = pres;

        // Synchronize accurate slide count
        if (pres.slides.length > 0) {
          if (this.currentPptx) {
            this.currentPptx.slideCount = pres.slides.length;
          }
          this.currentSource.slideCount = pres.slides.length;
        }

        return pres;
      } catch (err) {
        console.error('Lỗi khi nạp mô hình trình chiếu PPTX:', err);
        throw err;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  getParsedPresentation(): Presentation | null {
    return this.parsedPresentation;
  }

  /**
   * Render a specific slide index to an SVG string using @web-ppt/core with in-memory caching.
   */
  renderSlideSvg(slideIndex: number): string {
    if (!this.parsedPresentation) {
      throw new Error('Chưa nạp tài liệu PowerPoint vào bộ nhớ.');
    }

    const slides = this.parsedPresentation.slides;
    if (slideIndex < 0 || slideIndex >= slides.length) {
      throw new Error(`Chỉ mục slide không hợp lệ: ${slideIndex + 1}/${slides.length}`);
    }

    const cached = this.svgCache.get(slideIndex);
    if (cached) {
      return cached;
    }

    const slide = slides[slideIndex];
    // textMode: 'html' generates optimal screen layout with foreignObject and full Vietnamese typography support
    const svg = renderSlideToSvg(this.parsedPresentation, slide, { textMode: 'html' });
    this.svgCache.set(slideIndex, svg);
    return svg;
  }

  /**
   * Retrieves native speaker notes from the PowerPoint slide if present.
   */
  getSlideNotes(slideIndex: number): string | undefined {
    if (!this.parsedPresentation) return undefined;
    const slide = this.parsedPresentation.slides[slideIndex];
    return slide?.notes?.trim() || undefined;
  }

  /**
   * Cleans up blob URLs and caches when switching files or leaving session.
   */
  disposeCurrent() {
    if (this.parsedPresentation?.dispose) {
      try {
        this.parsedPresentation.dispose();
      } catch (e) {
        // Safe disposal fallback
      }
    }
    this.parsedPresentation = null;
    this.svgCache.clear();
    this.loadPromise = null;
  }

  clearPptx() {
    this.disposeCurrent();
    this.setPptx(null);
  }

  getSource(): PresentationSource {
    return this.currentSource;
  }

  setDemoSource(deckId: string, deckName: string, slideCount: number) {
    this.currentSource = {
      type: 'demo',
      deckId,
      name: deckName,
      slideCount,
      status: 'ready',
    };
  }
}

export const pptxSessionStore = new PptxSessionStore();
