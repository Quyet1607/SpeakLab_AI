/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DevicePermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'interrupted'
  | 'disconnected'
  | 'denied'
  | 'unavailable'
  | 'busy'
  | 'unsupported'
  | 'error';

export interface DeviceStatus {
  isEnabled: boolean;
  permissionState: DevicePermissionState;
  errorMessage?: string;
  deviceId?: string;
  label?: string;
}

export interface AvailableDevices {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
}

type DeviceChangeCallback = () => void;
type AudioLevelCallback = (level: number) => void;

class MediaDeviceService {
  private cameraStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;

  private cameraFacingMode: 'user' | 'environment' = 'user';
  private selectedCameraId: string | undefined = undefined;
  private selectedMicrophoneId: string | undefined = undefined;

  private cameraStatus: DeviceStatus = {
    isEnabled: false,
    permissionState: 'idle',
  };

  private microphoneStatus: DeviceStatus = {
    isEnabled: false,
    permissionState: 'idle',
  };

  private isRequestingCamera = false;
  private isRequestingMicrophone = false;

  // Web Audio API for Real Input Metering
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private audioSourceNode: MediaStreamAudioSourceNode | null = null;
  private audioLevelAnimFrame: number | null = null;
  private audioLevelCallbacks: Set<AudioLevelCallback> = new Set();
  private statusListeners: Set<DeviceChangeCallback> = new Set();

  /**
   * Check if getUserMedia is supported in the current environment
   */
  public isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  public getCameraStatus(): DeviceStatus {
    return { ...this.cameraStatus };
  }

  public getMicrophoneStatus(): DeviceStatus {
    return { ...this.microphoneStatus };
  }

  public getCameraStream(): MediaStream | null {
    return this.cameraStream;
  }

  public getMicrophoneStream(): MediaStream | null {
    return this.microphoneStream;
  }

  public getCameraFacingMode(): 'user' | 'environment' {
    return this.cameraFacingMode;
  }

  public getCurrentFacingMode(): 'user' | 'environment' {
    return this.cameraFacingMode;
  }

  public async hasMultipleVideoInputs(): Promise<boolean> {
    const devices = await this.getAvailableDevices();
    return devices.cameras.length > 1;
  }

  public subscribe(listener: DeviceChangeCallback): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatusChange(): void {
    this.statusListeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Error in device status listener:', e);
      }
    });
  }

  /**
   * Enumerate available video & audio input devices
   */
  public async getAvailableDevices(): Promise<AvailableDevices> {
    if (!this.isSupported() || !navigator.mediaDevices.enumerateDevices) {
      return { cameras: [], microphones: [], videoInputs: [], audioInputs: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      const microphones = devices.filter((d) => d.kind === 'audioinput');
      return {
        cameras,
        microphones,
        videoInputs: cameras,
        audioInputs: microphones,
      };
    } catch (err) {
      console.warn('Lỗi khi liệt kê danh sách thiết bị:', err);
      return { cameras: [], microphones: [], videoInputs: [], audioInputs: [] };
    }
  }

  /**
   * Parse getUserMedia errors into clear Vietnamese explanations
   */
  private parseMediaError(err: unknown, deviceType: 'camera' | 'microphone'): { state: DevicePermissionState; msg: string } {
    if (!err || typeof err !== 'object') {
      return { state: 'error', msg: 'Lỗi không xác định khi truy cập thiết bị.' };
    }

    const name = 'name' in err ? String(err.name) : '';
    const devLabel = deviceType === 'camera' ? 'camera' : 'micro';

    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
          state: 'denied',
          msg: `Bạn đã từ chối cấp quyền sử dụng ${devLabel}. Hãy bấm vào biểu tượng ổ khóa/quyền trang trên thanh địa chỉ trình duyệt để cho phép.`,
        };
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          state: 'unavailable',
          msg: `Không tìm thấy ${devLabel} nào kết nối với thiết bị của bạn.`,
        };
      case 'NotReadableError':
      case 'TrackStartError':
        return {
          state: 'busy',
          msg: `${devLabel === 'camera' ? 'Camera' : 'Micro'} đang bị ứng dụng khác trên máy tính/điện thoại sử dụng. Hãy đóng các ứng dụng họp/quay video khác và thử lại.`,
        };
      case 'OverconstrainedError':
        return {
          state: 'error',
          msg: `Thiết bị không hỗ trợ cấu hình ${devLabel} được chỉ định.`,
        };
      case 'SecurityError':
        return {
          state: 'unsupported',
          msg: `Trình duyệt yêu cầu kết nối bảo mật HTTPS hoặc cấp quyền trong khung nhúng (iframe) để bật ${devLabel}.`,
        };
      default:
        return {
          state: 'error',
          msg: `Không thể kết nối ${devLabel}: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
  }

  // ================= CAMERA MANAGEMENT ================= //

  /**
   * Start real camera stream
   */
  public async startCamera(options?: { facingMode?: 'user' | 'environment'; deviceId?: string }): Promise<MediaStream> {
    if (this.isRequestingCamera) {
      throw new Error('Đang trong quá trình khởi động camera, vui lòng đợi...');
    }

    if (!this.isSupported()) {
      this.cameraStatus = {
        isEnabled: false,
        permissionState: 'unsupported',
        errorMessage: 'Trình duyệt hiện tại không hỗ trợ Web MediaDevices API.',
      };
      this.notifyStatusChange();
      throw new Error(this.cameraStatus.errorMessage);
    }

    this.isRequestingCamera = true;
    this.cameraStatus = {
      isEnabled: false,
      permissionState: 'requesting',
    };
    this.notifyStatusChange();

    try {
      // Clean up existing camera tracks first
      this.stopCameraTracksOnly();

      const facingMode = options?.facingMode || this.cameraFacingMode;
      const deviceId = options?.deviceId || this.selectedCameraId;

      const videoConstraints: MediaTrackConstraints = {
        facingMode: deviceId ? undefined : facingMode,
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 640 },
        height: { ideal: 480 },
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || !videoTrack.enabled) {
        throw new Error('Không nhận được luồng hình ảnh hợp lệ từ camera.');
      }

      this.cameraStream = stream;
      this.cameraFacingMode = facingMode;
      if (deviceId) this.selectedCameraId = deviceId;

      // Handle track mute, unmute, ended events
      videoTrack.onmute = () => {
        // Temporarily interrupted (e.g. system window switch or OS focus shift)
        this.cameraStatus = {
          ...this.cameraStatus,
          permissionState: 'interrupted',
          errorMessage: 'Camera tạm thời gián đoạn tín hiệu.',
        };
        this.notifyStatusChange();
      };

      videoTrack.onunmute = () => {
        // Video signal restored automatically
        this.cameraStatus = {
          ...this.cameraStatus,
          permissionState: 'granted',
          errorMessage: undefined,
        };
        this.notifyStatusChange();
      };

      videoTrack.onended = () => {
        // Track ended permanently (e.g. unplugged or OS revoked)
        this.cameraStatus = {
          isEnabled: false,
          permissionState: 'disconnected',
          errorMessage: 'Camera đã mất kết nối với thiết bị.',
        };
        this.stopCameraTracksOnly();
        this.notifyStatusChange();
      };

      this.cameraStatus = {
        isEnabled: true,
        permissionState: 'granted',
        deviceId: videoTrack.getSettings().deviceId,
        label: videoTrack.label || 'Camera trực tiếp',
      };
      this.notifyStatusChange();
      return stream;
    } catch (err) {
      const parsed = this.parseMediaError(err, 'camera');
      this.cameraStatus = {
        isEnabled: false,
        permissionState: parsed.state,
        errorMessage: parsed.msg,
      };
      this.notifyStatusChange();
      throw new Error(parsed.msg);
    } finally {
      this.isRequestingCamera = false;
    }
  }

  /**
   * Stop real camera stream and release resources
   */
  public stopCamera(): void {
    this.stopCameraTracksOnly();
    this.cameraStatus = {
      isEnabled: false,
      permissionState: 'idle',
    };
    this.notifyStatusChange();
  }

  private stopCameraTracksOnly(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Lỗi khi dừng video track:', e);
        }
      });
      this.cameraStream = null;
    }
  }

  /**
   * Switch between front (user) and rear (environment) cameras
   */
  public async switchCamera(): Promise<MediaStream | null> {
    if (!this.cameraStatus.isEnabled) {
      return null;
    }

    const nextMode: 'user' | 'environment' = this.cameraFacingMode === 'user' ? 'environment' : 'user';
    this.selectedCameraId = undefined; // clear specific ID so facingMode takes effect
    return await this.startCamera({ facingMode: nextMode });
  }

  // ================= MICROPHONE MANAGEMENT ================= //

  /**
   * Start real microphone stream and initialize real-time audio volume monitoring
   */
  public async startMicrophone(deviceId?: string): Promise<MediaStream> {
    if (this.isRequestingMicrophone) {
      throw new Error('Đang trong quá trình khởi động micro, vui lòng đợi...');
    }

    if (!this.isSupported()) {
      this.microphoneStatus = {
        isEnabled: false,
        permissionState: 'unsupported',
        errorMessage: 'Trình duyệt hiện tại không hỗ trợ Web Audio / MediaDevices API.',
      };
      this.notifyStatusChange();
      throw new Error(this.microphoneStatus.errorMessage);
    }

    this.isRequestingMicrophone = true;
    this.microphoneStatus = {
      isEnabled: false,
      permissionState: 'requesting',
    };
    this.notifyStatusChange();

    try {
      this.stopMicrophoneTracksOnly();

      const targetId = deviceId || this.selectedMicrophoneId;
      const audioConstraints: MediaTrackConstraints = {
        deviceId: targetId ? { exact: targetId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack || !audioTrack.enabled) {
        throw new Error('Không nhận được luồng âm thanh hợp lệ từ micro.');
      }

      this.microphoneStream = stream;
      if (deviceId) this.selectedMicrophoneId = deviceId;

      audioTrack.onmute = () => {
        // Temporarily interrupted
        this.microphoneStatus = {
          ...this.microphoneStatus,
          permissionState: 'interrupted',
          errorMessage: 'Micro tạm thời gián đoạn tín hiệu.',
        };
        this.notifyStatusChange();
      };

      audioTrack.onunmute = () => {
        // Signal restored
        this.microphoneStatus = {
          ...this.microphoneStatus,
          permissionState: 'granted',
          errorMessage: undefined,
        };
        this.resumeAudio();
        this.notifyStatusChange();
      };

      audioTrack.onended = () => {
        // Track ended permanently
        this.microphoneStatus = {
          isEnabled: false,
          permissionState: 'disconnected',
          errorMessage: 'Micro đã mất kết nối với thiết bị.',
        };
        this.stopMicrophoneTracksOnly();
        this.stopAudioAnalyser();
        this.notifyStatusChange();
      };

      // Set up Web Audio Analyser for volume metering
      this.setupAudioAnalyser(stream);

      this.microphoneStatus = {
        isEnabled: true,
        permissionState: 'granted',
        deviceId: audioTrack.getSettings().deviceId,
        label: audioTrack.label || 'Micro trực tiếp',
      };
      this.notifyStatusChange();
      return stream;
    } catch (err) {
      const parsed = this.parseMediaError(err, 'microphone');
      this.microphoneStatus = {
        isEnabled: false,
        permissionState: parsed.state,
        errorMessage: parsed.msg,
      };
      this.notifyStatusChange();
      throw new Error(parsed.msg);
    } finally {
      this.isRequestingMicrophone = false;
    }
  }

  /**
   * Stop real microphone stream and release Web Audio resources
   */
  public stopMicrophone(): void {
    this.stopAudioAnalyser();
    this.stopMicrophoneTracksOnly();
    this.microphoneStatus = {
      isEnabled: false,
      permissionState: 'idle',
    };
    this.notifyStatusChange();
  }

  private stopMicrophoneTracksOnly(): void {
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Lỗi khi dừng audio track:', e);
        }
      });
      this.microphoneStream = null;
    }
  }

  // ================= WEB AUDIO LEVEL ANALYSER ================= //

  private setupAudioAnalyser(stream: MediaStream): void {
    this.stopAudioAnalyser();

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioContext = new AudioCtxClass();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.5;

      this.audioSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.audioSourceNode.connect(this.analyserNode);

      // Start calculation loop
      this.startAudioLevelLoop();
    } catch (err) {
      console.warn('Không thể khởi tạo AnalyserNode âm thanh:', err);
    }
  }

  private startAudioLevelLoop(): void {
    if (!this.analyserNode) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const update = () => {
      if (!this.analyserNode || !this.microphoneStatus.isEnabled) {
        this.broadcastAudioLevel(0);
        return;
      }

      // Auto-resume AudioContext if browser suspended it during window change or getDisplayMedia
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      this.analyserNode.getByteFrequencyData(dataArray);

      // Calculate Root Mean Square / Average
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      // Convert to 0 - 100 percentage
      const level = Math.min(100, Math.round((avg / 128) * 100));

      this.broadcastAudioLevel(level);
      this.audioLevelAnimFrame = requestAnimationFrame(update);
    };

    this.audioLevelAnimFrame = requestAnimationFrame(update);
  }

  /**
   * Resume audio context if suspended by browser focus shift
   */
  public resumeAudio(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  /**
   * Reconnect camera if connection was interrupted or disconnected
   */
  public async reconnectCamera(): Promise<MediaStream> {
    return await this.startCamera();
  }

  /**
   * Reconnect microphone if connection was interrupted or disconnected
   */
  public async reconnectMicrophone(): Promise<MediaStream> {
    return await this.startMicrophone();
  }

  private stopAudioAnalyser(): void {
    if (this.audioLevelAnimFrame !== null) {
      cancelAnimationFrame(this.audioLevelAnimFrame);
      this.audioLevelAnimFrame = null;
    }

    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.disconnect();
      } catch (e) {
        console.warn('Disconnect audio source error:', e);
      }
      this.audioSourceNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (e) {
        console.warn('Disconnect analyser error:', e);
      }
      this.analyserNode = null;
    }

    if (this.audioContext) {
      try {
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close();
        }
      } catch (e) {
        console.warn('Close audioContext error:', e);
      }
      this.audioContext = null;
    }

    this.broadcastAudioLevel(0);
  }

  private broadcastAudioLevel(level: number): void {
    this.audioLevelCallbacks.forEach((cb) => {
      try {
        cb(level);
      } catch (e) {
        console.error('Audio level callback error:', e);
      }
    });
  }

  public subscribeAudioLevel(callback: AudioLevelCallback): () => void {
    this.audioLevelCallbacks.add(callback);
    return () => this.audioLevelCallbacks.delete(callback);
  }

  // ================= GLOBAL CLEANUP ================= //

  /**
   * Stop all active cameras and microphones, clean up all tracks and audio contexts
   */
  public stopAll(): void {
    this.stopCamera();
    this.stopMicrophone();
  }
}

export const mediaDeviceService = new MediaDeviceService();
