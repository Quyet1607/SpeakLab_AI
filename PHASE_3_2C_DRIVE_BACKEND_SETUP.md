# SpeakLab AI · Drive backend preparation (3.2C-2)

## Status
This change includes the **readiness endpoint** `GET /api/google-drive/status` and the **one-time OAuth verification pages** `GET/POST /api/google-drive/oauth/start` and `GET /api/google-drive/oauth/callback`.
The OAuth callback exchanges a short-lived authorization code to **verify teacher identity and Drive folder access only**; it deliberately discards access and refresh tokens. It does not upload, persist, list or delete any student video, nor activate long-term Drive authorization.
The endpoint deliberately responds with `driveConnection: "not_activated"` and `videoUploadEnabled: false`.
Until student authentication and a safe upload flow are implemented, all video remains local to the browser (IndexedDB).

## Existing Preview configuration
- `GOOGLE_CLIENT_ID`: Google OAuth 2.0 web application client ID
- `GOOGLE_DRIVE_FOLDER_ID`: Drive folder ID (configured in Preview)
- `GOOGLE_OAUTH_REDIRECT_URI`: exact HTTPS Preview callback, saved in Google Cloud Authorized redirect URIs
- `GOOGLE_OAUTH_SETUP_KEY`: randomly generated (>= 24 chars) secret known only to teacher, provided only in POST body
- `GOOGLE_DRIVE_OWNER_EMAIL`: **still needs to be configured** – exact email of teacher Drive owner; backend will reject other Google accounts
- A Google OAuth Web client exists for project "SpeakLab AI".
- Teacher controls the private folder "Video app SpeakLab".

## Next server-only secrets (not yet required by readiness endpoint)
- `GOOGLE_CLIENT_SECRET`: OAuth client secret (now configured on Preview)
- `GOOGLE_REFRESH_TOKEN`: offline authorization **after** secure OAuth and folder access are verified

Only save these using Vercel environment variables. Do not prefix with `VITE_`, expose them in a screenshot, print them in logs, or commit them to GitHub.
No refresh token should be created through an insecure/public endpoint, and no student should ever receive the teacher's OAuth token.

## Testing the teacher-only bootstrap

1. Add `GOOGLE_DRIVE_OWNER_EMAIL` to Vercel **Preview**. Value must be exactly the Google email owning the private Drive folder. Do not prefix with `VITE_`.
2. Ensure the other variables listed above are configured only on Preview. A new Preview deployment is needed after variable changes.
3. Open the **real branch Preview domain** (not Production): `https://<branch-preview-host>/api/google-drive/oauth/start`.
4. Paste the setup key into the **private form on the Preview site**, never in the URL or chat. The POST verifies the key and redirects to Google.
5. At Google consent, choose the owner account. The callback checks signed state, verified owner email, Drive `drive.file` folder visibility, and the ability to add children.
6. On success the browser shows a verification result only. **No token is stored** and video still stays local. A warning about missing folder access means the pre-existing folder needs explicit app permission (Google Picker) or an app-created folder.

The setup form should not be publicly advertised. The POST is protected with a high-entropy key, but a proper one-time admin authorization UI + rate limiting should be added before wider deployment.

## Before enabling Drive upload
1. Confirm the configured **preview callback URI** matches the deployed branch Preview domain exactly and is registered in the Google OAuth client.
2. Preliminary teacher-only OAuth consent verification is present, protected by a setup key and signed state; it intentionally does **not** persist tokens. Implement protected durable server-side token storage before enabling Drive uploads.
3. Verify the `drive.file` scope grants app access to this **pre-existing folder**. Folder ID alone is insufficient; Google Picker or another explicit authorization step may be needed.
4. Implement login and server-side authorization for actual students. The current React app has mock user data, NOT a production-grade authentication model.
5. Implement chunked/resumable transfer of video. Vercel Functions have a 4.5 MB request/response payload limit; NEVER upload a full video via a single Function request.
6. Store the mapping of each session and authenticated owner to a Drive file ID in a server-managed database with access controls. Do not trust a client-provided userId or fileId for delete.
7. Provide authenticated video playback (avoid public Drive share links). On deletion, trash the **verified owned file** in Drive before marking the record deleted.
8. Keep a local backup and clear error states when upload fails; report “Đã đồng bộ Google Drive” only after Drive and metadata persistence succeed.
9. Run end-to-end validation on isolated Preview before touching `main`.

## About OAuth Testing
Google OAuth external apps in Testing may have refresh tokens expiring in seven days for sensitive/non-basic scopes. Plan production authorization and verification as needed; don't promise indefinite background syncing while Testing.

## Quick check
After Preview deploy, open `https://<your-actual-preview-host>/api/google-drive/status`.
Expected JSON includes `driveConnection: "not_activated"`. This checks the endpoint exists only; it does NOT confirm Google authorization.

## Security
**Never paste client secret, setup key, token, or admin access credentials in ChatGPT or GitHub issues.**
