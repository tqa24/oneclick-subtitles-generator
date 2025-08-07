import { useEffect, useRef } from 'react';
import '../styles/GeminiHeaderAnimation.css';

/**
 * GeminiHeaderAnimation - Creates an animated constellation of Gemini icons in the header
 */
const GeminiHeaderAnimation = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const connectionsRef = useRef([]);
  const mouseRef = useRef({ x: null, y: null, radius: 100, isClicked: false });

  // Generate realistic star colors based on temperature (like real stars)
  const getStarColor = (temperature, intensity, isDark) => {
    // Temperature ranges: 0 = hot blue stars, 1 = cooler white/blue stars
    let r, g, b;

    if (temperature < 0.3) {
      // Hot blue stars (like Rigel, Spica) - Deep vibrant blues
      r = isDark ? 100 + temperature * 60 : 80 + temperature * 40;
      g = isDark ? 150 + temperature * 70 : 120 + temperature * 50;
      b = isDark ? 255 : 240;
    } else if (temperature < 0.7) {
      // Blue-white stars (like Vega, Sirius) - Bright blues
      r = isDark ? 160 + temperature * 50 : 130 + temperature * 40;
      g = isDark ? 190 + temperature * 40 : 160 + temperature * 30;
      b = isDark ? 255 : 250;
    } else {
      // White-blue stars (like Altair) - Light blues
      r = isDark ? 200 + temperature * 30 : 170 + temperature * 25;
      g = isDark ? 220 + temperature * 25 : 190 + temperature * 20;
      b = isDark ? 255 : 255;
    }

    return {
      r: Math.min(255, Math.round(r)),
      g: Math.min(255, Math.round(g)),
      b: Math.min(255, Math.round(b)),
      intensity
    };
  };

  // Get theme-aware star colors - natural, subtle stellar palette
  const getThemeColors = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    return {
      // Natural star outline colors - more muted
      strokeColor: isDark
        ? 'rgba(240, 240, 250, 0.7)'  // Soft white for dark theme
        : 'rgba(80, 80, 100, 0.6)',   // Muted dark for light theme
      connectionColor: isDark
        ? 'rgba(200, 200, 220, 0.15)' // Very subtle light lines for dark theme
        : 'rgba(100, 100, 120, 0.2)',  // Subtle dark lines for light theme
      // Natural stellar colors - subtle and gentle
      gradientStart: isDark
        ? 'rgba(190, 170, 210, 0.7)'  // Gentle purple (dark theme)
        : 'rgba(150, 130, 170, 0.6)',  // Muted purple (light theme)
      gradientMid: isDark
        ? 'rgba(170, 190, 220, 0.6)'  // Gentle blue (dark theme)
        : 'rgba(130, 150, 190, 0.5)',  // Muted blue (light theme)
      gradientEnd: isDark
        ? 'rgba(190, 210, 230, 0.5)'  // Soft light blue (dark theme)
        : 'rgba(150, 170, 200, 0.4)'  // Muted light blue (light theme)
    };
  };

  // Initialize the animation
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    let connections = [];

    // Set canvas dimensions with proper pixel density
    const resizeCanvas = () => {
      const header = canvas.parentElement;
      const rect = header.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set actual canvas size in memory (scaled for high DPI)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale the canvas back down using CSS
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      // Scale the drawing context so everything draws at the correct size
      ctx.scale(dpr, dpr);

      // Recreate particles when canvas is resized to ensure valid positions
      // This prevents particles from having coordinates outside the new canvas bounds
      if (rect.width > 0 && rect.height > 0) {
        createParticles();
        updateConnections();
      }
    };

    // Create particles
    const createParticles = () => {
      // Get CSS dimensions (not canvas buffer dimensions)
      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      // Ensure canvas has valid dimensions before creating particles
      if (cssWidth <= 0 || cssHeight <= 0) {
        return;
      }

      const particleCount = Math.max(5, Math.floor(cssWidth / 100)); // Responsive particle count
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        const size = 8 + Math.random() * 8; // 8-16px

        // Ensure particles are positioned within CSS bounds with some margin
        const margin = size; // Use particle size as margin
        const anchorX = margin + Math.random() * (cssWidth - 2 * margin);
        const anchorY = margin + Math.random() * (cssHeight - 2 * margin);

        // Position is always at the anchor point
        const x = anchorX;
        const y = anchorY;
        const isFilled = Math.random() > 0.3; // 70% chance of filled icons
        // No rotation - keep icons straight
        const rotation = 0;
        const rotationSpeed = 0;
        const opacity = 0.3 + Math.random() * 0.3; // 0.3-0.6 opacity

        particles.push({
          x,
          y,
          anchorX,
          anchorY,
          size,
          isFilled,
          rotation,
          rotationSpeed,
          opacity,
          pulsePhase: Math.random() * Math.PI * 2, // Random starting phase for pulse
          pulseSpeed: 0.008 + Math.random() * 0.006, // Balanced pulse speed
          // Balanced movement properties - slow but visible
          driftPhaseX: Math.random() * Math.PI * 2, // Random starting phase for X drift
          driftPhaseY: Math.random() * Math.PI * 2, // Random starting phase for Y drift
          driftSpeedX: 0.001 + Math.random() * 0.002, // Slow X drift speed (0.001-0.003)
          driftSpeedY: 0.001 + Math.random() * 0.002, // Slow Y drift speed (0.001-0.003)
          driftAmplitudeX: 3 + Math.random() * 6, // X drift amplitude (3-9 pixels)
          driftAmplitudeY: 3 + Math.random() * 6, // Y drift amplitude (3-9 pixels)
          // Orbital movement around anchor point
          orbitPhase: Math.random() * Math.PI * 2, // Random starting orbital phase
          orbitSpeed: 0.0006 + Math.random() * 0.0012, // Slow orbit (0.0006-0.0018)
          orbitRadius: 2 + Math.random() * 5, // Small orbital radius (2-7 pixels)
          // Breathing effect (size variation)
          breathePhase: Math.random() * Math.PI * 2,
          breatheSpeed: 0.002 + Math.random() * 0.002, // Slow breathing (0.002-0.004)
          breatheAmplitude: 0.06 + Math.random() * 0.10, // Size variation (6-16%)
          // Occasional twinkling rotation (only some stars)
          isTwinkler: Math.random() < 0.15, // 15% chance to be a twinkling star (reduced for subtlety)
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.002 + Math.random() * 0.003, // Even slower, more natural twinkle
          twinkleIntensity: 0.03 + Math.random() * 0.06, // Very subtle rotation (0.03-0.09 radians)
          // Random star color temperature (blue shades like real stars)
          starTemp: Math.random(), // 0-1 value for color temperature
          colorIntensity: 0.8 + Math.random() * 0.2 // Higher color saturation (0.8-1.0)
        });
      }

      particlesRef.current = particles;
    };

    // Simple TSP solver using nearest neighbor heuristic
    const solveTSP = (particles) => {
      if (particles.length < 2) return [];

      const visited = new Set();
      const path = [];
      let current = 0; // Start with first particle
      visited.add(current);
      path.push(current);

      // Find nearest unvisited neighbor for each step
      while (visited.size < particles.length) {
        let nearestIndex = -1;
        let nearestDistance = Infinity;

        for (let i = 0; i < particles.length; i++) {
          if (visited.has(i)) continue;

          const dx = particles[current].anchorX - particles[i].anchorX;
          const dy = particles[current].anchorY - particles[i].anchorY;
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

    // Update connections using TSP path
    const updateConnections = () => {
      connections = [];

      if (particles.length < 2) return;

      // Get optimal path through all stars
      const tspPath = solveTSP(particles);

      // Create connections along the TSP path
      for (let i = 0; i < tspPath.length - 1; i++) {
        const fromIndex = tspPath[i];
        const toIndex = tspPath[i + 1];

        const dx = particles[fromIndex].anchorX - particles[toIndex].anchorX;
        const dy = particles[fromIndex].anchorY - particles[toIndex].anchorY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only connect if distance is reasonable (avoid very long lines)
        if (distance < 200) {
          const opacity = Math.max(0.1, 1 - (distance / 200)); // Fade with distance
          connections.push({
            from: fromIndex,
            to: toIndex,
            opacity: opacity * 0.25 // Slightly higher opacity for cleaner look
          });
        }
      }

      connectionsRef.current = connections;
    };

    // Draw a single Gemini icon with subtle, natural star effects
    const drawGeminiIcon = (x, y, size, rotation, isFilled, opacity, particle) => {
      ctx.save();
      // Translate to the center point and then offset by half the SVG size to center it properly
      ctx.translate(x, y);
      ctx.rotate(rotation);

      const colors = getThemeColors();

      // Add subtle glow with gentle animated fading using star color
      if (isFilled && opacity > 0.4) {
        // Calculate animated glow intensity using particle's pulse phase
        const glowPulse = 0.7 + 0.3 * Math.sin(particle.pulsePhase * 0.8); // Slower pulse for glow
        const starColor = getStarColor(particle.starTemp, particle.colorIntensity, colors.isDark);

        // More vibrant glow with animated fading using realistic star color
        const subtleGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
        subtleGlow.addColorStop(0, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.18 * glowPulse})`);
        subtleGlow.addColorStop(0.4, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.12 * glowPulse})`);
        subtleGlow.addColorStop(0.7, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.06 * glowPulse})`);
        subtleGlow.addColorStop(0.9, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.03 * glowPulse})`);
        subtleGlow.addColorStop(1, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, 0)`);

        ctx.fillStyle = subtleGlow;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw the actual Gemini star shape
      ctx.scale(size / 28, size / 28); // Scale to desired size
      ctx.translate(-14, -14); // Center the SVG path around the translated point

      // Draw the Gemini icon path
      ctx.beginPath();
      ctx.moveTo(14, 28);
      ctx.bezierCurveTo(14, 26.0633, 13.6267, 24.2433, 12.88, 22.54);
      ctx.bezierCurveTo(12.1567, 20.8367, 11.165, 19.355, 9.905, 18.095);
      ctx.bezierCurveTo(8.645, 16.835, 7.16333, 15.8433, 5.46, 15.12);
      ctx.bezierCurveTo(3.75667, 14.3733, 1.93667, 14, 0, 14);
      ctx.bezierCurveTo(1.93667, 14, 3.75667, 13.6383, 5.46, 12.915);
      ctx.bezierCurveTo(7.16333, 12.1683, 8.645, 11.165, 9.905, 9.905);
      ctx.bezierCurveTo(11.165, 8.645, 12.1567, 7.16333, 12.88, 5.46);
      ctx.bezierCurveTo(13.6267, 3.75667, 14, 1.93667, 14, 0);
      ctx.bezierCurveTo(14, 1.93667, 14.3617, 3.75667, 15.085, 5.46);
      ctx.bezierCurveTo(15.8317, 7.16333, 16.835, 8.645, 18.095, 9.905);
      ctx.bezierCurveTo(19.355, 11.165, 20.8367, 12.1683, 22.54, 12.915);
      ctx.bezierCurveTo(24.2433, 13.6383, 26.0633, 14, 28, 14);
      ctx.bezierCurveTo(26.0633, 14, 24.2433, 14.3733, 22.54, 15.12);
      ctx.bezierCurveTo(20.8367, 15.8433, 19.355, 16.835, 18.095, 18.095);
      ctx.bezierCurveTo(16.835, 19.355, 15.8317, 20.8367, 15.085, 22.54);
      ctx.bezierCurveTo(14.3617, 24.2433, 14, 26.0633, 14, 28);
      ctx.closePath();

      // Fill or stroke the star shape based on the type
      const starColor = getStarColor(particle.starTemp, particle.colorIntensity, colors.isDark);

      if (isFilled) {
        const gradient = ctx.createLinearGradient(-14, -14, 14, 14);
        // Use realistic star colors based on temperature - more vibrant
        const baseOpacity = opacity * starColor.intensity;
        gradient.addColorStop(0, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${baseOpacity * 1.2})`);
        gradient.addColorStop(0.5, `rgba(${Math.max(0, starColor.r - 15)}, ${Math.max(0, starColor.g - 10)}, ${starColor.b}, ${baseOpacity * 1.0})`);
        gradient.addColorStop(1, `rgba(${Math.max(0, starColor.r - 30)}, ${Math.max(0, starColor.g - 20)}, ${Math.max(0, starColor.b - 5)}, ${baseOpacity * 0.8})`);

        ctx.fillStyle = gradient;
        ctx.fill();

        // Add a subtle outline with star color
        ctx.strokeStyle = `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.6})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else {
        // For outline stars, use star color
        ctx.strokeStyle = `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * starColor.intensity})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.restore();
    };

    // Draw connections between particles
    const drawConnections = () => {
      connections.forEach(connection => {
        const p1 = particles[connection.from];
        const p2 = particles[connection.to];

        // Ensure particles exist and have valid positions
        if (!p1 || !p2 ||
            typeof p1.x !== 'number' || typeof p1.y !== 'number' ||
            typeof p2.x !== 'number' || typeof p2.y !== 'number') {
          return; // Skip invalid connections
        }

        // The Gemini star is now properly centered at the particle position
        // We translate to (x, y), then offset by (-14, -14) to center the 28x28 SVG path
        // This means the visual center of the star is exactly at (p.x, p.y)

        // Calculate connection points with gaps so lines don't touch stars
        const x1 = p1.x;
        const y1 = p1.y;
        const x2 = p2.x;
        const y2 = p2.y;

        // Calculate direction vector
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 1) return; // Skip if particles are too close

        // Normalize direction vector
        const unitX = dx / distance;
        const unitY = dy / distance;

        // Create gaps around stars (use average star size for gap calculation)
        const avgSize = (p1.size + p2.size) / 2;
        const gap = avgSize * 0.7; // Gap is 70% of average star size

        // Calculate start and end points with gaps
        const startX = x1 + unitX * gap;
        const startY = y1 + unitY * gap;
        const endX = x2 - unitX * gap;
        const endY = y2 - unitY * gap;

        // Only draw if there's enough distance for a visible line
        const lineDistance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        if (lineDistance < gap) return; // Skip if line would be too short

        // Draw the connection line with gaps
        const colors = getThemeColors();
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = colors.connectionColor.replace(/[\d.]+\)$/, `${connection.opacity})`);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update all particles
      particles.forEach(particle => {
        // Start with anchor point as base position
        let baseX = particle.anchorX;
        let baseY = particle.anchorY;

        // Apply slow organic movements
        // 1. Gentle drift movement (like floating in space)
        const driftX = Math.sin(particle.driftPhaseX) * particle.driftAmplitudeX;
        const driftY = Math.sin(particle.driftPhaseY) * particle.driftAmplitudeY;

        // 2. Small orbital movement around anchor point
        const orbitX = Math.cos(particle.orbitPhase) * particle.orbitRadius;
        const orbitY = Math.sin(particle.orbitPhase) * particle.orbitRadius;

        // Combine movements for natural motion
        particle.x = baseX + driftX + orbitX;
        particle.y = baseY + driftY + orbitY;

        // Mouse interaction - move stars when mouse is nearby
        if (mouseRef.current.x !== null && mouseRef.current.y !== null) {
          const dx = particle.x - mouseRef.current.x;
          const dy = particle.y - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Increase the interaction radius for more coverage
          const interactionRadius = mouseRef.current.isClicked ? 200 : 150;

          if (distance < interactionRadius) {
            // Calculate repulsion force (stronger when closer)
            // Make the force stronger when clicked
            const forceFactor = mouseRef.current.isClicked ? 3 : 2;
            const force = Math.pow((interactionRadius - distance) / interactionRadius, forceFactor);
            const angle = Math.atan2(dy, dx);

            // Apply a more noticeable movement away from the mouse
            // Increase the effect when clicked
            const maxOffset = mouseRef.current.isClicked ? 50 : 30;
            particle.x += Math.cos(angle) * force * maxOffset;
            particle.y += Math.sin(angle) * force * maxOffset;

            // Also increase the opacity and pulse speed when mouse is nearby
            // More dramatic effect when clicked
            const pulseBoost = mouseRef.current.isClicked ? (1 + force * 1.0) : (1 + force * 0.5);
            particle.pulsePhase += particle.pulseSpeed * pulseBoost;
          }
        }

        // Update movement phases for next frame
        particle.driftPhaseX += particle.driftSpeedX;
        particle.driftPhaseY += particle.driftSpeedY;
        particle.orbitPhase += particle.orbitSpeed;
        particle.breathePhase += particle.breatheSpeed;

        // Update twinkling rotation for special stars
        if (particle.isTwinkler) {
          particle.twinklePhase += particle.twinkleSpeed;
          particle.rotation = Math.sin(particle.twinklePhase) * particle.twinkleIntensity;
        }

        // Update pulse effect
        particle.pulsePhase += particle.pulseSpeed;
      });

      // Draw connections first (so they appear behind the particles)
      // We don't need to update connections since they're based on fixed anchor points
      drawConnections();

      // Finally draw all particles
      particles.forEach(particle => {
        const pulseOpacity = particle.opacity * (0.7 + 0.3 * Math.sin(particle.pulsePhase));

        // Apply breathing effect to size
        const breatheMultiplier = 1 + Math.sin(particle.breathePhase) * particle.breatheAmplitude;
        const breathingSize = particle.size * breatheMultiplier;

        drawGeminiIcon(
          particle.x,
          particle.y,
          breathingSize,
          particle.rotation,
          particle.isFilled,
          pulseOpacity,
          particle
        );
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    // Mouse event handlers
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    // Handle mouse leave
    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
      mouseRef.current.isClicked = false;
    };

    // Handle mouse down (click)
    const handleMouseDown = () => {
      mouseRef.current.isClicked = true;
    };

    // Handle mouse up (release)
    const handleMouseUp = () => {
      mouseRef.current.isClicked = false;
    };

    // Initialize
    resizeCanvas(); // This now calls createParticles() and updateConnections() if canvas is valid
    animate();

    // Theme change listener
    const handleThemeChange = () => {
      // Colors will be updated automatically on next frame since getThemeColors() is called in draw functions
    };

    // Add event listeners
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('storage', handleThemeChange); // Listen for theme changes
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    // Also add touch events for mobile
    canvas.addEventListener('touchstart', handleMouseDown);
    canvas.addEventListener('touchend', handleMouseUp);
    canvas.addEventListener('touchcancel', handleMouseLeave);

    // Store animation frame ID for cleanup
    animationRef.current = animationFrameId;

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('storage', handleThemeChange);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleMouseDown);
      canvas.removeEventListener('touchend', handleMouseUp);
      canvas.removeEventListener('touchcancel', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="gemini-header-canvas" />
  );
};

export default GeminiHeaderAnimation;
