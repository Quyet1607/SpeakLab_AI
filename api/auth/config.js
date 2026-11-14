/**
 * Public sign-in configuration only. No secrets and no user data.
 * The Client ID is a public identifier; teacher Drive OAuth credentials remain server-side.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  res.status(clientId ? 200 : 503).json({
    googleSignInAvailable: Boolean(clientId),
    clientId: clientId || null,
    enrollmentEnabled: false,
    recordingsCloudEnabled: false,
    message: 'Sign-in identity verification is in Preview. Student enrollment and Drive upload are not active.',
  });
}
