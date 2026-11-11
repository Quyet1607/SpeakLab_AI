/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PracticeModeType = 'basic' | 'defense' | 'debate';

export interface PracticeMode {
  id: PracticeModeType;
  title: string;
  tagline: string;
  description: string;
  defaultDurationMinutes: number;
  juryCount: number;
  audienceCount: number;
  difficulty: 'Cơ bản' | 'Nâng cao' | 'Chuyên sâu';
  highlightFeatures: string[];
}

export type ParticipantRole = 'judge' | 'audience' | 'moderator';

export type ParticipantStatus = 
  | 'listening'        // Đang chăm chú nghe
  | 'taking_notes'     // Đang ghi chép nhận xét
  | 'analyzing'        // Đang phân tích luận điểm
  | 'preparing_question' // Chuẩn bị đặt câu hỏi phản biện
  | 'agreeing';        // Thể hiện đồng tình / gật đầu

export interface VirtualParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  title: string;          // Ví dụ: "Giám khảo Chuyên môn", "Hội đồng Phản biện", "Thính giả Học sinh"
  avatarInitials: string;
  avatarBg: string;
  status: ParticipantStatus;
  statusText: string;
  isMuted: boolean;
  isSpeaking: boolean;
  feedbackNote?: string;
}

export interface PresentationSlide {
  id: string;
  slideNumber: number;
  title: string;
  subtitle?: string;
  contentPoints: string[];
  keyHighlight?: string;
  speakerNotes: string;
  visualGraphicType?: 'chart' | 'process' | 'comparison' | 'conclusion';
}

export interface PresentationDeck {
  id: string;
  title: string;
  category: string;
  description: string;
  slides: PresentationSlide[];
}

export interface PptxDocumentInfo {
  file: File;
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  slideCount: number;
  parsedAt: string;
  status: 'valid' | 'invalid';
}

export type PresentationSourceType = 'demo' | 'pptx' | 'screenShare';

export interface PresentationSource {
  type: PresentationSourceType;
  deckId?: string;
  pptxInfo?: PptxDocumentInfo;
  name: string;
  slideCount: number;
  status: 'ready' | 'validating' | 'error';
  error?: string;
  stream?: MediaStream;
}

export interface PracticeSession {
  id: string;
  title: string;
  mode: PracticeModeType;
  modeTitle: string;
  topic: string;
  durationSeconds: number;
  slideCount: number;
  participantCount: number;
  createdAt: string;
  status: 'completed' | 'in_progress' | 'draft';
  score?: number;
  reportId?: string;
  presentationSource?: PresentationSource;
}

export interface EvaluationTimelineEvent {
  timeInSeconds: number;
  timeFormatted: string;
  type: 'positive' | 'warning' | 'question' | 'slide_change';
  title: string;
  description: string;
  slideNumber?: number;
}

export interface EvaluationReport {
  id: string;
  sessionId: string;
  sessionTitle: string;
  modeTitle: string;
  dateFormatted: string;
  durationFormatted: string;
  overallScore: number; // 0 - 10
  metrics: {
    speechPaceWpm: number;        // Words per minute (target 110-140)
    fillerWordsCount: number;     // e.g. "à, ừm, thì là"
    eyeContactPercentage: number; // Eye contact ratio
    clarityScore: number;         // 0 - 10
    structureScore: number;       // 0 - 10
    defenseScore: number;         // 0 - 10
  };
  speechPaceTrend: { time: string; wpm: number; status: 'good' | 'fast' | 'slow' }[];
  fillerWordBreakdown: { word: string; count: number }[];
  timelineEvents: EvaluationTimelineEvent[];
  strengths: string[];
  improvements: string[];
  juryFeedback: {
    judgeName: string;
    judgeTitle: string;
    comment: string;
    score: number;
  }[];
}

export interface UserProfile {
  id: string;
  fullName: string;
  roleDescription: string;
  school: string;
  grade: string;
  avatarInitials: string;
  stats: {
    totalSessions: number;
    totalPracticeMinutes: number;
    avgMinutesPerSession: number;
    totalReports: number;
    improvementPercentage: number;
  };
}

export interface PracticeSetupConfig {
  title: string;
  modeId: PracticeModeType;
  deckId: string;
  participantCount: number;
  durationMinutes: number;
  presentationSource?: PresentationSource;
}

export type ActivePage = 
  | 'dashboard'
  | 'practice_setup'
  | 'meeting_room'
  | 'history'
  | 'report'
  | 'settings'
  | 'classes';
