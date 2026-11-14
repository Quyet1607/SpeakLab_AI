/**
 * Google account control for the application header.
 * Sign-in is Google-only; there is no separate SpeakLab registration flow.
 * Credentials are exchanged with the server and never persisted in browser storage.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock, Award, LogOut, LoaderCircle, AlertCircle, UserRound } from 'lucide-react';
import { refreshSession, signInWithGoogleCredential, signOutAccount, subscribeSession, type AccountIdentity, type SessionState } from '../../services/accountSession';
import type { UserProfile } from '../../types';

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

interface GoogleAccountControlProps {
  currentUser: UserProfile;
}

export const GoogleAccountControl: React.FC<GoogleAccountControlProps> = ({ currentUser }) => {
  const buttonRoot = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<SessionState>({ status: 'loading', identity: null });
  const [phase, setPhase] = useState<'loading' | 'ready' | 'verifying' | 'unavailable'>('loading');
  const [feedback, setFeedback] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const identity: AccountIdentity | null = session.identity;

  useEffect(() => {
    const unsubscribe = subscribeSession(setSession);
    void refreshSession();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (session.status === 'loading' || session.status === 'signed_in') return;

    let active = true;
    let insertedScript: HTMLScriptElement | null = null;

    const handleCredential = async ({ credential }: { credential?: string }) => {
      if (!active) return;
      if (!credential) {
        setFeedback('Google chưa trả về thông tin đăng nhập. Vui lòng thử lại.');
        return;
      }
      setPhase('verifying');
      setFeedback('');
      try {
        const message = await signInWithGoogleCredential(credential);
        if (active) setFeedback(message);
      } catch (error) {
        if (active) setFeedback(error instanceof Error ? error.message : 'Không thể đăng nhập bằng Google.');
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
          setFeedback('Đăng nhập Google chưa được cấu hình trong môi trường này.');
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
            width: 210,
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
              setFeedback('Không tải được dịch vụ đăng nhập Google. Vui lòng kiểm tra kết nối.');
            }
          };
          document.head.appendChild(insertedScript);
        }
      } catch {
        if (active) {
          setPhase('unavailable');
          setFeedback('Không truy cập được cấu hình đăng nhập Google.');
        }
      }
    };

    void setup();
    return () => {
      active = false;
      if (insertedScript?.parentNode) insertedScript.remove();
    };
  }, [session.status]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setFeedback('');
    try {
      await signOutAccount();
      setShowMenu(false);
      setFeedback('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setSigningOut(false);
    }
  };

  if (session.status === 'loading') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 text-xs text-[#768078]" aria-live="polite">
        <LoaderCircle className="w-4 h-4 animate-spin" />
        Đang kiểm tra tài khoản…
      </div>
    );
  }

  if (session.status !== 'signed_in' || !identity) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div ref={buttonRoot} className="min-h-10 flex items-center justify-end" aria-label="Đăng nhập bằng Google" />
        {phase === 'loading' && <span className="text-[10px] text-[#768078]">Đang tải đăng nhập Google…</span>}
        {phase === 'verifying' && (
          <span className="text-[10px] text-[#52785D] flex items-center gap-1" role="status">
            <LoaderCircle className="w-3 h-3 animate-spin" />Đang xác minh tài khoản…
          </span>
        )}
        {(phase === 'unavailable' || feedback) && (
          <span className="max-w-56 text-right text-[10px] text-[#873631] flex items-start gap-1" role="status">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />{feedback || 'Đăng nhập Google hiện không khả dụng.'}
          </span>
        )}
      </div>
    );
  }

  const displayName = currentUser.fullName && currentUser.fullName !== 'Người luyện tập (khách)'
    ? currentUser.fullName
    : identity.name || 'Tài khoản Google';
  const initials = currentUser.fullName !== 'Người luyện tập (khách)' && currentUser.avatarInitials
    ? currentUser.avatarInitials
    : displayName.split(/\s+/).filter(Boolean).map(part => part[0]).slice(-2).join('').toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(value => !value)}
        className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-[#F7F9F6] transition-colors border border-transparent hover:border-[#E4E9E3] cursor-pointer"
        aria-expanded={showMenu}
        aria-label="Mở menu tài khoản"
      >
        <div className="w-8 h-8 rounded-lg bg-[#EEF4F0] border border-[#D9E5DC] text-[#324C3B] flex items-center justify-center font-bold text-xs shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left pr-1 max-w-36">
          <p className="text-xs font-semibold text-[#3D4740] leading-tight truncate">{displayName}</p>
          <p className="text-[11px] text-[#768078] leading-tight">Đã đăng nhập Google</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#768078] hidden sm:block" />
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-[#E4E9E3] shadow-lg p-3 z-50 animate-in fade-in zoom-in-95">
          <div className="pb-3 border-b border-[#E4E9E3]">
            <p className="text-sm font-semibold text-[#3D4740]">{displayName}</p>
            <p className="text-xs text-[#768078] mt-0.5">Tài khoản Google · {identity.role === 'teacher' ? 'Giáo viên' : 'Người luyện tập'}</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#4A6453] bg-[#EEF4F0] px-2 py-1 rounded border border-[#D9E5DC]">
              <UserRound className="w-3.5 h-3.5" />
              <span>Phiên đăng nhập đang hoạt động</span>
            </div>
          </div>
          <div className="py-2 space-y-1.5 text-xs text-[#556057]">
            <div className="flex items-center justify-between py-1">
              <span className="flex items-center gap-1.5 text-[#768078]">
                <Clock className="w-3.5 h-3.5" /> Thời gian luyện
              </span>
              <span className="font-medium text-[#3D4740]">
                {Math.round(currentUser.stats.totalPracticeMinutes / 60)}h {currentUser.stats.totalPracticeMinutes % 60}m
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="flex items-center gap-1.5 text-[#768078]">
                <Award className="w-3.5 h-3.5" /> Số buổi luyện
              </span>
              <span className="font-medium text-[#3D4740]">{currentUser.stats.totalSessions}</span>
            </div>
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="w-full mt-1 flex items-center justify-center gap-2 rounded-lg border border-[#E4E9E3] px-3 py-2 text-xs font-semibold text-[#873631] hover:bg-[#FFF7F6] disabled:opacity-60"
          >
            {signingOut ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      )}
    </div>
  );
};
