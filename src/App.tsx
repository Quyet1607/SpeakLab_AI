/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ActivePage,
  PracticeSession,
  PresentationDeck,
  VirtualParticipant,
  PracticeSetupConfig,
  type SpeechTranscriptSegment
} from './types';
import {
  mockCurrentUser,
  mockPresentationDecks,
} from './data/mockData';
import { sessionService } from './services/sessionService';
import { reportService } from './services/reportService';
import { AppLayout } from './layouts/AppLayout';
import { refreshSession, subscribeSession, type SessionState } from './services/accountSession';
import { listCompletedPracticeSessions, saveCompletedPracticeSession } from './services/localPracticeHistory';
import { extractPptxTextForReview } from './services/pptxReviewText';
import { saveLocalReviewSlides } from './services/localReviewSlideLibrary';
import { clearGuestLocalData } from './services/guestDataCleanup';
import { GoogleAccountControl } from './components/auth/GoogleAccountControl';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { PracticeSetupPage } from './pages/PracticeSetupPage';
import { MeetingRoomPage } from './pages/MeetingRoomPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReportPage } from './pages/ReportPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [accountSession, setAccountSession] = useState<SessionState>({ status: 'loading', identity: null });
  const [guestCleanupStatus, setGuestCleanupStatus] = useState<'pending' | 'complete' | 'failed'>('pending');
  const [guestCleanupError, setGuestCleanupError] = useState<string | null>(null);
  const [guestCleanupRetry, setGuestCleanupRetry] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeSession(setAccountSession);
    void refreshSession();
    return unsubscribe;
  }, []);

  // Do not mount any application page until legacy guest data has been removed.
  useEffect(() => {
    if (accountSession.status !== 'signed_in' && accountSession.status !== 'signed_out') return;
    let active = true;
    setGuestCleanupStatus('pending');
    setGuestCleanupError(null);
    void clearGuestLocalData()
      .then(() => {
        if (active) setGuestCleanupStatus('complete');
      })
      .catch(error => {
        if (!active) return;
        setGuestCleanupError(error instanceof Error ? error.message : 'Không thể xóa dữ liệu khách trên thiết bị.');
        setGuestCleanupStatus('failed');
      });
    return () => { active = false; };
  }, [accountSession.status, guestCleanupRetry]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [sessionOwnerSub, setSessionOwnerSub] = useState<string>('');

  useEffect(() => {
    if (accountSession.status !== 'signed_in' || !accountSession.identity?.id) {
      setSessions([]);
      return;
    }
    setSessions(listCompletedPracticeSessions(accountSession.identity.id));
  }, [accountSession]);

  // Setup configuration state retained in current session
  const [setupConfig, setSetupConfig] = useState<PracticeSetupConfig>({
    title: 'Buổi luyện thuyết trình của tôi',
    modeId: 'defense',
    deckId: 'deck_ai_waste',
    participantCount: 6,
    durationMinutes: 12,
  });

  // Calculate user profile stats dynamically from the actual sessions list
  const userProfile = useMemo(() => {
    const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    const stats = {
      totalSessions: sessions.length,
      totalPracticeMinutes: totalMinutes,
      avgMinutesPerSession: sessions.length ? Math.round(totalMinutes / sessions.length) : 0,
      totalReports: 0,
      improvementPercentage: 0,
    };
    return {
      ...mockCurrentUser,
      fullName: accountSession.identity?.name || 'Tài khoản Google',
      avatarInitials: (accountSession.identity?.name || 'GG').split(/\s+/).filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase(),
      roleDescription: accountSession.identity?.role === 'teacher' ? 'Tài khoản Google (giáo viên)' : 'Tài khoản Google cá nhân',
      school: 'Hồ sơ luyện tập cá nhân',
      grade: 'Đã đăng nhập Google',
      stats: {
        ...mockCurrentUser.stats,
        totalSessions: stats.totalSessions,
        totalPracticeMinutes: stats.totalPracticeMinutes,
        avgMinutesPerSession: stats.avgMinutesPerSession,
        totalReports: stats.totalReports,
        improvementPercentage: 0,
      },
    };
  }, [sessions, accountSession]);

  // Active Session State
  const [currentSession, setCurrentSession] = useState<PracticeSession>(() => sessionService.getRecentSessions()[0]);
  const [currentDeck, setCurrentDeck] = useState<PresentationDeck>(mockPresentationDecks[0]);
  const [participants, setParticipants] = useState<VirtualParticipant[]>(() =>
    sessionService.getParticipantsForSession(6, 'defense')
  );
  const [selectedReportId, setSelectedReportId] = useState<string>('rep_01');

  // Handle starting a new simulated practice session
  const handleStartSession = (config: PracticeSetupConfig) => {
    const ownerSub = accountSession.status === 'signed_in' ? accountSession.identity?.id : null;
    if (!ownerSub) return;
    // Save chosen config only for a verified Google account.
    setSetupConfig(config);
    setSessionOwnerSub(ownerSub);
    setHistoryNotice(null);

    const newSession = sessionService.createSession(config);
    const deck =
      mockPresentationDecks.find((d) => d.id === config.deckId) ||
      mockPresentationDecks[0];

    // Generate EXACT number of virtual participants requested
    const activeParticipants = sessionService.getParticipantsForSession(
      config.participantCount,
      config.modeId
    );

    setCurrentSession(newSession);
    setCurrentDeck(deck);
    setParticipants(activeParticipants);
    setActivePage('meeting_room');
  };

  const handleFinishSession = async (actualSeconds: number, destination: 'report' | 'dashboard', transcript: SpeechTranscriptSegment[]) => {
    const checked = await refreshSession();
    const activeOwner = checked.status === 'signed_in' ? checked.identity?.id || null : null;
    // Bind a completed session to the account which started the practice,
    // not another Google account that may have signed in midway.
    try {
      if (!sessionOwnerSub) throw new Error('Vui lòng đăng nhập Google để lưu buổi luyện.');
      saveCompletedPracticeSession({ ...currentSession, transcriptSegments: transcript }, actualSeconds, sessionOwnerSub);
      // Preserve slide TEXT for this completed session only (not the PPTX file).
      // Never block recording history if slide extraction is unavailable.
      let slideNotice = '';
      const pptx = currentSession.presentationSource;
      if (pptx?.type === 'pptx' && pptx.pptxInfo?.file) {
        try {
          const slideText = await extractPptxTextForReview(pptx.pptxInfo.file);
          if (!saveLocalReviewSlides(currentSession.id, sessionOwnerSub, slideText)) {
            slideNotice = ' PPTX không chứa chữ đọc được; phân tích vẫn sử dụng TXT.';
          }
        } catch {
          slideNotice = ' Chưa đọc được PPTX; bạn có thể chọn lại khi phân tích tại Lịch sử.';
        }
      }
      setSessions(listCompletedPracticeSessions(sessionOwnerSub));
      setHistoryNotice(sessionOwnerSub !== activeOwner
        ? 'Buổi luyện đã lưu dưới tài khoản khi bắt đầu. Đăng nhập lại đúng tài khoản đó để xem trong lịch sử.'
        : destination === 'report'
          ? 'Đã lưu buổi luyện thực tế. Có thể nhận xét AI từ bản ghi tại Lịch sử.' + slideNotice
          : slideNotice || null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không lưu được lịch sử buổi luyện.');
    }
    setActivePage(destination === 'report' ? 'history' : 'dashboard');
  };

  // Replay an existing session
  const handleReplaySession = (session: PracticeSession) => {
    setSetupConfig({
      title: session.title,
      topicTitle: session.topic,
      topicDescription: session.topicDescription || '',
      speakingGoal: session.speakingGoal || '',
      modeId: session.mode,
      deckId: 'deck_ai_waste',
      participantCount: session.participantCount,
      durationMinutes: Math.max(1, Math.round(session.durationSeconds / 60)),
    });
    setCurrentSession(session);
    setActivePage('practice_setup');
  };

  // Select a session to view report
  const handleSelectSessionForReport = (sessionId: string) => {
    const session = sessionService.getSessionById(sessionId);
    if (session && session.reportId) {
      setSelectedReportId(session.reportId);
    } else {
      setSelectedReportId('rep_01');
    }
  };

  const currentReport = reportService.getReportById(selectedReportId);

  if (accountSession.status !== 'signed_in' || !accountSession.identity || guestCleanupStatus !== 'complete') {
    const checkingSession = accountSession.status === 'loading';
    const cleaningGuestData = guestCleanupStatus === 'pending' &&
      (accountSession.status === 'signed_in' || accountSession.status === 'signed_out');
    return (
      <main className="min-h-screen bg-[#F7F9F6] flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-md bg-white border border-[#E4E9E3] rounded-2xl shadow-sm p-7 md:p-9 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EEF4F0] text-[#324C3B] flex items-center justify-center text-2xl font-bold">S</div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#324C3B]">SpeakLab AI</h1>
            <p className="text-sm text-[#556057]">Đăng nhập bằng tài khoản Google để tiếp tục sử dụng hệ thống.</p>
            <p className="text-xs text-[#768078]">SpeakLab AI không hỗ trợ tài khoản khách.</p>
          </div>
          {checkingSession && <p className="text-xs text-[#768078]" role="status">Đang kiểm tra phiên đăng nhập…</p>}
          {cleaningGuestData && <p className="text-xs text-[#52785D]" role="status">Đang xóa lịch sử, video và dữ liệu phụ trợ của chế độ khách trên thiết bị…</p>}
          {guestCleanupStatus === 'failed' && (
            <div className="space-y-3" role="alert">
              <p className="text-xs text-[#873631]">{guestCleanupError || 'Không thể dọn dữ liệu khách.'}</p>
              <button
                type="button"
                onClick={() => setGuestCleanupRetry(value => value + 1)}
                className="px-4 py-2 rounded-lg border border-[#D9E5DC] text-xs font-semibold text-[#324C3B] hover:bg-[#F7F9F6]"
              >
                Thử dọn dữ liệu lại
              </button>
            </div>
          )}
          <div className="flex justify-center">
            <GoogleAccountControl currentUser={userProfile} />
          </div>
          {accountSession.status === 'unavailable' && (
            <p className="text-xs text-[#873631]" role="status">
              Chưa xác minh được phiên đăng nhập. Hãy kiểm tra kết nối và thử đăng nhập Google lại.
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <AppLayout
      activePage={activePage}
      onNavigate={(page) => setActivePage(page)}
      currentUser={userProfile}
      sessionCount={sessions.length}
    >
      {activePage === 'dashboard' && (
        <DashboardPage
          currentUser={userProfile}
          recentSessions={sessions}
          onNavigate={(page) => setActivePage(page)}
          onSelectSessionForReport={handleSelectSessionForReport}
        />
      )}

      {activePage === 'practice_setup' && (
        <PracticeSetupPage
          availableModes={sessionService.getAvailableModes()}
          availableDecks={sessionService.getAvailableDecks()}
          initialConfig={setupConfig}
          onConfigChange={setSetupConfig}
          onStartSession={handleStartSession}
          onCancel={() => setActivePage('dashboard')}
        />
      )}

      {activePage === 'meeting_room' && (
        <MeetingRoomPage
          currentUser={userProfile}
          session={currentSession}
          sessionOwnerSub={sessionOwnerSub}
          deck={currentDeck}
          participants={participants}
          onNavigate={(page) => setActivePage(page)}
          onFinishSession={(seconds, destination, transcript) => { void handleFinishSession(seconds, destination, transcript); }}
        />
      )}

      {activePage === 'history' && (
        <HistoryPage
          sessions={sessions}
          notice={historyNotice}
          onNavigate={(page) => setActivePage(page)}
          onSelectSessionForReport={handleSelectSessionForReport}
          onReplaySession={handleReplaySession}
          onTranscriptDeleted={() => {
            const owner = accountSession.status === 'signed_in' ? accountSession.identity?.id : null;
            setSessions(owner ? listCompletedPracticeSessions(owner) : []);
          }}
        />
      )}

      {activePage === 'report' && (
        <ReportPage
          report={currentReport}
          onNavigate={(page) => setActivePage(page)}
          onPracticeAgain={() => setActivePage('practice_setup')}
        />
      )}

      {activePage === 'settings' && (
        <SettingsPage currentUser={userProfile} />
      )}
    </AppLayout>
  );
}
