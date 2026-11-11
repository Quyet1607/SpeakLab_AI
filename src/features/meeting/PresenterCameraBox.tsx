import React, { useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  RefreshCw,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { UserProfile } from '../../types';
import { DevicePermissionState } from '../../services/mediaDeviceService';

interface PresenterCameraBoxProps {
  currentUser: UserProfile;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShowCameraNotice?: () => void;
  cameraStream?: MediaStream | null;
  audioLevel?: number;
  facingMode?: 'user' | 'environment';
  canSwitchCamera?: boolean;
  onSwitchCamera?: () => void;
  cameraError?: string | null;
  micError?: string | null;
  cameraState?: DevicePermissionState;
  micState?: DevicePermissionState;
  onReconnectCamera?: () => void;
  onReconnectMic?: () => void;
}

export const PresenterCameraBox: React.FC<PresenterCameraBoxProps> = ({
  currentUser,
  isMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  onShowCameraNotice,
  cameraStream,
  audioLevel = 0,
  facingMode = 'user',
  canSwitchCamera = false,
  onSwitchCamera,
  cameraError,
  micError,
  cameraState = 'idle',
  micState = 'idle',
  onReconnectCamera,
  onReconnectMic,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Stable callback ref to immediately attach srcObject the instant the video DOM element mounts
  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node) {
        if (!isCameraOff && cameraStream) {
          if (node.srcObject !== cameraStream) {
            node.srcObject = cameraStream;
          }
          node.play().catch(() => {});
        } else {
          node.srcObject = null;
        }
      }
    },
    [isCameraOff, cameraStream]
  );

  // Effect to sync stream whenever cameraStream or isCameraOff changes
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      if (!isCameraOff && cameraStream) {
        if (videoEl.srcObject !== cameraStream) {
          videoEl.srcObject = cameraStream;
        }
        videoEl.play().catch(() => {});
      } else {
        videoEl.srcObject = null;
      }
    }
  }, [isCameraOff, cameraStream]);

  // Window Focus and Tab Visibility Recovery:
  // When user switches to PowerPoint window to select it for screen sharing and returns to SpeakLab AI,
  // ensure the video element resumes playing smoothly without freezing
  useEffect(() => {
    const handleWindowFocus = () => {
      const videoEl = videoRef.current;
      if (videoEl && !isCameraOff && cameraStream) {
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
    };
  }, [isCameraOff, cameraStream]);

  const hasActiveCamera = !isCameraOff && !!cameraStream;
  const isCameraInterrupted = cameraState === 'interrupted';
  const isCameraDisconnected = cameraState === 'disconnected';
  const isMicInterrupted = micState === 'interrupted';
  const isMicDisconnected = micState === 'disconnected';

  return (
    <div className="relative rounded-2xl bg-[#1C231E] border border-[#2D3830] overflow-hidden flex flex-col justify-between shadow-lg h-56 md:h-64 select-none">
      {/* 1. Live Video Stream or Background Overlay */}
      {hasActiveCamera ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            facingMode === 'user' ? 'transform scale-x-[-1]' : ''
          } ${isCameraInterrupted ? 'opacity-40' : 'opacity-100'}`}
        />
      ) : null}

      {/* Dimmer gradient overlay on top of video for text readability */}
      {hasActiveCamera && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />
      )}

      {/* 2. Top Bar: Presenter badge & Micro quick toggle / Camera switch */}
      <div className="p-2.5 sm:p-3 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-1.5 bg-[#1B241E]/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#38483C] text-xs font-semibold text-white max-w-[70%] truncate">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isCameraInterrupted
                ? 'bg-[#E8C27B] animate-ping'
                : hasActiveCamera
                ? 'bg-[#83A58E] animate-pulse ring-2 ring-[#83A58E]/40'
                : 'bg-[#768078]'
            }`}
          />
          <span className="truncate">{currentUser.fullName} (Bạn)</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Switch front/back camera button on mobile/multi-camera */}
          {hasActiveCamera && canSwitchCamera && onSwitchCamera && (
            <button
              onClick={onSwitchCamera}
              className="p-1.5 rounded-lg text-xs bg-[#1B241E]/80 hover:bg-[#2A362D] text-white border border-[#38483C] transition-colors cursor-pointer"
              title="Chuyển camera trước / sau"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick Mic toggle */}
          <button
            onClick={onToggleMic}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isMuted
                ? 'bg-[#3D2625] text-[#F09995] border border-[#5E3230]'
                : isMicInterrupted
                ? 'bg-[#3D3525] text-[#E8C27B] border border-[#5E4E30]'
                : 'bg-[#2B3B2F] text-[#9EC9A9] border border-[#3F5945]'
            }`}
            title={
              isMicInterrupted
                ? 'Micro tạm thời gián đoạn'
                : isMuted
                ? 'Bật Micro thật'
                : 'Tắt Micro thật'
            }
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Interruption or Disconnection Overlay Banner */}
      {isCameraInterrupted && (
        <div className="absolute inset-x-2 top-12 z-20 p-2 rounded-lg bg-[#2A2318]/90 backdrop-blur-md border border-[#5E4D2B] text-[10px] text-[#E8C27B] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>Camera tạm thời gián đoạn. Tín hiệu sẽ tự khôi phục khi bạn quay lại cửa sổ.</span>
        </div>
      )}

      {isCameraDisconnected && (
        <div className="absolute inset-x-2 top-12 z-20 p-2 rounded-lg bg-[#3D2524]/90 backdrop-blur-md border border-[#5E3230] text-[10px] text-[#F09995] flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Camera đã mất kết nối với thiết bị.</span>
          </div>
          {onReconnectCamera && (
            <button
              onClick={onReconnectCamera}
              className="ml-2 px-2 py-0.5 rounded bg-[#5E3230] text-white hover:bg-[#7E3D3A] text-[9px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Kết nối lại</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Center Area: Placeholder when Camera is OFF, or Active Camera Status */}
      {!hasActiveCamera ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 z-10">
          <div
            onClick={onShowCameraNotice || onToggleCamera}
            className="w-13 h-13 rounded-full bg-[#242F27] border border-[#38493C] flex items-center justify-center text-[#83A58E] mb-2 cursor-pointer hover:scale-105 transition-transform"
            title="Bấm để bật camera"
          >
            <CameraOff className="w-6 h-6 text-[#7E8F82]" />
          </div>

          <p className="text-xs font-semibold text-[#D4E0D7]">
            {isCameraDisconnected ? 'Camera đã mất kết nối' : 'Camera đang tắt'}
          </p>

          <p className="text-[11px] text-[#8C9C8F] mt-0.5 max-w-xs leading-relaxed">
            {isCameraDisconnected
              ? 'Thiết bị camera bị ngắt. Hãy kiểm tra kết nối và nhấn nút kết nối lại.'
              : 'Nhấn nút Camera ở thanh điều khiển bên dưới để quan sát hình ảnh thật của bạn.'}
          </p>

          {/* Reconnect button for disconnected camera */}
          {isCameraDisconnected && onReconnectCamera && (
            <button
              onClick={onReconnectCamera}
              className="mt-2.5 px-3 py-1 rounded-lg bg-[#2D3930] hover:bg-[#3B4D3F] border border-[#3E5242] text-xs font-semibold text-[#83A58E] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Kết nối lại Camera</span>
            </button>
          )}

          {/* Device Error Banner if permission was denied */}
          {cameraError && !isCameraDisconnected && (
            <div className="mt-2 p-1.5 px-2.5 rounded-lg bg-[#3D2524] border border-[#5E3230] text-[10px] text-[#F09995] flex items-center gap-1.5 max-w-xs text-left">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="line-clamp-2">{cameraError}</span>
            </div>
          )}

          {/* Real Audio Volume Meter when micro is ON */}
          {!isMuted ? (
            <div className="flex flex-col items-center gap-1 mt-2.5">
              <div className="flex items-center gap-1 h-3.5">
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((threshold, idx) => {
                  const isActive = audioLevel >= threshold;
                  const height = 4 + idx * 1.2;
                  return (
                    <span
                      key={idx}
                      style={{ height: `${height}px` }}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        isActive
                          ? 'bg-[#83A58E] shadow-[0_0_6px_#83A58E]'
                          : 'bg-[#2E3B31]'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] text-[#8C9C8F] tabular-nums">
                {isMicInterrupted
                  ? 'Micro tạm thời gián đoạn tín hiệu'
                  : audioLevel > 5
                  ? `Tín hiệu micro: ${audioLevel}% (Đang thu)`
                  : 'Micro sẵn sàng · Đang im lặng'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-[#768078]">
              <MicOff className="w-3 h-3 text-[#768078]" />
              <span>{isMicDisconnected ? 'Micro đã ngắt kết nối' : 'Micro đang tắt'}</span>
              {isMicDisconnected && onReconnectMic && (
                <button
                  onClick={onReconnectMic}
                  className="ml-2 text-[#83A58E] hover:underline font-semibold cursor-pointer"
                >
                  Kết nối lại
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* When Camera is ACTIVE: floating bottom audio bar and privacy notice */
        <div className="p-3 z-10 mt-auto space-y-1.5">
          {/* Real-time Audio Level Bar Overlay */}
          {!isMuted && (
            <div className="bg-[#18221B]/85 backdrop-blur-md p-1.5 px-2.5 rounded-lg border border-[#2F4033] flex items-center justify-between text-[10px] text-[#D4E0D7]">
              <div className="flex items-center gap-1.5">
                <Mic className={`w-3 h-3 ${isMicInterrupted ? 'text-[#E8C27B]' : 'text-[#83A58E]'}`} />
                <span>Micro:</span>
                <div className="flex items-center gap-0.5 h-3">
                  {[15, 30, 45, 60, 75, 90].map((threshold, idx) => {
                    const isActive = audioLevel >= threshold;
                    return (
                      <span
                        key={idx}
                        className={`w-1 h-2 rounded-full transition-all duration-75 ${
                          isActive ? (isMicInterrupted ? 'bg-[#E8C27B]' : 'bg-[#83A58E]') : 'bg-[#3A4A3E]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <span className={`font-mono text-[9px] font-semibold ${isMicInterrupted ? 'text-[#E8C27B]' : 'text-[#83A58E]'}`}>
                {isMicInterrupted ? 'Tạm ngắt' : audioLevel > 5 ? `${audioLevel}%` : 'Tĩnh'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. Bottom Footer: Privacy Notice (Section IX) */}
      <div className="p-2 bg-[#151C17]/95 border-t border-[#263329] flex items-center justify-between text-[10px] text-[#8C9C8F] z-10">
        <span className="truncate">
          {isCameraInterrupted
            ? 'Camera tạm thời gián đoạn · Đang đợi...'
            : isCameraDisconnected
            ? 'Camera đã mất kết nối'
            : hasActiveCamera
            ? 'Camera trực tiếp · Chưa ghi hình'
            : 'Xem trước phòng luyện · Chưa ghi hình'}
        </span>
        <span className="text-[#83A58E] font-medium shrink-0 ml-1">
          Chỉ xem trước
        </span>
      </div>
    </div>
  );
};
