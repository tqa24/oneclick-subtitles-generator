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
  const cometsRef = useRef([]);
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

    // Create a new comet
    const createComet = (cssWidth, cssHeight) => {
      const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
      let startX, startY, endX, endY;

      // Start from random edge, go to opposite area
      switch (side) {
        case 0: // From top
          startX = Math.random() * cssWidth;
          startY = -50;
          endX = Math.random() * cssWidth;
          endY = cssHeight + 50;
          break;
        case 1: // From right
          startX = cssWidth + 50;
          startY = Math.random() * cssHeight;
          endX = -50;
          endY = Math.random() * cssHeight;
          break;
        case 2: // From bottom
          startX = Math.random() * cssWidth;
          startY = cssHeight + 50;
          endX = Math.random() * cssWidth;
          endY = -50;
          break;
        case 3: // From left
          startX = -50;
          startY = Math.random() * cssHeight;
          endX = cssWidth + 50;
          endY = Math.random() * cssHeight;
          break;
      }

      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = 1.5 + Math.random() * 2.5; // Slightly slower for more majestic feel

      return {
        x: startX,
        y: startY,
        velocityX: (dx / distance) * speed,
        velocityY: (dy / distance) * speed,
        size: 8 + Math.random() * 4, // Larger for visible star shape
        opacity: 0.95 + Math.random() * 0.05,
        gravityRadius: 120 + Math.random() * 60, // Larger gravity field
        gravityStrength: 15 + Math.random() * 10,
        life: 0,
        maxLife: distance / speed,
        brightness: 0.9 + Math.random() * 0.3,
        // Star-specific properties
        rotation: Math.random() * Math.PI * 2, // Initial rotation
        rotationSpeed: 0.05 + Math.random() * 0.1, // Spinning speed
        glowIntensity: 0.8 + Math.random() * 0.4, // Individual glow strength
        sparkles: [], // Particle sparkles around comet
        maxSparkles: 8 + Math.floor(Math.random() * 12)
      };
    };

    // Manage comets - spawn occasionally
    const manageComets = (cssWidth, cssHeight) => {
      const comets = cometsRef.current;

      // Spawn new comet occasionally (every 8-15 seconds on average)
      if (Math.random() < 0.001) { // ~0.1% chance per frame at 60fps - more rare and special
        comets.push(createComet(cssWidth, cssHeight));
      }

      // Update existing comets
      for (let i = comets.length - 1; i >= 0; i--) {
        const comet = comets[i];

        // Update position
        comet.x += comet.velocityX;
        comet.y += comet.velocityY;
        comet.life++;

        // No trail storage needed anymore

        // Manage sparkles around comet
        if (comet.sparkles.length < comet.maxSparkles && Math.random() < 0.3) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 5 + Math.random() * 15;
          comet.sparkles.push({
            x: comet.x + Math.cos(angle) * distance,
            y: comet.y + Math.sin(angle) * distance,
            velocityX: (Math.random() - 0.5) * 2,
            velocityY: (Math.random() - 0.5) * 2,
            size: 0.5 + Math.random() * 1,
            opacity: 0.6 + Math.random() * 0.4,
            life: 0,
            maxLife: 20 + Math.random() * 30
          });
        }

        // Update sparkles
        for (let j = comet.sparkles.length - 1; j >= 0; j--) {
          const sparkle = comet.sparkles[j];
          sparkle.x += sparkle.velocityX;
          sparkle.y += sparkle.velocityY;
          sparkle.velocityX *= 0.98; // Drag
          sparkle.velocityY *= 0.98;
          sparkle.life++;
          sparkle.opacity *= 0.96; // Fade out

          if (sparkle.life > sparkle.maxLife || sparkle.opacity < 0.01) {
            comet.sparkles.splice(j, 1);
          }
        }

        // Remove comet if it's lived its full life
        if (comet.life > comet.maxLife) {
          comets.splice(i, 1);
        }
      }
    };

    // Draw a 5-point star
    const draw5PointStar = (x, y, size, rotation, opacity, brightness) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      const outerRadius = size;
      const innerRadius = size * 0.4;

      // Create star path
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const pointX = Math.cos(angle) * radius;
        const pointY = Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(pointX, pointY);
        } else {
          ctx.lineTo(pointX, pointY);
        }
      }
      ctx.closePath();

      // Gold gradient fill
      const starGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
      starGradient.addColorStop(0, `rgba(255, 255, 200, ${opacity * brightness})`);
      starGradient.addColorStop(0.3, `rgba(255, 215, 100, ${opacity * brightness * 0.9})`);
      starGradient.addColorStop(0.7, `rgba(255, 180, 50, ${opacity * brightness * 0.8})`);
      starGradient.addColorStop(1, `rgba(200, 140, 30, ${opacity * brightness * 0.6})`);

      ctx.fillStyle = starGradient;
      ctx.fill();

      // Gold outline
      ctx.strokeStyle = `rgba(255, 215, 100, ${opacity * brightness})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    };

    // Draw comets with professional sparkle effects
    const drawComets = () => {
      const comets = cometsRef.current;
      const colors = getThemeColors();

      if (!colors.isDark) return; // Only show comets in dark mode

      comets.forEach(comet => {
        // Update rotation for spinning effect
        comet.rotation += comet.rotationSpeed;

        // Draw multiple glow layers behind the star
        const glowLayers = [
          { radius: comet.size * 4, opacity: 0.15, color: [255, 215, 100] },
          { radius: comet.size * 2.5, opacity: 0.25, color: [255, 235, 150] },
          { radius: comet.size * 1.5, opacity: 0.4, color: [255, 245, 200] }
        ];

        glowLayers.forEach(layer => {
          const glowGradient = ctx.createRadialGradient(
            comet.x, comet.y, 0,
            comet.x, comet.y, layer.radius
          );
          glowGradient.addColorStop(0, `rgba(${layer.color.join(',')}, ${layer.opacity * comet.opacity * comet.glowIntensity})`);
          glowGradient.addColorStop(0.6, `rgba(${layer.color.join(',')}, ${layer.opacity * comet.opacity * comet.glowIntensity * 0.3})`);
          glowGradient.addColorStop(1, `rgba(${layer.color.join(',')}, 0)`);

          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(comet.x, comet.y, layer.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw the spinning gold 5-point star
        draw5PointStar(comet.x, comet.y, comet.size, comet.rotation, comet.opacity, comet.brightness);

        // Draw sparkles around comet
        comet.sparkles.forEach(sparkle => {
          ctx.save();

          // Sparkle glow
          const sparkleGlow = ctx.createRadialGradient(
            sparkle.x, sparkle.y, 0,
            sparkle.x, sparkle.y, sparkle.size * 3
          );
          sparkleGlow.addColorStop(0, `rgba(255, 255, 255, ${sparkle.opacity * 0.8})`);
          sparkleGlow.addColorStop(0.5, `rgba(200, 240, 255, ${sparkle.opacity * 0.4})`);
          sparkleGlow.addColorStop(1, `rgba(120, 200, 255, 0)`);

          ctx.fillStyle = sparkleGlow;
          ctx.beginPath();
          ctx.arc(sparkle.x, sparkle.y, sparkle.size * 3, 0, Math.PI * 2);
          ctx.fill();

          // Sparkle core
          ctx.fillStyle = `rgba(255, 255, 255, ${sparkle.opacity})`;
          ctx.beginPath();
          ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        });
      });
    };

    // Apply gravity effects from comets to stars
    const applyCometGravity = (particles) => {
      const comets = cometsRef.current;

      comets.forEach(comet => {
        particles.forEach(particle => {
          const dx = comet.x - particle.x;
          const dy = comet.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < comet.gravityRadius && distance > 0) {
            const force = (comet.gravityRadius - distance) / comet.gravityRadius;
            const pullStrength = force * comet.gravityStrength * 0.02;

            // Add velocity toward comet (realistic physics)
            particle.velocityX += (dx / distance) * pullStrength;
            particle.velocityY += (dy / distance) * pullStrength;

            // Add some orbital velocity for swirl effect
            const perpX = -dy / distance;
            const perpY = dx / distance;
            particle.velocityX += perpX * pullStrength * 0.5;
            particle.velocityY += perpY * pullStrength * 0.5;
          }
        });
      });
    };

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

        const dx = particles[fromIndex].x - particles[toIndex].x;
        const dy = particles[fromIndex].y - particles[toIndex].y;
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

        // Galaxy flow properties
        const centerX = cssWidth / 2;
        const centerY = cssHeight / 2;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const angleFromCenter = Math.atan2(y - centerY, x - centerX);

        particles.push({
          x,
          y,
          size,
          isFilled,
          rotation,
          opacity,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.015 + Math.random() * 0.012,
          breathePhase: Math.random() * Math.PI * 2,
          breatheSpeed: 0.006 + Math.random() * 0.008,
          breatheAmplitude: 0.12 + Math.random() * 0.20,
          isTwinkler: Math.random() < 0.25,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.005 + Math.random() * 0.008,
          twinkleIntensity: 0.08 + Math.random() * 0.15,
          starTemp: Math.random(),
          colorIntensity: 1.0 + Math.random() * 0.5,
          // Galaxy flow properties
          galaxyAngle: angleFromCenter,
          galaxyRadius: distanceFromCenter,
          galaxySpeed: 0.001 + Math.random() * 0.002, // Base rotation speed
          spiralSpeed: 0.0005 + Math.random() * 0.001, // Spiral inward/outward speed
          spiralDirection: Math.random() > 0.5 ? 1 : -1, // Some spiral in, some out
          // Realistic physics properties
          velocityX: 0, // Current velocity from external forces
          velocityY: 0,
          dragCoefficient: 0.98, // Slight drag to prevent infinite acceleration
          // Add some randomness to make it more organic
          turbulence: Math.random() * 0.5 + 0.2,
          turbulencePhase: Math.random() * Math.PI * 2,
          turbulenceSpeed: 0.002 + Math.random() * 0.003
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

      const centerX = canvas.width / (window.devicePixelRatio || 1) / 2;
      const centerY = canvas.height / (window.devicePixelRatio || 1) / 2;

      // Get canvas dimensions for comet management
      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      // Manage comets
      manageComets(cssWidth, cssHeight);

      particles.forEach(particle => {
        // Update animation phases
        particle.pulsePhase += particle.pulseSpeed;
        particle.breathePhase += particle.breatheSpeed;
        particle.turbulencePhase += particle.turbulenceSpeed;

        if (particle.isTwinkler) {
          particle.twinklePhase += particle.twinkleSpeed;
          particle.rotation = Math.sin(particle.twinklePhase) * particle.twinkleIntensity;
        }

        // Apply drag to velocity for realistic physics
        particle.velocityX *= particle.dragCoefficient;
        particle.velocityY *= particle.dragCoefficient;

        // Galaxy flow movement - much gentler pull toward ideal position
        particle.galaxyAngle += particle.galaxySpeed;
        particle.galaxyRadius += particle.spiralSpeed * particle.spiralDirection;

        // Add turbulence for organic movement
        const turbulenceX = Math.sin(particle.turbulencePhase) * particle.turbulence;
        const turbulenceY = Math.cos(particle.turbulencePhase * 1.3) * particle.turbulence;

        // Calculate ideal galaxy position
        const idealX = centerX + Math.cos(particle.galaxyAngle) * particle.galaxyRadius;
        const idealY = centerY + Math.sin(particle.galaxyAngle) * particle.galaxyRadius;

        // Very gentle pull toward ideal position (much weaker than before)
        const pullToIdealX = (idealX + turbulenceX - particle.x) * 0.005; // Much weaker pull
        const pullToIdealY = (idealY + turbulenceY - particle.y) * 0.005;

        particle.velocityX += pullToIdealX;
        particle.velocityY += pullToIdealY;

        // Keep stars within reasonable bounds but allow smooth flow
        const rect = canvas.getBoundingClientRect();
        const cssWidth = rect.width;
        const cssHeight = rect.height;
        const maxRadius = Math.max(cssWidth, cssHeight) * 0.8;

        // If star gets too far from center, gently guide it back
        if (particle.galaxyRadius > maxRadius) {
          particle.spiralDirection = -1; // Force inward spiral
          particle.spiralSpeed = Math.abs(particle.spiralSpeed) * 1.5; // Speed up return
        } else if (particle.galaxyRadius < 50) {
          particle.spiralDirection = 1; // Force outward spiral
          particle.spiralSpeed = Math.abs(particle.spiralSpeed) * 1.5; // Speed up expansion
        }

        // Cursor interaction - add velocity away from cursor
        if (mouse.x !== null && mouse.y !== null) {
          const dx = particle.x - mouse.x;
          const dy = particle.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < mouse.radius && distance > 0) {
            const force = (mouse.radius - distance) / mouse.radius;
            const pushStrength = mouse.isClicked ? 0.8 : 0.4;
            const pushX = (dx / distance) * force * pushStrength;
            const pushY = (dy / distance) * force * pushStrength;

            particle.velocityX += pushX;
            particle.velocityY += pushY;
          }
        }

        // Apply velocity to position (realistic physics)
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
      });

      // Apply comet gravity effects to stars
      applyCometGravity(particles);

      // Update connections dynamically based on current positions
      updateConnections();

      // Draw connections first (behind particles)
      drawConnections();

      // Draw comets with sparkle effects (above connections, below stars)
      drawComets();

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
