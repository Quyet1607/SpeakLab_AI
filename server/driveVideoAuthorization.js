/**
 * Phase 6.10.2 — private Drive-only ownership rules.
 * No upload, playback or delete is performed by this module.
 *
 * Never obtain ownerSub from browser-supplied query/body/headers.
 * The caller must use readSession(req).id, verified by the server.
 */
const GOOGLE_SUB_PATTERN = /^[0-9]{5,64}$/;
const GOOGLE_DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{10,256}$/;
const RECORDING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_MIME_TYPES = new Set(['video/webm', 'video/mp4']);

export class DriveAuthorizationError extends Error {
  constructor(message = 'Không có quyền truy cập video này.', status = 404) {
    super(message);
    this.name = 'DriveAuthorizationError';
    this.status = status;
  }
}

export function validateDriveFolderId(folderId) {
  if (typeof folderId !== 'string' || !GOOGLE_DRIVE_ID_PATTERN.test(folderId)) {
    throw new DriveAuthorizationError('Backend chưa cấu hình thư mục Drive hợp lệ.', 503);
  }
  return folderId;
}

export function validateGoogleSubject(ownerSub) {
  if (typeof ownerSub !== 'string' || !GOOGLE_SUB_PATTERN.test(ownerSub)) {
    throw new DriveAuthorizationError('Cần có phiên Google hợp lệ.', 401);
  }
  return ownerSub;
}

export function validateRecordingId(recordingId) {
  if (typeof recordingId !== 'string' || !RECORDING_ID_PATTERN.test(recordingId)) {
    throw new DriveAuthorizationError();
  }
  return recordingId;
}

export function validateDriveFileId(fileId) {
  if (typeof fileId !== 'string' || !GOOGLE_DRIVE_ID_PATTERN.test(fileId)) {
    throw new DriveAuthorizationError();
  }
  return fileId;
}

/** Escape Drive query literals as required by Google Drive search syntax. */
function quoteDriveLiteral(value) {
  return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

/** Search is constrained BOTH by our private appProperties and the app folder. */
export function makeOwnerVideoQuery(folderId, ownerSub) {
  const folder = validateDriveFolderId(folderId);
  const subject = validateGoogleSubject(ownerSub);
  return [
    quoteDriveLiteral(folder) + ' in parents',
    'trashed = false',
    "appProperties has { key = 'ownerSub' and value = " + quoteDriveLiteral(subject) + ' }',
    "appProperties has { key = 'schemaVersion' and value = '1' }",
  ].join(' and ');
}

/** Future lookup by opaque recordingId; do not trust raw Drive file IDs from clients. */
export function makeOwnerRecordingQuery(folderId, ownerSub, recordingId) {
  return makeOwnerVideoQuery(folderId, ownerSub) +
    " and appProperties has { key = 'recordingId' and value = " +
    quoteDriveLiteral(validateRecordingId(recordingId)) + ' }';
}

/**
 * Fail-closed metadata check. Perform this on files.list results AND on a fresh
 * files.get response before any future streaming, download, or trash action.
 */
export function assertOwnedVideoMetadata(file, folderId, ownerSub, expectedRecordingId = undefined) {
  const folder = validateDriveFolderId(folderId);
  const subject = validateGoogleSubject(ownerSub);
  if (!file || typeof file !== 'object' ||
      typeof file.id !== 'string' || !GOOGLE_DRIVE_ID_PATTERN.test(file.id) ||
      file.trashed !== false ||
      !Array.isArray(file.parents) || !file.parents.includes(folder) ||
      !SUPPORTED_MIME_TYPES.has(file.mimeType) ||
      !file.appProperties || typeof file.appProperties !== 'object' ||
      file.appProperties.ownerSub !== subject ||
      file.appProperties.schemaVersion !== '1' ||
      !RECORDING_ID_PATTERN.test(String(file.appProperties.recordingId || '')) ||
      typeof file.appProperties.sessionId !== 'string' ||
      file.appProperties.sessionId.length < 1 ||
      file.appProperties.sessionId.length > 128) {
    throw new DriveAuthorizationError();
  }
  if (expectedRecordingId !== undefined &&
      file.appProperties.recordingId !== validateRecordingId(expectedRecordingId)) {
    throw new DriveAuthorizationError();
  }
  return true;
}

/** Return safe display metadata only; Drive file IDs and owner info stay server-side. */
export function publicRecordingMetadata(file, folderId, ownerSub) {
  assertOwnedVideoMetadata(file, folderId, ownerSub);
  const name = typeof file.name === 'string' ? file.name.slice(0, 250) : 'Video SpeakLab AI';
  const rawSize = Number(file.size);
  const createdAt = typeof file.createdTime === 'string' && Number.isFinite(Date.parse(file.createdTime))
    ? file.createdTime : null;
  return {
    recordingId: file.appProperties.recordingId,
    sessionId: file.appProperties.sessionId,
    title: name,
    mimeType: file.mimeType,
    sizeBytes: Number.isSafeInteger(rawSize) && rawSize >= 0 ? rawSize : null,
    createdAt,
    storage: 'google_drive',
  };
}
