import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { clearGuestLocalVideos, listLocalVideos } from '../src/services/localVideoLibrary.ts';

const previousIndexedDB = globalThis.indexedDB;
const records = new Map();

function createRequest(run, transaction) {
  const request = { result: undefined, onsuccess: null, onerror: null };
  transaction.pending += 1;
  queueMicrotask(() => {
    try {
      request.result = run();
      request.onsuccess?.();
    } catch {
      request.onerror?.();
      transaction.onerror?.();
    }
    transaction.pending -= 1;
    if (transaction.pending === 0) queueMicrotask(() => transaction.oncomplete?.());
  });
  return request;
}

const database = {
  objectStoreNames: { contains: () => true },
  close() {},
  transaction() {
    const tx = {
      pending: 0,
      oncomplete: null,
      onerror: null,
      onabort: null,
      abort() { this.onabort?.(); },
      objectStore() {
        return {
          getAll: () => createRequest(() => [...records.values()], tx),
          delete: id => createRequest(() => { records.delete(id); }, tx),
        };
      },
    };
    return tx;
  },
};

beforeAll(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open() {
        const request = { result: null, onsuccess: null, onupgradeneeded: null, onerror: null, onblocked: null };
        queueMicrotask(() => {
          request.result = database;
          request.onsuccess?.();
        });
        return request;
      },
    },
  });
});
afterAll(() => {
  if (previousIndexedDB === undefined) delete globalThis.indexedDB;
  else Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: previousIndexedDB });
  records.clear();
});

describe('Google-owned local video library', () => {
  test('removes guest and legacy-unassigned video blobs but preserves Google-owned videos', async () => {
    records.clear();
    records.set('guest-video', { id: 'guest-video', ownerSub: null, sessionId: 'ses_guest_12345', blob: new Blob(['guest']) });
    records.set('legacy-video', { id: 'legacy-video', sessionId: 'ses_legacy_12345', blob: new Blob(['legacy']) });
    records.set('google-video', { id: 'google-video', ownerSub: '12345', sessionId: 'ses_google_12345', blob: new Blob(['google']), createdAt: '2026-01-01T00:00:00.000Z' });

    expect(await clearGuestLocalVideos()).toBe(2);
    expect((await listLocalVideos('12345')).map(item => item.id)).toEqual(['google-video']);
    expect(records.has('guest-video')).toBe(false);
    expect(records.has('legacy-video')).toBe(false);
    expect(records.has('google-video')).toBe(true);
  });
});
