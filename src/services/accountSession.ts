/**
 * Session identity in memory only. Credential is never stored in localStorage.
 * This state is a convenience for UI, never a security boundary.
 * All future Drive APIs must independently verify server cookies and file owner.
 */
export type AccountIdentity = { id: string; name: string; role: 'teacher' | 'learner' };
export type SessionState = {
  status: 'loading' | 'signed_in' | 'signed_out' | 'unavailable';
  identity: AccountIdentity | null;
  error?: string;
};

const initial: SessionState = { status: 'loading', identity: null };
let current: SessionState = initial;
const listeners = new Set<(state: SessionState) => void>();
let pending: Promise<SessionState> | null = null;

export function getCurrentSession(): SessionState { return current; }

function publish(next: SessionState) {
  current = next;
  listeners.forEach(listener => listener(next));
  return current;
}

export function subscribeSession(listener: (state: SessionState) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}

export async function refreshSession(): Promise<SessionState> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET', cache: 'no-store', credentials: 'same-origin',
      });
      const data = await response.json() as {
        authenticated?: boolean;
        identity?: AccountIdentity | null;
        error?: string;
      };
      if (!response.ok) return publish({
        status: 'unavailable', identity: null,
        error: data.error || 'Chưa thể kiểm tra phiên đăng nhập.',
      });
      return publish({
        status: data.authenticated && data.identity ? 'signed_in' : 'signed_out',
        identity: data.authenticated ? (data.identity || null) : null,
      });
    } catch {
      return publish({ status: 'unavailable', identity: null, error: 'Không thể kết nối dịch vụ đăng nhập.' });
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export async function signInWithGoogleCredential(credential: string) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', cache: 'no-store',
    body: JSON.stringify({ credential }),
  });
  const data = await response.json() as {
    authenticated?: boolean; identity?: AccountIdentity; error?: string; message?: string;
  };
  if (!response.ok || !data.authenticated || !data.identity) {
    throw new Error(data.error || 'Không thể xác thực tài khoản Google.');
  }
  publish({ status: 'signed_in', identity: data.identity });
  return data.message || 'Đăng nhập thành công.';
}

export async function signOutAccount() {
  const response = await fetch('/api/auth/session', {
    method: 'DELETE', credentials: 'same-origin', cache: 'no-store',
  });
  if (!response.ok) throw new Error('Không thể đăng xuất. Vui lòng thử lại.');
  publish({ status: 'signed_out', identity: null });
}
