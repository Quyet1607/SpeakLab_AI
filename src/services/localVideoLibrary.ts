/**
 * Local-only practice video library. IndexedDB belongs to this browser/device.
 * Login-based grouping is for convenience, NOT a secure access-control boundary.
 * No Google Drive or other remote video storage is used.
 */
import type { PracticeSession } from '../types';
import type { PresentationRecordingResult } from './presentationRecordingService';
import { refreshSession } from './accountSession';

const DATABASE_NAME = 'speaklab_local_recordings_v1';
const STORE = 'recordings';

export interface LocalVideoRecord {
  id: string;
  sessionId: string;
  title: string;
  createdAt: string;
  durationMs: number;
  sizeBytes: number;
  mimeType: string;
  extension: 'webm' | 'mp4';
  /** Legacy records use local_pending_drive; both values mean device-only storage. */
  storage: 'local_pending_drive' | 'local_device';
  /** Browser-only label, not an access-control boundary. Legacy recordings omit this field. */
  ownerSub?: string;
  blob: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ lưu video cục bộ.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by_session', 'sessionId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho video trên trình duyệt.'));
    request.onblocked = () => reject(new Error('Kho video đang được sử dụng ở tab khác.'));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  requestFactory: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let value: T;
    const tx = db.transaction(STORE, mode);
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Không truy cập được kho video.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Thao tác lưu video bị hủy.')); };
    try {
      const request = requestFactory(tx.objectStore(STORE));
      request.onsuccess = () => { value = request.result; };
      request.onerror = () => { tx.abort(); };
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      reject(error);
    }
  });
}

export async function saveLocalVideo(
  session: PracticeSession,
  recording: PresentationRecordingResult,
): Promise<LocalVideoRecord> {
  // Identify the current signed-in account at save time. Legacy/guest records remain unassigned.
  const account = await refreshSession();
  const ownerSub = account.status === 'signed_in' ? account.identity?.id : undefined;
  const entry: LocalVideoRecord = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    title: session.title,
    createdAt: new Date().toISOString(),
    durationMs: recording.durationMs,
    sizeBytes: recording.bytes,
    mimeType: recording.mimeType,
    extension: recording.fileExtension,
    storage: 'local_device',
    ownerSub,
    blob: recording.blob,
  };
  try {
    await transaction('readwrite', store => store.put(entry));
    return entry;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Không thể lưu dữ liệu.';
    throw new Error('Không lưu được video tạm trên thiết bị. Có thể đã hết dung lượng. ' + detail);
  }
}

/**
 * Import a previously downloaded video into this browser, under the currently
 * verified Google account. This is NOT an upload to a web server.
 */
export async function importLocalVideo(file: File): Promise<LocalVideoRecord> {
  const account = await refreshSession();
  if (account.status !== 'signed_in' || !account.identity?.id) {
    throw new Error('Vui lòng đăng nhập Google trước khi nhập video vào thư viện cá nhân.');
  }
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('Tệp video trống hoặc không hợp lệ.');
  }
  if (file.size > 1024 * 1024 * 1024) {
    throw new Error('Tệp video lớn hơn 1 GB. Hãy lưu tệp trên máy, không nhập vào trình duyệt.');
  }
  const extension = /\.webm$/i.test(file.name) ? 'webm' :
    /\.mp4$/i.test(file.name) ? 'mp4' : null;
  if (!extension) throw new Error('Chỉ hỗ trợ tệp video .webm hoặc .mp4.');
  if (file.type && !['video/webm', 'video/mp4', 'application/octet-stream'].includes(file.type)) {
    throw new Error('Loại tệp không phải video WebM hoặc MP4.');
  }

  const entry: LocalVideoRecord = {
    id: crypto.randomUUID(),
    sessionId: 'import_' + crypto.randomUUID(),
    title: file.name.slice(0, 180),
    createdAt: new Date().toISOString(),
    durationMs: 0, // Duration is unknown until the video is played.
    sizeBytes: file.size,
    mimeType: extension === 'webm' ? 'video/webm' : 'video/mp4',
    extension,
    storage: 'local_device',
    ownerSub: account.identity.id,
    blob: file,
  };
  try {
    await transaction('readwrite', store => store.put(entry));
    return entry;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Không thể lưu dữ liệu.';
    throw new Error('Không nhập được video vào trình duyệt, có thể đã hết dung lượng. ' + detail);
  }
}

export async function listLocalVideos(ownerSub: string | null = null): Promise<LocalVideoRecord[]> {
  const entries = await transaction('readonly', store => store.getAll());
  // UI grouping only. IndexedDB is not secure against other browser users.
  return entries.filter(item => ownerSub ? item.ownerSub === ownerSub : !item.ownerSub)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteLocalVideo(id: string): Promise<void> {
  await transaction('readwrite', store => store.delete(id));
}
