import React, { useEffect, useRef, useState } from 'react';
import {
  VietnameseBrowserSpeechSession, isVietnameseSpeechRecognitionSupported,
} from '../../services/vietnameseSpeechRecognition';
import { reviewInputFingerprint } from '../../services/localAiReviewLibrary';
import { defenseStorageKey, deleteLocalDefensePractice } from '../../services/localDefenseLibrary';

type CouncilQuestion = {
  id: 'J1' | 'J2' | 'J3'; role: string; question: string; evidenceId: string; slideNumber: number;
};
type CouncilFeedback = {
  id: string; answerQuote: string; covered: string; missing: string; nextStep: string;
};
type StoredSession = {
  sessionId: string; ownerSub: string; fingerprint: string;
  questions: CouncilQuestion[]; challengeToken: string; answers: string[];
  feedback: CouncilFeedback[] | null; createdAt: string;
};
interface Props {
  sessionId: string; ownerSub: string; signedIn: boolean; topic: string;
  topicDescription?: string; speakingGoal?: string; transcript: string;
  slides: Array<{ number: number; text: string }>;
}

const roles = ['J1', 'J2', 'J3'];
const emptyAnswers = () => ['', '', ''];

function loadStored(key: string, fingerprint: string): StoredSession | null {
  try {
    if (typeof window === 'undefined') return null;
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null') as StoredSession | null;
    if (!parsed || parsed.fingerprint !== fingerprint ||
      !Array.isArray(parsed.questions) || parsed.questions.length !== 3 ||
      !parsed.questions.every((q, i) =>
        q.id === roles[i] && typeof q.question === 'string' && q.question.length <= 420) ||
      !Array.isArray(parsed.answers) || parsed.answers.length !== 3 ||
      !parsed.answers.every(a => typeof a === 'string' && a.length <= 2500) ||
      typeof parsed.challengeToken !== 'string' || parsed.challengeToken.length > 7500 ||
      !(parsed.feedback === null || Array.isArray(parsed.feedback) &&
        parsed.feedback.length === 3 && parsed.feedback.every((f, i) =>
          f && f.id === roles[i] && typeof f.covered === 'string' &&
          typeof f.missing === 'string' && typeof f.nextStep === 'string' &&
          typeof f.answerQuote === 'string'))) return null;
    return parsed;
  } catch { return null; }
}

function storeSaved(key: string, record: StoredSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(record));
}

/** Separate opt-in Q&A practice. Questions and responses remain on this browser only. */
export const AiDefensePanel: React.FC<Props> = ({
  sessionId, ownerSub, signedIn, topic, topicDescription, speakingGoal, transcript, slides,
}) => {
  const key = defenseStorageKey(ownerSub, sessionId);
  const fingerprint = reviewInputFingerprint({
    topic, topicDescription, speakingGoal, transcript, slides,
  });
  const [saved, setSaved] = useState<StoredSession | null>(() => loadStored(key, fingerprint));
  const [answers, setAnswers] = useState<string[]>(() => loadStored(key, fingerprint)?.answers || emptyAnswers());
  const [consent, setConsent] = useState(false);
  const [micConsent, setMicConsent] = useState(false);
  const [busy, setBusy] = useState<'questions' | 'feedback' | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [interim, setInterim] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const micRef = useRef<VietnameseBrowserSpeechSession | null>(null);
  const speechMapRef = useRef<Map<number, string>>(new Map());
  const speechBaseRef = useRef('');
  const micIndexRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const canMic = isVietnameseSpeechRecognitionSupported();

  useEffect(() => {
    const restored = loadStored(key, fingerprint);
    setSaved(restored);
    setAnswers(restored?.answers || emptyAnswers());
    setConsent(false);
    setMicConsent(false);
    setError('');
    setNotice('');
    setBusy(null);
    abortRef.current?.abort();
    micRef.current?.dispose();
    micRef.current = null;
    micIndexRef.current = null;
    setSpeakingIndex(null);
    setInterim('');
    return () => {
      abortRef.current?.abort();
      micRef.current?.dispose();
      micRef.current = null;
    };
  }, [key, fingerprint]);

  const persist = (newSaved: StoredSession) => {
    setSaved(newSaved);
    try { storeSaved(key, newSaved); }
    catch { setNotice('Trình duyệt chưa lưu được phiên hỏi đáp; không có dữ liệu nào được đưa lên đám mây SpeakLab.'); }
  };

  const setAnswer = (index: number, value: string) => {
    if (value.length > 2500 || busy) return;
    setAnswers(prev => {
      const updated = [...prev];
      updated[index] = value;
      if (saved && !saved.feedback) {
        try { storeSaved(key, { ...saved, answers: updated }); } catch { /* user can continue */ }
      }
      return updated;
    });
  };

  const stopMic = async () => {
    const instance = micRef.current;
    if (!instance) return;
    await instance.stop();
    instance.dispose();
    if (micRef.current === instance) micRef.current = null;
    micIndexRef.current = null;
    setSpeakingIndex(null);
    setInterim('');
  };

  const startMic = (index: number) => {
    if (!canMic || !micConsent || !saved || saved.feedback || busy || micRef.current) return;
    const map = new Map<number, string>();
    speechMapRef.current = map;
    speechBaseRef.current = answers[index];
    micIndexRef.current = index;
    startedAtRef.current = Date.now();
    const updateSpoken = () => {
      const captured = [...speechMapRef.current.values()].join(' ').trim();
      const complete = [speechBaseRef.current.trim(), captured].filter(Boolean).join(' ').slice(0, 2500);
      setAnswer(index, complete);
    };
    try {
      const speech = new VietnameseBrowserSpeechSession({
        getElapsedSeconds: () => Math.floor((Date.now() - startedAtRef.current) / 1000),
        onInterim: setInterim,
        onState: (status, message) => {
          if (status === 'error') {
            setError(message || 'Không nhận diện được tiếng Việt. Bạn có thể nhập câu trả lời bằng bàn phím.');
            setSpeakingIndex(null);
            micIndexRef.current = null;
            micRef.current?.dispose();
            micRef.current = null;
          } else if (status === 'stopped') {
            setSpeakingIndex(null);
            // The recognition service may stop on silence; release it to allow another attempt.
            const ended = micRef.current;
            micRef.current = null;
            ended?.dispose();
          }
        },
        onSegment: (segment, segmentId) => {
          speechMapRef.current.set(segmentId, segment.text);
          updateSpoken();
        },
        onSegmentUpdate: (segmentId, segment) => {
          speechMapRef.current.set(segmentId, segment.text);
          updateSpoken();
        },
      });
      micRef.current = speech;
      setError('');
      setSpeakingIndex(index);
      speech.start();
    } catch (e) {
      micRef.current?.dispose();
      micRef.current = null;
      micIndexRef.current = null;
      setSpeakingIndex(null);
      setError(e instanceof Error ? e.message : 'Trình duyệt không cho phép sử dụng micro.');
    }
  };

  async function send(action: 'questions' | 'feedback') {
    if (!signedIn || !consent || busy || transcript.length < 20 || transcript.length > 24000) return;
    if (micRef.current) await stopMic();
    if (action === 'feedback' && (!saved || saved.feedback)) return;
    const rows = answers.map((text, index) => ({ id: roles[index], text: text.trim() }));
    if (action === 'feedback' && (rows.every(r => !r.text) ||
      rows.some(r => r.text.length > 0 && r.text.length < 12))) {
      setError('Hãy trả lời ít nhất một câu (từ 12 ký tự). Có thể để trống câu chưa biết.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/ai/defense', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, consent: true, sessionId, topic, topicDescription: topicDescription || '',
          speakingGoal: speakingGoal || '', transcript, slides,
          ...(action === 'feedback' ? { challengeToken: saved?.challengeToken, answers: rows } : {}),
        }),
      });
      if (!/\bapplication\/json\b/iu.test(response.headers.get('content-type') || '')) {
        throw new Error('API không trả JSON (HTTP ' + response.status + '). Kiểm tra Vercel Functions.');
      }
      const result = await response.json() as {
        questions?: CouncilQuestion[]; challengeToken?: string;
        feedback?: CouncilFeedback[]; remainingToday?: number; code?: string; error?: string;
      };
      if (!response.ok) {
        throw new Error((result.error || 'Yêu cầu AI chưa thành công.') +
          (result.code ? ' (mã lỗi: ' + result.code + ')' : ''));
      }
      if (action === 'questions') {
        if (!Array.isArray(result.questions) || result.questions.length !== 3 ||
          !result.challengeToken) throw new Error('Máy chủ trả bộ câu hỏi chưa hợp lệ.');
        const record: StoredSession = {
          sessionId, ownerSub, fingerprint, questions: result.questions,
          challengeToken: result.challengeToken, answers: emptyAnswers(), feedback: null,
          createdAt: new Date().toISOString(),
        };
        setAnswers(emptyAnswers());
        persist(record);
        setNotice('Đã tạo 3 câu hỏi. Bạn có thể trả lời từng câu. Còn ' +
          (result.remainingToday ?? '?') + ' lượt AI chung trong ngày.');
      } else {
        if (!Array.isArray(result.feedback) || result.feedback.length !== 3 || !saved) {
          throw new Error('Máy chủ trả nhận xét chưa hợp lệ.');
        }
        persist({ ...saved, answers: rows.map(r => r.text), feedback: result.feedback });
        setNotice('Đã lưu bài luyện phản biện trên trình duyệt. Còn ' +
          (result.remainingToday ?? '?') + ' lượt AI chung trong ngày.');
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Chưa thể kết nối với hội đồng AI.');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(null);
      }
    }
  }

  const reset = () => {
    if (!window.confirm('Xóa riêng phiên phản biện đã lưu trên trình duyệt này? Bản ghi lời nói và nhận xét thuyết trình khác không bị xóa.')) return;
    void stopMic();
    abortRef.current?.abort();
    deleteLocalDefensePractice(sessionId, ownerSub);
    setSaved(null);
    setAnswers(emptyAnswers());
    setConsent(false);
    setError('');
    setNotice('Đã xóa phiên phản biện trên trình duyệt.');
  };

  return (
    <details className="rounded-xl border border-[#B9C7D8] bg-[#F4F7FC] p-3 text-[#263D58] space-y-3" aria-label="Bảo vệ trước hội đồng AI">
      <summary className="cursor-pointer font-bold text-sm">Bảo vệ trước hội đồng AI · 3 câu hỏi</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs">Ba giám khảo AI mô phỏng lần lượt hỏi về kiến thức, kỹ thuật và khả năng ứng dụng. Bạn trả lời bằng bàn phím hoặc nhận diện tiếng Việt qua micro; AI nhận xét nội dung, không chấm điểm.</p>
        <div className="rounded-lg bg-white border p-2 text-xs">
          <p><strong>Đầu vào:</strong> Đề tài, mục tiêu, {transcript.length.toLocaleString('vi-VN')} ký tự bản ghi và {slides.length} slide có chữ.</p>
          <p><strong>Giới hạn:</strong> 1 lượt Gemini để tạo ba câu hỏi, 1 lượt nữa để nhận xét cả ba câu trả lời, dùng chung hạn mức 5 lượt/ngày với chức năng nhận xét bài thuyết trình.</p>
        </div>
        <label className="flex gap-2 items-start text-xs">
          <input type="checkbox" className="mt-0.5" checked={consent}
            onChange={event => {
              setConsent(event.target.checked);
              if (!event.target.checked) abortRef.current?.abort();
            }} />
          <span>Tôi đồng ý gửi nội dung đề tài, bản ghi lời nói, chữ trên slide và câu trả lời phản biện đến Google Gemini để luyện tập. Không gửi video, âm thanh, tệp PPTX hay thông tin tài khoản. Dữ liệu Free Tier có thể được Google sử dụng để cải thiện sản phẩm.</span>
        </label>
        {!signedIn && <p className="text-xs text-[#873631]">Cần đăng nhập Google trước khi dùng hội đồng AI.</p>}
        {!saved && <button type="button" disabled={!signedIn || !consent || !!busy ||
          transcript.length < 20 || transcript.length > 24000}
          className="rounded-lg bg-[#355477] px-3 py-2 text-xs text-white font-semibold disabled:opacity-50"
          onClick={() => { void send('questions'); }}>
          {busy === 'questions' ? 'Đang tạo 3 câu hỏi…' : 'Tạo 3 câu hỏi phản biện'}
        </button>}
        {saved && <div className="space-y-3">
          <p className="text-xs">Phiên tạo lúc {new Date(saved.createdAt).toLocaleString('vi-VN')}. Kết quả được lưu riêng trên trình duyệt, không đồng bộ lên đám mây SpeakLab.</p>
          {!saved.feedback && <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={micConsent}
              onChange={event => {
                setMicConsent(event.target.checked);
                if (!event.target.checked) void stopMic();
              }} />
            <span>Tôi đồng ý bật nhận diện tiếng Việt bằng micro khi chủ động nhấn nút. Dịch vụ nhận diện của trình duyệt có thể xử lý âm thanh trên máy chủ của nhà cung cấp trình duyệt; SpeakLab chỉ gửi văn bản câu trả lời đến Gemini sau khi tôi bấm nhận xét.</span>
          </label>}
          {saved.questions.map((q, index) => (
            <div key={q.id} className="rounded-xl border border-[#D6E0EB] bg-white p-3 space-y-2">
              <p className="font-semibold text-sm">{q.role}</p>
              <p className="text-sm leading-relaxed">{q.question}</p>
              <p className="text-[11px] text-[#60748A]">Căn cứ bản ghi: {q.evidenceId}{q.slideNumber ? ' · Slide ' + q.slideNumber : ''}</p>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Câu trả lời của bạn {saved.feedback ? '(đã lưu)' : ''}</span>
                <textarea className="block w-full border border-[#CAD5E2] rounded-lg p-2 text-sm text-[#25384D] bg-white"
                  rows={3} maxLength={2500} value={answers[index]}
                  onChange={e => setAnswer(index, e.target.value)}
                  disabled={!!saved.feedback || !!busy || speakingIndex === index}
                  placeholder="Nêu lý lẽ, dữ liệu hoặc ví dụ; có thể để trống nếu chưa biết." />
              </label>
              {!saved.feedback && canMic && <button type="button"
                disabled={!micConsent || !!busy || speakingIndex !== null && speakingIndex !== index}
                onClick={() => { if (speakingIndex === index) void stopMic(); else startMic(index); }}
                className="rounded-lg border border-[#B8C8D9] px-3 py-1.5 text-xs disabled:opacity-40">
                {speakingIndex === index ? 'Dừng micro' : 'Trả lời bằng micro'}
              </button>}
              {speakingIndex === index && <p role="status" className="text-xs">
                Đang nhận diện tiếng Việt… {interim}
              </p>}
              {saved.feedback && <div className="rounded-lg border border-[#D6E6D9] bg-[#F1F9F2] p-3 space-y-1 text-xs">
                <p><strong>Trích câu trả lời:</strong> {saved.feedback[index].answerQuote || '(không có câu trả lời)'}</p>
                <p><strong>Đã giải đáp:</strong> {saved.feedback[index].covered}</p>
                <p><strong>Cần làm rõ:</strong> {saved.feedback[index].missing}</p>
                <p><strong>Gợi ý luyện lại:</strong> {saved.feedback[index].nextStep}</p>
              </div>}
            </div>
          ))}
          {!saved.feedback && <button type="button" disabled={!signedIn || !consent || !!busy ||
            speakingIndex !== null || answers.every(a => !a.trim())}
            className="rounded-lg bg-[#355477] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            onClick={() => { void send('feedback'); }}>
            {busy === 'feedback' ? 'Đang nhận xét ba câu trả lời…' : 'Nhận xét câu trả lời bằng AI'}
          </button>}
          <button type="button" disabled={!!busy} onClick={reset}
            className="ml-2 text-xs underline text-[#873631] disabled:opacity-50">
            Xóa phiên phản biện
          </button>
        </div>}
        {notice && <p role="status" className="text-xs text-[#355477]">{notice}</p>}
        {error && <p role="alert" className="text-xs rounded-lg bg-[#FDEFEF] text-[#873631] border border-[#E7B8B8] p-2">{error}</p>}
      </div>
    </details>
  );
};
