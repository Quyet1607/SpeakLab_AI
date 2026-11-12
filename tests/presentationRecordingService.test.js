import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ScreenAudioRecordingSession } from '../src/services/presentationRecordingService.ts';

// Lightweight MediaRecorder simulation: tests wiring without opening camera/micro.
const OriginalRecorder = globalThis.MediaRecorder;
const OriginalStream = globalThis.MediaStream;

class FakeMediaStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
}
class FakeTrack extends EventTarget {
  constructor(kind, readyState = 'live', enabled = true) {
    super();
    this.kind = kind; this.readyState = readyState; this.enabled = enabled;
    this.stopCalls = 0;
  }
  stop() { this.stopCalls++; this.readyState = 'ended'; this.dispatchEvent(new Event('ended')); }
}
class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(type) { return type === 'video/webm'; }
  constructor(stream, options) {
    super(); this.stream = stream; this.options = options;
    this.mimeType = options?.mimeType || 'video/webm';
    this.state = 'inactive';
  }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    const dataEvent = new Event('dataavailable');
    Object.defineProperty(dataEvent, 'data', { value: new Blob(['recorded-sample'], { type: 'video/webm' }) });
    this.dispatchEvent(dataEvent);
    this.dispatchEvent(new Event('stop'));
  }
}

beforeAll(() => {
  globalThis.MediaRecorder = FakeMediaRecorder;
  globalThis.MediaStream = FakeMediaStream;
});
afterAll(() => {
  globalThis.MediaRecorder = OriginalRecorder;
  globalThis.MediaStream = OriginalStream;
});

describe('local screen / camera recording sources', () => {
  test('records camera + microphone without screen sharing', async () => {
    const camera = new FakeTrack('video');
    const microphone = new FakeTrack('audio');
    const ended = [];
    const session = new ScreenAudioRecordingSession(
      new FakeMediaStream([camera]), new FakeMediaStream([microphone]), input => ended.push(input), 'camera',
    );
    session.start();
    const result = await session.stop();
    expect(result.mimeType).toBe('video/webm');
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.fileExtension).toBe('webm');
    expect(camera.stopCalls).toBe(0);
    expect(microphone.stopCalls).toBe(0);
    camera.dispatchEvent(new Event('ended'));
    expect(ended).toEqual([]); // Listener removed after finalizing.
  });

  test('screen + mic mode is backward-compatible', async () => {
    const screen = new FakeTrack('video');
    const microphone = new FakeTrack('audio');
    const events = [];
    const session = new ScreenAudioRecordingSession(
      new FakeMediaStream([screen]), new FakeMediaStream([microphone]), input => events.push(input),
    );
    session.start();
    screen.dispatchEvent(new Event('ended'));
    expect(events).toEqual(['screen']);
    const result = await session.stop();
    expect(result.bytes).toBeGreaterThan(0);
  });

  test('camera ending emits camera source, not screen; microphone ending is distinct', () => {
    const camera = new FakeTrack('video');
    const microphone = new FakeTrack('audio');
    const events = [];
    const session = new ScreenAudioRecordingSession(
      new FakeMediaStream([camera]), new FakeMediaStream([microphone]), input => events.push(input), 'camera',
    );
    session.start();
    camera.dispatchEvent(new Event('ended'));
    microphone.dispatchEvent(new Event('ended'));
    expect(events).toEqual(['camera', 'microphone']);
    session.dispose();
    expect(camera.stopCalls).toBe(0);
    expect(microphone.stopCalls).toBe(0);
  });

  test('rejects camera or microphone that has not been explicitly enabled', () => {
    const audio = new FakeMediaStream([new FakeTrack('audio')]);
    const video = new FakeMediaStream([new FakeTrack('video', 'ended')]);
    expect(() => new ScreenAudioRecordingSession(video, audio, () => {}, 'camera'))
      .toThrow('Hãy bật camera thật');
    const camera = new FakeMediaStream([new FakeTrack('video')]);
    expect(() => new ScreenAudioRecordingSession(camera, new FakeMediaStream([]), () => {}, 'camera'))
      .toThrow('Hãy bật micro thật');
  });
});
