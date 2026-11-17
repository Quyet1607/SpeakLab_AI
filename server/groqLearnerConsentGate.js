/**
 * Fail-closed gate for future learner Groq reviews.
 * An operator-verified, server-side approval record MUST be provisioned by
 * an authorized review process outside this module. Browser checkboxes can
 * never create or amend this grant.
 *
 * A grant is a *technical prerequisite*, not a representation that legal
 * analysis, international-transfer duties, or guardian verification are done.
 */
import { createHmac } from 'node:crypto';

const ENABLE = 'SPEAKLAB_GROQ_STUDENT_REVIEW_ENABLED';
const VERSION = 'speaklab-groq-student-review-v1';
const MAX_GRANT_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const fail = () => Object.assign(new Error('Chưa có phê duyệt xử lý dữ liệu Groq đã xác minh cho tài khoản này.'), {
  code: 'GROQ_STUDENT_GRANT_REQUIRED', status: 403,
});
function config(env) {
  if (env.VERCEL_ENV !== 'preview' ||
      env.VERCEL_GIT_COMMIT_REF !== 'feature/groq-synthetic-pilot' ||
      env[ENABLE] !== 'true') throw fail();
  const url = String(env.SPEAKLAB_RATE_LIMIT_REST_URL || '').replace(/\/+$/u, '');
  const token = String(env.SPEAKLAB_RATE_LIMIT_REST_TOKEN || '');
  const secret = String(env.SPEAKLAB_SESSION_SECRET || '');
  if (!/^https:\/\/[^/?#]+$/iu.test(url) || !token.trim() || secret.length < 43) throw fail();
  return { url, token, secret };
}
export function learnerGroqGrantKey(userId, secret) {
  if (typeof userId !== 'string' || !/^[0-9]{5,64}$/u.test(userId) ||
      typeof secret !== 'string' || secret.length < 43) throw fail();
  const hash = createHmac('sha256', secret).update(userId).digest('hex');
  return 'speaklab:groq:student-consent:v1:' + hash;
}
export async function requireVerifiedLearnerGroqGrant({
  identity, env = process.env, fetcher = fetch, now = Date.now,
} = {}) {
  if (!identity || !/^[0-9]{5,64}$/u.test(identity.id || '') ||
      !['learner','teacher'].includes(identity.role)) throw fail();
  const { url, token, secret } = config(env);
  const key = learnerGroqGrantKey(identity.id, secret);
  let response, result;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', key]),
      signal: AbortSignal.timeout(4000),
    });
    if (!response?.ok) throw fail();
    result = await response.json();
  } catch { throw fail(); }
  if (!result || result.error || typeof result.result !== 'string' ||
      result.result.length > 2500) throw fail();
  let record;
  try { record = JSON.parse(result.result); } catch { throw fail(); }
  const current = now();
  if (!Number.isFinite(current) || !record || typeof record !== 'object' ||
      record.version !== VERSION ||
      record.provider !== 'groq' ||
      record.purpose !== 'student-presentation-text-review' ||
      record.status !== 'verified' ||
      record.guardianVerification !== 'verified-by-authorized-operator' ||
      record.operatorApproval !== 'approved' ||
      record.subjectRole !== identity.role ||
      record.studentSubjectHash !== key.slice(key.lastIndexOf(':') + 1) ||
      !Array.isArray(record.dataTypes) ||
      record.dataTypes.length !== 3 ||
      !['topic_and_goal','asr_transcript','slide_text'].every(v => record.dataTypes.includes(v)) ||
      typeof record.policyVersion !== 'string' ||
      !/^groq-student-[\w.-]{3,40}$/u.test(record.policyVersion) ||
      !Number.isSafeInteger(record.verifiedAt) ||
      !Number.isSafeInteger(record.expiresAt) ||
      record.verifiedAt > current || record.expiresAt <= current ||
      record.expiresAt - record.verifiedAt > MAX_GRANT_AGE_MS ||
      record.revokedAt != null ||
      typeof record.verificationReference !== 'string' ||
      !/^[A-Za-z0-9_-]{12,100}$/u.test(record.verificationReference)) throw fail();
  return { policyVersion: record.policyVersion };
}

/** Do not expose grant keys or sensitive consent records to the client. */
export function isStudentGroqReviewConfigured(env = process.env) {
  try { config(env); return true; } catch { return false; }
}
