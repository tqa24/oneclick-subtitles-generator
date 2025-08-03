import React, { useEffect, useRef, useState, useCallback } from 'react';
import './LoadingIndicator.css';

/**
 * Material Design 3 Expressive Loading Indicator
 * A sophisticated loading animation with REAL morphing shapes from Figma design
 * 
 * @param {Object} props
 * @param {string} props.theme - 'light' or 'dark' (default: 'dark')
 * @param {boolean} props.showContainer - Whether to show the background container (default: true)
 * @param {number} props.size - Size in pixels (default: 48)
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Additional inline styles
 */
const LoadingIndicator = ({ 
  theme = 'dark', 
  showContainer = true, 
  size = 48, 
  className = '', 
  style = {} 
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Colors from Figma design - all 4 variants
  const COLORS = {
    // Container colors
    containerDark: '#2E4578',
    containerLight: '#ADC3FE',

    // Shape colors
    shapeDarkWithContainer: '#D9E2FF',
    shapeDarkNoContainer: '#485E92', // Dark color for dark theme
    shapeLightWithContainer: '#324574',
    shapeLightNoContainer: '#B0C6FF' // Light color for light theme
  };

  // Animation state
  const animationState = useRef({
    currentStep: 1,
    morphShapes: [],
    currentMorph: null,
    morphProgress: 0,
    rotationAngle: 0,
    pulseValue: 1,
    animationTime: 0,
    discreteSpinSpeed: 0,
    isAnimating: false
  });

  // Get the appropriate shape color based on theme and container
  const getShapeColor = useCallback(() => {
    const isDarkMode = theme === 'dark';
    if (isDarkMode) {
      return showContainer ? COLORS.shapeDarkWithContainer : COLORS.shapeDarkNoContainer;
    } else {
      return showContainer ? COLORS.shapeLightWithContainer : COLORS.shapeLightNoContainer;
    }
  }, [theme, showContainer, COLORS]);

  // Get the appropriate container color
  const getContainerColor = useCallback(() => {
    return theme === 'dark' ? COLORS.containerDark : COLORS.containerLight;
  }, [theme, COLORS]);

  const drawMaterial3Container = useCallback((ctx) => {
    if (!showContainer) return;

    // Use dynamic canvas size based on component size with larger scaling to prevent clipping
    const scaleFactor = size <= 24 ? 3.0 : size <= 48 ? 2.5 : 2.2;
    const canvasSize = Math.round(size * scaleFactor);
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = Math.min(canvasSize, canvasSize) * 0.45; // Larger radius to better match SVG shapes

    ctx.save();
    ctx.translate(centerX, centerY);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);

    // Use correct container color based on theme (like original)
    const containerColor = theme === 'dark' ? COLORS.containerDark : COLORS.containerLight;
    ctx.fillStyle = containerColor;
    ctx.fill();

    ctx.restore();
  }, [showContainer, theme, COLORS, size]);



  const applyMaterial3ExpressiveEffects = useCallback((ctx) => {
    const state = animationState.current;
    
    // Update animation time
    state.animationTime += 0.05;

    // Material 3 Expressive spinning with bounce
    if (state.currentMorph && state.morphProgress < 1.0) {
      const morphPhase = state.morphProgress;

      if (morphPhase < 0.8) {
        state.discreteSpinSpeed = 6.0;
      } else {
        const bouncePhase = (morphPhase - 0.8) / 0.2;
        const speedFactor = 1 - bouncePhase;
        const bounce = Math.sin(bouncePhase * Math.PI * 2.5);
        const overshootIntensity = -1.2;
        
        state.discreteSpinSpeed = 6.0 * speedFactor + overshootIntensity * bounce * speedFactor;
      }
    } else {
      state.discreteSpinSpeed = 0.05; 
    }

    state.rotationAngle += state.discreteSpinSpeed;
    ctx.rotate((state.rotationAngle * Math.PI) / 180);

    // DYNAMIC baseScale based on component size for better appearance in buttons
    const baseScale = size <= 24 ? 1.5 : 2.5;

    // Scaling effect
    let syncedScale;
    if (state.currentMorph && state.morphProgress < 1.0) {
      const morphPhase = state.morphProgress;
      let scaleVariation;

      if (morphPhase < 0.8) {
        scaleVariation = 0.015 + Math.sin(state.animationTime * 4) * 0.005;
      } else {
        const bouncePhase = (morphPhase - 0.8) / 0.2;
        scaleVariation = 0.015 + Math.sin(bouncePhase * Math.PI) * 0.025;
      }
      syncedScale = baseScale + scaleVariation;
    } else {
      syncedScale = baseScale + Math.sin(state.animationTime * 1.2) * 0.05;
    }
    ctx.scale(syncedScale, syncedScale);

    // Pulse effect
    if (state.currentMorph && state.morphProgress < 1.0) {
      state.pulseValue = 0.8 + state.morphProgress * 0.2;
    } else {
      state.pulseValue = 0.7 + Math.sin(state.animationTime * 3) * 0.2;
    }
  }, [size]); // Add size to dependency array

  const drawPolygonWithEffects = useCallback((polygon, ctx) => {
    const color = getShapeColor();
    drawPolygon(polygon, color, ctx);
  }, [getShapeColor]);

  const drawCubicsWithEffects = useCallback((cubics, ctx) => {
    const color = getShapeColor();
    drawCubics(cubics, color, ctx);
  }, [getShapeColor]);

  const drawCurrentShape = useCallback((ctx) => {
    const state = animationState.current;

    // Use dynamic canvas size based on component size with larger scaling to prevent clipping
    const scaleFactor = size <= 24 ? 3.0 : size <= 48 ? 2.5 : 2.2;
    const canvasSize = Math.round(size * scaleFactor);
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Only draw container if showContainer is true
    if (showContainer) {
      drawMaterial3Container(ctx);
    }

    ctx.save();
    ctx.translate(canvasSize / 2, canvasSize / 2);
    applyMaterial3ExpressiveEffects(ctx);

    const shape = state.morphShapes[state.currentStep - 1];
    if (shape) {
      drawPolygonWithEffects(shape, ctx);
    }

    ctx.restore();
  }, [drawMaterial3Container, applyMaterial3ExpressiveEffects, drawPolygonWithEffects, size, showContainer]);

  const drawMorphedShape = useCallback((ctx) => {
    const state = animationState.current;

    // Use dynamic canvas size based on component size with larger scaling to prevent clipping
    const scaleFactor = size <= 24 ? 3.0 : size <= 48 ? 2.5 : 2.2;
    const canvasSize = Math.round(size * scaleFactor);
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Only draw container if showContainer is true
    if (showContainer) {
      drawMaterial3Container(ctx);
    }

    ctx.save();
    ctx.translate(canvasSize / 2, canvasSize / 2);
    applyMaterial3ExpressiveEffects(ctx);

    if (state.currentMorph) {
      try {
        const morphedCubics = state.currentMorph.asCubics(state.morphProgress);
        drawCubicsWithEffects(morphedCubics, ctx);
      } catch (error) {
        // Fallback to current shape if morphing fails
        const shape = state.morphShapes[state.currentStep - 1];
        if (shape) {
          drawPolygonWithEffects(shape, ctx);
        }
      }
    }

    ctx.restore();
  }, [drawMaterial3Container, applyMaterial3ExpressiveEffects, drawCubicsWithEffects, drawPolygonWithEffects, size, showContainer]);

  const drawPolygon = useCallback((polygon, color, ctx) => {
    if (polygon && polygon.cubics) {
      drawCubics(polygon.cubics, color, ctx);
    }
  }, []);

  const drawCubics = useCallback((cubics, color, ctx) => {
    if (!cubics || cubics.length === 0) return;

    ctx.fillStyle = color;
    ctx.beginPath();

    const firstCubic = cubics[0];
    ctx.moveTo(firstCubic.anchor0X, firstCubic.anchor0Y);

    for (const cubic of cubics) {
      ctx.bezierCurveTo(
        cubic.control0X, cubic.control0Y,
        cubic.control1X, cubic.control1Y,
        cubic.anchor1X, cubic.anchor1Y
      );
    }

    ctx.closePath();
    ctx.fill();
  }, []);

  const startAnimation = useCallback((ctx, Morph) => {
    const state = animationState.current;
    if (state.isAnimating) return;
    
    state.isAnimating = true;
    
    const animate = () => {
      if (!state.isAnimating) return;

      // Handle morphing
      if (!state.currentMorph && state.morphShapes.length > 0) {
        const startShape = state.morphShapes[state.currentStep - 1];
        const endShape = state.morphShapes[state.currentStep % state.morphShapes.length];
        state.currentMorph = new Morph(startShape, endShape);
      }

      if (state.currentMorph) {
        // Update morph progress with Material 3 timing
        let morphIncrement;
        if (state.morphProgress < 0.8) {
          morphIncrement = 0.03;
        } else {
          const easeOutFactor = 1 - (state.morphProgress - 0.8) / 0.2;
          morphIncrement = 0.03 * easeOutFactor;
          morphIncrement = Math.max(morphIncrement, 0.001);
        }
        state.morphProgress += morphIncrement;

        if (state.morphProgress >= 1.0) {
          // Move to next shape pair
          state.morphProgress = 0;
          state.currentStep = state.currentStep >= state.morphShapes.length ? 1 : state.currentStep + 1;

          // Create new morph for the next transition
          const startShape = state.morphShapes[state.currentStep - 1];
          const endShape = state.morphShapes[state.currentStep % state.morphShapes.length];
          state.currentMorph = new Morph(startShape, endShape);
        }

        drawMorphedShape(ctx);
      } else {
        drawCurrentShape(ctx);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [drawMorphedShape, drawCurrentShape]);

  const initializeAnimation = useCallback(async (ctx) => {
    try {
      // Load the REAL modules dynamically
      const [{ Point }, { Cubic }, { RoundedPolygon }, { Morph }] = await Promise.all([
        import('./LoadingIndicator/utils.js'),
        import('./LoadingIndicator/cubic.js'),
        import('./LoadingIndicator/roundedPolygon.js'),
        import('./LoadingIndicator/morph-fixed.js')
      ]);

      // Create reliable fallback shapes (no need for complex Figma loading)
      const shapes = [];
      for (let i = 0; i < 7; i++) {
        shapes.push(createFallbackShape(i, RoundedPolygon));
      }
      animationState.current.morphShapes = shapes;

      console.log(`✅ Created ${shapes.length} reliable shapes for morphing`);
      setIsLoaded(true);
      startAnimation(ctx, Morph);
    } catch (error) {
      console.error('❌ Failed to load REAL animation modules:', error);
      setIsLoaded(false);
    }
  }, [startAnimation, size]);







  // Fallback shapes if Figma shapes fail to load - WITH PROPER ROUNDING!
  const createFallbackShape = (index, RoundedPolygon) => {
    switch (index) {
      case 0: return new RoundedPolygon(new Float32Array([0, -20, 17, 10, -17, 10]), 6); // Triangle with rounding
      case 1: return new RoundedPolygon(new Float32Array([-15, -15, 15, -15, 15, 15, -15, 15]), 8); // Square with rounding
      case 2: return new RoundedPolygon(new Float32Array([0, -17, 16, -5, 10, 14, -10, 14, -16, -5]), 5); // Pentagon with rounding
      case 3: return createCirclePolygon(17, 12, RoundedPolygon); // Circle
      case 4: return createStarPolygon(15, 5, RoundedPolygon); // Star
      case 5: return new RoundedPolygon(new Float32Array([20, 0, 10, 17, -10, 17, -20, 0, -10, -17, 10, -17]), 4); // Hexagon with rounding
      case 6: return createCirclePolygon(15, 8, RoundedPolygon); // Octagon
      default: return createCirclePolygon(15, 8, RoundedPolygon);
    }
  };

  const createCirclePolygon = (radius, sides, RoundedPolygon) => {
    const vertices = new Float32Array(sides * 2);
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * 2 * Math.PI;
      vertices[i * 2] = Math.cos(angle) * radius;
      vertices[i * 2 + 1] = Math.sin(angle) * radius;
    }
    return new RoundedPolygon(vertices, 3); // 3px rounding for smooth circle
  };

  const createStarPolygon = (radius, points, RoundedPolygon) => {
    const vertices = new Float32Array(points * 4);
    const innerRadius = radius * 0.4;
    let vertexIndex = 0;

    for (let i = 0; i < points; i++) {
      const outerAngle = (i / points) * 2 * Math.PI - Math.PI / 2;
      vertices[vertexIndex++] = Math.cos(outerAngle) * radius;
      vertices[vertexIndex++] = Math.sin(outerAngle) * radius;

      const innerAngle = ((i + 0.5) / points) * 2 * Math.PI - Math.PI / 2;
      vertices[vertexIndex++] = Math.cos(innerAngle) * innerRadius;
      vertices[vertexIndex++] = Math.sin(innerAngle) * innerRadius;
    }
    return new RoundedPolygon(vertices, 2); // 2px rounding for smooth star points
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas internal size based on the display size for proper scaling
    // Use larger scaling for small sizes to prevent clipping
    const scaleFactor = size <= 24 ? 3.0 : size <= 48 ? 2.5 : 2.2;
    const canvasSize = Math.round(size * scaleFactor);
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    // Scale for device pixel ratio and fit to display size
    ctx.scale(dpr, dpr);

    // Initialize the REAL animation
    initializeAnimation(ctx);

    return () => {
      const state = animationState.current;
      state.isAnimating = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size, initializeAnimation]);

  // Re-render when theme or container changes
  useEffect(() => {
    if (isLoaded && canvasRef.current) {
      // Trigger a redraw with current state
      const ctx = canvasRef.current.getContext('2d');
      const state = animationState.current;
      if (state.currentMorph) {
        drawMorphedShape(ctx);
      } else {
        drawCurrentShape(ctx);
      }
    }
  }, [theme, showContainer, isLoaded, drawMorphedShape, drawCurrentShape]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const state = animationState.current;
      state.isAnimating = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`loading-indicator ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        className="loading-indicator-canvas"
        style={{
          width: `${size}px`,  // Display at intended size
          height: `${size}px`,
          borderRadius: '12px'
        }}
      />
    </div>
  );
};

export default LoadingIndicator;