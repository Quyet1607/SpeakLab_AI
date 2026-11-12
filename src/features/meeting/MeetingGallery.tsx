import React, { useCallback, useEffect, useRef } from 'react';
import { MicOff, VideoOff, Users } from 'lucide-react';
import type { UserProfile, VirtualParticipant } from '../../types';

interface MeetingGalleryProps {
  currentUser: UserProfile;
  participants: VirtualParticipant[];
  cameraStream: MediaStream | null;
  isCameraOff: boolean;
  isMuted: boolean;
  onSimulatedQuestion: (name: string) => void;
}

/**
 * In-room gallery without a presentation.
 * Exactly one real participant: the current learner's webcam, if enabled.
 * All other visible persons are static, clearly labeled simulations.
 */
export const MeetingGallery: React.FC<MeetingGalleryProps> = ({
  currentUser,
  participants,
  cameraStream,
  isCameraOff,
  isMuted,
  onSimulatedQuestion,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && cameraStream && !isCameraOff) {
      node.srcObject = cameraStream;
      void node.play().catch(() => {});
    }
  }, [cameraStream, isCameraOff]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = cameraStream && !isCameraOff ? cameraStream : null;
    if (video.srcObject) void video.play().catch(() => {});
  }, [cameraStream, isCameraOff]);

  return (
    <section className="w-full h-full min-h-0 overflow-y-auto rounded-xl bg-[#151D18] border border-[#2D3930] p-3 sm:p-4" aria-label="Cuộc họp luyện tập, một người thật và các nhân vật mô phỏng">
      <div className="mb-3 flex flex-wrap justify-between items-center gap-2 text-xs text-[#A8B6AB]">
        <span className="inline-flex gap-2 items-center"><Users className="w-4 h-4" />
          Cuộc họp luyện tập · {participants.length + 1} ô tham gia
        </span>
        <span className="text-[11px] text-[#BED5C2]">1 người luyện tập thật · {participants.length} nhân vật mô phỏng</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-[minmax(165px,1fr)]">
        <div className="relative min-h-44 h-48 sm:h-52 bg-[#27352B] border-2 border-[#84A98D] rounded-xl overflow-hidden flex flex-col justify-center items-center">
          {cameraStream && !isCameraOff ? (
            <video ref={attachVideo} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full h-16 w-16 bg-[#63866D] flex justify-center items-center text-white font-bold text-lg">
                {currentUser.avatarInitials}
              </div>
              <span className="text-[11px] text-[#A8B6AB] inline-flex gap-1 items-center"><VideoOff className="w-3.5 h-3.5" />Camera đang tắt</span>
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-between p-2.5 bg-[#121D15]/90 gap-2">
            <span className="text-xs font-semibold truncate">{currentUser.fullName} (Bạn)</span>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[#354F3B] text-[#D9F0DC]">{currentUser.roleDescription === 'Chưa đăng nhập' ? 'Khách' : 'Đã đăng nhập'} {isMuted ? '· Mic tắt' : '· Mic bật'}</span>
          </div>
        </div>
        {participants.map(p => (
          <button
            type="button"
            key={p.id}
            onClick={() => onSimulatedQuestion(p.name)}
            className="relative text-white min-h-44 h-48 sm:h-52 rounded-xl border border-[#36473A] bg-[#26332A] hover:border-[#83A58E] transition-colors overflow-hidden flex flex-col items-center justify-center gap-2 cursor-pointer"
            title="Bấm để gợi ý câu hỏi mô phỏng, không phải cuộc gọi thật"
          >
            <div className="absolute top-2 right-2 rounded-md px-2 py-1 text-[10px] bg-[#19251C] text-[#C9D8CD] border border-[#405444]">Mô phỏng</div>
            <div className="rounded-full h-16 w-16 flex items-center justify-center border-2 border-[#445A4A] text-white text-lg font-bold" style={{backgroundColor:p.avatarBg}}>
              {p.avatarInitials}
            </div>
            <span className="text-[11px] text-[#B7C9BB]">{p.role === 'judge' ? 'Hội đồng phản biện' : 'Thính giả mô phỏng'}</span>
            <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-[#152119]/85 flex gap-2 items-center justify-between">
              <span className="truncate font-semibold text-xs">{p.name}</span>
              <MicOff className="w-3.5 h-3.5 text-[#9BAE9F] shrink-0" />
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[#8FA595]">
        Các thành viên mô phỏng chỉ có ảnh đại diện và câu hỏi luyện tập. Không có người khác đang kết nối, không thu âm giọng nói của họ.
      </p>
    </section>
  );
};
