import {
  lyricKey,
  placementLength,
  arrangePlacement,
  movePlacementStart,
  placementToLyrics,
} from './narrationLaneActions';

describe('lyricKey', () => {
  test('prefers id, then subtitle_id, then 1-based index', () => {
    expect(lyricKey({ id: 7 }, 0)).toBe(7);
    expect(lyricKey({ subtitle_id: 3 }, 0)).toBe(3);
    expect(lyricKey({}, 4)).toBe(5);
  });
});

describe('placementLength', () => {
  test('scales by 1/speed (faster = shorter), with a floor', () => {
    expect(placementLength(4, 1)).toBe(4);
    expect(placementLength(4, 2)).toBe(2);
    expect(placementLength(0, 1)).toBe(0.5); // fallback for missing duration
  });
});

describe('arrangePlacement', () => {
  const segments = [
    { id: 1, start: 0, audioDuration: 2 }, // 2s clip
    { id: 2, start: 1, audioDuration: 1 }, // overlaps clip 1
    { id: 3, start: 21, audioDuration: 0.5 },
  ];
  test('sequences clips with no overlap, preserving gaps and order', () => {
    expect(arrangePlacement(segments, 1)).toEqual({ 1: 0, 2: 2, 3: 21 });
  });
  test('accounts for speed (faster clips pack tighter)', () => {
    // clip 1 at 2x is 1s long, so clip 2 only needs to start at 1
    expect(arrangePlacement(segments, 2)[2]).toBe(1);
  });
});

describe('movePlacementStart', () => {
  test('shifts by delta, clamped at 0', () => {
    expect(movePlacementStart(2, 0.5)).toBe(2.5);
    expect(movePlacementStart(0.2, -5)).toBe(0);
  });
  test('snaps to a nearby target', () => {
    expect(movePlacementStart(2, 1.95, { snapTargets: [4] })).toBe(4); // 3.95 -> snaps to 4
    expect(movePlacementStart(2, 1.5, { snapTargets: [4] })).toBe(3.5); // 3.5 too far -> no snap
  });
});

describe('placementToLyrics', () => {
  const lyrics = [
    { id: 1, start: 0, end: 1, text: 'a' },
    { id: 2, start: 5, end: 6, text: 'b' },
  ];
  const segments = [
    { id: 1, start: 0, audioDuration: 2 },
    { id: 2, start: 5, audioDuration: 1.5 },
  ];

  test('writes each subtitle to [placementStart, start + clipLength]', () => {
    const out = placementToLyrics(lyrics, segments, { 1: 0, 2: 2 }, 1);
    expect(out.map((l) => [l.id, l.start, l.end])).toEqual([
      [1, 0, 2], // window grows to the 2s clip
      [2, 2, 3.5], // moved to its staged start, window = 1.5s clip
    ]);
  });
  test('falls back to the segment start when no placement override', () => {
    expect(placementToLyrics(lyrics, segments, null, 1)[1]).toMatchObject({ start: 5, end: 6.5 });
  });
  test('applies speed to the committed window', () => {
    expect(placementToLyrics(lyrics, segments, { 1: 0 }, 2)[0]).toMatchObject({ start: 0, end: 1 });
  });
});
