/**
 * Student consent lifecycle, mounted ONLY in the existing SpeakLab AI review.
 * Learner can request an operator/guardian verification or withdraw access.
 * Neither self-attestation nor a teacher login can create a verified grant.
 * No transcript, PPTX, name, email or contact detail is stored or accepted.
 */
import { readSession, isSameOriginRequest } from '../../server/sessionCookie.js';
import { learnerGroqGrantKey } from '../../server/groqLearnerConsentGate.js';

const REQUEST_ENABLED = 'SPEAKLAB_GROQ_CONSENT_REQUESTS_ENABLED';
const BRANCH = 'feature/groq-synthetic-pilot';
const STATUS = Object.freeze({ none: 'not_requested', pending: 'pending_verification', revoked: 'withdrawn' });
const REQUEST_TTL = 30 * 86400;
const REVOKE_SCRIPT = [
  "local raw = redis.call('GET', KEYS[1])",
  "local changed = 0",
  "if raw then",
  "  local ok, record = pcall(cjson.decode, raw)",
  "  if not ok or type(record) ~= 'table' then return redis.error_reply('invalid grant record') end",
  "  record.status = 'revoked'",
  "  record.revokedAt = tonumber(ARGV[1])",
  "  redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL')",
  "  changed = 1",
  "end",
  "if redis.call('DEL', KEYS[2]) == 1 then changed = 1 end",
  "return changed",
].join('\n');
const fail = () => Object.assign(new Error('Không thể kiểm tra trạng thái đồng thuận.'), { status: 503 });
function config(env) {
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== BRANCH) throw fail();
  const url = String(env.SPEAKLAB_RATE_LIMIT_REST_URL || '').replace(/\/+$/u, '');
  const token = String(env.SPEAKLAB_RATE_LIMIT_REST_TOKEN || '');
  const secret = String(env.SPEAKLAB_SESSION_SECRET || '');
  if (!/^https:\/\/[^/?#]+$/iu.test(url) || !token.trim() || secret.length < 43) throw fail();
  return { url, token, secret };
}
function requestKey(grantKey) {
  return grantKey.replace('student-consent:v1:', 'student-consent-request:v1:');
}
async function redis(configValue, command, fetcher) {
  let response, data;
  try {
    response = await fetcher(configValue.url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + configValue.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(4000),
    });
    if (!response?.ok) throw fail();
    data = await response.json();
  } catch { throw fail(); }
  if (!data || data.error) throw fail();
  return data.result;
}
export async function readLearnerConsentStatus({ identity, env = process.env, fetcher = fetch } = {}) {
  const cfg = config(env);
  if (identity?.role !== 'learner') throw fail();
  const grantKey = learnerGroqGrantKey(identity.id, cfg.secret);
  const raw = await redis(cfg, ['GET', grantKey], fetcher);
  // Read only the status. Only the separately enforced verified-grant gate
  // is allowed to decide whether the user may call the model.
  let revoked = false, recorded = false;
  if (raw !== null) {
    if (typeof raw !== 'string' || raw.length > 2500) throw fail();
    let record;
    try { record = JSON.parse(raw); } catch { throw fail(); }
    if (!record || typeof record !== 'object') throw fail();
    revoked = record.revokedAt != null || record.status === 'revoked';
    recorded = true;
  }
  const pending = await redis(cfg, ['GET', requestKey(grantKey)], fetcher);
  if (pending !== null && (typeof pending !== 'string' || pending.length > 120)) throw fail();
  return {
    status: revoked ? STATUS.revoked : pending ? STATUS.pending : recorded ? 'record_on_file' : STATUS.none,
    requestsEnabled: env[REQUEST_ENABLED] === 'true',
    canUseGroq: false, // never infer model authorization from consent lifecycle
  };
}
export async function requestLearnerConsentReview({
  identity, env = process.env, fetcher = fetch, now = Date.now,
} = {}) {
  const cfg = config(env);
  if (identity?.role !== 'learner' || env[REQUEST_ENABLED] !== 'true') throw fail();
  const key = learnerGroqGrantKey(identity.id, cfg.secret);
  // Never overwrite or downgrade a pre-existing signed-off grant.
  const existing = await redis(cfg, ['GET', key], fetcher);
  if (existing !== null) throw Object.assign(new Error('Đã có hồ sơ; không thể tự tạo yêu cầu mới.'), { status: 409 });
  const at = now();
  if (!Number.isSafeInteger(at) || at < 0) throw fail();
  const result = await redis(cfg, ['SET', requestKey(key),
    String(at), 'NX', 'EX', String(REQUEST_TTL)], fetcher);
  if (result !== 'OK' && result !== null) throw fail();
  return { status: STATUS.pending, created: result === 'OK' };
}
export async function withdrawLearnerConsent({
  identity, env = process.env, fetcher = fetch, now = Date.now,
} = {}) {
  const cfg = config(env);
  if (identity?.role !== 'learner') throw fail();
  const key = learnerGroqGrantKey(identity.id, cfg.secret);
  const at = now();
  if (!Number.isSafeInteger(at) || at < 0) throw fail();
  // Atomic revoke and pending-request deletion: cannot be bypassed by stale
  // checkboxes, later request attempts, or concurrent state overwrites.
  const changed = await redis(cfg, ['EVAL', REVOKE_SCRIPT, '2',
    key, requestKey(key), String(at)], fetcher);
  if (changed !== 0 && changed !== 1) throw fail();
  return { status: STATUS.revoked };
}
function secure(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
export function createLearnerConsentHandler({
  env = process.env, sessionReader = readSession, sameOrigin = isSameOriginRequest,
  statusReader = readLearnerConsentStatus, requester = requestLearnerConsentReview,
  withdrawer = withdrawLearnerConsent,
} = {}) {
  return async function handler(req, res) {
    secure(res);
    if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
      return res.status(404).json({ error: 'Chỉ khả dụng trên Preview.' });
    }
    if (!['GET','POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Phương thức không hợp lệ.' });
    }
    const identity = sessionReader(req, env);
    if (!identity) return res.status(401).json({ error: 'Cần đăng nhập.' });
    if (identity.role !== 'learner') return res.status(403).json({ error: 'Chỉ tài khoản học sinh được quản lý yêu cầu của mình.' });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Nguồn không hợp lệ.' });
    try {
      if (req.method === 'GET') return res.status(200).json(await statusReader({ identity, env }));
      if (!/^application\/json(?:\s*;|\s*$)/iu.test(String(req.headers['content-type'] || ''))) {
        return res.status(415).json({ error: 'Cần JSON.' });
      }
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 200) {
        return res.status(413).json({ error: 'Yêu cầu quá dài.' });
      }
      const body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).length !== 1 || !['request','withdraw'].includes(body.action)) {
        return res.status(400).json({ error: 'Chỉ được gửi yêu cầu xét duyệt hoặc thu hồi.' });
      }
      if (body.action === 'request') return res.status(200).json(await requester({ identity, env }));
      return res.status(200).json(await withdrawer({ identity, env }));
    } catch (e) {
      return res.status(e?.status === 409 ? 409 : 503).json({
        error: e?.status === 409 ? 'Đã có hồ sơ. Liên hệ người phụ trách để xác minh.' :
          'Không thể cập nhật trạng thái; vui lòng thử lại sau. Không có dữ liệu nào được gửi đến Groq.',
      });
    }
  };
}
export default createLearnerConsentHandler();
