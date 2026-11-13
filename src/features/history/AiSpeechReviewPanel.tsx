import React, { useEffect, useRef, useState } from 'react';
import type { SpeechTranscriptSegment } from '../../types';
import { extractPptxTextForReview } from '../../services/pptxReviewText';
import {
  deleteLocalReviewSlides, getLocalReviewSlides, saveLocalReviewSlides,
  type LocalReviewSlides,
} from '../../services/localReviewSlideLibrary';

type Point = { point: string; evidenceId: string; evidence: string; action?: string };
type SlidePoint = Point & { slideNumber: number };
type Review = {
  summary: string;
  strengths: Point[];
  improvements: Point[];
  slideComparisons: SlidePoint[];
  limitations: string[];
  source: 'transcript' | 'transcript_and_pptx';
  model: string;
};

interface Props {
  sessionId: string;
  topic: string;
  topicDescription?: string;
  speakingGoal?: string;
  ownerSub: string | null;
  segments: SpeechTranscriptSegment[];
  signedIn: boolean;
}

/** Phase 7.3.1: preview of evidence-based review; no persistence/scoring yet. */
export const AiSpeechReviewPanel: React.FC<Props> = ({
  sessionId, topic, topicDescription, speakingGoal, ownerSub, segments, signedIn,
}) => {
  const [slides, setSlides] = useState<LocalReviewSlides | null>(() => getLocalReviewSlides(sessionId, ownerSub));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const transcript = segments.map(s => s.text).filter(Boolean).join('\n').trim();

  useEffect(() => {
    setSlides(getLocalReviewSlides(sessionId, ownerSub));
    setConsent(false);
    setReview(null);
    setError(null);
    abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [sessionId, ownerSub]);

  const pickPptx = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setError(null);
    setNotice(null);
    setReview(null);
    setConsent(false); // Consent must cover the new slide text as well.
    try {
      const parsed = await extractPptxTextForReview(file);
      if (!parsed.slides.length) {
        setNotice('PowerPoint không có văn bản có thể đọc. Chỉ phân tích TXT.');
        return;
      }
      const saved = saveLocalReviewSlides(sessionId, ownerSub, parsed);
      setSlides(saved);
      setNotice('Đã đọc và lưu nội dung slide trên thiết bị. Không tải tệp PPTX lên máy chủ.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được nội dung PowerPoint.');
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clearPptx = () => {
    abortRef.current?.abort();
    deleteLocalReviewSlides(sessionId, ownerSub);
    setSlides(null);
    setReview(null);
    setConsent(false);
    setNotice('Đã bỏ văn bản slide; bạn vẫn có thể phân tích bài nói bằng TXT.');
  };

  const requestReview = async () => {
    if (busy || !consent || !signedIn) return;
    if (transcript.length < 20 || transcript.length > 24000) {
      setError('Bản ghi cần từ 20 đến 24.000 ký tự để phân tích; không được tự cắt bỏ nội dung.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setReview(null);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch('/api/ai/review', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true, sessionId, topic, topicDescription: topicDescription || '',
          speakingGoal: speakingGoal || '', transcript,
          slides: slides?.slides || [],
        }),
      });
      const data = await response.json() as { review?: Review; error?: string; remainingToday?: number };
      if (!response.ok || !data.review || !Array.isArray(data.review.strengths) ||
        !Array.isArray(data.review.improvements)) {
        throw new Error(data.error || 'Chưa nhận được nhận xét hợp lệ.');
      }
      if (!controller.signal.aborted) {
        setReview(data.review);
        setNotice('AI đã trả kết quả thử nghiệm. Còn ' + (data.remainingToday ?? '?') + ' lượt trong hạn mức nội bộ hôm nay.');
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể kết nối API AI miễn phí.');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const renderEvidence = (item: Point) => (
    <details className="mt-1 text-xs text-[#687B6D]">
      <summary className="cursor-pointer">Đối chiếu lời nói: {item.evidenceId}</summary>
      <p className="mt-1 rounded-lg border border-[#D9E5DC] bg-white p-2 whitespace-pre-wrap break-words">
        {item.evidence}
      </p>
    </details>
  );

  return (
    <section className="mt-3 rounded-xl border border-[#A7C8AC] bg-[#F2F8F3] p-3 space-y-3 text-[#304C38]"
      aria-label="Nhận xét bài thuyết trình bằng AI">
      <h4 className="font-bold text-sm">AI nhận xét bài thuyết trình · thử nghiệm 7.3.1</h4>
      <p className="text-xs">Dựa trên lời nói thực tế đã chuyển thành chữ. Không chấm điểm, không nhận xét giọng điệu hoặc hình ảnh chỉ từ TXT.</p>

      <div className="rounded-lg bg-white border border-[#D9E5DC] p-2 text-xs space-y-1">
        <p><strong>Dữ liệu cơ bản:</strong> Đề tài, mục tiêu và bản ghi lời nói ({transcript.length.toLocaleString('vi-VN')} ký tự).</p>
        <p><strong>PowerPoint:</strong> {slides?.slides.length
          ? slides.name + ' · ' + slides.slides.length + ' slide có chữ'
          : 'Không có nội dung slide; vẫn phân tích bình thường.'}</p>
        <p className="text-[#687B6D]">Chỉ đọc chữ trong slide, không nhận diện ảnh, sơ đồ hoặc thiết kế trực quan. Chia sẻ màn hình không tạo dữ liệu PPTX.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input ref={inputRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden" aria-label="Chọn PPTX cho nhận xét"
          onChange={e => { void pickPptx(e.currentTarget.files?.[0]); }} />
        <button type="button" disabled={reading || busy} onClick={() => inputRef.current?.click()}
          className="border border-[#BDD3C0] rounded-lg px-3 py-1.5 text-xs font-semibold bg-white disabled:opacity-50">
          {reading ? 'Đang đọc PPTX…' : slides ? 'Thay PowerPoint' : 'Thêm PowerPoint (tùy chọn)'}
        </button>
        {!!slides && <button type="button" disabled={busy} onClick={clearPptx}
          className="text-xs underline text-[#873631] disabled:opacity-50">Bỏ nội dung slide</button>}
      </div>

      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={consent} onChange={e => {
          setConsent(e.target.checked);
          if (!e.target.checked) { abortRef.current?.abort(); setReview(null); }
        }} className="mt-0.5" />
        <span>Tôi đồng ý gửi <strong>đề tài, mục tiêu, văn bản lời nói và chữ trong PPTX (nếu có)</strong> đến Google Gemini để nhận xét. Không gửi tệp video, âm thanh, PPTX nguyên bản hay tên tài khoản. Dữ liệu Free Tier có thể được Google dùng để cải thiện sản phẩm.</span>
      </label>

      {!signedIn && <p className="text-xs text-[#873631]">Cần đăng nhập Google ở Cài đặt để dùng dịch vụ AI.</p>}
      {transcript.length > 24000 && <p className="text-xs text-[#873631]">Bản ghi vượt giới hạn 24.000 ký tự. Đợt thử nghiệm chưa phân tích bài dài hơn.</p>}
      <button type="button" onClick={() => void requestReview()}
        disabled={!signedIn || !consent || busy || reading || transcript.length < 20 || transcript.length > 24000}
        className="bg-[#446B50] text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-45">
        {busy ? 'Đang phân tích…' : 'Phân tích bài thuyết trình bằng AI'}
      </button>
      <p className="text-[11px] text-[#687B6D]">Chỉ hoạt động trên Preview với Gemini Free Tier không bật thanh toán, có kiểm tra quota. Không tự chuyển sang API có phí.</p>
      {notice && <p role="status" className="text-xs text-[#395C42]">{notice}</p>}
      {error && <p role="alert" className="text-xs rounded-lg bg-[#FDEFEF] border border-[#E2BABA] p-2 text-[#873631]">{error}</p>}

      {review && <div className="space-y-3 border-t border-[#B4CDBA] pt-3">
        <p className="text-xs font-semibold">Nhận xét tổng quan</p>
        <p className="text-sm whitespace-pre-wrap break-words">{review.summary}</p>
        <div>
          <h5 className="text-xs font-bold mb-1">Điểm mạnh</h5>
          {review.strengths.map((item, i) => <div key={i} className="bg-white rounded-lg border border-[#D9E5DC] p-2 my-1">
            <p className="text-xs">{i + 1}. {item.point}</p>{renderEvidence(item)}
          </div>)}
        </div>
        <div>
          <h5 className="text-xs font-bold mb-1">Điểm cần cải thiện</h5>
          {review.improvements.map((item, i) => <div key={i} className="bg-white rounded-lg border border-[#D9E5DC] p-2 my-1">
            <p className="text-xs">{i + 1}. {item.point}</p>
            <p className="text-xs mt-1"><strong>Gợi ý:</strong> {item.action}</p>{renderEvidence(item)}
          </div>)}
        </div>
        {review.slideComparisons.length > 0 && <div>
          <h5 className="text-xs font-bold mb-1">Đối chiếu bài nói và PowerPoint</h5>
          {review.slideComparisons.map((item, i) => <div key={i} className="bg-white rounded-lg border border-[#D9E5DC] p-2 my-1">
            <p className="text-xs"><strong>Slide {item.slideNumber}:</strong> {item.point}</p>{renderEvidence(item)}
          </div>)}
        </div>}
        <div className="text-xs">
          <strong>Giới hạn đánh giá:</strong>
          {review.limitations.length
            ? <ul className="list-disc pl-5 mt-1">{review.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
            : <p>Nhận diện giọng nói có thể sai; cần đối chiếu video khi cần.</p>}
        </div>
        <p className="text-[11px] text-[#687B6D]">Nhận xét đang chỉ hiển thị trong phiên này, chưa được lưu thành báo cáo (Đợt 7.3.2).</p>
      </div>}
    </section>
  );
};
