/**
 * Drive-only secret vault for teacher's OAuth refresh token.
 * Private to the backend: never import from src/, never put plain refresh
 * tokens in a browser, GitHub, logs, or VITE_ env variables.
 *
 * Provisioning for a serverless Preview: teacher copies ONLY an AES-256-GCM
 * encrypted envelope into a private Vercel environment variable. The separate
 * encryption key is also server-side and never disclosed by an endpoint.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'slv1';
const KEY_NAME = 'SPEAKLAB_DRIVE_VAULT_KEY';
const ENVELOPE_NAME = 'GOOGLE_DRIVE_REFRESH_TOKEN_ENC';
const TOKEN_PATTERN = /^[A-Za-z0-9_\-./]+$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function readKey(env) {
  const input = String(env?.[KEY_NAME] || '').trim();
  // A Base64-encoded 32-byte random secret (PowerShell/Node generated).
  if (!/^[A-Za-z0-9+/]{43}=$/.test(input)) return null;
  const bytes = Buffer.from(input, 'base64');
  return bytes.length === 32 && bytes.toString('base64') === input ? bytes : null;
}

export function driveVaultKeyConfigured(env = process.env) {
  return readKey(env) !== null;
}

function aadString(context) {
  const clientId = String(context?.clientId || '');
  const folderId = String(context?.folderId || '');
  const ownerEmail = String(context?.ownerEmail || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9._-]{10,256}$/.test(clientId) ||
      !/^[A-Za-z0-9_-]{10,256}$/.test(folderId) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error('Cấu hình Drive Vault không hợp lệ.');
  }
  // AAD binds the secret to this exact OAuth client, folder and owner.
  // JSON provides unambiguous separators (no string concatenation collisions).
  return Buffer.from(JSON.stringify([VERSION, clientId, folderId, ownerEmail]), 'utf8');
}

export function encryptDriveRefreshToken(refreshToken, context, env = process.env) {
  const key = readKey(env);
  if (!key) throw new Error('Thiếu khóa SPEAKLAB_DRIVE_VAULT_KEY hợp lệ.');
  if (typeof refreshToken !== 'string' || refreshToken.length < 20 ||
      refreshToken.length > 2048 || !TOKEN_PATTERN.test(refreshToken)) {
    throw new Error('Google không cấp refresh token hợp lệ.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadString(context));
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(refreshToken, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'),
    encrypted.toString('base64url')].join('.');
}

export function decryptDriveRefreshToken(envelope, context, env = process.env) {
  const key = readKey(env);
  if (!key || typeof envelope !== 'string' || envelope.length > 4096) return null;
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION ||
      parts.slice(1).some(p => !BASE64URL_PATTERN.test(p))) return null;
  const [,, tagPart, dataPart] = parts;
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  const data = Buffer.from(dataPart, 'base64url');
  if (iv.length !== 12 || tag.length !== 16 || data.length < 20 || data.length > 2048) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aadString(context));
    decipher.setAuthTag(tag);
    const token = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return token.length >= 20 && token.length <= 2048 && TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function getDriveRefreshToken(env = process.env) {
  const context = {
    clientId: env.GOOGLE_CLIENT_ID,
    folderId: env.GOOGLE_DRIVE_FOLDER_ID,
    ownerEmail: env.GOOGLE_DRIVE_OWNER_EMAIL,
  };
  return decryptDriveRefreshToken(env[ENVELOPE_NAME], context, env);
}

export function driveVaultReady(env = process.env) {
  return Boolean(getDriveRefreshToken(env));
}
