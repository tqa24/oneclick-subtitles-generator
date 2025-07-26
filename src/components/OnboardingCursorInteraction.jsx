import { useEffect, useRef } from 'react';

/**
 * OnboardingCursorInteraction - Adds cursor avoidance behavior to SVG paths
 * Similar to the gemini-header-canvas interaction but for the onboarding banner
 */
const OnboardingCursorInteraction = ({ children, isDismissing, canDismiss }) => {

  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: null, y: null, isClicked: false });
  const pathDataRef = useRef(new Map()); // Store original path data and current positions

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    const paths = svg.querySelectorAll('path[data-index]');
    if (!paths.length) return;

    // Inject cursor avoidance CSS into the SVG
    const injectCursorAvoidanceCSS = () => {
      const existingStyle = svg.querySelector('style');
      if (existingStyle && !existingStyle.textContent.includes('--cursor-offset')) {
        const cursorCSS = `
          /* Cursor avoidance enhancement */
          path {
            --cursor-offset-x: 0px;
            --cursor-offset-y: 0px;
          }

          /* Override existing keyframes to include cursor offset */
          @keyframes fadeInScaleUp {
            from { opacity: 0; transform: scale(0.8) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
            to   { opacity: 1; transform: scale(1) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
          }

          @keyframes fadeInScaleRotate {
            from { opacity: 0; transform: scale(0.7) rotate(-15deg) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
            to   { opacity: 1; transform: scale(1) rotate(0deg) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
          }

          @keyframes gentlePulse {
            0%, 100% { transform: scale(1) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
            50%      { transform: scale(1.03) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
          }

          @keyframes subtleFloat {
            0%, 100% { transform: translateY(0px) rotate(0deg) scale(1) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
            25%      { transform: translateY(-1.5px) rotate(-0.7deg) scale(1) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
            75%      { transform: translateY(1px) rotate(0.5deg) scale(1) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
          }

          @keyframes shimmer {
            0%, 100% { opacity: 0.6; transform: scale(1) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
            50%      { opacity: 1; transform: scale(1.08) translate(var(--cursor-offset-x), var(--cursor-offset-y)); }
          }
        `;
        existingStyle.textContent += cursorCSS;
        // CSS injected successfully
      }
    };

    // Initialize path data storage
    const initializePaths = () => {
      paths.forEach(path => {
        const dataIndex = path.getAttribute('data-index');
        if (!dataIndex) return;

        // Get the bounding box to find the center point
        const bbox = path.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        // Store original data
        pathDataRef.current.set(dataIndex, {
          element: path,
          originalTransform: path.style.transform || '',
          anchorX: centerX,
          anchorY: centerY,
          currentX: centerX,
          currentY: centerY,
          isAnimating: false, // Track if path is in entrance animation
          hasEnteredIdle: false // Track if path has completed entrance and is in idle state
        });
      });
    };

    // Check if a path has completed its entrance animation and is in idle state
    const isPathInIdleState = (pathData) => {
      const path = pathData.element;

      // Check if the path has finished its entrance animation
      // We can detect this by checking if the opacity is 1 (entrance complete)
      const computedStyle = window.getComputedStyle(path);
      const opacity = parseFloat(computedStyle.opacity);

      // If opacity is 1, the entrance animation is complete
      if (opacity >= 0.99 && !pathData.hasEnteredIdle) {
        pathData.hasEnteredIdle = true;
      }

      return pathData.hasEnteredIdle;
    };

    // Apply cursor avoidance effect
    const applyCursorAvoidance = () => {
      if (mouseRef.current.x === null || mouseRef.current.y === null) {
        // console.log('🚫 No mouse position, skipping avoidance');
        return;
      }
      const containerRect = container.getBoundingClientRect();

      // Use container coordinates instead of SVG rect
      const containerX = mouseRef.current.x;
      const containerY = mouseRef.current.y;

      // Convert to SVG coordinates properly
      const viewBox = svg.viewBox.baseVal;
      const scaleX = viewBox.width / containerRect.width;
      const scaleY = viewBox.height / containerRect.height;
      const svgMouseX = containerX * scaleX;
      const svgMouseY = containerY * scaleY;

      let pathsProcessed = 0;
      let pathsWithAvoidance = 0;

      pathDataRef.current.forEach((pathData) => {
        pathsProcessed++;
        const path = pathData.element;

        // Only apply avoidance if the path is in idle state or during entrance animation
        const inIdleState = isPathInIdleState(pathData);
        const computedStyle = window.getComputedStyle(path);
        const opacity = parseFloat(computedStyle.opacity);

        // Apply avoidance if path is visible (opacity > 0) and either in idle or entrance animation
        if (opacity > 0.1) {
          // Calculate distance from mouse to path center
          const dx = pathData.anchorX - svgMouseX;
          const dy = pathData.anchorY - svgMouseY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Interaction radius - reduced intensity
          const baseRadius = inIdleState ? 100 : 80;
          const interactionRadius = mouseRef.current.isClicked ? baseRadius * 1.5 : baseRadius;

          if (distance < interactionRadius) {
            pathsWithAvoidance++;
            // Calculate repulsion force
            const forceFactor = mouseRef.current.isClicked ? 2.5 : 1.8;
            const force = Math.pow((interactionRadius - distance) / interactionRadius, forceFactor);
            const angle = Math.atan2(dy, dx);

            // Apply movement away from cursor - reduced intensity
            const maxOffset = mouseRef.current.isClicked ? 40 : 25;
            const offsetX = Math.cos(angle) * force * maxOffset;
            const offsetY = Math.sin(angle) * force * maxOffset;

            pathData.currentX = pathData.anchorX + offsetX;
            pathData.currentY = pathData.anchorY + offsetY;

            // Removed debug logging
          } else {
            // Return to anchor position when mouse is far away
            const returnSpeed = 0.1;
            pathData.currentX += (pathData.anchorX - pathData.currentX) * returnSpeed;
            pathData.currentY += (pathData.anchorY - pathData.currentY) * returnSpeed;
          }

          // Apply cursor avoidance using CSS custom properties that work WITH animations
          const translateX = pathData.currentX - pathData.anchorX;
          const translateY = pathData.currentY - pathData.anchorY;

          // Set CSS custom properties for cursor offset that work with injected CSS
          path.style.setProperty('--cursor-offset-x', `${translateX}px`);
          path.style.setProperty('--cursor-offset-y', `${translateY}px`);

          // Store current position for dismissal animation
          pathData.dismissalStartX = pathData.currentX;
          pathData.dismissalStartY = pathData.currentY;
        }
      });

      // Removed debug logging
    };

    // Apply current cursor positions to dismissal animation
    const applyDismissalPositions = () => {
      pathDataRef.current.forEach((pathData) => {
        const path = pathData.element;
        const currentOffsetX = pathData.currentX - pathData.anchorX;
        const currentOffsetY = pathData.currentY - pathData.anchorY;

        // Set CSS custom properties for the dismissal animation to start from current position
        path.style.setProperty('--dismissal-start-x', `${currentOffsetX}px`);
        path.style.setProperty('--dismissal-start-y', `${currentOffsetY}px`);
      });
    };

    // Animation loop
    const animate = () => {
      if (!isDismissing) {
        applyCursorAvoidance();
      } else {
        // When dismissing starts, apply current positions to dismissal animation
        applyDismissalPositions();
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    // Mouse event handlers
    const handleMouseMove = (e) => {
      // Allow cursor interaction during entrance animations and idle state, but not during dismissal
      if (isDismissing) return;

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
      mouseRef.current.isClicked = false;
    };

    const handleMouseDown = () => {
      if (isDismissing) return;
      mouseRef.current.isClicked = true;
    };

    const handleMouseUp = () => {
      mouseRef.current.isClicked = false;
    };

    // Touch event handlers for mobile
    const handleTouchStart = (e) => {
      if (isDismissing) return;
      if (e.touches.length > 0) {
        const rect = container.getBoundingClientRect();
        mouseRef.current.x = e.touches[0].clientX - rect.left;
        mouseRef.current.y = e.touches[0].clientY - rect.top;
        mouseRef.current.isClicked = true;
      }
    };

    const handleTouchMove = (e) => {
      if (isDismissing) return;
      if (e.touches.length > 0) {
        const rect = container.getBoundingClientRect();
        mouseRef.current.x = e.touches[0].clientX - rect.left;
        mouseRef.current.y = e.touches[0].clientY - rect.top;
      }
    };

    const handleTouchEnd = () => {
      mouseRef.current.isClicked = false;
      // Keep the position for a moment before clearing
      setTimeout(() => {
        mouseRef.current.x = null;
        mouseRef.current.y = null;
      }, 100);
    };

    // Initialize and start animation
    injectCursorAvoidanceCSS();
    initializePaths();
    animate();

    // Add event listeners
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDismissing, canDismiss]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        overflow: 'visible'
      }}
    >
      {children}
    </div>
  );
};

export default OnboardingCursorInteraction;
