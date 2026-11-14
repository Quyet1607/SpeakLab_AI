import { describe, expect, test } from 'bun:test';
import { meetingTileLayout } from '../src/services/meetingGridCapture.ts';

describe('SpeakLab meeting gallery layout for one real user + mock avatars', () => {
  test('single user receives a tile', () => {
    expect(meetingTileLayout(1)).toEqual({ columns: 1, rows: 1 });
  });
  test('four people fit into an accessible grid', () => {
    const layout = meetingTileLayout(4);
    expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(4);
  });
  test('large simulated audiences do not exceed the tile maximum', () => {
    const layout = meetingTileLayout(16);
    expect(layout.columns).toBeLessThanOrEqual(5);
    expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(16);
  });
  test('invalid count safely clamps to one', () => {
    expect(meetingTileLayout(-1)).toEqual(meetingTileLayout(1));
    expect(meetingTileLayout(Number.NaN)).toEqual(meetingTileLayout(1));
  });
});
