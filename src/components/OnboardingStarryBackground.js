import { useEffect, useRef } from 'react';

/**
 * OnboardingStarryBackground - Creates an animated starry sky for the onboarding overlay
 * Full implementation with TSP connections, cursor interactions, and constant movement
 */
const OnboardingStarryBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const connectionsRef = useRef([]);
  const mouseRef = useRef({ x: null, y: null, radius: 120, isClicked: false });

  // Generate vibrant star colors - blue for dark, yellow/orange for light
  const getStarColor = (temperature, intensity, isDark) => {
    let r, g, b;

    if (isDark) {
      // Dark theme: Vibrant blue stars - much more noticeable
      if (temperature < 0.3) {
        // Bright electric blue stars
        r = Math.floor(100 + temperature * 50);
        g = Math.floor(150 + temperature * 80);
        b = 255;
      } else if (temperature < 0.7) {
        // Cyan-blue stars
        r = Math.floor(120 + temperature * 60);
        g = Math.floor(180 + temperature * 60);
        b = 255;
      } else {
        // Light blue stars
        r = Math.floor(150 + temperature * 80);
        g = Math.floor(200 + temperature * 50);
        b = 255;
      }
    } else {
      // Light theme: Warm yellow and orange stars
      if (temperature < 0.3) {
        // Deep orange stars
        r = 255;
        g = Math.floor(140 + temperature * 60);
        b = Math.floor(50 + temperature * 30);
      } else if (temperature < 0.7) {
        // Golden yellow stars
        r = 255;
        g = Math.floor(200 + temperature * 40);
        b = Math.floor(80 + temperature * 50);
      } else {
        // Bright yellow stars
        r = 255;
        g = Math.floor(220 + temperature * 30);
        b = Math.floor(100 + temperature * 80);
      }
    }

    return {
      r: Math.min(255, Math.max(0, r)),
      g: Math.min(255, Math.max(0, g)),
      b: Math.min(255, Math.max(0, b)),
      intensity: intensity * 1.5 // Increase intensity for more visibility
    };
  };

  // Get theme colors
  const getThemeColors = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return { isDark };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;

    // Set canvas dimensions with proper pixel density
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set actual canvas size in memory (scaled for high DPI)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale the canvas back down using CSS
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      // Scale the drawing context so everything draws at the correct size
      ctx.scale(dpr, dpr);

      // Recreate particles when canvas is resized
      if (rect.width > 0 && rect.height > 0) {
        createParticles();
        updateConnections();
      }
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
      let connections = [];

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
        if (distance < 280) { // Moderate connection distance
          const opacity = Math.max(0.15, 1 - (distance / 280));
          connections.push({
            from: fromIndex,
            to: toIndex,
            opacity: opacity * 0.45 // Moderate connection visibility
          });
        }
      }

      connectionsRef.current = connections;
    };

    // Draw connections between stars (only in dark mode)
    const drawConnections = () => {
      const connections = connectionsRef.current;
      const particles = particlesRef.current;
      const colors = getThemeColors();

      // Only draw connections in dark mode
      if (!colors.isDark) return;

      connections.forEach(connection => {
        const p1 = particles[connection.from];
        const p2 = particles[connection.to];

        if (!p1 || !p2) return;

        const x1 = p1.x;
        const y1 = p1.y;
        const x2 = p2.x;
        const y2 = p2.y;

        // Calculate unit vector for gap calculation
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;

        // Create gaps around stars
        const avgSize = (p1.size + p2.size) / 2;
        const gap = avgSize * 0.7;

        // Calculate start and end points with gaps
        const startX = x1 + unitX * gap;
        const startY = y1 + unitY * gap;
        const endX = x2 - unitX * gap;
        const endY = y2 - unitY * gap;

        // Only draw if there's enough distance for a visible line
        const lineDistance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        if (lineDistance < gap) return;

        // Draw connection line with theme-appropriate colors
        ctx.save();
        if (colors.isDark) {
          // Dark theme: Bright blue connections
          ctx.strokeStyle = `rgba(100, 150, 255, ${connection.opacity})`;
        } else {
          // Light theme: Warm orange/yellow connections
          ctx.strokeStyle = `rgba(255, 140, 60, ${connection.opacity})`;
        }
        ctx.lineWidth = 1.5; // Thicker lines for better visibility
        ctx.setLineDash([3, 6]); // More visible dashed pattern
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
      });
    };

    // Create particles
    const createParticles = () => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      if (cssWidth <= 0 || cssHeight <= 0) {
        return;
      }

      // Check theme - only show stars in dark mode
      const colors = getThemeColors();
      if (!colors.isDark) {
        particles = [];
        particlesRef.current = particles;
        return; // No stars in light mode
      }

      // Fewer groups of stars
      const particleCount = Math.max(6, Math.floor((cssWidth * cssHeight) / 25000));
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        const size = 8 + Math.random() * 8; // 8-16px - smaller for less intimidating

        const margin = size;
        const anchorX = margin + Math.random() * (cssWidth - 2 * margin);
        const anchorY = margin + Math.random() * (cssHeight - 2 * margin);

        const x = anchorX;
        const y = anchorY;
        const isFilled = Math.random() > 0.15; // 85% chance of filled icons - fewer blanks
        const rotation = 0;
        const opacity = 0.5 + Math.random() * 0.4; // 0.5-0.9 opacity - more vibrant

        particles.push({
          x,
          y,
          anchorX,
          anchorY,
          size,
          isFilled,
          rotation,
          opacity,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.015 + Math.random() * 0.012, // Faster pulsing
          driftPhaseX: Math.random() * Math.PI * 2,
          driftPhaseY: Math.random() * Math.PI * 2,
          driftSpeedX: 0.003 + Math.random() * 0.005, // Much faster drift
          driftSpeedY: 0.003 + Math.random() * 0.005, // Much faster drift
          driftAmplitudeX: 8 + Math.random() * 15, // Larger movement range
          driftAmplitudeY: 8 + Math.random() * 15, // Larger movement range
          orbitPhase: Math.random() * Math.PI * 2,
          orbitSpeed: 0.002 + Math.random() * 0.004, // Faster orbital movement
          orbitRadius: 5 + Math.random() * 12, // Larger orbital radius
          breathePhase: Math.random() * Math.PI * 2,
          breatheSpeed: 0.006 + Math.random() * 0.008, // Faster breathing
          breatheAmplitude: 0.12 + Math.random() * 0.20, // More dramatic size changes
          isTwinkler: Math.random() < 0.25, // More twinkling stars
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.005 + Math.random() * 0.008, // Faster twinkling
          twinkleIntensity: 0.08 + Math.random() * 0.15, // More dramatic rotation
          starTemp: Math.random(),
          colorIntensity: 1.0 + Math.random() * 0.5 // Higher intensity for visibility
        });
      }

      particlesRef.current = particles;
    };

    // Draw a single Gemini icon
    const drawGeminiIcon = (x, y, size, rotation, isFilled, opacity, particle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      const colors = getThemeColors();
      const starColor = getStarColor(particle.starTemp, particle.colorIntensity, colors.isDark);

      // Add subtle glow for filled stars (only in dark mode)
      if (isFilled && opacity > 0.4 && colors.isDark) {
        const glowPulse = 0.6 + 0.2 * Math.sin(particle.pulsePhase * 0.6);
        const subtleGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
        subtleGlow.addColorStop(0, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.2 * glowPulse})`);
        subtleGlow.addColorStop(0.4, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.12 * glowPulse})`);
        subtleGlow.addColorStop(0.7, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.08 * glowPulse})`);
        subtleGlow.addColorStop(1, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, 0)`);

        ctx.fillStyle = subtleGlow;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw the star shape
      ctx.beginPath();
      const path = "M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z";
      
      // Scale and center the path
      const scale = size / 28;
      ctx.scale(scale, scale);
      ctx.translate(-14, -14);
      
      const path2D = new Path2D(path);
      
      if (isFilled) {
        const gradient = ctx.createLinearGradient(-14, -14, 14, 14);
        const baseOpacity = opacity * starColor.intensity;
        gradient.addColorStop(0, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${baseOpacity * 1.3})`);
        gradient.addColorStop(0.5, `rgba(${Math.max(0, starColor.r - 5)}, ${Math.max(0, starColor.g - 5)}, ${starColor.b}, ${baseOpacity * 1.1})`);
        gradient.addColorStop(1, `rgba(${Math.max(0, starColor.r - 15)}, ${Math.max(0, starColor.g - 10)}, ${Math.max(0, starColor.b - 5)}, ${baseOpacity * 0.9})`);

        ctx.fillStyle = gradient;
        ctx.fill(path2D);

        // Add bright outline for more visibility
        ctx.strokeStyle = `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * 0.8})`;
        ctx.lineWidth = 1.2;
        ctx.stroke(path2D);
      } else {
        ctx.strokeStyle = `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${opacity * starColor.intensity})`;
        ctx.lineWidth = 1.5; // Thicker outline stars
        ctx.stroke(path2D);
      }

      ctx.restore();
    };

    // Animation loop with cursor interactions
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const colors = getThemeColors();

      // Only animate in dark mode
      if (!colors.isDark) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      particles.forEach(particle => {
        // Update all animation phases
        particle.pulsePhase += particle.pulseSpeed;
        particle.driftPhaseX += particle.driftSpeedX;
        particle.driftPhaseY += particle.driftSpeedY;
        particle.orbitPhase += particle.orbitSpeed;
        particle.breathePhase += particle.breatheSpeed;

        if (particle.isTwinkler) {
          particle.twinklePhase += particle.twinkleSpeed;
          particle.rotation = Math.sin(particle.twinklePhase) * particle.twinkleIntensity;
        }

        // Calculate base position with drift and orbit
        const driftX = Math.sin(particle.driftPhaseX) * particle.driftAmplitudeX;
        const driftY = Math.sin(particle.driftPhaseY) * particle.driftAmplitudeY;
        const orbitX = Math.cos(particle.orbitPhase) * particle.orbitRadius;
        const orbitY = Math.sin(particle.orbitPhase) * particle.orbitRadius;

        let targetX = particle.anchorX + driftX + orbitX;
        let targetY = particle.anchorY + driftY + orbitY;

        // Cursor interaction - push particles away
        if (mouse.x !== null && mouse.y !== null) {
          const dx = targetX - mouse.x;
          const dy = targetY - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < mouse.radius) {
            const force = (mouse.radius - distance) / mouse.radius;
            const pushStrength = mouse.isClicked ? 25 : 15;
            const pushX = (dx / distance) * force * pushStrength;
            const pushY = (dy / distance) * force * pushStrength;

            targetX += pushX;
            targetY += pushY;
          }
        }

        // Smooth movement towards target
        particle.x += (targetX - particle.x) * 0.1;
        particle.y += (targetY - particle.y) * 0.1;

        // Update pulse effect
        particle.pulsePhase += particle.pulseSpeed;
      });

      // Draw connections first (behind particles)
      drawConnections();

      // Draw all particles
      particles.forEach(particle => {
        const pulseOpacity = particle.opacity * (0.7 + 0.3 * Math.sin(particle.pulsePhase));
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

    // Mouse event handlers - use overlay instead of canvas for better layering
    const handleMouseMove = (e) => {
      const overlay = canvas.parentElement; // Get the overlay element
      const rect = overlay.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
      mouseRef.current.isClicked = false;
    };

    const handleMouseDown = () => {
      mouseRef.current.isClicked = true;
    };

    const handleMouseUp = () => {
      mouseRef.current.isClicked = false;
    };

    // Theme change handler
    const handleThemeChange = () => {
      // Colors will be updated automatically on next frame
    };

    // Initialize
    resizeCanvas(); // This calls createParticles() and updateConnections()
    animate();

    // Add event listeners - use overlay for mouse events to avoid blocking buttons
    const overlay = canvas.parentElement;
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('storage', handleThemeChange);
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('mouseleave', handleMouseLeave);
    overlay.addEventListener('mousedown', handleMouseDown);
    overlay.addEventListener('mouseup', handleMouseUp);
    overlay.addEventListener('touchstart', handleMouseDown);
    overlay.addEventListener('touchend', handleMouseUp);
    overlay.addEventListener('touchcancel', handleMouseLeave);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('storage', handleThemeChange);
      if (overlay) {
        overlay.removeEventListener('mousemove', handleMouseMove);
        overlay.removeEventListener('mouseleave', handleMouseLeave);
        overlay.removeEventListener('mousedown', handleMouseDown);
        overlay.removeEventListener('mouseup', handleMouseUp);
        overlay.removeEventListener('touchstart', handleMouseDown);
        overlay.removeEventListener('touchend', handleMouseUp);
        overlay.removeEventListener('touchcancel', handleMouseLeave);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="onboarding-starry-canvas" />
  );
};

export default OnboardingStarryBackground;
