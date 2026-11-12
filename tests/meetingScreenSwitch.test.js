import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MeetingGridCapture, hasLiveScreenTrack } from '../src/services/meetingGridCapture.ts';

const oldDocument = globalThis.document;
const oldRAF = globalThis.requestAnimationFrame;
const oldCancelRAF = globalThis.cancelAnimationFrame;
let latestFrame;
let context;
let canvasTrack;
let videos;

function makeTrack() {
  return { readyState: 'live', enabled: true, stopCalls: 0, stop() { this.stopCalls++; this.readyState = 'ended'; } };
}
function makeStream(track = makeTrack()) {
  return { getVideoTracks: () => [track], getTracks: () => [track] };
}

beforeAll(() => {
  context = {
    draws: 0,
    fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
    strokeRect() {}, save() {}, restore() {}, rect() {}, clip() {},
    drawImage() { this.draws++; },
  };
  videos = [];
  canvasTrack = makeTrack();
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') return {
        width: 0, height: 0,
        getContext() { return context; },
        captureStream() { return makeStream(canvasTrack); },
      };
      if (tag === 'video') {
        const vid = {
          srcObject: null, muted: false, playsInline: false, autoplay: false,
          readyState: 2, videoWidth: 1920, videoHeight: 1080,
          play() { return Promise.resolve(); }, pause() {},
        };
        videos.push(vid);
        return vid;
      }
      throw Error('Unexpected element ' + tag);
    },
  };
  globalThis.requestAnimationFrame = fn => { latestFrame = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { latestFrame = null; };
});
afterAll(() => {
  globalThis.document = oldDocument;
  globalThis.requestAnimationFrame = oldRAF;
  globalThis.cancelAnimationFrame = oldCancelRAF;
});

describe('live sharing inside a continuous meeting recording', () => {
  test('distinguishes usable display tracks', () => {
    expect(hasLiveScreenTrack(null)).toBe(false);
    expect(hasLiveScreenTrack(makeStream())).toBe(true);
    expect(hasLiveScreenTrack(makeStream({ readyState: 'ended', enabled: true }))).toBe(false);
    expect(hasLiveScreenTrack(makeStream({ readyState: 'live', enabled: false }))).toBe(false);
  });

  test('start, change, stop, and re-share keep exactly the same output video track', () => {
    let sharing = null;
    const ownUser = { fullName: 'Người luyện', avatarInitials: 'NL' };
    const capture = new MeetingGridCapture(ownUser, [], () => null, () => null, () => sharing);
    const originalTrack = capture.getStream().getVideoTracks()[0];
    const screenElement = videos[1];
    capture.start();
    const tick = t => { expect(latestFrame).toBeFunction(); latestFrame(t); };
    tick(100);
    expect(screenElement.srcObject).toBeNull();

    const first = makeStream();
    sharing = first;
    tick(160);
    expect(screenElement.srcObject).toBe(first);
    expect(context.draws).toBeGreaterThan(0);
    expect(capture.getStream().getVideoTracks()[0]).toBe(originalTrack);
    expect(originalTrack.stopCalls).toBe(0);

    const second = makeStream();
    sharing = second;
    tick(220);
    expect(screenElement.srcObject).toBe(second);
    expect(first.getVideoTracks()[0].stopCalls).toBe(0);

    sharing = null;
    tick(280);
    expect(screenElement.srcObject).toBeNull();
    expect(originalTrack.stopCalls).toBe(0);

    sharing = makeStream();
    tick(340);
    expect(screenElement.srcObject).toBe(sharing);
    expect(originalTrack.stopCalls).toBe(0);

    capture.dispose();
    expect(originalTrack.stopCalls).toBe(1);
    expect(second.getVideoTracks()[0].stopCalls).toBe(0);
    expect(sharing.getVideoTracks()[0].stopCalls).toBe(0);
  });
});
