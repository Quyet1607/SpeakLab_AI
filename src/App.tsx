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
  PracticeSetupConfig
} from './types';
import {
  mockCurrentUser,
  mockPresentationDecks,
} from './data/mockData';
import { sessionService } from './services/sessionService';
import { reportService } from './services/reportService';
import { AppLayout } from './layouts/AppLayout';
import { refreshSession, subscribeSession, type SessionState } from './services/accountSession';

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
  const [sessions, setSessions] = useState<PracticeSession[]>(sessionService.getRecentSessions());

  // Setup configuration state retained in current session
  const [setupConfig, setSetupConfig] = useState<PracticeSetupConfig>({
    title: 'Bảo vệ Đề tài: Phân loại Rác Thông minh bằng AI',
    modeId: 'defense',
    deckId: 'deck_ai_waste',
    participantCount: 6,
    durationMinutes: 12,
  });

  // Calculate user profile stats dynamically from the actual sessions list
  const userProfile = useMemo(() => {
    const stats = sessionService.getUserStats();
    return {
      ...mockCurrentUser,
      ...(accountSession.status === 'signed_in' && accountSession.identity ? {
        fullName: accountSession.identity.name || 'Người dùng Google',
        avatarInitials: (accountSession.identity.name || 'GG').split(/\s+/).filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase(),
        roleDescription: accountSession.identity.role === 'teacher' ? 'Tài khoản Google (giáo viên)' : 'Tài khoản Google cá nhân',
        school: 'Hồ sơ luyện tập cá nhân',
        grade: 'Đã đăng nhập Google',
      } : {}),
      stats: {
        ...mockCurrentUser.stats,
        totalSessions: stats.totalSessions,
        totalPracticeMinutes: stats.totalPracticeMinutes,
        avgMinutesPerSession: stats.avgMinutesPerSession,
        totalReports: stats.totalReports,
      },
    };
  }, [sessions, accountSession]);

  // Active Session State
  const [currentSession, setCurrentSession] = useState<PracticeSession>(sessions[0]);
  const [currentDeck, setCurrentDeck] = useState<PresentationDeck>(mockPresentationDecks[0]);
  const [participants, setParticipants] = useState<VirtualParticipant[]>(() =>
    sessionService.getParticipantsForSession(6, 'defense')
  );
  const [selectedReportId, setSelectedReportId] = useState<string>('rep_01');

  // Handle starting a new simulated practice session
  const handleStartSession = (config: PracticeSetupConfig) => {
    // Save chosen config in state
    setSetupConfig(config);

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
    setSessions(sessionService.getRecentSessions());
    setActivePage('meeting_room');
  };

  // Replay an existing session
  const handleReplaySession = (session: PracticeSession) => {
    setSetupConfig({
      title: session.title,
      modeId: session.mode,
      deckId: 'deck_ai_waste',
      participantCount: session.participantCount,
      durationMinutes: Math.round(session.durationSeconds / 60),
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
          deck={currentDeck}
          participants={participants}
          onNavigate={(page) => setActivePage(page)}
          onFinishSession={() => {
            setSelectedReportId('rep_01');
            setActivePage('report');
          }}
        />
      )}

      {activePage === 'history' && (
        <HistoryPage
          sessions={sessions}
          onNavigate={(page) => setActivePage(page)}
          onSelectSessionForReport={handleSelectSessionForReport}
          onReplaySession={handleReplaySession}
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
