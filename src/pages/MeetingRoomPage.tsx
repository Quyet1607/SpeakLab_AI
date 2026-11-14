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
  ScrollText,
  Download
} from 'lucide-react';
import {
  UserProfile,
  PracticeSession,
  PresentationDeck,
  VirtualParticipant,
  ActivePage,
  PresentationSource,
  type SpeechTranscriptSegment
} from '../types';
import { SlideViewer } from '../features/meeting/SlideViewer';
import { ParticipantGrid } from '../features/meeting/ParticipantGrid';
import { MeetingGallery } from '../features/meeting/MeetingGallery';
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
import { ScreenAudioRecordingSession, PresentationRecordingResult, type RecordingVideoSource } from '../services/presentationRecordingService';
import { saveLocalVideo } from '../services/localVideoLibrary';
import { recordingLibraryTitle, recordingDownloadName } from '../services/recordingNames';
import { MeetingGridCapture } from '../services/meetingGridCapture';
import { VietnameseBrowserSpeechSession, isVietnameseSpeechRecognitionSupported, normalizeTranscriptSegments, SPEECH_SEGMENT_LIMIT } from '../services/vietnameseSpeechRecognition';
import { SpeechTranscriptPanel } from '../features/meeting/SpeechTranscriptPanel';
import { saveLocalTranscript, deleteLocalTranscript } from '../services/localTranscriptLibrary';

interface MeetingRoomPageProps {
  currentUser: UserProfile;
  session: PracticeSession;
  sessionOwnerSub: string;
  deck: PresentationDeck;
  participants: VirtualParticipant[];
  onNavigate: (page: ActivePage) => void;
  onFinishSession: (actualSeconds: number, destination: 'report' | 'dashboard', transcript: SpeechTranscriptSegment[]) => void;
}

export const MeetingRoomPage: React.FC<MeetingRoomPageProps> = ({
  currentUser,
  session,
  sessionOwnerSub,
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // Actual elapsed time; no simulated starting offset.
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
  const previousSourceRef = useRef<PresentationSource | undefined>(undefined);
  const shareRequestPendingRef = useRef(false);
  const mountedRef = useRef(true);
  const [shareRequestPending, setShareRequestPending] = useState(false);
  const [showShareGuideModal, setShowShareGuideModal] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Ghi hình tự chọn nguồn: màn hình đang chia sẻ hoặc camera đang bật, kèm micro.
  // Giữ nguồn ghi cố định trong một bản ghi để tránh tự ý thay đổi nội dung đang quay.
  const recordingSessionRef = useRef<ScreenAudioRecordingSession | null>(null);
  const recordingSourceRef = useRef<RecordingVideoSource | null>(null);
  const meetingCaptureRef = useRef<MeetingGridCapture | null>(null);
  const [recordingVideoSource, setRecordingVideoSource] = useState<RecordingVideoSource>('camera');
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'finalizing' | 'ready' | 'error'>('idle');
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingResult, setRecordingResult] = useState<PresentationRecordingResult | null>(null);
  const [recordingDownloaded, setRecordingDownloaded] = useState(false);
  const [recordingSavedLocal, setRecordingSavedLocal] = useState(false);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [showRecordingConfirm, setShowRecordingConfirm] = useState(false);

  // Phase 7.2 — optional browser-native speech recognition, independent of video.
  // The mic and any browser recognition service are never enabled automatically.
  const speechRecognitionRef = useRef<VietnameseBrowserSpeechSession | null>(null);
  const speechSegmentsRef = useRef<SpeechTranscriptSegment[]>([]);
  const speechSegmentIdsRef = useRef<number[]>([]);
  const elapsedSecondsRef = useRef(0);
  const [speechSegments, setSpeechSegments] = useState<SpeechTranscriptSegment[]>([]);
  const [speechInterim, setSpeechInterim] = useState('');
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'starting' | 'listening' | 'stopped' | 'error'>('idle');
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const speechStopPromiseRef = useRef<Promise<void> | null>(null);
  const [showSpeechPanel, setShowSpeechPanel] = useState(false);

  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);

  const startSpeechRecognition = () => {
    if (speechRecognitionRef.current || speechStatus === 'starting' || speechStatus === 'listening') return;
    const activeMic = mediaDeviceService.getMicrophoneStream();
    if (!activeMic?.getAudioTracks().some(t => t.readyState === 'live' && t.enabled)) {
      setSpeechNotice('Hãy bật micro thật trên thanh điều khiển trước khi bắt đầu nhận diện.');
      return;
    }
    if (speechSegmentsRef.current.length >= SPEECH_SEGMENT_LIMIT) {
      setSpeechNotice('Đã đạt giới hạn bản ghi chữ của buổi luyện. Video vẫn có thể ghi tiếp.');
      return;
    }
    setSpeechNotice(null);
    setSpeechStatus('starting');
    try {
      const controller = new VietnameseBrowserSpeechSession({
        getElapsedSeconds: () => elapsedSecondsRef.current,
        onInterim: text => { if (mountedRef.current) setSpeechInterim(text); },
        onState: (state, message) => {
          if (!mountedRef.current) return;
          setSpeechStatus(state);
          if (message) setSpeechNotice(message);
          if (state === 'error') {
            const failed = speechRecognitionRef.current;
            speechRecognitionRef.current = null;
            failed?.dispose(); // Errors must not leave a browser-owned mic listening.
          } else if (state === 'stopped') {
            speechRecognitionRef.current = null;
          }
        },
        onSegment: (segment, segmentId) => {
          if (!mountedRef.current) return;
          const updated = normalizeTranscriptSegments([...speechSegmentsRef.current, segment]);
          speechSegmentsRef.current = updated;
          speechSegmentIdsRef.current = [...speechSegmentIdsRef.current, segmentId].slice(0, updated.length);
          setSpeechSegments(updated);
          if (updated.length >= SPEECH_SEGMENT_LIMIT) {
            setSpeechNotice('Đã nhận diện tối đa số đoạn cho buổi luyện. Bạn vẫn có thể tiếp tục ghi video.');
            void stopSpeechRecognition();
          }
        },
        onSegmentUpdate: (segmentId, segment) => {
          if (!mountedRef.current) return;
          const index = speechSegmentIdsRef.current.indexOf(segmentId);
          if (index < 0) return;
          const updated = [...speechSegmentsRef.current];
          updated[index] = segment;
          speechSegmentsRef.current = updated;
          setSpeechSegments(updated);
        },
      });
      speechRecognitionRef.current = controller;
      controller.start(); // Synchronous with the user's explicit opt-in click.
    } catch (error) {
      speechRecognitionRef.current?.dispose();
      speechRecognitionRef.current = null;
      setSpeechStatus('error');
      setSpeechNotice(error instanceof Error ? error.message : 'Không bắt đầu nhận diện được.');
    }
  };

  const stopSpeechRecognition = async () => {
    // Coalesce concurrent Stop/End requests and preserve final browser results.
    if (speechStopPromiseRef.current) return speechStopPromiseRef.current;
    const task = (async () => {
      const current = speechRecognitionRef.current;
      if (current) await current.stop();
      if (speechRecognitionRef.current === current) speechRecognitionRef.current = null;
      setSpeechInterim('');
      setSpeechStatus(prev => prev === 'error' ? prev : 'stopped');
      if (speechSegmentsRef.current.length > 0) {
        try {
          saveLocalTranscript(session.id, session.title, session.topic, sessionOwnerSub, speechSegmentsRef.current);
          setSpeechNotice('Đã lưu bản ghi chữ riêng trên thiết bị. Mở Lịch sử luyện tập để xem hoặc tải TXT.');
        } catch (error) {
          setSpeechNotice(error instanceof Error ? error.message : 'Không lưu được bản ghi chữ.');
        }
      }
    })();
    speechStopPromiseRef.current = task;
    try { await task; } finally { speechStopPromiseRef.current = null; }
  };

  const clearSpeechRecognition = async () => {
    if (!window.confirm('Xóa toàn bộ bản ghi chữ của buổi luyện này? Video đã ghi sẽ không bị xóa.')) return;
    await stopSpeechRecognition();
    try {
      deleteLocalTranscript(session.id, sessionOwnerSub);
      speechSegmentsRef.current = [];
      speechSegmentIdsRef.current = [];
      setSpeechSegments([]);
      setSpeechNotice('Đã xóa bản ghi chữ riêng của buổi luyện. Video không bị ảnh hưởng.');
    } catch (error) {
      setSpeechNotice(error instanceof Error ? error.message : 'Không xóa được bản ghi chữ.');
    }
  };

  // Modals & Notices
  const [showEndModal, setShowEndModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCameraNoticeModal, setShowCameraNoticeModal] = useState(false);
  const [showTitleDetailModal, setShowTitleDetailModal] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<{
    judge: string;
    text: string;
  } | null>(null);
  const activeQuestionRef = useRef<typeof activeQuestion>(null);
  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  const finishMeetingWithTranscript = async (destination: 'report' | 'dashboard') => {
    if (!canLeaveMeeting(true)) { setShowEndModal(false); return; }
    // The browser may send a final recognition event in response to stop().
    // Wait briefly before taking the canonical segmentsRef snapshot.
    await stopSpeechRecognition();
    if (!mountedRef.current) return;
    void handleStopScreenShare();
    mediaDeviceService.stopAll();
    setIsTimerRunning(false);
    setShowEndModal(false);
    onFinishSession(elapsedSecondsRef.current, destination, [...speechSegmentsRef.current]);
  };

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

  const canLeaveMeeting = (savingTranscript = false): boolean => {
    if (!savingTranscript && (speechRecognitionRef.current || speechSegmentsRef.current.length > 0)) {
      setShowSpeechPanel(true);
      setSpeechNotice('Có bản ghi chữ chưa được lưu. Hãy kết thúc buổi luyện để lưu vào Lịch sử hoặc xóa bản ghi chữ trước khi thoát.');
      return false;
    }
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
    // Always use a single canvas video track. The canvas can show either
    // meeting tiles or the shared screen without restarting the recording.
    const source: RecordingVideoSource = screen?.getVideoTracks().some(t => t.readyState === 'live' && t.enabled)
      ? 'screen' : 'meeting';
    if (!microphone?.getAudioTracks().some(t => t.readyState === 'live' && t.enabled)) {
      setRecordingNotice('Hãy bật micro thật trước khi bắt đầu ghi cuộc họp.');
      return;
    }
    let gridCapture: MeetingGridCapture | null = null;
    try {
      gridCapture = new MeetingGridCapture(
        currentUser,
        participants,
        () => mediaDeviceService.getCameraStream(),
        () => activeQuestionRef.current,
        () => screenShareService.getActiveStream(),
      );
      const videoStream = gridCapture.getStream();
      if (!videoStream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled)) {
        throw new Error('Không lấy được hình ảnh để ghi video.');
      }
      const sessionRecorder = new ScreenAudioRecordingSession(videoStream, microphone, (input) => {
        void handleStopRecording(input === 'microphone'
          ? 'Micro đã ngắt; bản ghi được hoàn tất để tránh mất tiếng.'
          : 'Nguồn hình ảnh cuộc họp đã ngắt; bản ghi được hoàn tất.');
      }, 'meeting');
      sessionRecorder.start();
      meetingCaptureRef.current = gridCapture;
      gridCapture.start();
      recordingSourceRef.current = source;
      setRecordingVideoSource(source);
      recordingSessionRef.current = sessionRecorder;
      setRecordingResult(null);
      setRecordingDownloaded(false);
      setRecordingSavedLocal(false);
      setRecordingDuration(0);
      setRecordingStartedAt(Date.now());
      setRecordingStatus('recording');
    } catch (error) {
      gridCapture?.dispose();
      meetingCaptureRef.current = null;
      setRecordingStatus('error');
      setRecordingNotice(error instanceof Error ? error.message : 'Không thể khởi động ghi hình.');
    }
  };

  const handleStopRecording = async (reason?: string) => {
    const active = recordingSessionRef.current;
    if (!active) return;
    const finishedSource = recordingSourceRef.current ?? recordingVideoSource;
    recordingSessionRef.current = null;
    recordingSourceRef.current = null;
    setRecordingStatus('finalizing');
    try {
      const result = await active.stop();
      setRecordingResult(result);
      setRecordingDownloaded(false);
      setRecordingSavedLocal(false);
      setRecordingDuration(Math.round(result.durationMs / 1000));
      try {
        // Keep the same IndexedDB schema; only use clearer titles for NEW recordings.
        await saveLocalVideo({ ...session, title: recordingLibraryTitle(session.title, finishedSource) }, result);
        setRecordingSavedLocal(true);
        if (reason) setRecordingNotice(reason + ' Đã lưu video trên trình duyệt này.');
      } catch (saveError) {
        setRecordingNotice((reason ? reason + ' ' : '') + (saveError instanceof Error ? saveError.message : 'Không lưu được video.') + ' Hãy nhấn “Lưu video” để tải về thiết bị ngay.');
      }
      setRecordingStatus('ready');
    } catch (error) {
      setRecordingStatus('error');
      setRecordingNotice(error instanceof Error ? error.message : 'Không thể hoàn tất bản ghi.');
    } finally {
      meetingCaptureRef.current?.dispose();
      meetingCaptureRef.current = null;
      setRecordingStartedAt(null);
    }
  };

  const handleDownloadRecording = () => {
    if (!recordingResult) return;
    const url = URL.createObjectURL(recordingResult.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = recordingDownloadName(session.title, recordingVideoSource, recordingResult.fileExtension);
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
      if (recordingSessionRef.current && recordingSourceRef.current === 'camera') {
        await handleStopRecording('Camera đã tắt; bản ghi được hoàn tất.');
      }
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
      if (recordingSessionRef.current && recordingSourceRef.current === 'camera') {
        await handleStopRecording('Đã đổi camera; bản ghi trước đó được hoàn tất.');
      }
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
      await stopSpeechRecognition();
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
      // If the learner disables/unplugs the mic, recognition must not keep
      // listening through a separate browser-owned microphone session.
      if (!micStatus.isEnabled && speechRecognitionRef.current) {
        void speechRecognitionRef.current.stop();
      }

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

  // Screen sharing can be started, stopped or replaced at any time, including
  // during a recording. The recorder has a stable canvas video track and will
  // switch between gallery and shared screen without being stopped.
  const handleStopScreenShare = async (expectedStream?: MediaStream) => {
    const active = screenShareService.getActiveStream();
    if (expectedStream && active !== expectedStream) return; // Ignore stale ended events.
    if (active) {
      // Detach our handler before stopping tracks to avoid recursive cleanups.
      active.getVideoTracks().forEach(track => { track.onended = null; });
      // Active stream is cleared synchronously by stopShare; avoid a late
      // completion resetting the UI if a new share starts immediately.
      void screenShareService.stopShare(active);
    }
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);

    if (recordingSessionRef.current && recordingSourceRef.current === 'screen') {
      recordingSourceRef.current = 'meeting'; // This clip now includes both views.
      setRecordingVideoSource('meeting');
    }

    setActiveSource(previousSourceRef.current || session.presentationSource || {
      type: 'none', name: 'Không trình chiếu', slideCount: 0, status: 'ready',
    });
    previousSourceRef.current = undefined;
    mediaDeviceService.resumeAudio();
  };

  // User-initiated getDisplayMedia must run directly after the click in the guide.
  // A second selection replaces the first only AFTER the new source was granted.
  const handleStartScreenShare = async () => {
    setShowShareGuideModal(false);
    if (shareRequestPendingRef.current) return;
    const capability = screenShareService.getCapability();
    if (!capability.isSupported) {
      setShareError(capability.friendlyNotice);
      return;
    }
    shareRequestPendingRef.current = true;
    setShareRequestPending(true);
    const oldStream = screenShareService.getActiveStream();
    const sourceToRestore = oldStream
      ? previousSourceRef.current
      : activeSource;

    try {
      const stream = await screenShareService.startShare();
      if (!mountedRef.current) {
        // A browser picker may finish even after the learner left the room.
        // Release the new capture stream instead of leaving it active.
        void screenShareService.stopShare(stream);
        return;
      }
      if (oldStream && oldStream !== stream) {
        oldStream.getVideoTracks().forEach(track => { track.onended = null; });
        // Do not call stopShare(oldStream): that would clear the NEW active stream.
        oldStream.getTracks().forEach(track => { try { track.stop(); } catch { /* ended already */ } });
      }

      previousSourceRef.current = sourceToRestore;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => { void handleStopScreenShare(stream); };
      }
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      setActiveSource({
        type: 'screenShare',
        name: 'Cửa sổ đang chia sẻ',
        slideCount: sourceToRestore?.slideCount || 1,
        status: 'ready',
        stream,
      });
      // Recording stays active. When sharing begins partway through, label
      // the finished clip as a meeting containing more than one view.
      if (recordingSessionRef.current && recordingSourceRef.current === 'meeting') {
        setRecordingVideoSource('meeting');
      }

      mediaDeviceService.resumeAudio();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'NotAllowedError') {
        // Cancelling the chooser does not interrupt an existing share or recording.
        console.info('Người dùng đã đóng hộp thoại chia sẻ màn hình.');
      } else {
        const msg = err instanceof Error ? err.message : capability.friendlyNotice;
        setShareError(msg);
      }
    } finally {
      shareRequestPendingRef.current = false;
      setShareRequestPending(false);
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      speechRecognitionRef.current?.dispose();
      speechRecognitionRef.current = null;
      recordingSessionRef.current?.dispose();
      recordingSessionRef.current = null;
      recordingSourceRef.current = null;
      meetingCaptureRef.current?.dispose();
      meetingCaptureRef.current = null;
      if (screenStreamRef.current) {
        const oldScreen = screenStreamRef.current;
        oldScreen.getVideoTracks().forEach(track => { track.onended = null; });
        void screenShareService.stopShare(oldScreen);
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

  const showPresentation = Boolean(activeSource && activeSource.type !== 'none');
  const totalSlides = !showPresentation ? 0
    : activeSource?.type === 'pptx' ? (activeSource.slideCount || 1) : deck.slides.length;

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
    // A written practice prompt only; no participant is connected or speaking.
    const prompts = {
      basic: 'Bạn hãy nêu ngắn gọn ý chính của bài thuyết trình và ví dụ để làm rõ.',
      defense: 'Bạn có thể giải thích bằng chứng cho đề tài này, giới hạn của giải pháp và cách kiểm chứng?',
      debate: 'Bạn sẽ phản hồi thế nào nếu có ý kiến phản đối luận điểm chính của mình?',
    };
    setActiveQuestion({ judge: judgeName, text: prompts[session.mode] });
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
          {showPresentation && <div className="lg:hidden flex items-center bg-[#253027] p-0.5 rounded-lg border border-[#37473A]">
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
          </div>}

          <button
            type="button"
            onClick={() => setShowSpeechPanel(prev => !prev)}
            aria-label="Mở bản ghi lời nói tiếng Việt"
            aria-expanded={showSpeechPanel}
            className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#2B3A2E] text-[#D4E9D8] border border-[#436047] hover:bg-[#38503C] flex items-center gap-1.5 cursor-pointer"
          >
            <ScrollText className="w-4 h-4" />
            <span className="hidden sm:inline">Lời nói</span>
            {speechStatus === 'listening' && <span className="w-2 h-2 bg-[#A8DDB3] rounded-full animate-pulse" aria-hidden="true" />}
          </button>
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
          {!showPresentation ? (
            <MeetingGallery
              currentUser={currentUser}
              participants={participants}
              cameraStream={cameraStream}
              isCameraOff={isCameraOff}
              isMuted={isMuted}
              onSimulatedQuestion={handleTriggerSimulatedQuestion}
            />
          ) : (
          <>
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
                onStopScreenShare={() => { void handleStopScreenShare(); }}
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
          </>
          )}
        </div>

        {showSpeechPanel && (
          <SpeechTranscriptPanel
            segments={speechSegments}
            interimText={speechInterim}
            status={speechStatus}
            notice={speechNotice}
            supported={isVietnameseSpeechRecognitionSupported()}
            micEnabled={!isMuted}
            onStart={startSpeechRecognition}
            onStop={() => { void stopSpeechRecognition(); }}
            onClear={() => { void clearSpeechRecognition(); }}
            onClose={() => {
              void stopSpeechRecognition();
              setShowSpeechPanel(false);
            }}
          />
        )}

        {/* Right Drawers */}
        <AttendeeDrawer
          isOpen={isAttendeesOpen}
          onClose={() => setIsAttendeesOpen(false)}
          participants={participants}
          onTriggerSimulatedQuestion={handleTriggerSimulatedQuestion}
        />

        <PresenterNotesDrawer
          isOpen={isNotesOpen && showPresentation}
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
        hasPresentation={showPresentation}
        onStopScreenShare={() => { void handleStopScreenShare(); }}
        onChangeScreenShare={() => setShowShareGuideModal(true)}
        isScreenSharePending={shareRequestPending}
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
        recordingDuration={recordingDuration}
        onRecordClick={() => recordingStatus === 'recording' ? void handleStopRecording() : setShowRecordingConfirm(true)}
      />

      {recordingStatus === 'recording' &&
        (micState === 'interrupted' || (recordingSourceRef.current === 'camera' && cameraState === 'interrupted')) && (
        <div role="alert" className="fixed top-20 left-1/2 -translate-x-1/2 w-[min(94vw,520px)] z-40 p-3 rounded-xl border border-[#E9C999] bg-[#FFF7E7] text-[#665125] shadow-lg text-xs">
          <strong>Đường ghi đang bị gián đoạn.</strong> Camera hoặc micro tạm mất tín hiệu. Hãy kiểm tra thiết bị; nếu nguồn bị ngắt hẳn, bản ghi sẽ tự kết thúc để tránh thiếu hình hoặc tiếng.
        </div>
      )}

      {/* Xác nhận nguồn hình ảnh: camera hoặc PowerPoint chia sẻ + micro */}
      <Modal
        isOpen={showRecordingConfirm}
        onClose={() => setShowRecordingConfirm(false)}
        title="Xác nhận bắt đầu ghi hình"
        subtitle="Ghi cuộc họp mô phỏng hoặc màn hình chia sẻ kèm micro"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowRecordingConfirm(false)}>Hủy</Button>
            <Button variant="primary" size="sm" onClick={handleStartRecording}>Bắt đầu ghi</Button>
          </>
        }
      >
        <div className="space-y-2 text-xs text-[#3D4740]">
          <p>Chưa chia sẻ màn hình: ghi <strong>lưới cuộc họp</strong> gồm camera thật của bạn (nếu bật), các tài khoản mô phỏng và tiếng micro. Đã chia sẻ màn hình: ghi PowerPoint và tiếng micro, không ghép thêm camera.</p>
          <p className="text-[#647568]">Video chỉ được ghi sau khi bạn xác nhận, được lưu trên trình duyệt thiết bị này và có thể xem lại hoặc tải xuống trong Lịch sử.</p>
          <p className="font-medium text-[#873631]">Hãy bật micro trước khi ghi; camera là tùy chọn. Các nhân vật mô phỏng không có tiếng nói thật.</p>
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
            <p className="text-xs font-bold">Video {recordingVideoSource === 'meeting' ? 'cuộc họp mô phỏng' : recordingVideoSource === 'screen' ? 'PowerPoint' : 'camera'} + micro đã hoàn tất</p>
            <p className="text-[11px] text-[#768078]">{formatTimer(Math.round(recordingResult.durationMs / 1000))} · {(recordingResult.bytes / 1024 / 1024).toFixed(1)} MB · {recordingResult.fileExtension.toUpperCase()}</p>
            <p className="text-[10px] text-[#768078]">{recordingSavedLocal ? 'Đã lưu trên trình duyệt này. Xem lại trong Lịch sử luyện tập.' : recordingDownloaded ? 'Đã yêu cầu tải xuống; hãy kiểm tra thư mục Tải xuống.' : 'Chưa lưu – hãy tải về máy trước khi rời phòng.'}</p>
          </div>
          <button onClick={handleDownloadRecording} className="bg-[#83A58E] text-white hover:bg-[#6F917A] font-semibold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer">
            <Download className="w-4 h-4" /> Tải về
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
            <span className="text-[#768078] block text-[11px]">Tên buổi luyện:</span>
            <p className="font-bold text-sm mt-0.5">{session.title}</p>
          </div>
          <div>
            <span className="text-[#768078] block text-[11px]">Đề tài học sinh đã nhập:</span>
            <p className="font-semibold text-sm mt-0.5">{session.topic}</p>
          </div>
          {session.topicDescription && (
            <div>
              <span className="text-[#768078] block text-[11px]">Mô tả đề tài:</span>
              <p className="whitespace-pre-wrap break-words mt-0.5">{session.topicDescription}</p>
            </div>
          )}
          {session.speakingGoal && (
            <div>
              <span className="text-[#768078] block text-[11px]">Mục tiêu bài nói:</span>
              <p className="whitespace-pre-wrap break-words mt-0.5">{session.speakingGoal}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E4E9E3]">
            <div>
              <span className="text-[#768078] text-[11px]">Chế độ:</span>
              <p className="font-semibold text-[#4A6453]">{session.modeTitle}</p>
            </div>
            <div>
              <span className="text-[#768078] text-[11px]">Số trang trình chiếu:</span>
              <p className="font-semibold">{session.slideCount || 'Không có'}</p>
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
        onConfirmViewReport={() => { void finishMeetingWithTranscript('report'); }}
        onReturnToDashboard={() => { void finishMeetingWithTranscript('dashboard'); }}
      />

      {/* Screen Share 5-Step Guidance Modal (Phase 2.3) */}
      <ScreenShareGuideModal
        isReplacingShare={isScreenSharing}
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
              Camera và micro mặc định tắt. Khi xác nhận ghi hình, ứng dụng ghi bố cục cuộc họp mô phỏng và tiếng micro; nếu đang chia sẻ màn hình, ứng dụng ghi PowerPoint + micro. Không có người khác đang kết nối thật.
            </p>
          </div>

          <div className="space-y-2 text-[11px] text-[#556057] leading-relaxed">
            <p>
              • <strong>Lưu cục bộ:</strong> Sau khi dừng ghi, video được lưu trong thư viện IndexedDB của trình duyệt và có thể tải về; không lưu trên máy chủ.
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
                  onChange={async (e) => {
                    const deviceId = e.target.value;
                    setSelectedCameraId(deviceId);
                    if (!isCameraOff) {
                      if (recordingSessionRef.current && recordingSourceRef.current === 'camera') {
                        await handleStopRecording('Đã đổi camera; bản ghi trước đó được hoàn tất.');
                      }
                      try {
                        await mediaDeviceService.startCamera({ deviceId });
                      } catch (error) {
                        setCameraError(error instanceof Error ? error.message : 'Không đổi được camera.');
                      }
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
            Lưu ý: Chỉ khi bạn xác nhận, ứng dụng mới ghi camera hoặc màn hình chia sẻ kèm tiếng micro. Không tự tải video lên máy chủ.
          </div>
        </div>
      </Modal>
    </div>
  );
};
