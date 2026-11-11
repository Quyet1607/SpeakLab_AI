/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EnvironmentType =
  | 'desktop_browser'
  | 'mobile_browser'
  | 'embedded_iframe'
  | 'webview'
  | 'native_android'
  | 'native_ios'
  | 'unknown';

export interface ScreenShareCapability {
  isSupported: boolean;
  environment: EnvironmentType;
  platformLabel: string;
  providerId: 'browser' | 'android_native' | 'ios_native';
  friendlyNotice: string;
  technicalDetails?: string;
}

export interface IScreenShareProvider {
  readonly id: 'browser' | 'android_native' | 'ios_native';
  readonly name: string;
  isSupported(): boolean;
  getCapability(): ScreenShareCapability;
  startShare(): Promise<MediaStream>;
  stopShare(stream?: MediaStream | null): Promise<void>;
}

/**
 * Standard Web Screen Capture Provider using navigator.mediaDevices.getDisplayMedia
 * Works on Desktop HTTPS browsers (Chrome, Edge, Firefox, Safari).
 */
export class BrowserScreenShareProvider implements IScreenShareProvider {
  readonly id = 'browser' as const;
  readonly name = 'Trình duyệt Web (Web Screen Capture API)';

  private detectEnvironment(): { env: EnvironmentType; label: string; isMobile: boolean; isIframe: boolean } {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { env: 'unknown', label: 'Môi trường máy chủ', isMobile: false, isIframe: false };
    }

    const ua = navigator.userAgent || '';
    const isIframe = window.self !== window.top;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

    if (isIframe) {
      return { env: 'embedded_iframe', label: 'Cửa sổ xem trước nhúng (Iframe)', isMobile, isIframe: true };
    }

    if (isMobile) {
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isAndroid = /Android/i.test(ua);
      const osLabel = isIOS ? 'iOS' : isAndroid ? 'Android' : 'Điện thoại';
      return { env: 'mobile_browser', label: `Trình duyệt di động (${osLabel})`, isMobile: true, isIframe: false };
    }

    return { env: 'desktop_browser', label: 'Trình duyệt máy tính (Desktop)', isMobile: false, isIframe: false };
  }

  isSupported(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const { isMobile, isIframe } = this.detectEnvironment();

    // Mobile browsers and restrictive iframes do not have working desktop-like getDisplayMedia
    if (isMobile) {
      return false;
    }

    // Must have secure context (HTTPS or localhost) and getDisplayMedia API
    const hasApi = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
    const isSecure = window.isSecureContext ?? true;

    return hasApi && isSecure && !isIframe;
  }

  getCapability(): ScreenShareCapability {
    const { env, label, isMobile, isIframe } = this.detectEnvironment();
    const hasApi = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');

    if (isMobile) {
      return {
        isSupported: false,
        environment: env,
        platformLabel: label,
        providerId: this.id,
        friendlyNotice: 'Trình duyệt hoặc thiết bị hiện tại chưa hỗ trợ chia sẻ màn hình trực tiếp. Bạn vẫn có thể tải PowerPoint để trình chiếu trong SpeakLab AI.',
        technicalDetails: 'Trình duyệt di động (Android / iOS) hạn chế Screen Capture Web API theo chính sách bảo mật hệ điều hành. Cần đóng gói ứng dụng native để kích hoạt MediaProjection/ReplayKit.',
      };
    }

    if (isIframe) {
      return {
        isSupported: false,
        environment: env,
        platformLabel: label,
        providerId: this.id,
        friendlyNotice: 'Môi trường xem trước nhúng (Iframe) bị hạn chế quyền chia sẻ màn hình. Bạn có thể mở ứng dụng trên tab trình duyệt độc lập hoặc dùng Chế độ PPTX nội bộ.',
        technicalDetails: 'Iframe permissions policy: display-capture bị chặn bởi trang cha.',
      };
    }

    if (!hasApi) {
      return {
        isSupported: false,
        environment: env,
        platformLabel: label,
        providerId: this.id,
        friendlyNotice: 'Trình duyệt hiện tại chưa hỗ trợ tính năng chia sẻ màn hình. Vui lòng sử dụng Google Chrome hoặc Microsoft Edge phiên bản mới nhất.',
        technicalDetails: 'navigator.mediaDevices.getDisplayMedia không khả dụng trên trình duyệt này.',
      };
    }

    return {
      isSupported: true,
      environment: env,
      platformLabel: label,
      providerId: this.id,
      friendlyNotice: 'Thiết bị sẵn sàng chia sẻ cửa sổ PowerPoint với đầy đủ hiệu ứng Animation và Transition.',
      technicalDetails: 'Web Screen Capture API sẵn sàng (60fps, cursor: always).',
    };
  }

  async startShare(): Promise<MediaStream> {
    if (!this.isSupported()) {
      const cap = this.getCapability();
      throw new Error(cap.friendlyNotice);
    }

    // Configure options with displaySurface hint and exclude current tab to prevent infinite mirror loop
    const displayMediaOptions = {
      video: {
        cursor: 'always',
        displaySurface: 'window',
      } as MediaTrackConstraints,
      audio: false,
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      systemAudio: 'exclude',
    } as DisplayMediaStreamOptions;

    return await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
  }

  async stopShare(stream?: MediaStream | null): Promise<void> {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Lỗi khi dừng media track:', e);
        }
      });
    }
  }
}

/**
 * Adapter placeholder for Android Native Screen Capture (MediaProjection API)
 * Will be activated when packaged via Capacitor / Android Native wrapper.
 */
export class AndroidNativeScreenShareProvider implements IScreenShareProvider {
  readonly id = 'android_native' as const;
  readonly name = 'Android Native Screen Sharing (MediaProjection)';

  isSupported(): boolean {
    // In Web Phase 2.4, native bridge is not yet present
    return false;
  }

  getCapability(): ScreenShareCapability {
    return {
      isSupported: false,
      environment: 'native_android',
      platformLabel: 'Android Native Application',
      providerId: this.id,
      friendlyNotice: 'Trình duyệt hoặc thiết bị hiện tại chưa hỗ trợ chia sẻ màn hình trực tiếp. Bạn vẫn có thể tải PowerPoint để trình chiếu trong SpeakLab AI.',
      technicalDetails: 'Kiến trúc adapter sẵn sàng cho plugin Capacitor Android MediaProjection trong giai đoạn đóng gói APK.',
    };
  }

  async startShare(): Promise<MediaStream> {
    throw new Error('Tính năng Native Screen Capture cho Android sẽ được kích hoạt khi triển khai ứng dụng APK với plugin MediaProjection.');
  }

  async stopShare(): Promise<void> {
    // Native cleanup hook
  }
}

/**
 * Adapter placeholder for iOS Native Screen Capture (ReplayKit API)
 * Will be activated when packaged via Capacitor / iOS Native wrapper.
 */
export class IOSNativeScreenShareProvider implements IScreenShareProvider {
  readonly id = 'ios_native' as const;
  readonly name = 'iOS Native Screen Sharing (ReplayKit)';

  isSupported(): boolean {
    // In Web Phase 2.4, native bridge is not yet present
    return false;
  }

  getCapability(): ScreenShareCapability {
    return {
      isSupported: false,
      environment: 'native_ios',
      platformLabel: 'iOS Native Application',
      providerId: this.id,
      friendlyNotice: 'Trình duyệt hoặc thiết bị hiện tại chưa hỗ trợ chia sẻ màn hình trực tiếp. Bạn vẫn có thể tải PowerPoint để trình chiếu trong SpeakLab AI.',
      technicalDetails: 'Kiến trúc adapter sẵn sàng cho plugin Capacitor iOS ReplayKit Broadcast Extension trong giai đoạn đóng gói IPA.',
    };
  }

  async startShare(): Promise<MediaStream> {
    throw new Error('Tính năng Native Screen Capture cho iOS sẽ được kích hoạt khi triển khai ứng dụng IPA với Broadcast Upload Extension.');
  }

  async stopShare(): Promise<void> {
    // Native cleanup hook
  }
}

/**
 * ScreenShareService: Centralized singleton managing screen sharing operations and platform routing.
 */
class ScreenShareService {
  private browserProvider = new BrowserScreenShareProvider();
  private androidProvider = new AndroidNativeScreenShareProvider();
  private iosProvider = new IOSNativeScreenShareProvider();

  private activeStream: MediaStream | null = null;

  /**
   * Determine the most appropriate provider based on execution runtime.
   */
  public getActiveProvider(): IScreenShareProvider {
    // If running in Capacitor Android environment in future:
    // if (window.Capacitor?.getPlatform() === 'android') return this.androidProvider;
    // If running in Capacitor iOS environment in future:
    // if (window.Capacitor?.getPlatform() === 'ios') return this.iosProvider;

    return this.browserProvider;
  }

  /**
   * Check capability of current runtime.
   */
  public getCapability(): ScreenShareCapability {
    return this.getActiveProvider().getCapability();
  }

  /**
   * Request to start screen sharing.
   */
  public async startShare(): Promise<MediaStream> {
    const provider = this.getActiveProvider();
    const stream = await provider.startShare();
    this.activeStream = stream;
    return stream;
  }

  /**
   * Stop active screen sharing and release all track resources.
   */
  public async stopShare(stream?: MediaStream | null): Promise<void> {
    const target = stream || this.activeStream;
    const provider = this.getActiveProvider();
    await provider.stopShare(target);
    this.activeStream = null;
  }

  /**
   * Get current active stream if any.
   */
  public getActiveStream(): MediaStream | null {
    return this.activeStream;
  }
}

export const screenShareService = new ScreenShareService();
