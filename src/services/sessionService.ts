/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PracticeSession, PracticeMode, PresentationDeck, VirtualParticipant, PracticeModeType } from '../types';
import {
  mockPracticeSessions,
  mockPracticeModes,
  mockPresentationDecks,
  generateVirtualParticipants,
} from '../data/mockData';

class SessionService {
  private sessions: PracticeSession[] = [...mockPracticeSessions];

  /**
   * Lấy danh sách các chế độ luyện tập có sẵn
   */
  getAvailableModes(): PracticeMode[] {
    return mockPracticeModes;
  }

  /**
   * Lấy danh sách các bài trình chiếu mẫu
   */
  getAvailableDecks(): PresentationDeck[] {
    return mockPresentationDecks;
  }

  /**
   * Lấy danh sách lịch sử các buổi luyện tập
   */
  getRecentSessions(): PracticeSession[] {
    return [...this.sessions];
  }

  /**
   * Tính toán các chỉ số thống kê toán học chính xác từ danh sách phiên
   */
  getUserStats() {
    const totalSessions = this.sessions.length;
    const totalSeconds = this.sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    const avgMinutesPerSession = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
    const totalReports = this.sessions.filter((s) => !!s.reportId).length;

    return {
      totalSessions,
      totalPracticeMinutes: totalMinutes,
      avgMinutesPerSession,
      totalReports,
      improvementPercentage: 32, // Chỉ số minh họa
    };
  }

  /**
   * Lấy danh sách người tham dự mô phỏng chính xác theo số lượng và chế độ
   */
  getParticipantsForSession(count: number, mode: PracticeModeType): VirtualParticipant[] {
    return generateVirtualParticipants(count, mode);
  }

  /**
   * Tìm buổi luyện tập theo ID
   */
  getSessionById(id: string): PracticeSession | undefined {
    return this.sessions.find((s) => s.id === id);
  }

  /**
   * Tạo phiên luyện tập mới (mô phỏng)
   */
  createSession(params: {
    title: string;
    modeId: PracticeModeType;
    deckId: string;
    participantCount: number;
    durationMinutes: number;
    presentationSource?: import('../types').PresentationSource;
  }): PracticeSession {
    const mode = mockPracticeModes.find((m) => m.id === params.modeId) || mockPracticeModes[0];
    const deck = mockPresentationDecks.find((d) => d.id === params.deckId) || mockPresentationDecks[0];

    const isPptx = params.presentationSource?.type === 'pptx';
    const hasNoSlides = !params.presentationSource || params.presentationSource.type === 'none';
    const slideCount = hasNoSlides ? 0 : isPptx && params.presentationSource
      ? params.presentationSource.slideCount : deck.slides.length;
    const topic = hasNoSlides ? 'Luyện thuyết trình và phản biện không trình chiếu' : isPptx
      ? 'PowerPoint cá nhân' : deck.category;

    const newSession: PracticeSession = {
      id: `ses_${Date.now()}`,
      title: params.title.trim() || `Buổi luyện: ${mode.title}`,
      mode: params.modeId,
      modeTitle: mode.title,
      topic,
      durationSeconds: params.durationMinutes * 60,
      slideCount,
      participantCount: params.participantCount,
      createdAt: 'Vừa xong',
      status: 'in_progress',
      score: undefined,
      reportId: undefined, // No pretend AI evaluation for real practice
      presentationSource: params.presentationSource,
    };

    this.sessions.unshift(newSession);
    return newSession;
  }
}

export const sessionService = new SessionService();
