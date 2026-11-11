/**
 * Local PowerPoint-screen + microphone recorder (Phase 3.2A).
 * Does not own, replace or stop original screen / microphone tracks.
 * Never uploads media. Webcam compositing belongs to Phase 3.2B.
 */
export interface PresentationRecordingResult {
  blob: Blob;
  mimeType: string;
  fileExtension: 'webm' | 'mp4';
  durationMs: number;
  bytes: number;
}

export type RecordingInput = 'screen' | 'microphone';

const MIME_OPTIONS = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
];

export class ScreenAudioRecordingSession {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private finished = false;
  private resultPromise: Promise<PresentationRecordingResult>;
  private resolveResult!: (result: PresentationRecordingResult) => void;
  private rejectResult!: (reason: Error) => void;
  private removeInputListeners: () => void;

  constructor(
    screenStream: MediaStream,
    microphoneStream: MediaStream,
    private onInputEnded: (input: RecordingInput) => void,
  ) {
    const video = screenStream.getVideoTracks().find(t => t.readyState === 'live' && t.enabled);
    const audio = microphoneStream.getAudioTracks().find(t => t.readyState === 'live' && t.enabled);
    if (!video) throw new Error('Chưa có nguồn chia sẻ PowerPoint đang hoạt động.');
    if (!audio) throw new Error('Hãy bật micro thật trước khi ghi hình.');
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Trình duyệt này chưa hỗ trợ ghi video.');
    }

    const mimeType = typeof MediaRecorder.isTypeSupported === 'function'
      ? MIME_OPTIONS.find(type => MediaRecorder.isTypeSupported(type))
      : undefined;
    if (typeof MediaRecorder.isTypeSupported === 'function' && !mimeType) {
      throw new Error('Trình duyệt không hỗ trợ định dạng video ghi phù hợp.');
    }
    try {
      // Composite stream references the source tracks; do NOT stop those tracks.
      this.recorder = new MediaRecorder(
        new MediaStream([video, audio]),
        mimeType ? { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 } : undefined,
      );
    } catch {
      throw new Error('Không thể khởi tạo ghi hình màn hình và micro trên thiết bị này.');
    }
    this.resultPromise = new Promise((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
    });

    const handleVideoEnd = () => this.onInputEnded('screen');
    const handleAudioEnd = () => this.onInputEnded('microphone');
    video.addEventListener('ended', handleVideoEnd);
    audio.addEventListener('ended', handleAudioEnd);
    this.removeInputListeners = () => {
      video.removeEventListener('ended', handleVideoEnd);
      audio.removeEventListener('ended', handleAudioEnd);
    };

    this.recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.recorder.addEventListener('error', (event) => {
      const reported = (event as Event & { error?: Error }).error;
      this.fail(new Error(reported?.message || 'Lỗi khi đang ghi video.'));
    });
    this.recorder.addEventListener('stop', () => {
      this.removeInputListeners();
      if (this.finished) return;
      const format = this.recorder.mimeType || this.chunks[0]?.type || '';
      const base = format.split(';')[0].toLowerCase();
      if (base !== 'video/webm' && base !== 'video/mp4') {
        this.fail(new Error('Không xác định được định dạng bản ghi.'));
        return;
      }
      const blob = new Blob(this.chunks, { type: format });
      this.chunks = [];
      if (!blob.size) {
        this.fail(new Error('Bản ghi trống. Hãy kiểm tra màn hình chia sẻ và micro.'));
        return;
      }
      this.finished = true;
      this.resolveResult({
        blob, mimeType: format, fileExtension: base === 'video/mp4' ? 'mp4' : 'webm',
        durationMs: Math.max(0, performance.now() - this.startedAt),
        bytes: blob.size,
      });
    });
  }

  start() {
    if (this.recorder.state !== 'inactive') throw new Error('Bản ghi đang hoạt động.');
    this.recorder.start(1000);
    this.startedAt = performance.now();
  }

  stop(): Promise<PresentationRecordingResult> {
    if (this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); }
      catch (err) {
        this.fail(new Error(err instanceof Error ? err.message : 'Không thể dừng ghi hình.'));
      }
    }
    return this.resultPromise;
  }

  dispose() {
    this.removeInputListeners();
    if (this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch { /* already stopped */ }
    }
    // Microphone and screen owners independently manage original tracks.
  }

  private fail(error: Error) {
    if (this.finished) return;
    this.finished = true;
    this.removeInputListeners();
    this.chunks = [];
    this.rejectResult(error);
  }
}
