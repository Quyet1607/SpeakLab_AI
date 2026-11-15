import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DriveAuthorizationError, makeOwnerVideoQuery, makeOwnerRecordingQuery,
  assertOwnedVideoMetadata, publicRecordingMetadata,
} from '../server/driveVideoAuthorization.js';

const folderId = '162BRQa2a0sVMsM-icghcI6QqhK1va1rr';
const ownerSub = '123456789012345678901';
const recordingId = '8d4e6f2a-1111-4111-8111-111111111111';
function validFile() {
  return {
    id: '1A_bcdEFghijklmnop234567',
    name: 'Bài thuyết trình mẫu.webm',
    mimeType: 'video/webm',
    trashed: false,
    parents: [folderId],
    size: '15728640',
    createdTime: '2026-11-12T00:00:00Z',
    appProperties: {
      ownerSub,
      recordingId,
      schemaVersion: '1',
      sessionId: 'session-demo-1',
    },
  };
}

test('owner-specific search has exact folder, ownerSub and non-trashed filters', () => {
  const query = makeOwnerVideoQuery(folderId, ownerSub);
  assert.ok(query.includes("'" + folderId + "' in parents"));
  assert.ok(query.includes('trashed = false'));
  assert.ok(query.includes("appProperties has { key = 'ownerSub' and value = '" + ownerSub + "' }"));
  assert.ok(query.includes("schemaVersion"));
  assert.ok(makeOwnerRecordingQuery(folderId, ownerSub, recordingId).includes(recordingId));
});

test('valid owner receives safe metadata without Drive ID', () => {
  const file = validFile();
  assert.equal(assertOwnedVideoMetadata(file, folderId, ownerSub, recordingId), true);
  assert.deepEqual(publicRecordingMetadata(file, folderId, ownerSub), {
    recordingId,
    sessionId: 'session-demo-1',
    title: 'Bài thuyết trình mẫu.webm',
    mimeType: 'video/webm',
    sizeBytes: 15728640,
    createdAt: '2026-11-12T00:00:00Z',
    storage: 'google_drive',
  });
  assert.equal(JSON.stringify(publicRecordingMetadata(file, folderId, ownerSub)).includes(file.id), false);
  assert.equal(JSON.stringify(publicRecordingMetadata(file, folderId, ownerSub)).includes(ownerSub), false);
});

test('cannot access video owned by a different Google account', () => {
  assert.throws(() => assertOwnedVideoMetadata(validFile(), folderId, '987654321098765432109'), DriveAuthorizationError);
});

test('rejects file outside protected app folder', () => {
  const file = validFile();
  file.parents = ['another_folder_123456789'];
  assert.throws(() => assertOwnedVideoMetadata(file, folderId, ownerSub), DriveAuthorizationError);
});

test('rejects trashed, non-video, missing private properties and invalid metadata', () => {
  for (const mutation of [
    f => { f.trashed = true; },
    f => { f.mimeType = 'application/pdf'; },
    f => { delete f.appProperties.ownerSub; },
    f => { f.appProperties.schemaVersion = '2'; },
    f => { f.appProperties.recordingId = 'not-a-uuid'; },
    f => { f.appProperties.sessionId = ''; },
    f => { delete f.parents; },
  ]) {
    const file = validFile();
    mutation(file);
    assert.throws(() => assertOwnedVideoMetadata(file, folderId, ownerSub), DriveAuthorizationError);
  }
});

test('rejects mismatched or forged recording ID', () => {
  assert.throws(() => assertOwnedVideoMetadata(
    validFile(), folderId, ownerSub, '3d4e6f2a-2222-4222-8222-222222222222',
  ), DriveAuthorizationError);
  assert.throws(() => makeOwnerRecordingQuery(folderId, ownerSub, "' or trashed = false"), DriveAuthorizationError);
});

test('rejects invalid user and folder identifiers', () => {
  assert.throws(() => makeOwnerVideoQuery(folderId, 'not-an-owner'), DriveAuthorizationError);
  assert.throws(() => makeOwnerVideoQuery("x' or trashed=false", ownerSub), DriveAuthorizationError);
});
