/**
 * Phase 3.2C-1: durable local fallback for recorded sessions.
 * IMPORTANT: IndexedDB is device/browser local; it is NOT a Google Drive backup.
 * The Drive backend will later supersede this fallback after authenticated upload.
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
  storage: 'local_pending_drive';
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
    storage: 'local_pending_drive',
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

export async function listLocalVideos(ownerSub: string | null = null): Promise<LocalVideoRecord[]> {
  const entries = await transaction('readonly', store => store.getAll());
  // UI grouping only. IndexedDB is not secure against other browser users.
  return entries.filter(item => ownerSub ? item.ownerSub === ownerSub : !item.ownerSub)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteLocalVideo(id: string): Promise<void> {
  await transaction('readwrite', store => store.delete(id));
}
