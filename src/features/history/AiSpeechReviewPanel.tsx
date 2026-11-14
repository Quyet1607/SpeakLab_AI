import React, { useEffect, useRef, useState } from 'react';
import type { SpeechTranscriptSegment } from '../../types';
import { extractPptxTextForReview } from '../../services/pptxReviewText';
import {
  deleteLocalReviewSlides, getLocalReviewSlides, saveLocalReviewSlides,
  type LocalReviewSlides,
} from '../../services/localReviewSlideLibrary';
import {
  deleteLocalAiReview, getLocalAiReview, reviewInputFingerprint, saveLocalAiReview,
  type AiReviewPoint as Point, type AiSpeechReview as Review,
  type LocalAiReviewReport,
} from '../../services/localAiReviewLibrary';

interface Props {
  sessionId: string;
  topic: string;
  topicDescription?: string;
  speakingGoal?: string;
  ownerSub: string | null;
  segments: SpeechTranscriptSegment[];
  signedIn: boolean;
}

/** Phase 7.3.2: evidence-based AI review saved locally with the practice session. */
export const AiSpeechReviewPanel: React.FC<Props> = ({
  sessionId, topic, topicDescription, speakingGoal, ownerSub, segments, signedIn,
}) => {
  const [slides, setSlides] = useState<LocalReviewSlides | null>(() => getLocalReviewSlides(sessionId, ownerSub));
  const [savedReport, setSavedReport] = useState<LocalAiReviewReport | null>(() => getLocalAiReview(sessionId, ownerSub));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(() => getLocalAiReview(sessionId, ownerSub)?.review ?? null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const transcript = segments.map(s => s.text).filter(Boolean).join('\n').trim();

  const currentFingerprint = reviewInputFingerprint({
    topic, topicDescription, speakingGoal, transcript, slides: slides?.slides || [],
  });
  const savedReportIsStale = !!savedReport && savedReport.inputFingerprint !== currentFingerprint;

  useEffect(() => {
    setSlides(getLocalReviewSlides(sessionId, ownerSub));
    const storedReport = getLocalAiReview(sessionId, ownerSub);
    setSavedReport(storedReport);
    setReview(storedReport?.review ?? null);
    setConsent(false);
    setError(null);
    abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [sessionId, ownerSub]);

  const pickPptx = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setError(null);
    setNotice(null);
    setConsent(false); // Consent must cover the new slide text as well.
    try {
      const parsed = await extractPptxTextForReview(file);
      if (!parsed.slides.length) {
        deleteLocalReviewSlides(sessionId, ownerSub);
        setSlides(null);
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
      const data = await response.json() as { review?: Review; error?: string; code?: string; remainingToday?: number };
      if (!response.ok || !data.review || !Array.isArray(data.review.strengths) ||
        !Array.isArray(data.review.improvements)) {
        const message = data.error || 'Chưa nhận được nhận xét hợp lệ.';
        throw new Error(data.code ? message + ' (mã lỗi: ' + data.code + ')' : message);
      }
      if (!controller.signal.aborted) {
        setReview(data.review);
        if (ownerSub) {
          try {
            const saved = saveLocalAiReview({
              sessionId,
              ownerSub,
              inputFingerprint: currentFingerprint,
              topic: topic.slice(0, 120),
              topicDescription: (topicDescription || '').slice(0, 800),
              speakingGoal: (speakingGoal || '').slice(0, 400),
              transcriptLength: transcript.length,
              slideName: slides?.name || '',
              slideCount: slides?.slides.length || 0,
              review: data.review,
            });
            setSavedReport(saved);
            setNotice('Đã lưu nhận xét trên trình duyệt. Còn ' + (data.remainingToday ?? '?') + ' lượt trong hạn mức nội bộ hôm nay.');
          } catch (saveError) {
            setNotice('AI đã trả kết quả nhưng trình duyệt chưa lưu được nhận xét. ' +
              (saveError instanceof Error ? saveError.message : 'Hãy kiểm tra dung lượng lưu trữ.'));
          }
        } else {
          setNotice('AI đã trả kết quả nhưng không xác định được tài khoản để lưu nhận xét.');
        }
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

  const removeSavedReview = () => {
    if (!window.confirm('Xóa riêng nhận xét AI đã lưu của buổi luyện này? Video và bản ghi lời nói vẫn được giữ nguyên.')) return;
    deleteLocalAiReview(sessionId, ownerSub);
    setSavedReport(null);
    setReview(null);
    setNotice('Đã xóa riêng nhận xét AI trên trình duyệt.');
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
      <h4 className="font-bold text-sm">AI nhận xét bài thuyết trình · Đợt 7.3.2</h4>
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
          if (!e.target.checked) abortRef.current?.abort();
        }} className="mt-0.5" />
        <span>Tôi đồng ý gửi <strong>đề tài, mục tiêu, văn bản lời nói và chữ trong PPTX (nếu có)</strong> đến Google Gemini để nhận xét. Không gửi tệp video, âm thanh, PPTX nguyên bản hay tên tài khoản. Dữ liệu Free Tier có thể được Google dùng để cải thiện sản phẩm.</span>
      </label>

      {!signedIn && <p className="text-xs text-[#873631]">Cần đăng nhập Google ở Cài đặt để dùng dịch vụ AI.</p>}
      {transcript.length > 24000 && <p className="text-xs text-[#873631]">Bản ghi vượt giới hạn 24.000 ký tự. Đợt thử nghiệm chưa phân tích bài dài hơn.</p>}
      {savedReport && <div className="rounded-lg border border-[#D9E5DC] bg-white p-2 text-xs space-y-1">
        <p><strong>Nhận xét đã lưu:</strong> {new Date(savedReport.createdAt).toLocaleString('vi-VN')} · lưu trên trình duyệt này.</p>
        {savedReportIsStale && <p role="status" className="text-[#873631]">Dữ liệu đề tài, lời nói hoặc PowerPoint đã thay đổi sau lần phân tích. Kết quả bên dưới là bản nhận xét cũ; hãy phân tích lại nếu muốn cập nhật.</p>}
        <button type="button" onClick={removeSavedReview} disabled={busy}
          className="text-xs underline text-[#873631] disabled:opacity-50">Xóa riêng nhận xét AI</button>
      </div>}
      <button type="button" onClick={() => void requestReview()}
        disabled={!signedIn || !consent || busy || reading || transcript.length < 20 || transcript.length > 24000}
        className="bg-[#446B50] text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-45">
        {busy ? 'Đang phân tích…' : savedReport ? 'Phân tích lại bằng AI' : 'Phân tích bài thuyết trình bằng AI'}
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
        {(review.slideComparisons.length > 0 || !!review.slideOverview?.length) && <div className="space-y-2">
          <h5 className="text-xs font-bold mb-1">Đối chiếu bài nói và PowerPoint</h5>
          {review.slideOverview && review.slideOverview.length > 0 && <details className="rounded-lg bg-white border border-[#D9E5DC] p-2 text-xs">
            <summary className="cursor-pointer font-semibold">Tổng quan chữ trên {review.slideOverview.length} slide · dò từ khóa, chưa phải kết luận nội dung</summary>
            <p className="my-2 text-[#687B6D]">Dò từ khóa toàn bộ slide có chữ. Không trùng từ khóa không có nghĩa là người học bỏ qua slide, vì có thể diễn đạt khác hoặc ASR nhận sai. Chỉ những slide liệt kê chi tiết bên dưới mới được AI đối chiếu sâu.</p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {review.slideOverview.map(item => <p key={item.slideNumber} className="border-b border-[#E6EDE7] py-1 break-words">
                <strong>Slide {item.slideNumber}:</strong> {item.slideExcerpt}
                <span className="block text-[#687B6D]">{item.keywordSignal === 'shared_keywords'
                  ? 'Có từ khóa trùng: ' + item.sharedKeywords.join(', ')
                  : item.keywordSignal === 'no_shared_keywords'
                    ? 'Chưa thấy từ khóa trùng trong bản ghi; cần kiểm tra ngữ nghĩa thủ công.'
                    : 'Slide có quá ít chữ để dò từ khóa.'}
                  {review.slideComparisons.some(detail => detail.slideNumber === item.slideNumber)
                    ? ' · Đã đối chiếu chi tiết' : ' · Chưa đối chiếu chi tiết'}
                </span>
              </p>)}
            </div>
          </details>}
          {review.slideComparisons.map((item, i) => <div key={i} className="bg-white rounded-lg border border-[#D9E5DC] p-3 my-1 space-y-2">
            <p className="text-xs font-semibold"><strong>Slide {item.slideNumber}:</strong> {item.point}</p>
            {item.status ? <>
              <p className="text-[11px] text-[#617466]">Nhận định nội dung: {{
                matched: 'Đã tìm thấy nội dung tương ứng',
                partial: 'Mới tìm thấy một phần',
                not_found: 'Chưa tìm thấy trong bản ghi ASR',
                possible_difference: 'Có khác biệt cần kiểm tra',
              }[item.status]}</p>
              <p className="text-xs"><strong>Chữ trên slide:</strong> “{item.slideQuote}”</p>
              {item.spokenQuote && <p className="text-xs"><strong>Lời nói tương ứng:</strong> “{item.spokenQuote}” ({item.evidenceId})</p>}
              <p className="text-xs"><strong>{item.status === 'not_found' ? 'Kết quả tìm kiếm trong ASR:' : 'Đã tìm thấy:'}</strong> {item.covered}</p>
              <p className="text-xs"><strong>Chưa thấy / cần kiểm tra:</strong> {item.missing}</p>
              <p className="text-xs"><strong>Gợi ý:</strong> {item.action}</p>
              {item.evidenceId && renderEvidence(item)}
            </> : renderEvidence(item)}
          </div>)}
        </div>}
        <div className="text-xs">
          <strong>Giới hạn đánh giá:</strong>
          {review.limitations.length
            ? <ul className="list-disc pl-5 mt-1">{review.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
            : <p>Nhận diện giọng nói có thể sai; cần đối chiếu video khi cần.</p>}
        </div>
        <p className="text-[11px] text-[#687B6D]">Nhận xét lưu trên thiết bị, mở lại không tốn lượt Gemini. Đối chiếu PowerPoint chỉ dựa trên chữ có thể đọc và bản ghi ASR; không chứng minh người học đã chuyển tới slide nào. Dữ liệu cục bộ không phải đồng bộ đám mây hay phân quyền bảo mật giữa các tài khoản dùng chung thiết bị.</p>
      </div>}
    </section>
  );
};
