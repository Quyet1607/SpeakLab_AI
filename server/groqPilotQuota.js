import { createHmac, randomUUID } from 'node:crypto';

/** Atomically reserve operator/day, system/day, system/minute and a concurrency lease. */
export const GROQ_PILOT_LIMITS = Object.freeze({ operatorDay: 3, systemDay: 12, systemMinute: 2, concurrent: 1 });
const LEASE_SECONDS = 45; // Groq timeout is 30s; a crashed process releases on expiry.
export const RESERVE_SCRIPT = [
  "local now = tonumber(ARGV[1])",
  "redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', now)",
  "if redis.call('ZCARD', KEYS[4]) >= tonumber(ARGV[6]) then return 4 end",
  "if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[3]) then return 1 end",
  "if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[4]) then return 2 end",
  "if tonumber(redis.call('GET', KEYS[3]) or '0') >= tonumber(ARGV[5]) then return 3 end",
  "redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 172800)",
  "redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], 172800)",
  "redis.call('INCR', KEYS[3]); redis.call('EXPIRE', KEYS[3], 120)",
  "redis.call('ZADD', KEYS[4], now + tonumber(ARGV[7]), ARGV[2])",
  "redis.call('EXPIRE', KEYS[4], tonumber(ARGV[7]) + 60)",
  "return 0",
].join('\n');
export const RELEASE_SCRIPT = "return redis.call('ZREM', KEYS[1], ARGV[1])";

const fail = (code, message, status = 503) => Object.assign(new Error(message), { code, status });
function credentials(env) {
  const url = String(env.SPEAKLAB_RATE_LIMIT_REST_URL || '').replace(/\/+$/u, '');
  const token = String(env.SPEAKLAB_RATE_LIMIT_REST_TOKEN || '');
  const secret = String(env.SPEAKLAB_SESSION_SECRET || '');
  if (!/^https:\/\/[^/?#]+$/iu.test(url) || !token.trim() || secret.length < 32) {
    throw fail('GROQ_QUOTA_UNAVAILABLE', 'Redis hoặc khóa bảo vệ định danh chưa cấu hình trên Preview.');
  }
  return { url, token, secret };
}
export function ensureGroqPilotQuotaConfigured(env = process.env) { credentials(env); }

export function quotaKeys(identity, at, secret) {
  if (typeof identity?.id !== 'string' || !identity.id) throw fail('GROQ_QUOTA_UNAVAILABLE', 'Không xác định được tài khoản vận hành.');
  if (!Number.isFinite(at)) throw fail('GROQ_QUOTA_UNAVAILABLE', 'Thời gian máy chủ không hợp lệ.');
  const iso = new Date(at).toISOString();
  const digest = createHmac('sha256', secret).update(identity.id).digest('hex').slice(0, 40);
  return [
    'speaklab:groq:pilot:operator:' + iso.slice(0, 10) + ':' + digest,
    'speaklab:groq:pilot:system:' + iso.slice(0, 10),
    'speaklab:groq:pilot:minute:' + iso.slice(0, 16),
    'speaklab:groq:pilot:leases',
  ];
}

async function evalRedis({ url, token, fetcher, script, keys, args }) {
  let response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', script, String(keys.length), ...keys, ...args.map(String)]),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    throw fail('GROQ_QUOTA_UNAVAILABLE', 'Không thể kết nối Redis để xác nhận hạn mức Groq.');
  }
  if (!response?.ok) throw fail('GROQ_QUOTA_UNAVAILABLE', 'Redis chưa sẵn sàng.');
  let data;
  try { data = await response.json(); } catch {
    throw fail('GROQ_QUOTA_UNAVAILABLE', 'Phản hồi Redis không hợp lệ.');
  }
  if (!data || data.error || !Number.isInteger(data.result)) {
    throw fail('GROQ_QUOTA_UNAVAILABLE', 'Redis không xác nhận được hạn mức.');
  }
  return data.result;
}

/** A granted reservation consumes the counters, even if the provider later fails. */
export async function reserveGroqPilotQuota({
  identity, env = process.env, fetcher = fetch, now = Date.now, idFactory = randomUUID,
} = {}) {
  const config = credentials(env);
  const at = now();
  const token = idFactory();
  if (typeof token !== 'string' || !/^[\w-]{8,100}$/u.test(token)) throw fail('GROQ_QUOTA_UNAVAILABLE', 'Mã lượt thử không hợp lệ.');
  const keys = quotaKeys(identity, at, config.secret);
  const code = await evalRedis({
    ...config, fetcher, script: RESERVE_SCRIPT, keys,
    args: [Math.floor(at / 1000), token,
      GROQ_PILOT_LIMITS.operatorDay, GROQ_PILOT_LIMITS.systemDay,
      GROQ_PILOT_LIMITS.systemMinute, GROQ_PILOT_LIMITS.concurrent, LEASE_SECONDS],
  });
  if (code !== 0) {
    const errors = {
      1: ['GROQ_OPERATOR_DAILY_LIMIT', 'Tài khoản vận hành đã hết lượt thử trong ngày UTC.'],
      2: ['GROQ_SYSTEM_DAILY_LIMIT', 'Groq Pilot đã hết hạn mức toàn hệ thống trong ngày UTC.'],
      3: ['GROQ_SYSTEM_MINUTE_LIMIT', 'Groq Pilot đã hết hạn mức toàn hệ thống trong phút hiện tại.'],
      4: ['GROQ_CONCURRENT_LIMIT', 'Đang có một lượt Groq chạy. Không gửi lượt đồng thời.'],
    };
    if (!errors[code]) throw fail('GROQ_QUOTA_UNAVAILABLE', 'Không xác định được trạng thái hạn mức.');
    throw fail(errors[code][0], errors[code][1], 429);
  }
  let released = false;
  return {
    async release() {
      if (released) return true;
      try {
        const result = await evalRedis({ ...config, fetcher, script: RELEASE_SCRIPT, keys: [keys[3]], args: [token] });
        released = true;
        return result === 1;
      } catch {
        // Fail closed: a stuck concurrency lease expires after 45 seconds.
        return false;
      }
    },
  };
}
