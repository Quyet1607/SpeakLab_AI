/**
 * One-time startup cleanup for the retired guest mode.
 * Only unowned/null-owner device records are removed. Google-owned records remain.
 */
import { clearGuestPracticeHistory } from './localPracticeHistory';
import { clearGuestLocalReviewSlides } from './localReviewSlideLibrary';
import { clearGuestLocalTranscripts } from './localTranscriptLibrary';
import { clearGuestLocalVideos } from './localVideoLibrary';
import { clearGuestLocalAiReviews } from './localAiReviewLibrary';

export type GuestCleanupResult = {
  practiceSessions: number;
  slideTextRecords: number;
  transcripts: number;
  videos: number;
  aiReviews: number;
};

export async function clearGuestLocalData(): Promise<GuestCleanupResult> {
  const practiceSessions = clearGuestPracticeHistory();
  const slideTextRecords = clearGuestLocalReviewSlides();
  const transcripts = clearGuestLocalTranscripts();
  const aiReviews = clearGuestLocalAiReviews();
  const videos = await clearGuestLocalVideos();
  return { practiceSessions, slideTextRecords, transcripts, videos, aiReviews };
}
