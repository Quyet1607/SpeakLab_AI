import test from 'node:test';
import assert from 'node:assert/strict';
import { listOwnedDriveVideos } from '../server/driveVideoReader.js';

const env = {
  GOOGLE_DRIVE_FOLDER_ID: '162BRQa2a0sVMsM-icghcI6QqhK1va1rr',
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'fake-secret',
  GOOGLE_REFRESH_TOKEN: 'fake-refresh-token',
};
const subject = '123456789012345678901';
const otherSubject = '987654321098765432109';
const valid = {
  id: '1A_bcdEFghijklmnop234567',
  name: 'Recording.webm',
  mimeType: 'video/webm',
  trashed: false,
  parents: [env.GOOGLE_DRIVE_FOLDER_ID],
  size: '512',
  createdTime: '2026-11-12T00:00:00Z',
  appProperties: {
    schemaVersion: '1',
    ownerSub: subject,
    recordingId: '8d4e6f2a-1111-4111-8111-111111111111',
    sessionId: 'practice-session-1',
  },
};

function mockFetch(files, opts = {}) {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers });
    if (String(url).includes('oauth2.googleapis.com')) {
      return { ok: true, json: async () => ({ access_token: 'test-access-token-1234567890' }) };
    }
    if (String(url).includes('drive/v3/files')) {
      return {
        ok: opts.driveOk !== false,
        json: async () => ({ files, ...(opts.nextPageToken ? { nextPageToken: 'next' } : {}) }),
      };
    }
    throw Error('Unexpected URL');
  };
  return { fetcher, calls };
}

test('lists only verified owner records without exposing Drive file IDs', async () => {
  const foreign = structuredClone(valid);
  foreign.appProperties.ownerSub = otherSubject;
  const outside = structuredClone(valid);
  outside.parents = ['outside_folder_123'];
  const mock = mockFetch([valid, foreign, outside]);
  const rows = await listOwnedDriveVideos(subject, env, mock.fetcher);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recordingId, valid.appProperties.recordingId);
  assert.equal(JSON.stringify(rows).includes(valid.id), false);
  assert.equal(JSON.stringify(rows).includes(subject), false);
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[0].method, 'POST');
  const query = new URL(mock.calls[1].url).searchParams.get('q');
  assert.ok(query.includes("ownerSub"));
  assert.ok(query.includes(subject));
  assert.ok(query.includes(env.GOOGLE_DRIVE_FOLDER_ID));
  assert.ok(query.includes("trashed = false"));
});

test('missing refresh token fails before making any network request', async () => {
  const mock = mockFetch([]);
  await assert.rejects(
    () => listOwnedDriveVideos(subject, { ...env, GOOGLE_REFRESH_TOKEN: '' }, mock.fetcher),
    /Google Drive chưa được kết nối/,
  );
  assert.equal(mock.calls.length, 0);
});

test('rejects incomplete Drive list rather than reporting a partial history', async () => {
  const mock = mockFetch([valid], { nextPageToken: true });
  await assert.rejects(() => listOwnedDriveVideos(subject, env, mock.fetcher), /chưa đầy đủ/);
});

test('rejects invalid user identity before requesting Drive', async () => {
  const mock = mockFetch([valid]);
  await assert.rejects(() => listOwnedDriveVideos('fake-owner', env, mock.fetcher));
  assert.equal(mock.calls.length, 0);
});
