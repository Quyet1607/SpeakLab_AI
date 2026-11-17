import React, { useEffect, useRef, useState } from 'react';
import type { SpeechTranscriptSegment } from '../../types';
import { extractPptxTextForReview } from '../../services/pptxReviewText';
import {
  deleteLocalReviewSlides, getLocalReviewSlides, saveLocalReviewSlides,
  type LocalReviewSlides,
} from '../../services/localReviewSlideLibrary';
import {
  deleteLocalAiReview, getLocalAiReview, reviewInputFingerprint, saveLocalAiReview,
  type AiSpeechReview as Review, type LocalAiReviewReport,
} from '../../services/localAiReviewLibrary';
import { AiReviewResults } from './AiReviewResults';

interface Props {
  sessionId: string;
  topic: string;
  topicDescription?: string;
  speakingGoal?: string;
  ownerSub: string;
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
  const [groqReady, setGroqReady] = useState(false);
  const [studentGroqReady, setStudentGroqReady] = useState(false);
  const [groqTeacher, setGroqTeacher] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [previewAccepted, setPreviewAccepted] = useState<string | null>(null);
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
  // Reports saved before the Vietnamese-language fix remain intact. Do not try
  // to guess accents locally, because doing so could change technical meaning.
  const savedReportMissingDiacritics = !!savedReport && savedReport.review.summary.length >= 100 &&
    !/[\u0300-\u036fĐđ]/u.test(savedReport.review.summary.normalize('NFD'));

  useEffect(() => {
    setSlides(getLocalReviewSlides(sessionId, ownerSub));
    const storedReport = getLocalAiReview(sessionId, ownerSub);
    setSavedReport(storedReport);
    setReview(storedReport?.review ?? null);
    setConsent(false);
    setAdultConfirmed(false);
    setPreviewAccepted(null);
    setProvider('gemini');
    setError(null);
    abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [sessionId, ownerSub]);

  useEffect(() => {
    let cancelled = false;
    if (!signedIn) {
      setGroqTeacher(false);
      setGroqReady(false);
      setStudentGroqReady(false);
      setProvider('gemini');
      return;
    }
    void fetch('/api/groq/adult-preview', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => ({ ok: response.ok, data: await response.json() as { enabled?: boolean; ready?: boolean } }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        setGroqTeacher(ok);
        setGroqReady(ok && data.ready === true);
      })
      .catch(() => { if (!cancelled) { setGroqTeacher(false); setGroqReady(false); } });
    return () => { cancelled = true; };
  }, [signedIn, ownerSub]);

  useEffect(() => {
    let cancelled = false;
    if (!signedIn) { setStudentGroqReady(false); return; }
    void fetch('/api/ai/groq-review', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => ({ ok: response.ok, data: await response.json() as { ready?: boolean } }))
      .then(({ ok, data }) => { if (!cancelled) setStudentGroqReady(ok && data.ready === true); })
      .catch(() => { if (!cancelled) setStudentGroqReady(false); });
    return () => { cancelled = true; };
  }, [signedIn, ownerSub]);

  const studentGroqMode = provider === 'groq' && studentGroqReady && !groqTeacher;
  const groqAvailable = studentGroqReady || (groqTeacher && groqReady);
  const groqPayload = () => ({
    sessionId, topic, ...(studentGroqMode ? { topicDescription: topicDescription || '' } : {}),
    speakingGoal: speakingGoal || '', transcript, slides: slides?.slides || [],
  });
  const currentGroqSnapshot = JSON.stringify(groqPayload());
  const groqAllowedInput = transcript.length >= 20 && transcript.length <= 24000 &&
    topic.length <= 120 && (speakingGoal || '').length <= 400 &&
    (slides?.slides.length || 0) <= 40 &&
    (slides?.slides || []).every(slide => slide.text.length <= 900) &&
    (slides?.slides || []).reduce((sum, slide) => sum + slide.text.length, 0) <= 16000;
  const groqConfirmed = previewAccepted === currentGroqSnapshot && adultConfirmed;
  const chooseProvider = (next: 'gemini' | 'groq') => {
    if (busy) return;
    setProvider(next);
    setConsent(false);
    setAdultConfirmed(false);
    setPreviewAccepted(null);
    setError(null);
    setNotice(null);
  };

  const pickPptx = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setError(null);
    setNotice(null);
    setConsent(false); // Consent must cover the new slide text as well.
    setAdultConfirmed(false);
    setPreviewAccepted(null);
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
    setAdultConfirmed(false);
    setPreviewAccepted(null);
    setNotice('Đã bỏ văn bản slide; bạn vẫn có thể phân tích bài nói bằng TXT.');
  };

  const requestReview = async () => {
    if (busy || !consent || !signedIn) return;
    if (provider === 'groq' && (!groqAvailable || !groqAllowedInput ||
      (!studentGroqMode && !groqConfirmed))) return;
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
      const groqMode = provider === 'groq';
      const response = await fetch(groqMode
        ? (studentGroqMode ? '/api/ai/groq-review' : '/api/groq/adult-preview')
        : '/api/ai/review', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentGroqMode ? {
          consent: true, sessionId, topic, topicDescription: topicDescription || '',
          speakingGoal: speakingGoal || '', transcript, slides: slides?.slides || [],
        } : groqMode ? {
          ...groqPayload(), adultSelfAuthored: true,
          confirmExternalTransfer: true, confirmOneCall: true,
        } : {
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
        if (ownerSub && (!groqMode || studentGroqMode)) {
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
            setNotice(studentGroqMode
              ? 'Đã lưu nhận xét Groq trên trình duyệt. Không tự gửi lại khi lỗi.'
              : 'Đã lưu nhận xét trên trình duyệt. Còn ' + (data.remainingToday ?? '?') + ' lượt trong hạn mức nội bộ hôm nay.');
          } catch (saveError) {
            setNotice('AI đã trả kết quả nhưng trình duyệt chưa lưu được nhận xét. ' +
              (saveError instanceof Error ? saveError.message : 'Hãy kiểm tra dung lượng lưu trữ.'));
          }
        } else if (groqMode) {
          setNotice('Đã nhận nhận xét Groq. Kết quả thử của người lớn chỉ hiển thị tại đây, không ghi vào Lịch sử. Không tự gửi lại.');
        } else {
          setNotice('AI đã trả kết quả nhưng không xác định được tài khoản để lưu nhận xét.');
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể kết nối API AI miễn phí.');
    } finally {
      if (abortRef.current === controller) {
        if (provider === 'groq') { setConsent(false); setAdultConfirmed(false); setPreviewAccepted(null); }
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

  return (
    <section className="mt-3 rounded-xl border border-[#A7C8AC] bg-[#F2F8F3] p-3 space-y-3 text-[#304C38]"
      aria-label="Nhận xét bài thuyết trình bằng AI">
      <h4 className="font-bold text-sm">AI nhận xét bài thuyết trình · Bước 7.3.3.3</h4>
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

      {(groqTeacher || studentGroqReady) && <div className="rounded-lg border border-[#BDD3C0] bg-white p-3 text-xs space-y-2">
        <p className="font-semibold">Nhà cung cấp AI</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={provider === 'gemini'} disabled={busy}
            onClick={() => chooseProvider('gemini')}
            className={'rounded-lg border px-3 py-2 ' + (provider === 'gemini' ? 'bg-[#446B50] text-white' : 'bg-white')}>Gemini hiện tại</button>
          <button type="button" aria-pressed={provider === 'groq'} disabled={busy}
            onClick={() => chooseProvider('groq')}
            className={'rounded-lg border px-3 py-2 ' + (provider === 'groq' ? 'bg-[#446B50] text-white' : 'bg-white')}>{studentGroqReady && !groqTeacher ? 'Groq · Nhận xét bài thuyết trình' : 'Groq · Bài người lớn tự viết'}</button>
        </div>
        {provider === 'groq' && <p role="status" className="text-[#873631]">
          {studentGroqMode
            ? 'Groq đã được máy chủ xác minh quyền xử lý dữ liệu cho phiên học sinh này. Chỉ gửi văn bản sau khi tự kiểm tra nội dung.'
            : groqReady ? 'Groq đã được bật riêng cho giáo viên. Chỉ dùng bài do chính người lớn tự viết, không chứa dữ liệu cá nhân hoặc học sinh.' :
            'Groq chưa được quản trị viên bật trên Preview; Gemini không bị thay đổi.'}
        </p>}
      </div>}
      {provider === 'groq' ? <div className="rounded-lg border border-[#BDD3C0] bg-white p-3 text-xs space-y-3">
        <p className="font-semibold">Xác nhận dữ liệu gửi tới Groq</p>
        <p>{studentGroqMode
          ? 'Chỉ gửi khi máy chủ có hồ sơ phê duyệt hợp lệ cho đúng người học, nhà cung cấp Groq và mục đích nhận xét. Rà soát để không có dữ liệu định danh hoặc nhạy cảm trong bản ghi; không gửi video, âm thanh hay PPTX gốc.'
          : 'Chỉ dành cho bài do chính người lớn tự viết và được dùng hợp lệ. Không chọn buổi luyện của học sinh, thông tin định danh hoặc nội dung nhạy cảm.'} Giới hạn 24.000 ký tự bản ghi và 40 slide chữ (tổng 16.000 ký tự). Bài dài có thể vượt giới hạn Groq Free Tier; hệ thống không tự cắt nội dung.</p>
        {!groqAllowedInput && <p role="alert" className="text-[#873631]">Bản ghi hoặc slide vượt giới hạn dữ liệu Groq (24.000 ký tự bản ghi, 40 slide hoặc tổng 16.000 ký tự slide). Không tự cắt bớt nội dung.</p>}
        <button type="button" disabled={!groqAllowedInput || busy}
          onClick={() => { setPreviewAccepted(currentGroqSnapshot); setConsent(false); setAdultConfirmed(false); }}
          className="border border-[#BDD3C0] rounded-lg px-3 py-1.5 font-semibold">
          Xem chính xác văn bản dự kiến gửi
        </button>
        {previewAccepted === currentGroqSnapshot && <div className="space-y-2">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#F3F7F4] p-2">{JSON.stringify(groqPayload(), null, 2)}</pre>
          {!studentGroqMode && <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={adultConfirmed} onChange={e => { setAdultConfirmed(e.target.checked); setConsent(false); }} className="mt-0.5" />
            <span>Tôi xác nhận đây là bài do chính người lớn tự viết; tôi có quyền gửi, đã rà soát không có dữ liệu học sinh hoặc thông tin cá nhân và hiểu rằng Groq là nhà cung cấp bên ngoài.</span>
          </label>}
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={consent} disabled={!studentGroqMode && !adultConfirmed}
              onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
            <span>{studentGroqMode
              ? 'Tôi đã xem nội dung và đồng ý gửi bản ghi, đề tài và chữ slide tới Groq để nhận xét. Hệ thống vẫn phải xác minh hồ sơ đồng thuận phía máy chủ trước mỗi lần gửi.'
              : 'Tôi đồng ý gửi đúng nội dung đã xem tới Groq một lần. Không tự động gửi lại và không lưu kết quả thử vào Lịch sử.'}</span>
          </label>
        </div>}
      </div> : <label className="flex items-start gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={consent} onChange={e => {
          setConsent(e.target.checked);
          if (!e.target.checked) abortRef.current?.abort();
        }} className="mt-0.5" />
        <span>Tôi đồng ý gửi <strong>đề tài, mục tiêu, văn bản lời nói và chữ trong PPTX (nếu có)</strong> đến Google Gemini để nhận xét. Không gửi tệp video, âm thanh, PPTX nguyên bản hay tên tài khoản. Dữ liệu Free Tier có thể được Google dùng để cải thiện sản phẩm.</span>
      </label>}

      {!signedIn && <p className="text-xs text-[#873631]">Cần đăng nhập Google để sử dụng dịch vụ AI.</p>}
      {transcript.length > 24000 && <p className="text-xs text-[#873631]">Bản ghi vượt giới hạn 24.000 ký tự. Đợt thử nghiệm chưa phân tích bài dài hơn.</p>}
      {savedReport && <div className="rounded-lg border border-[#D9E5DC] bg-white p-2 text-xs space-y-1">
        <p><strong>Nhận xét đã lưu:</strong> {new Date(savedReport.createdAt).toLocaleString('vi-VN')} · lưu trên trình duyệt này.</p>
        {savedReportIsStale && <p role="status" className="text-[#873631]">Dữ liệu đề tài, lời nói hoặc PowerPoint đã thay đổi sau lần phân tích. Kết quả bên dưới là bản nhận xét cũ; hãy phân tích lại nếu muốn cập nhật.</p>}
        {savedReportMissingDiacritics && <p role="status" className="text-[#873631]">Nhận xét này được lưu từ phiên AI trả tiếng Việt không dấu. Hệ thống giữ nguyên bản cũ, không tự thêm dấu vì có thể làm sai thuật ngữ. Bạn có thể chủ động phân tích lại để có nhận xét mới có dấu (sẽ sử dụng một lượt Gemini miễn phí).</p>}
        <button type="button" onClick={removeSavedReview} disabled={busy}
          className="text-xs underline text-[#873631] disabled:opacity-50">Xóa riêng nhận xét AI</button>
      </div>}
      <button type="button" onClick={() => void requestReview()}
        disabled={!signedIn || !consent || busy || reading || transcript.length < 20 || transcript.length > 24000 ||
          (provider === 'groq' && (!groqAvailable || !groqAllowedInput ||
            (!studentGroqMode && !groqConfirmed) || previewAccepted !== currentGroqSnapshot))}
        className="bg-[#446B50] text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-45">
        {busy ? 'Đang phân tích…' : provider === 'groq' ? 'Nhận xét bằng Groq (một lần)' : savedReport ? 'Phân tích lại bằng AI' : 'Phân tích bài thuyết trình bằng AI'}
      </button>
      <p className="text-[11px] text-[#687B6D]">{provider === 'groq' ? (studentGroqMode
        ? 'Groq chỉ hoạt động nếu máy chủ xác minh hồ sơ đồng thuận đúng phiên học sinh; không tự gửi lại hoặc chuyển sang API trả phí.'
        : 'Groq cho giáo viên trên Preview cần bật riêng phía máy chủ; không tự gửi lại hoặc chuyển sang API có phí.') : 'Chỉ hoạt động trên Preview với Gemini Free Tier không bật thanh toán, có kiểm tra quota. Không tự chuyển sang API có phí.'}</p>
      {notice && <p role="status" className="text-xs text-[#395C42]">{notice}</p>}
      {error && <p role="alert" className="text-xs rounded-lg bg-[#FDEFEF] border border-[#E2BABA] p-2 text-[#873631]">{error}</p>}

      {review && <AiReviewResults key={sessionId} review={review} />}
    </section>
  );
};
