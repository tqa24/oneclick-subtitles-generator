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
    shapeDarkNoContainer: '#485E92',
    shapeLightWithContainer: '#324574',
    shapeLightNoContainer: '#B0C6FF'
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

    // Use canvas size (300px) like original figma-showcase
    const canvasSize = 300;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = Math.min(canvasSize, canvasSize) * 0.2; // Bigger radius like original

    ctx.save();
    ctx.translate(centerX, centerY);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);

    // Use correct container color based on theme (like original)
    const containerColor = theme === 'dark' ? COLORS.containerDark : COLORS.containerLight;
    ctx.fillStyle = containerColor;
    ctx.fill();

    ctx.restore();
  }, [showContainer, theme, COLORS]);



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

    // Scaling effect - MUCH BIGGER SHAPES!
    let syncedScale;
    if (state.currentMorph && state.morphProgress < 1.0) {
      const morphPhase = state.morphProgress;
      const baseScale = 2.5; // Much bigger base scale!
      let scaleVariation;

      if (morphPhase < 0.8) {
        scaleVariation = 0.015 + Math.sin(state.animationTime * 4) * 0.005;
      } else {
        const bouncePhase = (morphPhase - 0.8) / 0.2;
        scaleVariation = 0.015 + Math.sin(bouncePhase * Math.PI) * 0.025;
      }
      syncedScale = baseScale + scaleVariation;
    } else {
      syncedScale = 2.5 + Math.sin(state.animationTime * 1.2) * 0.05; // Much bigger!
    }
    ctx.scale(syncedScale, syncedScale);

    // Pulse effect
    if (state.currentMorph && state.morphProgress < 1.0) {
      state.pulseValue = 0.8 + state.morphProgress * 0.2;
    } else {
      state.pulseValue = 0.7 + Math.sin(state.animationTime * 3) * 0.2;
    }
  }, []);

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

    // Use canvas size (300px) like original figma-showcase
    const canvasSize = 300;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    drawMaterial3Container(ctx);

    ctx.save();
    ctx.translate(canvasSize / 2, canvasSize / 2);
    applyMaterial3ExpressiveEffects(ctx);

    const shape = state.morphShapes[state.currentStep - 1];
    if (shape) {
      drawPolygonWithEffects(shape, ctx);
    }

    ctx.restore();
  }, [drawMaterial3Container, applyMaterial3ExpressiveEffects, drawPolygonWithEffects]);

  const drawMorphedShape = useCallback((ctx) => {
    const state = animationState.current;

    // Use canvas size (300px) like original figma-showcase
    const canvasSize = 300;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    drawMaterial3Container(ctx);

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
  }, [drawMaterial3Container, applyMaterial3ExpressiveEffects, drawCubicsWithEffects, drawPolygonWithEffects]);

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

      // Load the REAL Figma shapes
      const result = await createFigmaShapes(RoundedPolygon);
      animationState.current.morphShapes = result.shapes;

      console.log(`✅ Created ${result.shapes.length} REAL Figma shapes for morphing`);
      setIsLoaded(true);
      startAnimation(ctx, Morph);
    } catch (error) {
      console.error('❌ Failed to load REAL animation modules:', error);
      setIsLoaded(false);
    }
  }, [startAnimation]);

  // REAL Figma shape creation function
  const createFigmaShapes = async (RoundedPolygon) => {
    // Load the actual SVG files from your Figma design
    const figmaShapeFiles = [
      'shapes/shape-step1.svg',
      'shapes/shape-step2.svg',
      'shapes/shape-step3.svg',
      'shapes/shape-step4.svg',
      'shapes/shape-step5.svg',
      'shapes/shape-step6.svg',
      'shapes/shape-step7.svg'
    ];

    const shapes = [];

    for (let i = 0; i < figmaShapeFiles.length; i++) {
      try {
        // Load the SVG file and extract the path
        const response = await fetch(`/src/components/common/LoadingIndicator/${figmaShapeFiles[i]}`);
        const svgText = await response.text();

        // Parse the SVG to extract the path data
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const pathElement = svgDoc.querySelector('path');

        if (pathElement) {
          const pathData = pathElement.getAttribute('d');
          // Convert to RoundedPolygon for morphing with PROPER ROUNDING
          const vertices = await convertSVGPathToVertices(pathData, 40);
          const polygon = new RoundedPolygon(vertices, 8); // 8px rounding for smooth curves!
          shapes.push(polygon);
        } else {
          throw new Error('No path element found in SVG');
        }
      } catch (error) {
        console.error(`❌ Failed to load Figma shape ${i + 1}:`, error);
        // Fallback to simple shapes if Figma shapes fail
        shapes.push(createFallbackShape(i, RoundedPolygon));
      }
    }

    return { shapes };
  };

  // SVG path to vertices conversion with curvature detection (REAL implementation from figma-showcase)
  const convertSVGPathToVertices = async (pathData, scale = 1) => {
    // Create a temporary SVG to parse the path
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');
    svg.style.position = 'absolute';
    svg.style.visibility = 'hidden';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    document.body.appendChild(svg);

    try {
      // Get the bounding box to properly center the shape
      const bbox = path.getBBox();
      const centerX = bbox.x + bbox.width / 2;
      const centerY = bbox.y + bbox.height / 2;
      const maxDimension = Math.max(bbox.width, bbox.height);

      // Get the path length and use curvature-based adaptive sampling
      const pathLength = path.getTotalLength();

      // Use curvature-based adaptive sampling for better shape preservation
      const vertices = await samplePathWithCurvatureDetection(path, pathLength, centerX, centerY, maxDimension, scale);

      document.body.removeChild(svg);
      return vertices;
    } catch (error) {
      document.body.removeChild(svg);
      throw error;
    }
  };

  // Curvature detection sampling for smooth rounded shapes (from figma-showcase)
  const samplePathWithCurvatureDetection = async (path, pathLength, centerX, centerY, maxDimension, scale) => {
    // For star-like shapes, we need to detect peaks and valleys specifically
    const highResSamples = 500; // Very high resolution for feature detection

    // First pass: high-resolution sampling to detect all features
    const points = [];
    for (let i = 0; i <= highResSamples; i++) {
      const t = i / highResSamples;
      const distance = t * pathLength;
      const point = path.getPointAtLength(distance);

      // Calculate distance from center (for peak/valley detection)
      const distFromCenter = Math.sqrt(
        Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)
      );

      points.push({ t, point, distFromCenter, index: i });
    }

    // Second pass: detect peaks and valleys based on distance from center
    const features = [];
    const windowSize = 8; // Smaller window for more sensitive detection

    for (let i = windowSize; i < points.length - windowSize; i++) {
      const current = points[i];
      const neighbors = points.slice(i - windowSize, i + windowSize + 1);

      // Check if this is a local maximum (peak) or minimum (valley)
      const isLocalMax = neighbors.every(n => n.distFromCenter <= current.distFromCenter);
      const isLocalMin = neighbors.every(n => n.distFromCenter >= current.distFromCenter);

      // Also check for near-peaks/valleys with small tolerance
      const tolerance = 0.5; // Small tolerance for detecting subtle peaks
      const isNearMax = neighbors.filter(n => n.distFromCenter > current.distFromCenter + tolerance).length === 0;
      const isNearMin = neighbors.filter(n => n.distFromCenter < current.distFromCenter - tolerance).length === 0;

      if (isLocalMax || isLocalMin || (isNearMax && !isNearMin) || (isNearMin && !isNearMax)) {
        const type = (isLocalMax || isNearMax) ? 'peak' : 'valley';

        // Avoid duplicate features too close together
        const tooClose = features.some(f => Math.abs(f.index - current.index) < windowSize);
        if (!tooClose) {
          features.push({
            ...current,
            type: type
          });
        }
      }
    }

    // Third pass: ensure we capture all features plus dense curve sampling
    const finalSamples = [];

    // Add all detected features
    features.forEach(feature => finalSamples.push(feature));

    // Add dense interpolation points between features for smooth curves
    for (let i = 0; i < features.length; i++) {
      const current = features[i];
      const next = features[(i + 1) % features.length];

      // Calculate the arc length between features
      const startT = current.t;
      const endT = next.t > current.t ? next.t : next.t + 1; // Handle wrap-around
      const arcLength = (endT - startT) * pathLength;

      // Use more interpolation points for longer arcs (curves need more detail)
      const baseInterpCount = 6;
      const extraForLength = Math.floor(arcLength / 10); // More points for longer curves
      const interpCount = Math.min(12, baseInterpCount + extraForLength);

      for (let j = 1; j <= interpCount; j++) {
        let interpT = current.t + (next.t - current.t) * (j / (interpCount + 1));

        // Handle wrap-around properly
        if (interpT > 1) {
          interpT = interpT - 1;
        }
        if (interpT < 0) {
          interpT = interpT + 1;
        }

        const interpDistance = interpT * pathLength;
        const interpPoint = path.getPointAtLength(interpDistance);
        finalSamples.push({ t: interpT, point: interpPoint });
      }
    }

    // Add additional high-density sampling for very smooth curves
    const denseSamples = 50; // Extra samples for overall smoothness
    for (let i = 0; i < denseSamples; i++) {
      const t = i / denseSamples;
      const distance = t * pathLength;
      const point = path.getPointAtLength(distance);

      // Only add if not too close to existing samples
      const tooClose = finalSamples.some(s => Math.abs(s.t - t) < 0.01);
      if (!tooClose) {
        finalSamples.push({ t, point });
      }
    }

    // Sort by parameter t to maintain proper order
    finalSamples.sort((a, b) => a.t - b.t);

    // Convert to vertices array with proper scaling
    const vertices = new Float32Array(finalSamples.length * 2);
    for (let i = 0; i < finalSamples.length; i++) {
      const sample = finalSamples[i];
      const scaledX = (sample.point.x - centerX) * scale / (maxDimension / 2);
      const scaledY = (sample.point.y - centerY) * scale / (maxDimension / 2);

      vertices[i * 2] = scaledX;
      vertices[i * 2 + 1] = scaledY;
    }

    return vertices;
  };

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

    // Set canvas size like the original figma-showcase (300x300 base size)
    const canvasSize = 300;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    // Size is now controlled by inline styles in JSX
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
        // Let the canvas determine the size naturally
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        className="loading-indicator-canvas"
        style={{
          width: `${size * 3}px`,  // Make it much bigger - 192px for size=64
          height: `${size * 3}px`,
          borderRadius: '12px'
        }}
      />
    </div>
  );
};

export default LoadingIndicator;
