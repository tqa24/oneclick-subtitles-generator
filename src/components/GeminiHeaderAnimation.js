import React, { useEffect, useRef } from 'react';
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

  // Initialize the animation
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    let connections = [];

    // Set canvas dimensions
    const resizeCanvas = () => {
      const header = canvas.parentElement;
      canvas.width = header.offsetWidth;
      canvas.height = header.offsetHeight;

      // If particles exist, recalculate connections
      if (particles.length > 0) {
        updateConnections();
      }
    };

    // Create particles
    const createParticles = () => {
      const particleCount = Math.max(5, Math.floor(canvas.width / 100)); // Responsive particle count
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        const size = 8 + Math.random() * 8; // 8-16px
        const anchorX = Math.random() * canvas.width;
        const anchorY = Math.random() * canvas.height;
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
          pulseSpeed: 0.03 + Math.random() * 0.02 // Random pulse speed
        });
      }

      particlesRef.current = particles;
    };

    // Update connections between particles
    const updateConnections = () => {
      connections = [];

      // Create connections between nearby anchor points
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          // Calculate distance between anchor points (not current positions)
          const dx = particles[i].anchorX - particles[j].anchorX;
          const dy = particles[i].anchorY - particles[j].anchorY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Connect particles whose anchors are close enough
          if (distance < 150) {
            const opacity = 1 - (distance / 150); // Fade with distance
            connections.push({
              from: i,
              to: j,
              opacity: opacity * 0.2 // Max opacity 0.2
            });
          }
        }
      }

      connectionsRef.current = connections;
    };

    // Draw a single Gemini icon
    const drawGeminiIcon = (x, y, size, rotation, isFilled, opacity) => {
      ctx.save();
      // Translate to the center point
      ctx.translate(x, y);
      ctx.rotate(rotation);
      // The Gemini icon is drawn in a 28x28 viewBox with center at (14,14)
      ctx.scale(size / 28, size / 28); // Scale to desired size

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

      // Fill or stroke based on the type
      if (isFilled) {
        const gradient = ctx.createLinearGradient(-14, -14, 14, 14);
        gradient.addColorStop(0, `rgba(145, 104, 192, ${opacity})`);
        gradient.addColorStop(0.5, `rgba(86, 132, 209, ${opacity})`);
        gradient.addColorStop(1, `rgba(27, 161, 227, ${opacity})`);

        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    };

    // Draw connections between particles
    const drawConnections = () => {
      connections.forEach(connection => {
        const p1 = particles[connection.from];
        const p2 = particles[connection.to];

        // Calculate the exact center of each star
        // The Gemini icon's center is at (14, 14) in a 28x28 viewBox
        // But since we're drawing at the center already, we don't need to adjust

        // Draw the connection line
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${connection.opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update all particles
      particles.forEach(particle => {
        // Default position is at anchor point
        particle.x = particle.anchorX;
        particle.y = particle.anchorY;

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

        // No rotation updates needed

        // Update pulse effect
        particle.pulsePhase += particle.pulseSpeed;
      });

      // Draw connections first (so they appear behind the particles)
      // We don't need to update connections since they're based on fixed anchor points
      drawConnections();

      // Finally draw all particles
      particles.forEach(particle => {
        const pulseOpacity = particle.opacity * (0.7 + 0.3 * Math.sin(particle.pulsePhase));

        drawGeminiIcon(
          particle.x,
          particle.y,
          particle.size,
          particle.rotation,
          particle.isFilled,
          pulseOpacity
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
    resizeCanvas();
    createParticles();
    // Calculate connections once since they're based on fixed anchor points
    updateConnections();
    animate();

    // Add event listeners
    window.addEventListener('resize', resizeCanvas);
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
