import { getSizeInPixels } from './rendering';
import { isWithinPillBoundary, poissonDiskSampling, generateWellDistributedPositions, createParticle } from './particles';
import { applyPhysics, updateParticles } from './physics';
import initGeminiButtonEffects, {
  resetGeminiButtonState,
  resetAllGeminiButtonEffects,
  disableGeminiButtonEffects,
} from './index';

describe('geminiEffects modules (post-split)', () => {
  test('getSizeInPixels maps size classes', () => {
    expect(getSizeInPixels('size-xs')).toBe(8);
    expect(getSizeInPixels('size-lg')).toBe(20);
    expect(getSizeInPixels('unknown')).toBe(14);
  });

  test('isWithinPillBoundary accepts the centre and rejects the corner', () => {
    expect(isWithinPillBoundary(50, 50, 5)).toBe(true);
    expect(isWithinPillBoundary(0, 0, 5)).toBe(false);
  });

  test('poisson/positions helpers return point arrays', () => {
    const pts = poissonDiskSampling(80, 80, 20, 10, 30, [12]);
    expect(Array.isArray(pts)).toBe(true);
    pts.forEach((p) => {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
    });
    expect(Array.isArray(generateWellDistributedPositions(5, [12, 12, 12, 12, 12]))).toBe(true);
  });

  test('createParticle builds a particle (cross-module rendering import works)', () => {
    const p = createParticle(10, 20, 'size-sm', false, false);
    expect(p).toMatchObject({ x: 10, y: 20, isActive: true });
    expect(typeof p.svg).toBe('string');
    expect(typeof p.size).toBe('number');
  });

  test('applyPhysics / updateParticles run without throwing (cross-module physics)', () => {
    const p = createParticle(50, 50, 'size-sm', false, false);
    p.vx = 1;
    p.vy = 1;
    applyPhysics(p);
    expect(Number.isFinite(p.x)).toBe(true);
    updateParticles([p], { x: 10, y: 10 }, true);
    expect(Number.isFinite(p.vx)).toBe(true);
  });

  test('index re-exposes the public API unchanged', () => {
    expect(typeof initGeminiButtonEffects).toBe('function');
    expect(typeof resetGeminiButtonState).toBe('function');
    expect(typeof resetAllGeminiButtonEffects).toBe('function');
    expect(typeof disableGeminiButtonEffects).toBe('function');
  });
});
