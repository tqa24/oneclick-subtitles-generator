import React, { useEffect, useRef, useCallback } from 'react';

/**
 * LiquidGlass - A highly customizable liquid glass effect component
 * Converted from vanilla JS to React component with extensive customization options
 */
const LiquidGlass = ({
  // Size and positioning
  width = 100,
  height = 100,
  position = 'relative', // 'relative', 'absolute', 'fixed'
  top,
  left,
  right,
  bottom,
  transform,
  zIndex = 10,
  
  // Visual styling
  borderRadius = '150px',
  boxShadow = '0 4px 8px rgba(0, 0, 0, 0.25), 0 -10px 25px inset rgba(0, 0, 0, 0.15)',
  backdropFilter = 'blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)',
  border = '1px solid var(--md-outline-variant, #ccc)',
  background = 'transparent',
  
  // Interaction
  draggable = false,
  cursor = 'default',
  onClick,
  onMouseEnter,
  onMouseLeave,
  
  // Glass effect parameters
  effectIntensity = 1.0, // Multiplier for displacement effect
  effectRadius = 0.6, // Radius of the glass effect
  effectWidth = 0.3, // Width of the effect area
  effectHeight = 0.2, // Height of the effect area
  effectOffset = 0.15, // Offset for the effect
  
  // Animation
  animateOnHover = false,
  hoverScale = 1.05,
  transition = 'all 0.3s ease',
  
  // Content
  children,
  className = '',
  style = {},
  
  // Advanced options
  canvasDPI = 1,
  updateOnMouseMove = false,
  constrainToViewport = false,
  viewportOffset = 10,
  
  // Callbacks
  onEffectUpdate,
  onDragStart,
  onDragEnd,
  
  // Accessibility
  role,
  'aria-label': ariaLabel,
  tabIndex,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const contextRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const mouseUsedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const uniqueIdRef = useRef(`liquid-glass-${Math.random().toString(36).substr(2, 9)}`);

  // Utility functions
  const smoothStep = useCallback((a, b, t) => {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }, []);

  const length = useCallback((x, y) => {
    return Math.sqrt(x * x + y * y);
  }, []);

  const roundedRectSDF = useCallback((x, y, width, height, radius) => {
    const qx = Math.abs(x) - width + radius;
    const qy = Math.abs(y) - height + radius;
    return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  }, [length]);

  const texture = useCallback((x, y) => {
    return { type: 't', x, y };
  }, []);

  // Fragment shader function - restored original refraction effect
  const fragmentShader = useCallback((uv, mouse) => {
    const ix = uv.x - 0.5;
    const iy = uv.y - 0.5;
    const distanceToEdge = roundedRectSDF(
      ix,
      iy,
      0.4,  // Fixed width for stronger edge effect
      0.4,  // Fixed height for stronger edge effect
      0.9   // Fixed radius for stronger edge effect
    );
    const displacement = smoothStep(0.8, 0, distanceToEdge - 0.1); // Fixed offset for stronger edge effect
    const scaled = smoothStep(0, 1.5, displacement); // Removed effectIntensity multiplier to reduce zoom
    return texture(ix * scaled + 0.5, iy * scaled + 0.5);
  }, [roundedRectSDF, smoothStep, texture]);

  // Constrain position within viewport
  const constrainPosition = useCallback((x, y) => {
    if (!constrainToViewport) return { x, y };
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const minX = viewportOffset;
    const maxX = viewportWidth - width - viewportOffset;
    const minY = viewportOffset;
    const maxY = viewportHeight - height - viewportOffset;
    
    const constrainedX = Math.max(minX, Math.min(maxX, x));
    const constrainedY = Math.max(minY, Math.min(maxY, y));
    
    return { x: constrainedX, y: constrainedY };
  }, [constrainToViewport, viewportOffset, width, height]);

  // Update shader effect
  const updateShader = useCallback(() => {
    if (!canvasRef.current || !contextRef.current) return;

    const mouseProxy = new Proxy(mouseRef.current, {
      get: (target, prop) => {
        mouseUsedRef.current = true;
        return target[prop];
      }
    });

    mouseUsedRef.current = false;

    const w = width * canvasDPI;
    const h = height * canvasDPI;
    const data = new Uint8ClampedArray(w * h * 4);

    let maxScale = 0;
    const rawValues = [];

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % w;
      const y = Math.floor(i / 4 / w);
      const pos = fragmentShader(
        { x: x / w, y: y / h },
        mouseProxy
      );
      const dx = pos.x * w - x;
      const dy = pos.y * h - y;
      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
      rawValues.push(dx, dy);
    }

    maxScale *= 0.5;

    let index = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = rawValues[index++] / maxScale + 0.5;
      const g = rawValues[index++] / maxScale + 0.5;
      data[i] = r * 255;
      data[i + 1] = g * 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }

    contextRef.current.putImageData(new ImageData(data, w, h), 0, 0);
    
    // Update SVG filter
    const feImage = svgRef.current?.querySelector(`#${uniqueIdRef.current}_map`);
    const feDisplacementMap = svgRef.current?.querySelector('feDisplacementMap');
    
    if (feImage && feDisplacementMap) {
      feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvasRef.current.toDataURL());
      feDisplacementMap.setAttribute('scale', (maxScale / canvasDPI).toString());
    }

    // Call update callback if provided
    if (onEffectUpdate) {
      onEffectUpdate({ maxScale, mouseUsed: mouseUsedRef.current });
    }
  }, [width, height, canvasDPI, fragmentShader, onEffectUpdate]);

  // Initialize canvas and SVG
  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup canvas
    const canvas = canvasRef.current;
    canvas.width = width * canvasDPI;
    canvas.height = height * canvasDPI;
    canvas.style.display = 'none';
    contextRef.current = canvas.getContext('2d');

    // Initial shader update
    updateShader();
  }, [width, height, canvasDPI, updateShader]);

  // Handle mouse events for dragging
  useEffect(() => {
    if (!draggable || !containerRef.current) return;

    const container = containerRef.current;

    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialX: container.offsetLeft,
        initialY: container.offsetTop
      };
      
      if (onDragStart) onDragStart(e);
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (isDraggingRef.current) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        const newX = dragStartRef.current.initialX + deltaX;
        const newY = dragStartRef.current.initialY + deltaY;
        
        const constrained = constrainPosition(newX, newY);
        
        container.style.left = constrained.x + 'px';
        container.style.top = constrained.y + 'px';
      }

      // Update mouse position for shader
      if (updateOnMouseMove) {
        const rect = container.getBoundingClientRect();
        mouseRef.current.x = (e.clientX - rect.left) / rect.width;
        mouseRef.current.y = (e.clientY - rect.top) / rect.height;
        
        if (mouseUsedRef.current) {
          updateShader();
        }
      }
    };

    const handleMouseUp = (e) => {
      if (isDraggingRef.current && onDragEnd) {
        onDragEnd(e);
      }
      isDraggingRef.current = false;
    };

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggable, constrainPosition, updateOnMouseMove, updateShader, onDragStart, onDragEnd]);

  // Handle window resize for viewport constraints
  useEffect(() => {
    if (!constrainToViewport || !containerRef.current) return;

    const handleResize = () => {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const constrained = constrainPosition(rect.left, rect.top);
      
      if (rect.left !== constrained.x || rect.top !== constrained.y) {
        container.style.left = constrained.x + 'px';
        container.style.top = constrained.y + 'px';
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainToViewport, constrainPosition]);

  // Combine styles
  const containerStyle = {
    position,
    width: `${width}px`,
    height: `${height}px`,
    borderRadius,
    boxShadow,
    backdropFilter: `url(#${uniqueIdRef.current}_filter) ${backdropFilter}`,
    border,
    background,
    cursor: draggable ? (isDraggingRef.current ? 'grabbing' : 'grab') : cursor,
    zIndex,
    transition: animateOnHover ? transition : undefined,
    transform: animateOnHover && containerRef.current?.matches(':hover') 
      ? `${transform || ''} scale(${hoverScale})`.trim() 
      : transform,
    top,
    left,
    right,
    bottom,
    ...style,
  };

  return (
    <>
      {/* Hidden SVG filter */}
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width="0"
        height="0"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: zIndex - 1,
        }}
      >
        <defs>
          <filter
            id={`${uniqueIdRef.current}_filter`}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            x="0"
            y="0"
            width={width.toString()}
            height={height.toString()}
          >
            <feImage
              id={`${uniqueIdRef.current}_map`}
              width={width.toString()}
              height={height.toString()}
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2={`${uniqueIdRef.current}_map`}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Hidden canvas for displacement map */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Main container */}
      <div
        ref={containerRef}
        className={`liquid-glass ${className}`}
        style={containerStyle}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        role={role}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
      >
        {children}
      </div>
    </>
  );
};

export default LiquidGlass;
