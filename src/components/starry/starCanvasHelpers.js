// Pure helper functions for the onboarding starry background canvas.
// Zero closures — every dependency is passed in as an argument.

/**
 * Pre-compiled Path2D object for the star shape.
 * This avoids parsing the SVG string on every frame for every star, a major performance win.
 */
const GEMINI_STAR_PATH_STRING = "M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z";
export const GEMINI_STAR_PATH_2D = new Path2D(GEMINI_STAR_PATH_STRING);

/**
 * Generates vibrant star colors based on temperature and theme.
 */
export const getStarColor = (temperature, intensity, isDark) => {
  let r, g, b;

  if (isDark) {
    if (temperature < 0.3) {
      r = Math.floor(100 + temperature * 50); g = Math.floor(150 + temperature * 80); b = 255;
    } else if (temperature < 0.7) {
      r = Math.floor(120 + temperature * 60); g = Math.floor(180 + temperature * 60); b = 255;
    } else {
      r = Math.floor(150 + temperature * 80); g = Math.floor(200 + temperature * 50); b = 255;
    }
  } else {
    if (temperature < 0.3) {
      r = 255; g = Math.floor(140 + temperature * 60); b = Math.floor(50 + temperature * 30);
    } else if (temperature < 0.7) {
      r = 255; g = Math.floor(200 + temperature * 40); b = Math.floor(80 + temperature * 50);
    } else {
      r = 255; g = Math.floor(220 + temperature * 30); b = Math.floor(100 + temperature * 80);
    }
  }

  return {
    r: Math.min(255, Math.max(0, r)),
    g: Math.min(255, Math.max(0, g)),
    b: Math.min(255, Math.max(0, b)),
    intensity: intensity * 1.5
  };
};

/**
 * Gets theme colors from the document.
 */
export const getThemeColors = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return { isDark };
};

/**
 * Draws a 5-point star on the given canvas context.
 */
export const draw5PointStar = (ctx, x, y, size, rotation, opacity, brightness) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const outerRadius = size;
  const innerRadius = size * 0.4;

  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const pointX = Math.cos(angle) * radius;
    const pointY = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
  ctx.closePath();

  const starGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
  starGradient.addColorStop(0, `rgba(255, 255, 200, ${opacity * brightness})`);
  starGradient.addColorStop(0.3, `rgba(255, 215, 100, ${opacity * brightness * 0.9})`);
  starGradient.addColorStop(0.7, `rgba(255, 180, 50, ${opacity * brightness * 0.8})`);
  starGradient.addColorStop(1, `rgba(200, 140, 30, ${opacity * brightness * 0.6})`);

  ctx.fillStyle = starGradient;
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 215, 100, ${opacity * brightness})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

/**
 * Simple TSP solver using nearest neighbor heuristic.
 */
export const solveTSP = (particles) => {
  if (particles.length < 2) return [];
  const visited = new Set();
  const path = [];
  let current = 0;
  visited.add(current);
  path.push(current);

  while (visited.size < particles.length) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < particles.length; i++) {
      if (visited.has(i)) continue;
      const dx = particles[current].x - particles[i].x;
      const dy = particles[current].y - particles[i].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    if (nearestIndex !== -1) {
      visited.add(nearestIndex);
      path.push(nearestIndex);
      current = nearestIndex;
    } else {
      break;
    }
  }
  return path;
};
