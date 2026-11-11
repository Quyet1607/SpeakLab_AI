/**
 * Phase 6.8.2: optional Google identity test. Independent of existing demo user.
 * No token is persisted in browser storage; cloud recording remains disabled.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, UserRound, AlertCircle, LoaderCircle } from 'lucide-react';
import { refreshSession, signInWithGoogleCredential, signOutAccount, subscribeSession, type AccountIdentity, type SessionState } from '../../services/accountSession';

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (args: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        auto_select: boolean;
        cancel_on_tap_outside: boolean;
      }) => void;
      renderButton: (element: HTMLElement, options: {
        theme: 'outline';
        size: 'large';
        shape: 'rectangular';
        text: 'signin_with';
        width: number;
      }) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

export const GoogleIdentityTest: React.FC = () => {
  const buttonRoot = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<SessionState>({ status: 'loading', identity: null });
  const identity: AccountIdentity | null = session.identity;
  const [feedback, setFeedback] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'verifying' | 'unavailable'>('loading');

  useEffect(() => {
    const unsubscribe = subscribeSession(setSession);
    void refreshSession();
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    let insertedScript: HTMLScriptElement | null = null;

    const handleCredential = async ({ credential }: { credential?: string }) => {
      if (!active) return;
      if (!credential) {
        setFeedback('Google chưa trả về thông tin đăng nhập.');
        return;
      }
      setPhase('verifying');
      setFeedback('');
      try {
        const message = await signInWithGoogleCredential(credential);
        if (active) setFeedback(message);
      } catch (error) {
        if (active) setFeedback(error instanceof Error ? error.message : 'Không thể đăng nhập.');
      } finally {
        if (active) setPhase('ready');
      }
    };

    const setup = async () => {
      try {
        const response = await fetch('/api/auth/config', { cache: 'no-store' });
        const config = await response.json() as { clientId?: string; googleSignInAvailable?: boolean };
        if (!active) return;
        if (!response.ok || !config.googleSignInAvailable || !config.clientId) {
          setPhase('unavailable');
          setFeedback('Google Sign-In chưa được cấu hình trong môi trường này.');
          return;
        }
        const render = () => {
          if (!active || !window.google || !buttonRoot.current) return;
          window.google.accounts.id.initialize({
            client_id: config.clientId!,
            callback: handleCredential,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          buttonRoot.current.replaceChildren();
          window.google.accounts.id.renderButton(buttonRoot.current, {
            theme: 'outline',
            size: 'large',
            shape: 'rectangular',
            text: 'signin_with',
            width: 250,
          });
          setPhase('ready');
        };
        if (window.google) {
          render();
        } else {
          insertedScript = document.createElement('script');
          insertedScript.src = 'https://accounts.google.com/gsi/client';
          insertedScript.async = true;
          insertedScript.defer = true;
          insertedScript.onload = render;
          insertedScript.onerror = () => {
            if (active) {
              setPhase('unavailable');
              setFeedback('Không tải được Google Sign-In. Kiểm tra kết nối hoặc tiện ích chặn nội dung.');
            }
          };
          document.head.appendChild(insertedScript);
        }
      } catch {
        if (active) {
          setPhase('unavailable');
          setFeedback('Không truy cập được cấu hình đăng nhập.');
        }
      }
    };

    void setup();
    return () => {
      active = false;
      if (insertedScript) insertedScript.remove();
    };
  }, []);

  return (
    <section className="p-4 md:p-5 rounded-xl border border-[#D9E5DC] bg-[#F7F9F6] space-y-3" aria-label="Kiểm thử xác thực Google">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#52785D]" />
        <h4 className="text-sm font-bold text-[#3D4740]">Xác thực Google (thử nghiệm)</h4>
      </div>
      <p className="text-xs text-[#5A655D] leading-relaxed">
        Đăng nhập Google để tạo phiên cá nhân an toàn trên máy chủ (hết hạn sau tối đa 8 giờ).
        Video vẫn nằm trên trình duyệt, chưa được bảo mật liên thiết bị và chưa đồng bộ Drive.
      </p>
      <div ref={buttonRoot} />
      {session.status === 'unavailable' && <p className="text-xs text-[#873631]">{session.error}</p>}
      {phase === 'loading' && <p className="text-xs text-[#768078]">Đang tải nút đăng nhập Google…</p>}
      {phase === 'verifying' && (
        <p className="text-xs text-[#52785D] flex items-center gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin" />Đang kiểm tra chữ ký Google…
        </p>
      )}
      {feedback && (
        <p role="status" className="text-xs text-[#3D4740] flex items-start gap-2">
          {identity ? <UserRound className="w-4 h-4 shrink-0 text-[#52785D]" /> :
            <AlertCircle className="w-4 h-4 shrink-0 text-[#8D6141]" />}
          {feedback}
        </p>
      )}
      {identity && (
        <div className="text-xs text-[#3D4740] border border-[#D9E5DC] bg-white p-3 rounded-lg">
          <p>Danh tính: <strong>{identity.name || 'Người dùng Google'}</strong></p>
          <p>Phiên đăng nhập: <strong>{identity.role === 'teacher' ? 'Giáo viên' : 'Tài khoản cá nhân'}</strong></p>
          <p className="mt-1 text-[#768078]">Video ghi mới có thể được gắn với tài khoản này trong trình duyệt; đây chưa phải kiểm soát truy cập bảo mật cho video cục bộ.</p>
          <button type="button" className="mt-3 text-[#873631] font-semibold underline cursor-pointer"
            onClick={() => void signOutAccount().then(() => setFeedback('Đã đăng xuất khỏi SpeakLab AI.')).catch(error => setFeedback(error instanceof Error ? error.message : 'Không thể đăng xuất.'))}>Đăng xuất</button>
        </div>
      )}
    </section>
  );
};
