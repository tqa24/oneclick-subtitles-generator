import {
  lyricKey,
  placementLength,
  effectiveSpeed,
  resolvePlacements,
  arrangePlacement,
  computeAutoSpeed,
  movePlacementStart,
  placementToLyrics,
  ACCEPTABLE_OVERLAP,
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

describe('effectiveSpeed', () => {
  test('returns the global speed when weight is 0 (uniform)', () => {
    expect(effectiveSpeed(2, 1, 1.2, 0)).toBe(1.2);
  });
  test('does not change a clip that already fits its slot (speed-up only)', () => {
    expect(effectiveSpeed(1, 5, 1, 0.5)).toBe(1); // needs 0.2x, already fits
    expect(effectiveSpeed(1, 5, 2, 0.5)).toBe(2); // never slows below global
  });
  test('blends toward the exact-fit speed by the weight', () => {
    // needs 2x to fit; weight 0.5 -> halfway from 1.0 to 2.0
    expect(effectiveSpeed(2, 1, 1, 0.5)).toBeCloseTo(1.5, 5);
  });
  test('clamps the per-line speed-up', () => {
    expect(effectiveSpeed(10, 1, 1, 1, 1.6)).toBe(1.6);
  });
});

describe('resolvePlacements', () => {
  const segments = [
    { id: 1, start: 0, audioDuration: 2 },
    { id: 2, start: 1, audioDuration: 1 },
  ];
  test('weight 0 keeps a uniform global speed', () => {
    const placed = resolvePlacements(segments, null, 1, 0);
    expect(placed.map((p) => [p.id, p.start, p.speed, p.end])).toEqual([
      [1, 0, 1, 2],
      [2, 1, 1, 2],
    ]);
  });
  test('per-line weight speeds up only the clip that overruns its slot', () => {
    const placed = resolvePlacements(segments, null, 1, 0.5);
    const seg1 = placed.find((p) => p.id === 1);
    expect(seg1.speed).toBeCloseTo(1.5, 5); // slot is 1s, needs 2x, weight 0.5 -> 1.5x
    expect(seg1.end).toBeCloseTo(2 / 1.5, 5);
  });
  test('honours per-clip start overrides', () => {
    const placed = resolvePlacements(segments, { 2: 4 }, 1, 0);
    expect(placed.find((p) => p.id === 2).start).toBe(4);
  });
});

describe('arrangePlacement', () => {
  const segments = [
    { id: 1, start: 0, audioDuration: 2 }, // 2s clip -> ends at 2
    { id: 2, start: 1, audioDuration: 1 }, // would overlap clip 1
    { id: 3, start: 21, audioDuration: 0.5 },
  ];
  test('packs clips allowing the acceptable overlap, preserving gaps and order', () => {
    // clip 2 may start at prevEnd - 0.3 = 1.7 (a 0.3s tolerated overlap), gap before clip 3 kept
    expect(arrangePlacement(segments, 1)).toEqual({ 1: 0, 2: 1.7, 3: 21 });
    expect(ACCEPTABLE_OVERLAP).toBe(0.3);
  });
  test('strict (overlap 0) packs with no overlap', () => {
    expect(arrangePlacement(segments, 1, 0)).toEqual({ 1: 0, 2: 2, 3: 21 });
  });
  test('accounts for speed (faster clips pack tighter)', () => {
    // clip 1 at 2x is 1s long; clip 2 anchor (1) already past prevEnd-0.3 (0.7) so stays at 1
    expect(arrangePlacement(segments, 2)[2]).toBe(1);
  });
});

describe('computeAutoSpeed', () => {
  const segments = [{ audioDuration: 2 }, { audioDuration: 1 }]; // 3s total speech
  test('stays at 1x when the narration already fits the window', () => {
    expect(computeAutoSpeed(segments, 6)).toBe(1);
  });
  test('speeds up to fit a tight window, clamped to the max', () => {
    expect(computeAutoSpeed(segments, 2)).toBe(1.5); // 3/2 = 1.5
    expect(computeAutoSpeed(segments, 0.5)).toBe(1.5); // 6x wanted -> clamped to AUTO_SPEED_MAX
  });
  test('is a no-op (1x) for an empty/invalid window', () => {
    expect(computeAutoSpeed(segments, 0)).toBe(1);
    expect(computeAutoSpeed([], 10)).toBe(1);
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

  test('writes each subtitle to its resolved [start, end]', () => {
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
