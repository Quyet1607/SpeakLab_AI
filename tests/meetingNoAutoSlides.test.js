import { describe, expect, test } from 'bun:test';
import { sessionService } from '../src/services/sessionService.ts';

describe('practice enters meeting without forced example PowerPoint', () => {
  test('explicit no presentation creates an empty gallery-style meeting', () => {
    const session = sessionService.createSession({
      title: 'Luyện trình bày',
      modeId: 'basic',
      deckId: 'deck_ai_waste',
      durationMinutes: 5,
      participantCount: 3,
      presentationSource: { type: 'none', name: 'Không trình chiếu', slideCount: 0, status: 'ready' },
    });
    expect(session.slideCount).toBe(0);
    expect(session.presentationSource?.type).toBe('none');
    expect(session.reportId).toBeUndefined();
    expect(session.topic).toContain('không trình chiếu');
  });

  test('even missing optional source never adds mock slides automatically', () => {
    const session = sessionService.createSession({
      title: 'Nói tự do',
      modeId: 'debate',
      deckId: 'deck_ai_waste',
      durationMinutes: 10,
      participantCount: 6,
    });
    expect(session.slideCount).toBe(0);
    expect(session.presentationSource).toBeUndefined();
  });
});
