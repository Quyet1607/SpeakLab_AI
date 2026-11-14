import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readOAuthConfig } from '../server/driveOAuthBootstrap.js';
import { ensureFreePreview } from '../server/freeSpeechReview.js';
import { makeSessionCookie } from '../server/sessionCookie.js';
import driveVideosHandler from '../api/google-drive/videos.js';
import authConfigHandler from '../api/auth/config.js';

const validOAuth = {
  GOOGLE_CLIENT_ID: 'fake-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'mock-secret-never-used',
  GOOGLE_OAUTH_SETUP_KEY: 'mock-preview-only-setup-key-12345',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://preview.example.test/api/google-drive/oauth/callback',
  GOOGLE_DRIVE_FOLDER_ID: 'examplefolderid123',
  GOOGLE_DRIVE_OWNER_EMAIL: 'teacher@gmail.com',
};

function mockRes() {
  return {
    code: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(n) { this.code = n; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('Google login is available without a separate SpeakLab registration flow', () => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  try {
    process.env.GOOGLE_CLIENT_ID = 'public-client.apps.googleusercontent.com';
    const res = mockRes();
    authConfigHandler({ method: 'GET' }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.googleSignInAvailable, true);
    assert.equal(res.body.enrollmentEnabled, false);
    assert.equal(res.body.clientId, 'public-client.apps.googleusercontent.com');

    const header = readFileSync(new URL('../src/components/common/Header.tsx', import.meta.url), 'utf8');
    const settings = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
    assert.match(header, /GoogleAccountControl/u);
    assert.doesNotMatch(settings, /GoogleIdentityTest|GoogleAccountControl/u);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previous;
  }
});

test('Production refuses Drive OAuth setup even with otherwise valid credentials', () => {
  assert.equal(readOAuthConfig({ ...validOAuth, VERCEL_ENV: 'production' }), null);
  assert.equal(readOAuthConfig({ ...validOAuth, VERCEL_ENV: undefined }), null);
  assert.ok(readOAuthConfig({ ...validOAuth, VERCEL_ENV: 'preview' }));
});

test('Gemini Free Tier review fails closed in Production even when a key exists', () => {
  const env = {
    VERCEL_ENV: 'production',
    SPEAKLAB_GEMINI_FREE_TIER_CONFIRMED: 'true',
    GEMINI_API_KEY: 'fake-key-for-test-only',
  };
  assert.throws(() => ensureFreePreview(env), /Preview/u);
  assert.doesNotThrow(() => ensureFreePreview({ ...env, VERCEL_ENV: 'preview' }));
});

test('Drive read-only feature cannot be enabled in Production by an environment flag alone', async () => {
  const old = {
    secret: process.env.SPEAKLAB_SESSION_SECRET,
    stage: process.env.VERCEL_ENV,
    flag: process.env.SPEAKLAB_DRIVE_READ_ONLY_ENABLED,
  };
  const secret = randomBytes(48).toString('base64');
  try {
    process.env.SPEAKLAB_SESSION_SECRET = secret;
    process.env.VERCEL_ENV = 'production';
    process.env.SPEAKLAB_DRIVE_READ_ONLY_ENABLED = 'true';
    const cookie = makeSessionCookie({
      userId: '123456789', displayName: 'Teacher',
      role: 'teacher', expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }).split(';')[0];
    const res = mockRes();
    await driveVideosHandler({ method: 'GET', headers: { cookie } }, res);
    assert.equal(res.code, 503);
    assert.equal(res.body.enabled, false);
    assert.equal(res.body.videos, undefined);
  } finally {
    for (const [key, value] of Object.entries({
      SPEAKLAB_SESSION_SECRET: old.secret,
      VERCEL_ENV: old.stage,
      SPEAKLAB_DRIVE_READ_ONLY_ENABLED: old.flag,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('main PR workflows and user-facing Gemini disclosures exist', () => {
  const paths = [
    '.github/workflows/check-local-video-library.yml',
    '.github/workflows/drive-ownership-tests.yml',
  ];
  for (const path of paths) {
    const text = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.match(text, /pull_request:\s*\n\s*branches:\s*\n\s*- main/u);
    assert.match(text, /push:\s*\n\s*branches:(?:.|\n)*?- main/u);
  }
  for (const path of ['public/privacy.html', 'docs/privacy.html']) {
    const html = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.match(html, /Nhận xét AI bằng Google Gemini/u);
    assert.match(html, /chữ trích từ PPTX/u);
    assert.match(html, /không đồng nghĩa yêu cầu Google xóa/u);
  }
});
