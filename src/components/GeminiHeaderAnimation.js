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
  const mouseRef = useRef({ x: null, y: null, radius: 100 });

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
    };

    // Create particles
    const createParticles = () => {
      const particleCount = Math.max(5, Math.floor(canvas.width / 100)); // Responsive particle count
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        const size = 8 + Math.random() * 8; // 8-16px
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const dirX = (Math.random() - 0.5) * 0.5;
        const dirY = (Math.random() - 0.5) * 0.5;
        const isFilled = Math.random() > 0.7; // 30% chance of filled icons
        const rotation = Math.random() * Math.PI * 2;
        const rotationSpeed = (Math.random() - 0.5) * 0.02;
        const opacity = 0.3 + Math.random() * 0.3; // 0.3-0.6 opacity

        particles.push({
          x,
          y,
          size,
          dirX,
          dirY,
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
      
      // Create connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Connect particles that are close enough
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
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(size / 28, size / 28); // Scale to desired size (original viewBox is 28x28)
      
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
      
      // Update and draw connections
      updateConnections();
      drawConnections();
      
      // Update and draw particles
      particles.forEach((particle, index) => {
        // Update position
        particle.x += particle.dirX;
        particle.y += particle.dirY;
        
        // Boundary check with bounce
        if (particle.x < 0 || particle.x > canvas.width) {
          particle.dirX *= -1;
        }
        
        if (particle.y < 0 || particle.y > canvas.height) {
          particle.dirY *= -1;
        }
        
        // Update rotation
        particle.rotation += particle.rotationSpeed;
        
        // Update pulse effect
        particle.pulsePhase += particle.pulseSpeed;
        const pulseOpacity = particle.opacity * (0.7 + 0.3 * Math.sin(particle.pulsePhase));
        
        // Mouse interaction
        if (mouseRef.current.x !== null && mouseRef.current.y !== null) {
          const dx = particle.x - mouseRef.current.x;
          const dy = particle.y - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouseRef.current.radius) {
            // Repel from mouse
            const force = (mouseRef.current.radius - distance) / mouseRef.current.radius;
            const angle = Math.atan2(dy, dx);
            particle.dirX += Math.cos(angle) * force * 0.2;
            particle.dirY += Math.sin(angle) * force * 0.2;
            
            // Limit speed
            const speed = Math.sqrt(particle.dirX * particle.dirX + particle.dirY * particle.dirY);
            if (speed > 2) {
              particle.dirX = (particle.dirX / speed) * 2;
              particle.dirY = (particle.dirY / speed) * 2;
            }
          }
        }
        
        // Apply friction
        particle.dirX *= 0.99;
        particle.dirY *= 0.99;
        
        // Draw the particle
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

    // Handle mouse movement
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    // Handle mouse leave
    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    // Initialize
    resizeCanvas();
    createParticles();
    animate();
    
    // Add event listeners
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    // Store animation frame ID for cleanup
    animationRef.current = animationFrameId;
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="gemini-header-canvas" />
  );
};

export default GeminiHeaderAnimation;
