/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  Users,
  FileText,
  Settings,
  PhoneOff,
  Presentation,
  Circle,
  Square
} from 'lucide-react';

interface MeetingControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreenClick: () => void;
  onToggleAttendees: () => void;
  isAttendeesOpen: boolean;
  attendeeCount: number;
  onToggleNotes: () => void;
  isNotesOpen: boolean;
  onOpenSettings: () => void;
  onEndMeeting: () => void;
  isScreenSharing?: boolean;
  hasPresentation?: boolean;
  onStopScreenShare?: () => void;
  isCameraLoading?: boolean;
  isMicLoading?: boolean;
  cameraError?: string | null;
  micError?: string | null;
  recordingStatus?: 'idle' | 'recording' | 'finalizing' | 'ready' | 'error';
  recordingDuration?: number;
  onRecordClick?: () => void;
}

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  isMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  onShareScreenClick,
  onToggleAttendees,
  isAttendeesOpen,
  attendeeCount,
  onToggleNotes,
  isNotesOpen,
  onOpenSettings,
  onEndMeeting,
  isScreenSharing = false,
  hasPresentation = false,
  onStopScreenShare,
  isCameraLoading = false,
  isMicLoading = false,
  cameraError,
  micError,
  recordingStatus = 'idle',
  recordingDuration = 0,
  onRecordClick,
}) => {
  return (
    <div className="h-14 sm:h-16 md:h-18 bg-[#1B221D] border-t border-[#2D3930] px-2.5 sm:px-4 md:px-6 flex items-center justify-between shadow-2xl z-30 shrink-0">
      {/* Left: Session metadata & Mode indicator */}
      <div className="hidden lg:flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#27332A] border border-[#3A4A3E] flex items-center justify-center text-[#83A58E]">
          <Presentation className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white leading-tight">
            Phòng họp mô phỏng
          </p>
          <p className="text-[10px] text-[#A8B6AB] leading-tight">
            Ghi cuộc họp mô phỏng hoặc PowerPoint
          </p>
        </div>
      </div>

      {/* Center: Main control buttons (Min 40-44px touch target) */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 mx-auto overflow-x-auto min-w-0 shrink overscroll-x-contain" aria-label="Thanh điều khiển phòng họp">
        {/* Microphone */}
        <button
          onClick={onToggleMic}
          disabled={isMicLoading}
          className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 md:p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center relative ${
            isMicLoading
              ? 'bg-[#27332A] opacity-70 cursor-wait border border-[#3A4A3E]'
              : isMuted
              ? 'bg-[#3D2625] text-[#F09995] hover:bg-[#4D302F] border border-[#5E3230]'
              : 'bg-[#27332A] text-white hover:bg-[#344438] border border-[#3A4A3E]'
          }`}
          title={
            isMicLoading
              ? 'Đang kết nối micro...'
              : isMuted
              ? 'Bật Micro thật'
              : 'Tắt Micro thật'
          }
        >
          {isMicLoading ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[#83A58E] animate-spin" />
          ) : isMuted ? (
            <MicOff className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          ) : (
            <Mic className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          )}
          {micError && isMuted && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E5484D]" />
          )}
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCamera}
          disabled={isCameraLoading}
          className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 md:p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center relative ${
            isCameraLoading
              ? 'bg-[#27332A] opacity-70 cursor-wait border border-[#3A4A3E]'
              : isCameraOff
              ? 'bg-[#3D2625] text-[#F09995] hover:bg-[#4D302F] border border-[#5E3230]'
              : 'bg-[#27332A] text-white hover:bg-[#344438] border border-[#3A4A3E]'
          }`}
          title={
            isCameraLoading
              ? 'Đang khởi động camera...'
              : isCameraOff
              ? 'Bật Camera thật'
              : 'Tắt Camera thật'
          }
        >
          {isCameraLoading ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[#83A58E] animate-spin" />
          ) : isCameraOff ? (
            <VideoOff className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          ) : (
            <Video className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          )}
          {cameraError && isCameraOff && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E5484D]" />
          )}
        </button>

        {/* Share Screen */}
        <button
          onClick={isScreenSharing && onStopScreenShare ? onStopScreenShare : onShareScreenClick}
          className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 md:p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center relative ${
            isScreenSharing
              ? 'bg-[#83A58E] text-white hover:bg-[#6F917A] shadow-md ring-2 ring-[#83A58E]/40'
              : 'bg-[#27332A] text-[#A8B6AB] hover:text-white hover:bg-[#344438] border border-[#3A4A3E]'
          }`}
          title={isScreenSharing ? 'Đang chia sẻ màn hình (Bấm để dừng)' : 'Chia sẻ màn hình PowerPoint có hiệu ứng'}
        >
          <Share2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          {isScreenSharing && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E5484D] animate-ping" />
          )}
        </button>

        {/* Composite simulated meeting tiles or real screen capture; real mic only. */}
        <button
          type="button"
          onClick={onRecordClick}
          disabled={!onRecordClick || recordingStatus === 'finalizing'}
          aria-label={recordingStatus === 'recording' ? 'Dừng ghi hình' : isScreenSharing ? 'Bắt đầu ghi màn hình và micro' : 'Bắt đầu ghi lưới cuộc họp và micro'}
          title={recordingStatus === 'recording' ? 'Dừng ghi hình' : recordingStatus === 'finalizing' ? 'Đang hoàn tất bản ghi…' : isScreenSharing ? 'Ghi PowerPoint + micro' : 'Ghi cuộc họp mô phỏng và micro (camera tùy chọn)'}
          className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 md:p-3 rounded-xl border transition-colors flex items-center justify-center shrink-0 ${
            recordingStatus === 'recording'
              ? 'bg-[#873631] text-white border-[#B9544D] hover:bg-[#A33E37]'
              : recordingStatus === 'finalizing'
              ? 'bg-[#27332A] text-[#A8B6AB] border-[#3A4A3E] opacity-60 cursor-wait'
              : 'bg-[#27332A] text-[#F09995] border-[#3A4A3E] hover:bg-[#344438] cursor-pointer'
          }`}
        >
          {recordingStatus === 'recording' ? <Square className="w-4.5 h-4.5 sm:w-5 sm:h-5" fill="currentColor" /> : <Circle className="w-4.5 h-4.5 sm:w-5 sm:h-5" fill="currentColor" />}
        </button>

        {recordingStatus === 'recording' && (
          <span className="inline-flex items-center gap-1 px-2 py-1.5 shrink-0 rounded-lg bg-[#3D2625] border border-[#873631] text-[#FFE2DF] text-[11px] sm:text-xs font-mono tabular-nums" role="timer" aria-live="off" aria-label={`Đang ghi hình, ${Math.floor(recordingDuration / 60)} phút ${recordingDuration % 60} giây`}>
            <span className="w-2 h-2 bg-[#F09995] rounded-full animate-pulse" aria-hidden="true" />
            REC {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
          </span>
        )}
        {recordingStatus === 'finalizing' && (
          <span className="text-[11px] text-[#FFE2DF] shrink-0" role="status">Đang lưu…</span>
        )}

        {/* Attendees List Toggle */}
        <button
          onClick={onToggleAttendees}
          className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 md:p-3 rounded-xl transition-all cursor-pointer relative flex items-center justify-center ${
            isAttendeesOpen
              ? 'bg-[#83A58E] text-white font-semibold'
              : 'bg-[#27332A] text-[#A8B6AB] hover:text-white hover:bg-[#344438] border border-[#3A4A3E]'
          }`}
          title="Mở danh sách người tham dự mô phỏng"
        >
          <Users className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#83A58E] text-white text-[9px] font-bold flex items-center justify-center border border-[#1B221D]">
            {attendeeCount}
          </span>
        </button>

        {/* Presenter Notes */}
        <button
          onClick={onToggleNotes}
          disabled={!hasPresentation}
          className={`disabled:opacity-35 disabled:cursor-not-allowed min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 md:p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
            isNotesOpen
              ? 'bg-[#83A58E] text-white font-semibold'
              : 'bg-[#27332A] text-[#A8B6AB] hover:text-white hover:bg-[#344438] border border-[#3A4A3E]'
          }`}
          title={hasPresentation ? "Kịch bản trình chiếu" : "Không có tài liệu trình chiếu"}
        >
          <FileText className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 md:p-3 rounded-xl bg-[#27332A] text-[#A8B6AB] hover:text-white hover:bg-[#344438] border border-[#3A4A3E] transition-all cursor-pointer flex items-center justify-center"
          title="Cài đặt phòng họp mô phỏng"
        >
          <Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Right: End Meeting CTA */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onEndMeeting}
          className="min-h-[40px] sm:min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#873631] hover:bg-[#A33E37] text-white text-xs font-semibold transition-all shadow-md cursor-pointer"
          title="Kết thúc buổi luyện thuyết trình"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden sm:inline">Kết thúc buổi luyện</span>
        </button>
      </div>
    </div>
  );
};
