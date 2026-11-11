/**
 * Phase 3.2C: configuration readiness only.
 * NEVER expose credentials, refresh tokens, or Drive file metadata to unauthenticated clients.
 * This endpoint does not upload, authorize, list, or delete any Google Drive files.
 */
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const configured = {
    folder: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
    oauthClient: Boolean(process.env.GOOGLE_CLIENT_ID),
    oauthSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    ownerAuthorization: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
  };

  // A complete set of config values is NOT proof of successful Drive authorization.
  return response.status(200).json({
    phase: '3.2C',
    driveConnection: 'not_activated',
    configured,
    verifiedWithGoogle: false,
    videoUploadEnabled: false,
    playbackFromDriveEnabled: false,
    deleteOnDriveEnabled: false,
    message: 'Google Drive backend is not activated. Videos are still saved locally on this browser.',
  });
}
