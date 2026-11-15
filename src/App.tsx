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

  useEffect(() => {
    const unsubscribe = subscribeSession(setAccountSession);
    void refreshSession();
    return unsubscribe;
  }, []);

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [sessionOwnerSub, setSessionOwnerSub] = useState<string>('');

  useEffect(() => {
    if (accountSession.status === 'loading') return;
    setSessions(listCompletedPracticeSessions(accountSession.status === 'signed_in' && accountSession.identity?.id ? accountSession.identity.id : 'guest'));
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
      fullName: accountSession.identity?.name || 'Khách',
      avatarInitials: (accountSession.identity?.name || 'K').split(/\s+/).filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase(),
      roleDescription: accountSession.status === 'signed_in' ? (accountSession.identity?.role === 'teacher' ? 'Tài khoản Google (giáo viên)' : 'Tài khoản Google cá nhân') : 'Chế độ khách trên thiết bị',
      school: 'Hồ sơ luyện tập cá nhân',
      grade: accountSession.status === 'signed_in' ? 'Đã đăng nhập Google' : 'Chưa đăng nhập',
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
  const [selectedReportId, setSelectedReportId] = useState<string>('');

  // Handle starting a new simulated practice session
  const handleStartSession = (config: PracticeSetupConfig) => {
    const ownerSub = accountSession.status === 'signed_in' ? accountSession.identity?.id || 'guest' : 'guest';
    // Guest practice is saved locally; Google sessions keep their own owner label.
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
    const activeOwner = checked.status === 'signed_in' ? checked.identity?.id || null : 'guest';
    // Bind a completed session to the account which started the practice,
    // not another Google account that may have signed in midway.
    try {
      if (!sessionOwnerSub) throw new Error('Không xác định được phiên luyện tập.');
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
        ? 'Buổi luyện đã lưu dưới chế độ tài khoản khi bắt đầu. Chuyển về đúng chế độ để xem trong lịch sử.'
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

  // Only a real local completed session can be selected. Never fall back to rep_01.
  const handleSelectSessionForReport = (sessionId: string) => {
    const session = sessions.find(item => item.id === sessionId);
    setSelectedReportId(session?.reportId || '');
  };

  const currentReport = reportService.getReportById(selectedReportId);

  if (accountSession.status === 'loading') {
    return <main className="min-h-screen flex items-center justify-center text-[#324C3B]" role="status">Đang kiểm tra phiên đăng nhập…</main>;
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
            const owner = accountSession.status === 'signed_in' ? accountSession.identity?.id || 'guest' : 'guest';
            setSessions(listCompletedPracticeSessions(owner));
          }}
        />
      )}

      {activePage === 'report' && (currentReport ? (
        <ReportPage
          report={currentReport}
          onNavigate={(page) => setActivePage(page)}
          onPracticeAgain={() => setActivePage('practice_setup')}
        />
      ) : (
        <section className="rounded-xl bg-white border border-[#D9E5DC] p-6 space-y-3" role="status">
          <h2 className="text-lg font-bold text-[#324C3B]">Chưa có báo cáo đánh giá</h2>
          <p className="text-sm text-[#65786A]">Không tìm thấy báo cáo đánh giá thực tế cho buổi luyện này. Hệ thống không hiển thị điểm và nhận xét Demo thay thế.</p>
          <button type="button" onClick={() => setActivePage('history')} className="rounded-lg border border-[#BFD4C2] px-3 py-2 text-sm font-semibold text-[#324C3B]">Quay lại Lịch sử</button>
        </section>
      ))}

      {activePage === 'settings' && (
        <SettingsPage currentUser={userProfile} />
      )}
    </AppLayout>
  );
}
