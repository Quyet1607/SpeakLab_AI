import React from 'react';
import { Mic, MicOff, Trash2, X, ScrollText } from 'lucide-react';
import type { SpeechTranscriptSegment } from '../../types';
import { SPEECH_SEGMENT_LIMIT } from '../../services/vietnameseSpeechRecognition';

type RecognitionStatus = 'idle' | 'starting' | 'listening' | 'stopped' | 'error';

interface SpeechTranscriptPanelProps {
  segments: SpeechTranscriptSegment[];
  interimText: string;
  status: RecognitionStatus;
  notice: string | null;
  supported: boolean;
  micEnabled: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onClose: () => void;
}

const timeLabel = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** Learner-controlled and intentionally not coupled to the video recorder. */
export const SpeechTranscriptPanel: React.FC<SpeechTranscriptPanelProps> = ({
  segments, interimText, status, notice, supported, micEnabled,
  onStart, onStop, onClear, onClose,
}) => {
  const active = status === 'listening' || status === 'starting';
  return (
    <aside
      aria-label="Bản ghi lời nói tiếng Việt"
      className="absolute inset-y-1.5 right-1.5 sm:inset-y-2 sm:right-2 w-[min(94vw,380px)] z-40 rounded-2xl border border-[#3E5342] bg-[#1C2820] text-[#EDF5EF] shadow-2xl flex flex-col overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 p-3 border-b border-[#354639] shrink-0">
        <span className="inline-flex items-center gap-2 font-semibold text-sm">
          <ScrollText className="w-4 h-4 text-[#9EB9A4]" /> Lời nói → Văn bản
        </span>
        <button type="button" onClick={onClose} aria-label="Đóng bảng lời nói" className="p-1.5 rounded-lg hover:bg-[#344738]">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="px-3 pt-3 space-y-2 shrink-0">
        <p className="text-[11px] leading-relaxed text-[#C3D4C6]">
          Chức năng chỉ bắt đầu khi bạn bấm đồng ý. Trình duyệt sẽ nhận diện tiếng Việt qua micro.
          <strong> Tùy trình duyệt, âm thanh có thể được xử lý trên máy chủ của nhà cung cấp trình duyệt.</strong>
          SpeakLab AI không tự gửi âm thanh hay bản ghi chữ lên API riêng.
        </p>
        <p className="text-[11px] text-[#9FB1A3]">
          Khi bấm Dừng nhận diện, văn bản đã xác nhận được lưu riêng trên thiết bị và có thể xem, tải TXT tại Lịch sử luyện tập.
          Thời điểm và thời lượng từng đoạn là ước lượng, không phải phân tích chính xác từng từ.
        </p>
        {!supported && (
          <p role="alert" className="text-xs rounded-lg p-2 bg-[#3C2928] text-[#F3C1BE]">
            Trình duyệt này chưa hỗ trợ nhận diện lời nói. Hãy thử Chrome hoặc Edge phiên bản tương thích.
          </p>
        )}
        {supported && !micEnabled && (
          <p className="text-xs rounded-lg p-2 bg-[#393224] text-[#EED7A6]">
            Hãy bật micro trong thanh điều khiển phòng họp trước khi nhận diện.
          </p>
        )}
        {notice && <p role="status" className="text-xs rounded-lg p-2 bg-[#2D3D31] text-[#DDEBDD]">{notice}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {active ? (
            <button type="button" onClick={onStop}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#873631] text-white text-xs font-semibold">
              <MicOff className="w-4 h-4" /> Dừng nhận diện
            </button>
          ) : (
            <button type="button" onClick={onStart}
              disabled={!supported || !micEnabled || segments.length >= SPEECH_SEGMENT_LIMIT}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#83A58E] text-[#17251B] text-xs font-semibold disabled:opacity-45 disabled:cursor-not-allowed">
              <Mic className="w-4 h-4" /> Tôi đồng ý, bắt đầu
            </button>
          )}
          {segments.length > 0 && (
            <button type="button" onClick={onClear} className="inline-flex items-center gap-1 px-2 py-2 text-xs text-[#E7B3AE] hover:text-white">
              <Trash2 className="w-3.5 h-3.5" /> Xóa chữ
            </button>
          )}
          {active && <span className="text-xs text-[#A7D1AE]"><span className="inline-block w-2 h-2 bg-[#B6E0BD] rounded-full animate-pulse mr-1" />Đang nghe</span>}
        </div>
      </div>

      {/* Pin provisional words where they can be seen immediately. When the
          list grows long, learners no longer need to scroll to the bottom to
          find the current hypothesis. This text is never saved as final. */}
      {active && (
        <div className="mx-3 mt-3 rounded-xl border border-[#7E9A83] bg-[#2B4232] px-3 py-3 shrink-0" aria-live="off">
          <span className="text-[11px] font-semibold text-[#BFE5C7] block mb-1">
            Chữ đang nhận diện · cập nhật liên tục
          </span>
          {interimText ? (
            <p className="text-sm text-white leading-relaxed break-words whitespace-pre-wrap">{interimText}</p>
          ) : (
            <p className="text-xs text-[#BDD2C1]">Đang nghe… Chữ sẽ xuất hiện ngay khi trình duyệt trả kết quả tạm thời.</p>
          )}
          <p className="text-[10px] text-[#AFC6B4] mt-1">Bản nháp có thể thay đổi; chỉ lưu những câu đã xác nhận.</p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" aria-live="off">
        {segments.length === 0 && !active && (
          <p className="text-xs text-[#A8BAAC] py-4">Chưa có nội dung nhận diện. Bạn có thể ghi video bình thường mà không bật chức năng này.</p>
        )}
        {segments.map((segment, index) => (
          <div key={index} className="p-2.5 rounded-xl bg-[#29382E] border border-[#395041]">
            <div className="text-[10px] font-mono text-[#9CC4A4] mb-1">
              {timeLabel(segment.startSeconds)} – {timeLabel(segment.endSeconds)}
              <span className="text-[#ADC3B1]"> (≈{Math.max(0, segment.endSeconds - segment.startSeconds)} giây)</span>
            </div>
            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{segment.text}</p>
          </div>
        ))}

      </div>

      <footer className="p-3 border-t border-[#354639] text-[11px] text-[#9DB2A2] shrink-0">
        Đã nhận diện {segments.length}/{SPEECH_SEGMENT_LIMIT} đoạn. Không tạo điểm số AI từ văn bản này.
        {segments.length >= SPEECH_SEGMENT_LIMIT && <span className="block text-[#EAD6A9]">Đã đạt giới hạn của bản ghi chữ. Bạn có thể tiếp tục ghi video.</span>}
      </footer>
    </aside>
  );
};
