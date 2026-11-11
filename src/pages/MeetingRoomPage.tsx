/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  ChevronLeft,
  Users,
  Presentation,
  Sparkles,
  Info,
  Sliders,
  Share2,
  Video,
  Layers,
  HelpCircle,
  Download
} from 'lucide-react';
import {
  UserProfile,
  PracticeSession,
  PresentationDeck,
  VirtualParticipant,
  ActivePage,
  PresentationSource
} from '../types';
import { SlideViewer } from '../features/meeting/SlideViewer';
import { ParticipantGrid } from '../features/meeting/ParticipantGrid';
import { PresenterCameraBox } from '../features/meeting/PresenterCameraBox';
import { MeetingControls } from '../features/meeting/MeetingControls';
import { AttendeeDrawer } from '../features/meeting/AttendeeDrawer';
import { PresenterNotesDrawer } from '../features/meeting/PresenterNotesDrawer';
import { EndMeetingModal } from '../features/meeting/EndMeetingModal';
import { ScreenShareGuideModal } from '../features/meeting/ScreenShareGuideModal';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { pptxSessionStore } from '../services/pptxService';
import { screenShareService } from '../services/screenShareService';
import { mediaDeviceService, DevicePermissionState } from '../services/mediaDeviceService';
import { ScreenAudioRecordingSession, PresentationRecordingResult } from '../services/presentationRecordingService';
import { saveLocalVideo } from '../services/localVideoLibrary';

interface MeetingRoomPageProps {
  currentUser: UserProfile;
  session: PracticeSession;
  deck: PresentationDeck;
  participants: VirtualParticipant[];
  onNavigate: (page: ActivePage) => void;
  onFinishSession: () => void;
}

export const MeetingRoomPage: React.FC<MeetingRoomPageProps> = ({
  currentUser,
  session,
  deck,
  participants,
  onNavigate,
  onFinishSession,
}) => {
  // Presentation & Meeting State
  const [activeSource, setActiveSource] = useState<PresentationSource | undefined>(
    session.presentationSource
  );
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isAttendeesOpen, setIsAttendeesOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(145); // start with realistic ~2m25s demo time
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Real Camera & Microphone State (Phase 3.1: default to OFF for privacy)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraOff, setIsCameraOff] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraState, setCameraState] = useState<DevicePermissionState>('idle');

  const [isMuted, setIsMuted] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [isMicLoading, setIsMicLoading] = useState(false);
  const [micState, setMicState] = useState<DevicePermissionState>('idle');

  // Device Selection & Hardware Settings
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');

  // Screen Share State (Independent stream from camera & microphone)
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [previousSource, setPreviousSource] = useState<PresentationSource | undefined>(undefined);
  const [showShareGuideModal, setShowShareGuideModal] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Đợt 3.2A: ghi màn hình PowerPoint đang chia sẻ + tiếng micro (chưa ghép webcam).
  const recordingSessionRef = useRef<ScreenAudioRecordingSession | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'finalizing' | 'ready' | 'error'>('idle');
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingResult, setRecordingResult] = useState<PresentationRecordingResult | null>(null);
  const [recordingDownloaded, setRecordingDownloaded] = useState(false);
  const [recordingSavedLocal, setRecordingSavedLocal] = useState(false);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [showRecordingConfirm, setShowRecordingConfirm] = useState(false);

  // Modals & Notices
  const [showEndModal, setShowEndModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCameraNoticeModal, setShowCameraNoticeModal] = useState(false);
  const [showTitleDetailModal, setShowTitleDetailModal] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<{
    judge: string;
    text: string;
  } | null>(null);

  // Mobile View Switcher: 'slide' | 'audience' | 'camera'
  const [mobileTab, setMobileTab] = useState<'slide' | 'audience' | 'camera'>('slide');

  // Query hardware devices list
  const loadHardwareDevices = async () => {
    try {
      const devices = await mediaDeviceService.getAvailableDevices();
      setAvailableCameras(devices.videoInputs);
      setAvailableMicrophones(devices.audioInputs);
      if (devices.videoInputs.length > 1) {
        setCanSwitchCamera(true);
      }
    } catch (err) {
      console.warn('Không thể truy vấn danh sách thiết bị media:', err);
    }
  };

  const canLeaveMeeting = (): boolean => {
    if (recordingSessionRef.current || recordingStatus === 'finalizing') {
      setRecordingNotice('Hãy dừng ghi hình và đợi hoàn tất tệp trước khi rời phòng.');
      return false;
    }
    if (recordingResult && !recordingDownloaded && !recordingSavedLocal) {
      setRecordingNotice('Video chưa được lưu. Hãy tải bản ghi về thiết bị trước khi rời phòng.');
      return false;
    }
    return true;
  };

  const handleStartRecording = () => {
    setShowRecordingConfirm(false);
    if (recordingSessionRef.current || recordingStatus === 'finalizing') return;
    if (recordingResult && !recordingDownloaded && !recordingSavedLocal) {
      setRecordingNotice('Hãy lưu hoặc tải bản ghi trước đó về thiết bị trước khi bắt đầu bản ghi mới.');
      return;
    }

    const screen = screenShareService.getActiveStream();
    const microphone = mediaDeviceService.getMicrophoneStream();
    if (!screen?.getVideoTracks().some(t => t.readyState === 'live' && t.enabled)) {
      setRecordingNotice('Để ghi PowerPoint có hiệu ứng, hãy bắt đầu chia sẻ đúng cửa sổ PowerPoint trước.');
      return;
    }
    if (!microphone?.getAudioTracks().some(t => t.readyState === 'live' && t.enabled)) {
      setRecordingNotice('Hãy bật micro thật và kiểm tra tín hiệu trước khi bắt đầu ghi hình.');
      return;
    }

    try {
      const sessionRecorder = new ScreenAudioRecordingSession(screen, microphone, (input) => {
        void handleStopRecording(input === 'screen'
          ? 'Nguồn chia sẻ PowerPoint đã ngắt; bản ghi được dừng để tránh hình đen.'
          : 'Nguồn micro đã ngắt; bản ghi được dừng để tránh mất tiếng.');
      });
      sessionRecorder.start();
      recordingSessionRef.current = sessionRecorder;
      setRecordingResult(null);
      setRecordingDownloaded(false);
      setRecordingSavedLocal(false);
      setRecordingDuration(0);
      setRecordingStartedAt(Date.now());
      setRecordingStatus('recording');
    } catch (error) {
      setRecordingStatus('error');
      setRecordingNotice(error instanceof Error ? error.message : 'Không thể khởi động ghi hình.');
    }
  };

  const handleStopRecording = async (reason?: string) => {
    const active = recordingSessionRef.current;
    if (!active) return;
    recordingSessionRef.current = null;
    setRecordingStatus('finalizing');
    try {
      const result = await active.stop();
      setRecordingResult(result);
      setRecordingDownloaded(false);
      setRecordingSavedLocal(false);
      setRecordingDuration(Math.round(result.durationMs / 1000));
      try {
        // IndexedDB is a temporary same-browser fallback; this is NOT a cloud upload.
        await saveLocalVideo(session, result);
        setRecordingSavedLocal(true);
        if (reason) setRecordingNotice(reason + ' Đã lưu tạm trên trình duyệt, chưa đồng bộ Google Drive.');
      } catch (saveError) {
        setRecordingNotice((reason ? reason + ' ' : '') + (saveError instanceof Error ? saveError.message : 'Không lưu được video.') + ' Hãy nhấn “Lưu video” để tải về thiết bị ngay.');
      }
      setRecordingStatus('ready');
    } catch (error) {
      setRecordingStatus('error');
      setRecordingNotice(error instanceof Error ? error.message : 'Không thể hoàn tất bản ghi.');
    } finally {
      setRecordingStartedAt(null);
    }
  };

  const handleDownloadRecording = () => {
    if (!recordingResult) return;
    const url = URL.createObjectURL(recordingResult.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SpeakLab_AI_ghi_man_hinh_${new Date().toISOString().replace(/[:.]/g, '-')}.${recordingResult.fileExtension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setRecordingDownloaded(true); // requested, not verified by OS
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  useEffect(() => {
    if (recordingStatus !== 'recording' || recordingStartedAt === null) return;
    const interval = window.setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - recordingStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [recordingStatus, recordingStartedAt]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (recordingSessionRef.current || recordingStatus === 'finalizing' || (recordingResult && !recordingDownloaded && !recordingSavedLocal)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [recordingStatus, recordingResult, recordingDownloaded, recordingSavedLocal]);

  // Real Camera Toggle Handler
  const handleToggleCamera = async () => {
    setCameraError(null);
    if (!isCameraOff && cameraStream) {
      // Turn OFF
      mediaDeviceService.stopCamera();
      setCameraStream(null);
      setIsCameraOff(true);
    } else {
      // Turn ON
      setIsCameraLoading(true);
      try {
        const stream = await mediaDeviceService.startCamera({
          deviceId: selectedCameraId || undefined,
          facingMode: cameraFacingMode,
        });
        setCameraStream(stream);
        setIsCameraOff(false);
        setCameraFacingMode(mediaDeviceService.getCurrentFacingMode());
        const hasMultiple = await mediaDeviceService.hasMultipleVideoInputs();
        setCanSwitchCamera(hasMultiple);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể kích hoạt camera.';
        setCameraError(msg);
        setIsCameraOff(true);
        setCameraStream(null);
      } finally {
        setIsCameraLoading(false);
      }
    }
  };

  // Camera switch handler (front/back)
  const handleSwitchCamera = async () => {
    if (isCameraOff) return;
    setIsCameraLoading(true);
    try {
      const stream = await mediaDeviceService.switchCamera();
      setCameraStream(stream);
      setCameraFacingMode(mediaDeviceService.getCurrentFacingMode());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể chuyển đổi camera.';
      setCameraError(msg);
    } finally {
      setIsCameraLoading(false);
    }
  };

  // Real Microphone Toggle Handler
  const handleToggleMic = async () => {
    setMicError(null);
    if (!isMuted) {
      if (recordingSessionRef.current) {
        await handleStopRecording('Micro đã được tắt; bản ghi kết thúc để bảo đảm quyền riêng tư.');
      }
      mediaDeviceService.stopMicrophone();
      setIsMuted(true);
      setAudioLevel(0);
    } else {
      // Turn ON
      setIsMicLoading(true);
      try {
        await mediaDeviceService.startMicrophone(selectedMicrophoneId || undefined);
        setIsMuted(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể kích hoạt micro.';
        setMicError(msg);
        setIsMuted(true);
        setAudioLevel(0);
      } finally {
        setIsMicLoading(false);
      }
    }
  };

  // Subscribe to real-time audio volume level
  useEffect(() => {
    const unsubscribeAudio = mediaDeviceService.subscribeAudioLevel((level) => {
      setAudioLevel(level);
    });

    // Synchronize state with real-time media device events (track mute/unmute/ended)
    const unsubscribeDevice = mediaDeviceService.subscribe(() => {
      const camStatus = mediaDeviceService.getCameraStatus();
      const micStatus = mediaDeviceService.getMicrophoneStatus();

      setCameraStream(mediaDeviceService.getCameraStream());
      setIsCameraOff(!camStatus.isEnabled);
      setCameraFacingMode(mediaDeviceService.getCurrentFacingMode());
      setCameraState(camStatus.permissionState);
      setCameraError(camStatus.errorMessage || null);

      setIsMuted(!micStatus.isEnabled);
      setMicState(micStatus.permissionState);
      setMicError(micStatus.errorMessage || null);
    });

    loadHardwareDevices();

    return () => {
      unsubscribeAudio();
      unsubscribeDevice();
    };
  }, []);

  // Window Focus and Visibility Recovery:
  // When user switches windows or returns to SpeakLab AI from PowerPoint,
  // ensure AudioContext and camera/mic tracks remain active and resumed
  useEffect(() => {
    const handleFocusRecovery = () => {
      mediaDeviceService.resumeAudio();
    };

    window.addEventListener('focus', handleFocusRecovery);
    document.addEventListener('visibilitychange', handleFocusRecovery);
    return () => {
      window.removeEventListener('focus', handleFocusRecovery);
      document.removeEventListener('visibilitychange', handleFocusRecovery);
    };
  }, []);

  // Stop Screen Share handler (stops ONLY screen capture tracks, never touches camera/mic)
  const handleStopScreenShare = async () => {
    if (recordingSessionRef.current) {
      await handleStopRecording('Chia sẻ màn hình đã dừng; bản ghi được hoàn tất.');
    }
    screenShareService.stopShare(screenStream);
    setScreenStream(null);
    setIsScreenSharing(false);

    if (previousSource) {
      setActiveSource(previousSource);
    } else {
      setActiveSource(
        session.presentationSource || {
          type: 'demo',
          deckId: deck.id,
          name: deck.title,
          slideCount: deck.slides.length,
          status: 'ready',
        }
      );
    }

    // Ensure audio level analyzer is resumed smoothly
    mediaDeviceService.resumeAudio();
  };

  // Start Screen Share handler (preserves active camera and microphone tracks)
  const handleStartScreenShare = async () => {
    setShowShareGuideModal(false);

    const capability = screenShareService.getCapability();
    if (!capability.isSupported) {
      setShareError(capability.friendlyNotice);
      return;
    }

    try {
      const stream = await screenShareService.startShare();

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          // Native "Stop sharing" floating bar clicked in browser
          handleStopScreenShare();
        };
      }

      setPreviousSource(activeSource);
      setScreenStream(stream);
      setIsScreenSharing(true);
      setActiveSource({
        type: 'screenShare',
        name: 'Cửa sổ PowerPoint (Animation trực tiếp)',
        slideCount: activeSource?.slideCount || 1,
        status: 'ready',
        stream,
      });

      // Ensure audio analyzer continues smoothly if browser momentarily blurred the tab
      mediaDeviceService.resumeAudio();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'NotAllowedError') {
        // User closed or dismissed the browser picker
        console.log('Người dùng đã đóng hộp thoại chia sẻ màn hình.');
      } else {
        const msg = err instanceof Error ? err.message : capability.friendlyNotice;
        console.error('Lỗi khi kích hoạt Screen Capture:', err);
        setShareError(msg);
      }
    }
  };

  // Keep ref to active screenStream for unmount cleanup ONLY
  const screenStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  // CRITICAL FIX: Cleanup media tracks ONLY when leaving the meeting room (unmount)!
  // Empty dependency array [] ensures this NEVER triggers on screenStream changes!
  useEffect(() => {
    return () => {
      recordingSessionRef.current?.dispose();
      recordingSessionRef.current = null;
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      mediaDeviceService.stopAll();
    };
  }, []);

  // Elapsed time counter with clean lifecycle management
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalSlides = activeSource?.type === 'pptx' ? (activeSource.slideCount || 1) : deck.slides.length;

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < totalSlides - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleTriggerSimulatedQuestion = (judgeName: string) => {
    setActiveQuestion({
      judge: judgeName,
      text: `Chào em Quân, thầy muốn hỏi thêm về tính khả thi của hệ thống camera khi căng-tin vào giờ cao điểm, ánh sáng yếu hoặc học sinh bỏ rác liên tục thì thuật toán xử lý thế nào?`,
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#181F1A] text-white select-none">
      {/* 1. Meeting Top Bar */}
      <header className="h-12 sm:h-14 bg-[#1E2620] border-b border-[#2C382F] px-2 sm:px-4 md:px-5 flex items-center justify-between z-30 shrink-0 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
          <button
            onClick={() => {
              if (!canLeaveMeeting()) return;
              void handleStopScreenShare();
              mediaDeviceService.stopAll();
              onNavigate('dashboard');
            }}
            className="p-1 sm:p-1.5 rounded-lg text-[#A8B6AB] hover:text-white hover:bg-[#2A362D] transition-colors cursor-pointer shrink-0"
            title="Thoát về Tổng quan"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1
                onClick={() => setShowTitleDetailModal(true)}
                className="text-xs md:text-sm font-bold text-white tracking-tight truncate max-w-[120px] sm:max-w-xs md:max-w-md cursor-pointer hover:underline"
                title="Bấm để xem tên đầy đủ"
              >
                {session.title}
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-[#83A58E] bg-[#28352B] px-2 py-0.5 rounded border border-[#38493B] shrink-0">
                {session.modeTitle}
              </span>
            </div>
            <p className="text-[10px] text-[#A8B6AB] hidden md:block">
              Phòng họp trực tuyến giả lập · SpeakLab AI
            </p>
          </div>
        </div>

        {/* Center: Live timer & Recording status (Phase 3.1: Explicitly "Chưa ghi hình") */}
        <div className="flex items-center gap-1.5 sm:gap-3 bg-[#151C17] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-[#2A362D] shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono font-medium text-[#83A58E]">
            <span className="w-2 h-2 rounded-full bg-[#83A58E]" />
            <span className="tabular-nums">{formatTimer(elapsedSeconds)}</span>
            <span className="text-[#6D7F72]">/ {formatTimer(session.durationSeconds)}</span>
          </div>

          <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] border-l border-[#2A362D] pl-2 ${recordingStatus === 'recording' ? 'text-[#F09995]' : 'text-[#A8B6AB]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${recordingStatus === 'recording' ? 'bg-[#E5484D] animate-pulse' : 'bg-[#6D7F72]'}`} />
            {recordingStatus === 'recording' ? `REC ${formatTimer(recordingDuration)}` : recordingStatus === 'finalizing' ? 'Đang hoàn tất…' : recordingStatus === 'ready' ? 'Đã ghi xong' : 'Chưa ghi hình'}
          </span>
        </div>

        {/* Right: Mobile View Tabs & End button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Tab switchers (Slide / Audience / Camera) */}
          <div className="lg:hidden flex items-center bg-[#253027] p-0.5 rounded-lg border border-[#37473A]">
            <button
              onClick={() => setMobileTab('slide')}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded font-medium transition-colors cursor-pointer ${
                mobileTab === 'slide' ? 'bg-[#83A58E] text-white font-semibold shadow-2xs' : 'text-[#A8B6AB]'
              }`}
            >
              Slide
            </button>
            <button
              onClick={() => setMobileTab('audience')}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded font-medium transition-colors cursor-pointer ${
                mobileTab === 'audience' ? 'bg-[#83A58E] text-white font-semibold shadow-2xs' : 'text-[#A8B6AB]'
              }`}
            >
              Hội đồng ({participants.length})
            </button>
            <button
              onClick={() => setMobileTab('camera')}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded font-medium transition-colors cursor-pointer ${
                mobileTab === 'camera' ? 'bg-[#83A58E] text-white font-semibold shadow-2xs' : 'text-[#A8B6AB]'
              }`}
            >
              Camera
            </button>
          </div>

          <button
            onClick={() => setShowEndModal(true)}
            className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#873631] hover:bg-[#A33E37] text-white font-medium transition-colors cursor-pointer shrink-0 min-h-[32px] sm:min-h-[36px] flex items-center justify-center"
          >
            Kết thúc
          </button>
        </div>
      </header>

      {/* Simulated Question Banner / Toast if triggered */}
      {activeQuestion && (
        <div className="bg-[#2D3930] border-b border-[#3E4F41] px-3 sm:px-4 py-2 flex items-center justify-between text-xs animate-in slide-in-from-top duration-200 z-20">
          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#E8C27B] mt-1.5 shrink-0" />
            <div>
              <span className="font-bold text-[#E8C27B]">
                {activeQuestion.judge} (Đặt câu hỏi phản biện mô phỏng):
              </span>{' '}
              <span className="text-[#D8E6DC]">{activeQuestion.text}</span>
            </div>
          </div>
          <button
            onClick={() => setActiveQuestion(null)}
            className="text-[#A8B6AB] hover:text-white px-2 py-1 ml-3 rounded bg-[#1C241E] text-[10px] sm:text-[11px] shrink-0 border border-[#3A4A3E] cursor-pointer"
          >
            Đã trả lời / Đóng
          </button>
        </div>
      )}

      {/* 2. Main Conference Stage (Responsive Layout) */}
      <div className="flex-1 flex overflow-hidden p-1.5 sm:p-2 md:p-4 gap-2 md:gap-3 relative min-h-0">
        {/* Left / Center Work Area */}
        <div className="flex-1 flex flex-col gap-2 md:gap-3 min-w-0 min-h-0 overflow-hidden">
          {/* Top Audience & Juror Video Strip (Horizontal Carousel on Desktop or when mobileTab === 'audience') */}
          <div
            className={`shrink-0 ${
              mobileTab === 'audience' ? 'block flex-1 overflow-y-auto' : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-[#A8B6AB] mb-1.5 px-1">
              <span>Hội đồng mô phỏng ({participants.length} người)</span>
              <span className="text-[10px] text-[#83A58E]">Bấm vào giám khảo để mô phỏng đặt câu hỏi</span>
            </div>
            <ParticipantGrid
              participants={participants}
              onParticipantClick={(p) => handleTriggerSimulatedQuestion(p.name)}
            />
          </div>

          {/* Main Presentation Stage & Presenter Camera Tile */}
          <div className="flex-1 flex flex-col lg:flex-row gap-2 md:gap-3 min-h-0 overflow-hidden">
            {/* Slide Presentation Canvas */}
            <div
              className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden ${
                mobileTab === 'slide' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <SlideViewer
                slides={deck.slides}
                currentSlideIndex={currentSlideIndex}
                onPrevSlide={handlePrevSlide}
                onNextSlide={handleNextSlide}
                onSelectSlide={(idx) => setCurrentSlideIndex(idx)}
                onShareScreenClick={() => setShowShareGuideModal(true)}
                onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
                isNotesOpen={isNotesOpen}
                presentationSource={activeSource}
                screenStream={screenStream}
                onStopScreenShare={handleStopScreenShare}
                onSwitchToDemo={() =>
                  setActiveSource({
                    type: 'demo',
                    deckId: deck.id,
                    name: deck.title,
                    slideCount: deck.slides.length,
                    status: 'ready',
                  })
                }
              />
            </div>

            {/* Presenter Camera Box (Sidebar on large screens or dedicated tab on mobile) */}
            <div
              className={`lg:w-80 shrink-0 flex flex-col gap-3 ${
                mobileTab === 'camera' ? 'flex flex-1 overflow-y-auto' : 'hidden lg:flex'
              }`}
            >
              <PresenterCameraBox
                currentUser={currentUser}
                isMuted={isMuted}
                isCameraOff={isCameraOff}
                onToggleMic={handleToggleMic}
                onToggleCamera={handleToggleCamera}
                cameraStream={cameraStream}
                audioLevel={audioLevel}
                facingMode={cameraFacingMode}
                canSwitchCamera={canSwitchCamera}
                onSwitchCamera={handleSwitchCamera}
                cameraError={cameraError}
                micError={micError}
                cameraState={cameraState}
                micState={micState}
                onReconnectCamera={handleToggleCamera}
                onReconnectMic={handleToggleMic}
                onShowCameraNotice={() => setShowCameraNoticeModal(true)}
              />

              {/* Quick Session Coach Card */}
              <div className="p-3.5 rounded-2xl bg-[#1E2620] border border-[#2D3930] text-xs text-[#A8B6AB] space-y-2">
                <div className="flex items-center justify-between text-white font-semibold">
                  <span className="flex items-center gap-1.5 text-xs text-[#83A58E]">
                    <Sparkles className="w-3.5 h-3.5" />
                    Chỉ dẫn buổi nói
                  </span>
                  <span className="text-[10px] text-[#8C9E91] font-mono">
                    {activeSource?.type === 'screenShare'
                      ? 'Live Screen Share'
                      : activeSource?.type === 'pptx'
                      ? `${activeSource.slideCount} slides PPTX`
                      : `Slide ${currentSlideIndex + 1}/${deck.slides.length}`}
                  </span>
                </div>
                <p className="text-[11px] text-[#C4D3C7] leading-relaxed">
                  {activeSource?.type === 'screenShare' ? (
                    <>
                      Bạn đang <strong>chia sẻ màn hình PowerPoint có hiệu ứng</strong>. Mọi hiệu ứng chuyển động và hoạt họa đang được truyền phát trực tiếp đến hội đồng.
                    </>
                  ) : activeSource?.type === 'pptx' ? (
                    <>
                      Bạn đang diễn tập với tệp: <strong>{activeSource.name}</strong>. Hội đồng mô phỏng đang lắng nghe phần trình bày mở đầu của bạn.
                    </>
                  ) : (
                    <>
                      Bạn đang ở phần: <strong>{deck.slides[currentSlideIndex]?.title}</strong>. Thầy cô giám khảo đang theo dõi kỹ phương pháp và số liệu.
                    </>
                  )}
                </p>
                <div className="pt-2 border-t border-[#2C392F] flex items-center justify-between text-[11px]">
                  <span>Hội đồng: {participants.filter((p) => p.role === 'judge').length} giám khảo</span>
                  <button
                    onClick={() => setIsNotesOpen(true)}
                    className="text-[#83A58E] hover:underline font-medium cursor-pointer"
                  >
                    Xem kịch bản thoại
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Drawers */}
        <AttendeeDrawer
          isOpen={isAttendeesOpen}
          onClose={() => setIsAttendeesOpen(false)}
          participants={participants}
          onTriggerSimulatedQuestion={handleTriggerSimulatedQuestion}
        />

        <PresenterNotesDrawer
          isOpen={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
          slide={deck.slides[currentSlideIndex] || deck.slides[0]}
          currentSlideIndex={currentSlideIndex}
          totalSlides={totalSlides}
          customTitle={activeSource?.type === 'pptx' ? `Slide ${currentSlideIndex + 1} · ${activeSource.name}` : undefined}
          customNotes={activeSource?.type === 'pptx' ? pptxSessionStore.getSlideNotes(currentSlideIndex) : undefined}
        />
      </div>

      {/* 3. Bottom Meeting Controls Dock */}
      <MeetingControls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        isCameraLoading={isCameraLoading}
        isMicLoading={isMicLoading}
        cameraError={cameraError}
        micError={micError}
        onShareScreenClick={() => setShowShareGuideModal(true)}
        isScreenSharing={isScreenSharing}
        onStopScreenShare={handleStopScreenShare}
        onToggleAttendees={() => {
          setIsAttendeesOpen(!isAttendeesOpen);
          setIsNotesOpen(false);
        }}
        isAttendeesOpen={isAttendeesOpen}
        attendeeCount={participants.length}
        onToggleNotes={() => {
          setIsNotesOpen(!isNotesOpen);
          setIsAttendeesOpen(false);
        }}
        isNotesOpen={isNotesOpen}
        onOpenSettings={() => {
          loadHardwareDevices();
          setShowSettingsModal(true);
        }}
        onEndMeeting={() => setShowEndModal(true)}
        recordingStatus={recordingStatus}
        onRecordClick={() => recordingStatus === 'recording' ? void handleStopRecording() : setShowRecordingConfirm(true)}
      />

      {/* Đợt 3.2A: xác nhận ghi màn hình PowerPoint + micro */}
      <Modal
        isOpen={showRecordingConfirm}
        onClose={() => setShowRecordingConfirm(false)}
        title="Xác nhận bắt đầu ghi hình"
        subtitle="Đợt 3.2A – Ghi màn hình PowerPoint và tiếng micro"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowRecordingConfirm(false)}>Hủy</Button>
            <Button variant="primary" size="sm" onClick={handleStartRecording}>Bắt đầu ghi</Button>
          </>
        }
      >
        <div className="space-y-2 text-xs text-[#3D4740]">
          <p>Chỉ ghi <strong>màn hình PowerPoint đang chia sẻ</strong> và <strong>âm thanh micro</strong>. Camera chưa được đưa vào video ở bước 3.2A.</p>
          <p className="text-[#647568]">Video tự động được lưu tạm trên trình duyệt này để xem trong Lịch sử. Chưa đồng bộ lên Google Drive. Có thể tải video về thiết bị.</p>
          <p className="font-medium text-[#873631]">Hãy bật micro và chia sẻ đúng cửa sổ trình chiếu PowerPoint trước khi bắt đầu.</p>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(recordingNotice)}
        onClose={() => setRecordingNotice(null)}
        title="Thông báo ghi hình"
        footer={<Button variant="primary" size="sm" onClick={() => setRecordingNotice(null)}>Đã hiểu</Button>}
      >
        <p className="text-xs text-[#3D4740]">{recordingNotice}</p>
      </Modal>

      {recordingResult && recordingStatus === 'ready' && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 w-[min(95vw,430px)] bg-[#F7F9F6] border border-[#83A58E] shadow-xl rounded-xl p-3 z-40 text-[#3D4740] flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">Video PowerPoint + micro đã hoàn tất</p>
            <p className="text-[11px] text-[#768078]">{formatTimer(Math.round(recordingResult.durationMs / 1000))} · {(recordingResult.bytes / 1024 / 1024).toFixed(1)} MB · {recordingResult.fileExtension.toUpperCase()}</p>
            <p className="text-[10px] text-[#768078]">{recordingSavedLocal ? 'Đã lưu tạm trên trình duyệt (chưa đồng bộ Drive). Xem lại trong Lịch sử.' : recordingDownloaded ? 'Đã yêu cầu tải xuống; hãy kiểm tra thư mục Tải xuống.' : 'Chưa lưu – hãy tải về máy trước khi rời phòng.'}</p>
          </div>
          <button onClick={handleDownloadRecording} className="bg-[#83A58E] text-white hover:bg-[#6F917A] font-semibold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer">
            <Download className="w-4 h-4" /> Lưu video
          </button>
        </div>
      )}

      {/* 4. Modals */}

      {/* Title Details Modal for Mobile */}
      <Modal
        isOpen={showTitleDetailModal}
        onClose={() => setShowTitleDetailModal(false)}
        title="Thông tin buổi thuyết trình"
        subtitle="Chi tiết cấu hình phòng họp mô phỏng"
        footer={
          <Button variant="primary" size="sm" onClick={() => setShowTitleDetailModal(false)}>
            Đóng
          </Button>
        }
      >
        <div className="space-y-3 text-xs text-[#3D4740]">
          <div>
            <span className="text-[#768078] block text-[11px]">Tên đề tài:</span>
            <p className="font-bold text-sm mt-0.5">{session.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E4E9E3]">
            <div>
              <span className="text-[#768078] text-[11px]">Chế độ:</span>
              <p className="font-semibold text-[#4A6453]">{session.modeTitle}</p>
            </div>
            <div>
              <span className="text-[#768078] text-[11px]">Chủ đề:</span>
              <p className="font-semibold">{session.topic}</p>
            </div>
            <div>
              <span className="text-[#768078] text-[11px]">Thời lượng mục tiêu:</span>
              <p className="font-semibold font-mono">{Math.floor(session.durationSeconds / 60)} phút</p>
            </div>
            <div>
              <span className="text-[#768078] text-[11px]">Thính giả mô phỏng:</span>
              <p className="font-semibold">{participants.length} người</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* End Meeting Confirmation Modal */}
      <EndMeetingModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        elapsedSeconds={elapsedSeconds}
        onConfirmViewReport={() => {
          if (!canLeaveMeeting()) { setShowEndModal(false); return; }
          void handleStopScreenShare();
          mediaDeviceService.stopAll();
          setIsTimerRunning(false);
          setShowEndModal(false);
          onFinishSession();
        }}
        onReturnToDashboard={() => {
          if (!canLeaveMeeting()) { setShowEndModal(false); return; }
          void handleStopScreenShare();
          mediaDeviceService.stopAll();
          setIsTimerRunning(false);
          setShowEndModal(false);
          onNavigate('dashboard');
        }}
      />

      {/* Screen Share 5-Step Guidance Modal (Phase 2.3) */}
      <ScreenShareGuideModal
        isOpen={showShareGuideModal}
        onClose={() => setShowShareGuideModal(false)}
        onConfirmStartShare={handleStartScreenShare}
      />

      {/* Screen Share Error / Browser Support Notice Modal */}
      <Modal
        isOpen={Boolean(shareError)}
        onClose={() => setShareError(null)}
        title="Thông báo chia sẻ màn hình"
        subtitle="Không thể bắt đầu truyền luồng màn hình"
        footer={
          <Button variant="primary" size="sm" onClick={() => setShareError(null)}>
            Đã hiểu / Tiếp tục dùng slide nội bộ
          </Button>
        }
      >
        <div className="space-y-3 text-xs text-[#3D4740]">
          <div className="p-3 bg-[#FAFBF9] rounded-xl border border-[#E4E9E3] text-[11px] leading-relaxed space-y-2">
            <p className="font-semibold text-[#873631]">Gặp vấn đề khi cấp quyền chia sẻ:</p>
            <p className="text-[#556057]">{shareError}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#EEF4F0] border border-[#D9E5DC] text-[11px] text-[#2A4433]">
            💡 Bạn vẫn có thể tiếp tục diễn tập thuyết trình và phản biện bằng <strong>Chế độ trình chiếu PPTX nội bộ</strong> hoặc <strong>Slide mẫu</strong> đã chuẩn bị sẵn.
          </div>
        </div>
      </Modal>

      {/* Camera & Privacy Notice Modal (Section IX) */}
      <Modal
        isOpen={showCameraNoticeModal}
        onClose={() => setShowCameraNoticeModal(false)}
        title="Quyền riêng tư Camera & Micro"
        subtitle="Thông báo quan trọng về xử lý thiết bị của SpeakLab AI"
        footer={
          <Button variant="primary" size="sm" onClick={() => setShowCameraNoticeModal(false)}>
            Tôi đã hiểu
          </Button>
        }
      >
        <div className="space-y-3 text-xs text-[#3D4740]">
          <div className="p-3 bg-[#EEF4F0] rounded-xl border border-[#D9E5DC] text-[11px] leading-relaxed text-[#2A4433] space-y-2">
            <p className="font-bold text-xs text-[#2A4433]">
              🛡️ Cam kết bảo mật và quyền riêng tư:
            </p>
            <p>
              Camera và micro mặc định chỉ để xem trước. Ghi màn hình PowerPoint kèm tiếng micro chỉ bắt đầu khi bạn chủ động xác nhận. Không ghi camera trong Đợt 3.2A.
            </p>
          </div>

          <div className="space-y-2 text-[11px] text-[#556057] leading-relaxed">
            <p>
              • <strong>Lưu cục bộ:</strong> Video được giữ trong bộ nhớ phiên cho đến khi bạn chủ động tải về thiết bị; không lưu trên máy chủ.
            </p>
            <p>
              • <strong>Không gửi dữ liệu:</strong> Webcam và micro được xử lý cục bộ trong trình duyệt; bản ghi không được tải lên dịch vụ ngoài.
            </p>
            <p>
              • <strong>Quyền kiểm soát:</strong> Bạn có thể bật hoặc tắt camera và micro bất kỳ lúc nào bằng nút điều khiển ở thanh công cụ bên dưới.
            </p>
          </div>
        </div>
      </Modal>

      {/* Meeting Settings & Hardware Device Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Cài đặt thiết bị & Phòng họp"
        subtitle="Quản lý Camera, Micro thật và mức độ phản biện"
        footer={
          <Button variant="primary" size="sm" onClick={() => setShowSettingsModal(false)}>
            Lưu và đóng
          </Button>
        }
      >
        <div className="space-y-4 text-xs text-[#3D4740]">
          {/* Hardware Device Selection */}
          <div className="p-3 bg-[#FAFBF9] rounded-xl border border-[#E4E9E3] space-y-3">
            <p className="font-bold text-[#2A4433] text-xs">Thiết bị thu thật (Media Devices)</p>

            {/* Camera Select */}
            <div>
              <label className="block font-semibold mb-1 text-[11px]">Camera đầu vào:</label>
              {availableCameras.length > 0 ? (
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    if (!isCameraOff) {
                      mediaDeviceService.startCamera({ deviceId: e.target.value });
                    }
                  }}
                  className="w-full p-2 rounded-lg border border-[#D9E5DC] bg-white text-xs text-[#3D4740]"
                >
                  <option value="">Camera mặc định hệ thống</option>
                  {availableCameras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-[#768078] italic">
                  Chưa phát hiện camera hoặc trình duyệt đang chặn quyền.
                </p>
              )}
            </div>

            {/* Microphone Select */}
            <div>
              <label className="block font-semibold mb-1 text-[11px]">Micro đầu vào:</label>
              {availableMicrophones.length > 0 ? (
                <select
                  value={selectedMicrophoneId}
                  onChange={async (e) => {
                    const deviceId = e.target.value;
                    setSelectedMicrophoneId(deviceId);
                    if (!isMuted) {
                      if (recordingSessionRef.current) {
                        await handleStopRecording('Đã đổi micro trong lúc ghi; video trước đó được hoàn tất.');
                      }
                      try {
                        await mediaDeviceService.startMicrophone(deviceId);
                      } catch (error) {
                        setMicError(error instanceof Error ? error.message : 'Không đổi được micro.');
                      }
                    }
                  }}
                  className="w-full p-2 rounded-lg border border-[#D9E5DC] bg-white text-xs text-[#3D4740]"
                >
                  <option value="">Microphone mặc định hệ thống</option>
                  {availableMicrophones.map((mic, idx) => (
                    <option key={mic.deviceId || idx} value={mic.deviceId}>
                      {mic.label || `Microphone ${idx + 1}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-[#768078] italic">
                  Chưa phát hiện micro hoặc trình duyệt đang chặn quyền.
                </p>
              )}
            </div>

            {/* Audio level test meter */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
                <span>Kiểm tra độ nhạy âm thanh:</span>
                <span className="font-mono text-[#4A6453]">
                  {!isMuted ? `${audioLevel}%` : 'Micro đang tắt'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E4E9E3] overflow-hidden">
                <div
                  style={{ width: `${isMuted ? 0 : audioLevel}%` }}
                  className="h-full bg-[#83A58E] transition-all duration-75 rounded-full"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Mức độ tương tác của hội đồng AI</label>
            <select className="w-full p-2 rounded-lg border border-[#E4E9E3] bg-white text-xs text-[#3D4740]">
              <option>Tiêu chuẩn (Gật đầu và đặt 1-2 câu hỏi khi kết thúc)</option>
              <option>Nâng cao (Phản biện ngắt quãng, thử thách phản xạ)</option>
              <option>Thân thiện (Tập trung lắng nghe, khuyến khích)</option>
            </select>
          </div>

          <div className="p-2.5 rounded-lg bg-[#FAFBF9] border border-[#E4E9E3] text-[11px] text-[#768078]">
            Lưu ý: Chỉ khi xác nhận ghi, ứng dụng mới thu màn hình chia sẻ và tiếng micro. Đợt 3.2A chưa ghi webcam.
          </div>
        </div>
      </Modal>
    </div>
  );
};
