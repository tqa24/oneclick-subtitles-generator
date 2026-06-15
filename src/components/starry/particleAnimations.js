// Particle / connection animation functions for the onboarding starry background.
// These are kept free of component-state closures: the canvas context, particle
// data, theme colors and effect arrays (comets / wind currents) are passed in.

import { GEMINI_STAR_PATH_2D, getStarColor, solveTSP } from './starCanvasHelpers';

/**
 * Builds the particle array for the given canvas dimensions.
 * Returns the new array (the caller is responsible for storing it).
 */
export const createParticles = (canvas) => {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return [];

  const particleCount = Math.max(6, Math.floor((rect.width * rect.height) / 25000));
  const particles = [];
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  for (let i = 0; i < particleCount; i++) {
    const size = 8 + Math.random() * 8;
    const margin = size;
    const x = margin + Math.random() * (rect.width - 2 * margin);
    const y = margin + Math.random() * (rect.height - 2 * margin);
    const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const angleFromCenter = Math.atan2(y - centerY, x - centerX);

    particles.push({
      x, y, size, isFilled: Math.random() > 0.15, rotation: 0,
      opacity: 0.3 + Math.random() * 0.7, pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.012, breathePhase: Math.random() * Math.PI * 2,
      breatheSpeed: 0.006 + Math.random() * 0.008, breatheAmplitude: 0.12 + Math.random() * 0.20,
      isTwinkler: Math.random() < 0.25, twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.005 + Math.random() * 0.008, twinkleIntensity: 0.08 + Math.random() * 0.15,
      starTemp: Math.random(), colorIntensity: 1.0 + Math.random() * 0.5,
      galaxyAngle: angleFromCenter, galaxyRadius: distanceFromCenter,
      galaxySpeed: 0.001 + Math.random() * 0.002,
      spiralSpeed: 0.0005 + Math.random() * 0.001,
      spiralDirection: Math.random() > 0.5 ? 1 : -1,
      velocityX: 0, velocityY: 0, dragCoefficient: 0.98,
      turbulence: Math.random() * 0.5 + 0.2, turbulencePhase: Math.random() * Math.PI * 2,
      turbulenceSpeed: 0.002 + Math.random() * 0.003
    });
  }
  return particles;
};

/**
 * Computes the TSP-based connection list for the given particles.
 * Returns the new connections array (the caller is responsible for storing it).
 */
export const updateConnections = (particles) => {
  if (particles.length < 2) return [];
  const tspPath = solveTSP(particles);
  const newConnections = [];
  for (let i = 0; i < tspPath.length - 1; i++) {
    const p1 = particles[tspPath[i]];
    const p2 = particles[tspPath[i + 1]];
    const distance = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    if (distance < 280) {
      const opacity = Math.max(0.15, 1 - (distance / 280));
      newConnections.push({ from: tspPath[i], to: tspPath[i + 1], opacity: opacity * 0.45 });
    }
  }
  return newConnections;
};

/**
 * Draws the connection lines between particles.
 */
export const drawConnections = (ctx, connections, particles, colors) => {
  connections.forEach(connection => {
    const p1 = particles[connection.from];
    const p2 = particles[connection.to];
    if (!p1 || !p2) return;

    const dx = p2.x - p1.x; const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    const unitX = dx / distance; const unitY = dy / distance;
    const gap = (p1.size + p2.size) / 2 * 0.7;
    const startX = p1.x + unitX * gap; const startY = p1.y + unitY * gap;
    const endX = p2.x - unitX * gap; const endY = p2.y - unitY * gap;
    if (Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) < gap) return;

    ctx.save();
    if (colors.isDark) {
      ctx.strokeStyle = `rgba(100, 150, 255, ${connection.opacity})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 6]);
    } else {
      ctx.strokeStyle = `rgba(180, 200, 160, ${connection.opacity * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
    ctx.restore();
  });
};

/**
 * Draws a single particle (Gemini star or seed) onto the context.
 */
export const drawParticle = (ctx, particle, colors) => {
  const { x, y, size, rotation, isFilled, opacity } = particle;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  if (colors.isDark) {
    const starColor = getStarColor(particle.starTemp, particle.colorIntensity, true);
    if (isFilled && opacity > 0.4) {
      const glowPulse = 0.6 + 0.2 * Math.sin(particle.pulsePhase * 0.6);
      const subtleGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
      subtleGlow.addColorStop(0, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.2 * glowPulse})`);
      subtleGlow.addColorStop(1, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, 0)`);
      ctx.fillStyle = subtleGlow;
      ctx.beginPath(); ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2); ctx.fill();
    }

    const scale = size / 28;
    ctx.scale(scale, scale);
    ctx.translate(-14, -14);

    if (isFilled) {
      const gradient = ctx.createLinearGradient(-14, -14, 14, 14);
      const baseOpacity = opacity * starColor.intensity;
      gradient.addColorStop(0, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${baseOpacity * 1.3})`);
      gradient.addColorStop(1, `rgba(${Math.max(0, starColor.r - 15)}, ${Math.max(0, starColor.g - 10)}, ${Math.max(0, starColor.b - 5)}, ${baseOpacity * 0.9})`);
      ctx.fillStyle = gradient;
      ctx.fill(GEMINI_STAR_PATH_2D);
      ctx.strokeStyle = `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.8})`;
      ctx.lineWidth = 1.2;
      ctx.stroke(GEMINI_STAR_PATH_2D);
    } else {
      ctx.strokeStyle = `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * starColor.intensity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke(GEMINI_STAR_PATH_2D);
    }
  } else {
    const seedOpacity = Math.min(1.0, opacity * 1.1);
    ctx.fillStyle = `rgba(255, 220, 80, ${seedOpacity})`;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2); ctx.fill();
    const fiberCount = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < fiberCount; i++) {
      const angle = (i / fiberCount) * Math.PI * 2 + rotation;
      const fiberLength = size * (0.7 + Math.random() * 0.3);
      const fiberOpacity = seedOpacity * (0.7 + Math.random() * 0.3);
      ctx.strokeStyle = `rgba(255, 255, 255, ${fiberOpacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * fiberLength, Math.sin(angle) * fiberLength); ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${fiberOpacity})`;
      ctx.beginPath(); ctx.arc(Math.cos(angle) * fiberLength, Math.sin(angle) * fiberLength, 1, 0, Math.PI * 2); ctx.fill();
    }
    const seedGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
    seedGlow.addColorStop(0, `rgba(255, 255, 255, ${seedOpacity * 0.1})`);
    seedGlow.addColorStop(1, 'rgba(250, 250, 250, 0)');
    ctx.fillStyle = seedGlow;
    ctx.beginPath(); ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
};

/**
 * Applies comet gravity to particles (dark theme).
 */
export const applyCometGravity = (comets, particles) => {
  comets.forEach(comet => {
    particles.forEach(particle => {
      const dx = comet.x - particle.x;
      const dy = comet.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < comet.gravityRadius && distance > 0) {
        const force = (comet.gravityRadius - distance) / comet.gravityRadius;
        const pullStrength = force * comet.gravityStrength * 0.02;
        particle.velocityX += (dx / distance) * pullStrength;
        particle.velocityY += (dy / distance) * pullStrength;
        const perpX = -dy / distance; const perpY = dx / distance;
        particle.velocityX += perpX * pullStrength * 0.5;
        particle.velocityY += perpY * pullStrength * 0.5;
      }
    });
  });
};

/**
 * Applies wind-current effects to particles (light theme).
 */
export const applyWindEffects = (winds, particles) => {
  winds.forEach(wind => {
    particles.forEach(particle => {
      const dx = particle.x - wind.x; const dy = particle.y - wind.y;
      if (Math.abs(dx) < wind.width / 2 && Math.abs(dy) < wind.height / 2) {
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = Math.sqrt((wind.width / 2) ** 2 + (wind.height / 2) ** 2);
        if (distanceFromCenter < maxDistance) {
          const force = (maxDistance - distanceFromCenter) / maxDistance;
          const windStrength = force * wind.strength * 0.05;
          particle.velocityX += wind.velocityX * windStrength + (Math.random() - 0.5) * windStrength * 0.5;
          particle.velocityY += wind.velocityY * windStrength + (Math.random() - 0.5) * windStrength * 0.5;
        }
      }
    });
  });
};
