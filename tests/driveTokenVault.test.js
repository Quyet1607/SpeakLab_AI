import test from 'node:test';
import assert from 'node:assert/strict';
import {
  driveVaultKeyConfigured,
  encryptDriveRefreshToken,
  decryptDriveRefreshToken,
  getDriveRefreshToken,
  driveVaultReady,
} from '../server/driveTokenVault.js';

const baseEnv = {
  GOOGLE_CLIENT_ID: '123456789012-abc.apps.googleusercontent.com',
  GOOGLE_DRIVE_FOLDER_ID: '162BRQa2a0sVMsM-icghcI6QqhK1va1rr',
  GOOGLE_DRIVE_OWNER_EMAIL: 'teacher@example.com',
  SPEAKLAB_DRIVE_VAULT_KEY: Buffer.alloc(32, 23).toString('base64'),
};
const context = {
  clientId: baseEnv.GOOGLE_CLIENT_ID,
  folderId: baseEnv.GOOGLE_DRIVE_FOLDER_ID,
  ownerEmail: baseEnv.GOOGLE_DRIVE_OWNER_EMAIL,
};
const token = '1//0G_fake_sample_refresh_token_12345';

test('encrypt/decrypt uses AES-GCM with server-side key; never writes plaintext into envelope', () => {
  assert.equal(driveVaultKeyConfigured(baseEnv), true);
  const encrypted = encryptDriveRefreshToken(token, context, baseEnv);
  assert.match(encrypted, /^slv1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(encrypted.includes(token), false);
  assert.equal(decryptDriveRefreshToken(encrypted, context, baseEnv), token);
  const env = { ...baseEnv, GOOGLE_DRIVE_REFRESH_TOKEN_ENC: encrypted };
  assert.equal(getDriveRefreshToken(env), token);
  assert.equal(driveVaultReady(env), true);
});

test('ciphertext is randomized so identical tokens produce different envelopes', () => {
  const a = encryptDriveRefreshToken(token, context, baseEnv);
  const b = encryptDriveRefreshToken(token, context, baseEnv);
  assert.notEqual(a, b);
  assert.equal(decryptDriveRefreshToken(a, context, baseEnv), token);
  assert.equal(decryptDriveRefreshToken(b, context, baseEnv), token);
});

test('tampering, wrong key and wrong owner/folder/client all fail closed', () => {
  const encrypted = encryptDriveRefreshToken(token, context, baseEnv);
  const parts = encrypted.split('.');
  parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
  assert.equal(decryptDriveRefreshToken(parts.join('.'), context, baseEnv), null);
  assert.equal(decryptDriveRefreshToken(encrypted, context, {
    ...baseEnv, SPEAKLAB_DRIVE_VAULT_KEY: Buffer.alloc(32, 22).toString('base64'),
  }), null);
  assert.equal(decryptDriveRefreshToken(encrypted, { ...context, ownerEmail: 'other@example.com' }, baseEnv), null);
  assert.equal(decryptDriveRefreshToken(encrypted, { ...context, folderId: 'different_folder_1234' }, baseEnv), null);
  assert.equal(decryptDriveRefreshToken(encrypted, { ...context, clientId: 'different-client-1234' }, baseEnv), null);
});

test('does not allow malformed key, token, or envelope', () => {
  assert.equal(driveVaultKeyConfigured({}), false);
  assert.throws(() => encryptDriveRefreshToken(token, context, {}), /Thiếu khóa/);
  assert.throws(() => encryptDriveRefreshToken('abc', context, baseEnv), /refresh token/);
  assert.equal(decryptDriveRefreshToken('slv1.invalid', context, baseEnv), null);
  assert.equal(decryptDriveRefreshToken('slv2.a.b.c', context, baseEnv), null);
  assert.equal(decryptDriveRefreshToken('', context, baseEnv), null);
});
