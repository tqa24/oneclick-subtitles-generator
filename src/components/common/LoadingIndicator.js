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
    isAnimating: false,
    currentShapeIndex: 0,
    nextShapeIndex: 1,
    shapeOrder: []
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

    // Use random shape order if available, otherwise fall back to sequential
    const shapeIndex = state.shapeOrder.length > 0
      ? state.shapeOrder[state.currentShapeIndex]
      : state.currentStep - 1;
    const shape = state.morphShapes[shapeIndex];
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

  // Generate random shape order
  const generateRandomShapeOrder = useCallback((shapeCount) => {
    const indices = Array.from({ length: shapeCount }, (_, i) => i);
    // Fisher-Yates shuffle algorithm
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, []);

  const startAnimation = useCallback((ctx, Morph) => {
    const state = animationState.current;
    if (state.isAnimating) return;

    state.isAnimating = true;

    // Initialize random shape order if not already set
    if (state.shapeOrder.length === 0) {
      state.shapeOrder = generateRandomShapeOrder(state.morphShapes.length);
      state.currentShapeIndex = 0;
      state.nextShapeIndex = 1;
    }

    const animate = () => {
      if (!state.isAnimating) return;

      // Handle morphing
      if (!state.currentMorph && state.morphShapes.length > 0) {
        const currentIndex = state.shapeOrder[state.currentShapeIndex];
        const nextIndex = state.shapeOrder[state.nextShapeIndex];
        const startShape = state.morphShapes[currentIndex];
        const endShape = state.morphShapes[nextIndex];
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
          // Move to next shape pair in random order
          state.morphProgress = 0;
          state.currentShapeIndex = state.nextShapeIndex;
          state.nextShapeIndex = (state.nextShapeIndex + 1) % state.shapeOrder.length;

          // If we've completed a full cycle, generate new random order
          if (state.nextShapeIndex === 0) {
            state.shapeOrder = generateRandomShapeOrder(state.morphShapes.length);
            state.currentShapeIndex = 0;
            state.nextShapeIndex = 1;
          }

          // Create new morph for the next transition
          const currentIndex = state.shapeOrder[state.currentShapeIndex];
          const nextIndex = state.shapeOrder[state.nextShapeIndex];
          const startShape = state.morphShapes[currentIndex];
          const endShape = state.morphShapes[nextIndex];
          state.currentMorph = new Morph(startShape, endShape);
        }

        drawMorphedShape(ctx);
      } else {
        drawCurrentShape(ctx);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [drawMorphedShape, drawCurrentShape, generateRandomShapeOrder]);

  const initializeAnimation = useCallback(async (ctx) => {
    try {
      // Load the REAL modules dynamically
      const [, , { RoundedPolygon }, { Morph }] = await Promise.all([
        import('./LoadingIndicator/utils.js'),
        import('./LoadingIndicator/cubic.js'),
        import('./LoadingIndicator/roundedPolygon.js'),
        import('./LoadingIndicator/morph-fixed.js')
      ]);

      // Create reliable fallback shapes (refined collection!)
      const shapes = [];
      for (let i = 0; i < 17; i++) {
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







  // Refined collection of creative shapes - WITH PROPER ROUNDING!
  const createFallbackShape = (index, RoundedPolygon) => {
    switch (index) {
      case 0: return new RoundedPolygon(new Float32Array([0, -20, 17, 10, -17, 10]), 6); // Triangle
      case 1: return new RoundedPolygon(new Float32Array([-15, -15, 15, -15, 15, 15, -15, 15]), 8); // Square
      case 2: return new RoundedPolygon(new Float32Array([0, -17, 16, -5, 10, 14, -10, 14, -16, -5]), 5); // Pentagon
      case 3: return createStarPolygon(15, 5, RoundedPolygon); // 5-pointed Star
      case 4: return new RoundedPolygon(new Float32Array([20, 0, 10, 17, -10, 17, -20, 0, -10, -17, 10, -17]), 4); // Hexagon
      case 5: return createCirclePolygon(15, 8, RoundedPolygon); // Octagon
      case 6: return createStarPolygon(18, 6, RoundedPolygon); // 6-pointed Star
      case 7: return createDiamondShape(18, RoundedPolygon); // Diamond
      case 8: return createCrossShape(16, RoundedPolygon); // Cross/Plus
      case 9: return createArrowShape(18, RoundedPolygon); // Arrow
      case 10: return createStarPolygon(14, 4, RoundedPolygon); // 4-pointed Star
      case 11: return createOvalShape(18, 12, RoundedPolygon); // Oval (improved)
      case 12: return createTearDropShape(16, RoundedPolygon); // Teardrop (improved)
      case 13: return createMoonShape(16, RoundedPolygon); // Crescent Moon
      case 14: return createFlowerShape(15, RoundedPolygon); // Flower
      case 15: return createHouseShape(16, RoundedPolygon); // House
      case 16: return createSpadeShape(16, RoundedPolygon); // Spade (improved)
      case 17: return createInfinityShape(18, RoundedPolygon); // Infinity (improved)
      case 18: return createGearShape(16, RoundedPolygon); // Gear/Cog
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

  const createDiamondShape = (size, RoundedPolygon) => {
    const vertices = new Float32Array([0, -size, size, 0, 0, size, -size, 0]);
    return new RoundedPolygon(vertices, 4);
  };

  const createCrossShape = (size, RoundedPolygon) => {
    const thickness = size * 0.3;
    const vertices = new Float32Array([
      -thickness, -size, thickness, -size, thickness, -thickness,
      size, -thickness, size, thickness, thickness, thickness,
      thickness, size, -thickness, size, -thickness, thickness,
      -size, thickness, -size, -thickness, -thickness, -thickness
    ]);
    return new RoundedPolygon(vertices, 3);
  };

  const createArrowShape = (size, RoundedPolygon) => {
    const vertices = new Float32Array([
      0, -size, size * 0.5, -size * 0.3, size * 0.2, -size * 0.3,
      size * 0.2, size, -size * 0.2, size, -size * 0.2, -size * 0.3,
      -size * 0.5, -size * 0.3
    ]);
    return new RoundedPolygon(vertices, 3);
  };

  const createOvalShape = (width, height, RoundedPolygon) => {
    const sides = 24; // More sides for smoother oval
    const vertices = new Float32Array(sides * 2);
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * 2 * Math.PI;
      vertices[i * 2] = Math.cos(angle) * width;
      vertices[i * 2 + 1] = Math.sin(angle) * height;
    }
    return new RoundedPolygon(vertices, 1); // Less rounding for smoother curves
  };

  const createTearDropShape = (size, RoundedPolygon) => {
    // Realistic teardrop shape with smooth curves
    const vertices = new Float32Array([
      0, -size, // Sharp point at top
      size * 0.5, -size * 0.6, // Right side curve
      size * 0.8, -size * 0.1, // Right bulge
      size * 0.9, size * 0.3, // Right bottom
      size * 0.6, size * 0.7, // Right bottom curve
      size * 0.2, size * 0.9, // Bottom right
      0, size, // Bottom center
      -size * 0.2, size * 0.9, // Bottom left
      -size * 0.6, size * 0.7, // Left bottom curve
      -size * 0.9, size * 0.3, // Left bottom
      -size * 0.8, -size * 0.1, // Left bulge
      -size * 0.5, -size * 0.6 // Left side curve
    ]);
    return new RoundedPolygon(vertices, 6); // Higher rounding for smooth teardrop
  };

  const createMoonShape = (size, RoundedPolygon) => {
    // Crescent moon approximation
    const vertices = new Float32Array([
      size * 0.5, -size * 0.8, size * 0.8, -size * 0.3, size * 0.6, 0,
      size * 0.8, size * 0.3, size * 0.5, size * 0.8, 0, size * 0.5,
      -size * 0.3, size * 0.2, -size * 0.5, 0, -size * 0.3, -size * 0.2,
      0, -size * 0.5
    ]);
    return new RoundedPolygon(vertices, 5);
  };

  const createFlowerShape = (size, RoundedPolygon) => {
    // 8-petal flower
    const petals = 8;
    const vertices = new Float32Array(petals * 4);
    let vertexIndex = 0;

    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * 2 * Math.PI;
      const petalTipX = Math.cos(angle) * size;
      const petalTipY = Math.sin(angle) * size;
      const petalBaseX = Math.cos(angle) * size * 0.3;
      const petalBaseY = Math.sin(angle) * size * 0.3;

      vertices[vertexIndex++] = petalTipX;
      vertices[vertexIndex++] = petalTipY;
      vertices[vertexIndex++] = petalBaseX;
      vertices[vertexIndex++] = petalBaseY;
    }
    return new RoundedPolygon(vertices, 6);
  };

  const createHouseShape = (size, RoundedPolygon) => {
    // Simple house silhouette
    const vertices = new Float32Array([
      0, -size, size * 0.7, -size * 0.3, size * 0.7, size * 0.2,
      size * 0.7, size * 0.8, -size * 0.7, size * 0.8, -size * 0.7, size * 0.2,
      -size * 0.7, -size * 0.3
    ]);
    return new RoundedPolygon(vertices, 5);
  };

  const createSpadeShape = (size, RoundedPolygon) => {
    // Smooth spade card suit
    const vertices = new Float32Array([
      0, -size, // Top point
      size * 0.4, -size * 0.6, // Right top curve
      size * 0.7, -size * 0.2, // Right side
      size * 0.8, size * 0.1, // Right bulge
      size * 0.6, size * 0.4, // Right bottom curve
      size * 0.3, size * 0.5, // Right stem connection
      size * 0.25, size * 0.7, // Right stem
      size * 0.15, size * 0.9, // Right stem bottom
      0, size, // Bottom center
      -size * 0.15, size * 0.9, // Left stem bottom
      -size * 0.25, size * 0.7, // Left stem
      -size * 0.3, size * 0.5, // Left stem connection
      -size * 0.6, size * 0.4, // Left bottom curve
      -size * 0.8, size * 0.1, // Left bulge
      -size * 0.7, -size * 0.2, // Left side
      -size * 0.4, -size * 0.6 // Left top curve
    ]);
    return new RoundedPolygon(vertices, 5); // Higher rounding for smooth curves
  };



  const createInfinityShape = (size, RoundedPolygon) => {
    // Smooth infinity symbol (figure-8) with more natural curves
    const vertices = new Float32Array([
      -size * 0.9, 0, // Left outer point
      -size * 0.7, -size * 0.3, // Left top curve
      -size * 0.4, -size * 0.4, // Left top inner
      -size * 0.1, -size * 0.3, // Center top left
      0, 0, // Center crossing
      size * 0.1, -size * 0.3, // Center top right
      size * 0.4, -size * 0.4, // Right top inner
      size * 0.7, -size * 0.3, // Right top curve
      size * 0.9, 0, // Right outer point
      size * 0.7, size * 0.3, // Right bottom curve
      size * 0.4, size * 0.4, // Right bottom inner
      size * 0.1, size * 0.3, // Center bottom right
      0, 0, // Center crossing (duplicate for smooth path)
      -size * 0.1, size * 0.3, // Center bottom left
      -size * 0.4, size * 0.4, // Left bottom inner
      -size * 0.7, size * 0.3 // Left bottom curve
    ]);
    return new RoundedPolygon(vertices, 8); // High rounding for smooth infinity curves
  };

  const createGearShape = (size, RoundedPolygon) => {
    // Gear with 8 teeth
    const teeth = 8;
    const innerRadius = size * 0.6;
    const outerRadius = size;
    const vertices = new Float32Array(teeth * 4);
    let vertexIndex = 0;

    for (let i = 0; i < teeth; i++) {
      const baseAngle = (i / teeth) * 2 * Math.PI;
      const toothAngle = ((i + 0.5) / teeth) * 2 * Math.PI;

      // Inner point
      vertices[vertexIndex++] = Math.cos(baseAngle) * innerRadius;
      vertices[vertexIndex++] = Math.sin(baseAngle) * innerRadius;

      // Outer tooth point
      vertices[vertexIndex++] = Math.cos(toothAngle) * outerRadius;
      vertices[vertexIndex++] = Math.sin(toothAngle) * outerRadius;
    }
    return new RoundedPolygon(vertices, 2);
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