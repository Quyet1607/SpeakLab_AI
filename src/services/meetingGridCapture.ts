/**
 * A local-only meeting grid capture, comparable to a Teams/Meet-style tile view.
 * There is ONLY ONE real media input: the signed-in presenter's webcam/microphone.
 * Other tiles are visibly simulated avatars without video/audio streams.
 * This canvas stream is a temporary recording output, never uploaded anywhere.
 */
import type { UserProfile, VirtualParticipant } from '../types';

export interface MeetingTileLayout {
  columns: number;
  rows: number;
}

export function meetingTileLayout(count: number): MeetingTileLayout {
  const total = Math.max(1, Math.min(24, Math.floor(count) || 1));
  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(total * (16 / 9)))));
  return { columns, rows: Math.ceil(total / columns) };
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  const iw = image.videoWidth;
  const ih = image.videoHeight;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const cropW = w / scale;
  const cropH = h / scale;
  ctx.drawImage(image, (iw - cropW) / 2, (ih - cropH) / 2, cropW, cropH, x, y, w, h);
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, fontSize: number, color = '#f4f7f3') {
  ctx.fillStyle = color;
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y, maxWidth);
}

function drawAvatar(ctx: CanvasRenderingContext2D, initials: string, x: number, y: number, w: number, h: number, color: string) {
  const r = Math.max(18, Math.min(58, w * .18, h * .24));
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2 - 7, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.min(32, Math.floor(r * .8))}px system-ui, sans-serif`;
  ctx.fillText(initials.slice(0, 3), x + w / 2, y + h / 2 + 3, r * 1.7);
}

export class MeetingGridCapture {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stream: MediaStream;
  private cameraPreview: HTMLVideoElement;
  private attachedCamera: MediaStream | null = null;
  private raf = 0;
  private disposed = false;
  private lastDrawAt = 0;

  constructor(
    private user: UserProfile,
    private participants: VirtualParticipant[],
    private getCameraStream: () => MediaStream | null,
    private getQuestion: () => { judge: string; text: string } | null = () => null,
  ) {
    if (typeof document === 'undefined') throw new Error('Trình duyệt chưa sẵn sàng ghi bố cục cuộc họp.');
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx || typeof this.canvas.captureStream !== 'function') {
      throw new Error('Trình duyệt chưa hỗ trợ ghi lưới cuộc họp. Hãy thử Chrome hoặc Edge phiên bản mới.');
    }
    this.ctx = ctx;
    this.cameraPreview = document.createElement('video');
    this.cameraPreview.muted = true;
    this.cameraPreview.playsInline = true;
    this.cameraPreview.autoplay = true;
    this.draw();
    // captureStream is owned by this class; it must be stopped AFTER MediaRecorder finishes.
    this.stream = this.canvas.captureStream(20);
    if (!this.stream.getVideoTracks().length) {
      throw new Error('Không lấy được luồng hình ảnh từ lưới cuộc họp.');
    }
  }

  getStream(): MediaStream {
    return this.stream;
  }

  start(): void {
    if (this.disposed) return;
    const step = (timestamp: number) => {
      if (this.disposed) return;
      if (timestamp - this.lastDrawAt >= 45) {
        this.syncCamera();
        this.draw();
        this.lastDrawAt = timestamp;
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private syncCamera(): void {
    const stream = this.getCameraStream();
    const active = stream?.getVideoTracks().some(track => track.readyState === 'live' && track.enabled) ? stream : null;
    if (this.attachedCamera === active) return;
    this.attachedCamera = active;
    this.cameraPreview.srcObject = active;
    if (active) void this.cameraPreview.play().catch(() => { /* keep avatar fallback */ });
  }

  private draw(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.fillStyle = '#162019';
    ctx.fillRect(0, 0, width, height);
    const numberOfTiles = 1 + this.participants.length;
    const { columns, rows } = meetingTileLayout(numberOfTiles);
    const padding = 18;
    const gap = 12;
    const headerH = 66;
    const cellW = (width - 2 * padding - (columns - 1) * gap) / columns;
    const cellH = (height - headerH - padding * 2 - (rows - 1) * gap) / rows;

    drawText(ctx, 'SpeakLab AI  |  Phòng luyện tập mô phỏng', padding, 28, width - 2 * padding, 21);
    drawText(ctx, 'Chỉ bạn là người thật · Các ô còn lại là nhân vật mô phỏng', padding, 53, width - 2 * padding, 16, '#adbeaf');

    for (let i = 0; i < numberOfTiles; i++) {
      const x = padding + (i % columns) * (cellW + gap);
      const y = headerH + padding + Math.floor(i / columns) * (cellH + gap);
      ctx.fillStyle = '#26342a';
      ctx.fillRect(x, y, cellW, cellH);
      if (i === 0) {
        const live = this.attachedCamera?.getVideoTracks().some(t => t.readyState === 'live' && t.enabled)
          && this.cameraPreview.readyState >= 2 && this.cameraPreview.videoWidth > 0;
        if (live) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cellW, cellH);
          ctx.clip();
          drawImageCover(ctx, this.cameraPreview, x, y, cellW, cellH);
          ctx.restore();
        } else {
          drawAvatar(ctx, this.user.avatarInitials || 'B', x, y, cellW, cellH, '#63846b');
        }
      } else {
        const p = this.participants[i - 1];
        drawAvatar(ctx, p.avatarInitials || 'AI', x, y, cellW, cellH, p.avatarBg || '#53705a');
      }
      ctx.fillStyle = 'rgba(16, 25, 18, 0.85)';
      ctx.fillRect(x, y + cellH - 40, cellW, 40);
      const name = i === 0 ? this.user.fullName + ' (Bạn · Thật)' : this.participants[i - 1].name + ' (Mô phỏng)';
      drawText(ctx, name, x + 12, y + cellH - 14, cellW - 24, Math.max(12, Math.min(16, cellW / 15)));
      ctx.strokeStyle = i === 0 ? '#8cad95' : '#3e5143';
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
    const question = this.getQuestion();
    if (question) {
      ctx.fillStyle = 'rgba(18, 32, 21, 0.95)';
      ctx.fillRect(28, height - 112, width - 56, 92);
      ctx.strokeStyle = '#9aa977';
      ctx.lineWidth = 2;
      ctx.strokeRect(28, height - 112, width - 56, 92);
      drawText(ctx, 'CÂU HỎI MÔ PHỎNG · ' + question.judge, 44, height - 81, width - 88, 17, '#d5c692');
      drawText(ctx, question.text, 44, height - 44, width - 88, 20, '#ffffff');
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cameraPreview.pause();
    this.cameraPreview.srcObject = null;
    this.stream.getTracks().forEach(track => track.stop());
    // Never stop the real webcam or microphone here.
  }
}
