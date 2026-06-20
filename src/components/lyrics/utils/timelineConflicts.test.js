import { getTimingConflictIds } from './timelineConflicts';

describe('getTimingConflictIds', () => {
  test('flags both clips on a large (>=0.35s) overlap', () => {
    const ids = getTimingConflictIds([
      { id: 1, start: 0, end: 2 },
      { id: 2, start: 1.5, end: 3 }, // overlaps clip 1 by 0.5s
    ]);
    expect([...ids].sort()).toEqual([1, 2]);
  });

  test('does not flag a tiny overlap below the thresholds', () => {
    const ids = getTimingConflictIds([
      { id: 1, start: 0, end: 1.05 },
      { id: 2, start: 1, end: 3 }, // 0.05s overlap, and only 0.05/1.05 of the shorter
    ]);
    expect(ids.size).toBe(0);
  });

  test('flags a smaller overlap that eats >=50% of the shorter clip', () => {
    const ids = getTimingConflictIds([
      { id: 1, start: 0, end: 1 },
      { id: 2, start: 0.85, end: 1.05 }, // shorter clip is 0.2s, overlap 0.15s -> 0.75 ratio, >=0.1s
    ]);
    expect([...ids].sort()).toEqual([1, 2]);
  });

  test('no overlap -> no conflicts', () => {
    expect(getTimingConflictIds([{ id: 1, start: 0, end: 1 }, { id: 2, start: 2, end: 3 }]).size).toBe(0);
  });
});
