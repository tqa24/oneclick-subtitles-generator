/**
 * Particle utilities for Gemini button effects
 */

import { createGeminiSVG, createSpecialStarSVG, getSizeInPixels } from './renderUtils';

/**
 * Poisson disk sampling for evenly distributed points with guaranteed minimum distance
 * @param {number} width - Width of the area (in percentage, e.g., 80 for 80%)
 * @param {number} height - Height of the area (in percentage, e.g., 80 for 80%)
 * @param {number} minDistance - Minimum distance between points (in percentage)
 * @param {number} maxSamples - Maximum number of samples to generate
 * @param {number} maxAttempts - Maximum attempts per sample
 * @returns {Array} - Array of {x, y} positions
 */
const poissonDiskSampling = (width, height, minDistance, maxSamples, maxAttempts = 30) => {
  const points = [];
  const activeList = [];
  const grid = [];
  
  // Grid cell size should be minDistance / sqrt(2)
  const cellSize = minDistance / Math.sqrt(2);
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  
  // Initialize grid
  for (let i = 0; i < gridWidth * gridHeight; i++) {
    grid[i] = -1;
  }
  
  // Helper function to get grid index
  const getGridIndex = (x, y) => {
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);
    return gridY * gridWidth + gridX;
  };
  
  // Helper function to check if point is valid (no neighbors within minDistance)
  const isValidPoint = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);
    
    // Check neighboring grid cells
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gridX + dx;
        const ny = gridY + dy;
        
        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
          const neighborIndex = ny * gridWidth + nx;
          const pointIndex = grid[neighborIndex];
          
          if (pointIndex >= 0) {
            const neighbor = points[pointIndex];
            const dist = Math.sqrt((x - neighbor.x) ** 2 + (y - neighbor.y) ** 2);
            if (dist < minDistance) {
              return false;
            }
          }
        }
      }
    }
    
    return true;
  };
  
  // Start with a random initial point
  const initialX = Math.random() * width;
  const initialY = Math.random() * height;
  const initialPoint = { x: initialX, y: initialY };
  
  points.push(initialPoint);
  activeList.push(0);
  grid[getGridIndex(initialX, initialY)] = 0;
  
  // Generate points using Poisson disk sampling
  while (activeList.length > 0 && points.length < maxSamples) {
    // Pick a random active point
    const randomIndex = Math.floor(Math.random() * activeList.length);
    const currentPointIndex = activeList[randomIndex];
    const currentPoint = points[currentPointIndex];
    
    let found = false;
    
    // Try to generate a new point around the current point
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random point in annulus between minDistance and 2*minDistance
      const angle = Math.random() * Math.PI * 2;
      const radius = minDistance + Math.random() * minDistance;
      
      const newX = currentPoint.x + Math.cos(angle) * radius;
      const newY = currentPoint.y + Math.sin(angle) * radius;
      
      if (isValidPoint(newX, newY)) {
        const newPoint = { x: newX, y: newY };
        const pointIndex = points.length;
        
        points.push(newPoint);
        activeList.push(pointIndex);
        grid[getGridIndex(newX, newY)] = pointIndex;
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Remove current point from active list if no new points can be generated
      activeList.splice(randomIndex, 1);
    }
  }
  
  return points;
};

/**
 * Generate well-distributed positions using Poisson disk sampling
 * @param {number} particleCount - Number of particles to place
 * @param {Array} particleSizes - Array of particle sizes for adaptive spacing
 * @returns {Array} - Array of {x, y} positions
 */
const generateWellDistributedPositions = (particleCount, particleSizes) => {
  // Calculate average particle size for minimum distance
  const avgSize = particleSizes.reduce((sum, size) => sum + size, 0) / particleSizes.length;
  
  // Convert size to percentage for spacing (larger particles need more space)
  const minDistancePercent = (avgSize / 8) + 15; // Increased base spacing for better separation
  
  // Use Poisson disk sampling to generate positions
  const positions = poissonDiskSampling(
    80, // 80% width (10% margin on each side)
    80, // 80% height (10% margin on each side)
    minDistancePercent,
    particleCount * 2, // Generate more than needed, we'll pick the best ones
    40 // More attempts for better distribution
  );
  
  // Offset positions to account for margins (add 10% offset)
  const offsetPositions = positions.map(pos => ({
    x: pos.x + 10,
    y: pos.y + 10
  }));
  
  // Return only the number of positions we need
  return offsetPositions.slice(0, particleCount);
};

/**
 * Create a new particle
 * @param {number} x - X position (0-100)
 * @param {number} y - Y position (0-100)
 * @param {string} sizeClass - Size class name
 * @param {boolean} isFilled - Whether to use filled version
 * @param {boolean} useSpecialStar - Whether to use special star instead of regular Gemini star
 * @returns {Object} - Particle object
 */
export const createParticle = (x, y, sizeClass, isFilled = false, useSpecialStar = false) => {
  // Randomize the color scheme - now with more color schemes
  const colorSchemeIndex = Math.floor(Math.random() * 8);

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    size: getSizeInPixels(sizeClass),
    sizeClass,
    isFilled: isFilled || Math.random() > 0.5, // 50% chance of filled version
    colorSchemeIndex,
    svg: useSpecialStar ? createSpecialStarSVG(isFilled || Math.random() > 0.5, colorSchemeIndex) : createGeminiSVG(isFilled || Math.random() > 0.5, colorSchemeIndex),
    isActive: true,
    opacity: 1,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 0.5, // Slower rotation
    returnToOrigin: false,
    useSpecialStar
  };
};

/**
 * Create a collection of Gemini icon particles
 * @param {HTMLElement} buttonElement - The button element
 * @param {HTMLElement} container - The container for particles
 * @param {number} [limit] - Optional limit for number of particles (used for hover state)
 * @returns {Array} - Array of particle objects
 */
export const createParticles = (buttonElement, container, limit) => {
  const buttonParticles = [];

  // Determine button type to create different effects
  const isGenerateButton = buttonElement.classList.contains('generate-btn');
  const isAutoGenerateButton = buttonElement.classList.contains('auto-generate');
  const isForceStopButton = buttonElement.classList.contains('force-stop-btn');
  const isVideoAnalysisButton = buttonElement.classList.contains('video-analysis-button');

  // Set particle count based on button type and limit parameter
  let particleCount;
  if (limit !== undefined) {
    // Use the exact limit if provided (for hover state)
    particleCount = limit;
  } else {
    // Default counts for initial state - reduced for better spacing
    if (isAutoGenerateButton) {
      particleCount = 8 + Math.floor(Math.random() * 4); // 8-12 particles for auto-generate (special stars need more space)
    } else if (isGenerateButton) {
      particleCount = 15 + Math.floor(Math.random() * 5); // 15-20 particles for generate button
    } else if (isForceStopButton) {
      particleCount = 12 + Math.floor(Math.random() * 3); // 12-15 particles for force stop button
    } else {
      particleCount = 10 + Math.floor(Math.random() * 5); // 10-15 particles for other buttons
    }
  }

  // Clear any existing static icons
  const existingStaticIcons = container.querySelectorAll('.gemini-mini-icon:not(.dynamic)');
  existingStaticIcons.forEach(icon => {
    icon.remove();
  });

  // Create a unique set of particles for this button
  const particleTypes = [
    { type: 'normal', chance: 0.6 },
    { type: 'trail', chance: 0.2 },
    { type: 'pulse', chance: 0.2 }
  ];

  // Pre-calculate particle sizes for proper spacing
  const particleSizes = [];
  for (let i = 0; i < particleCount; i++) {
    // Determine size class using the same logic as below
    let sizeClasses;
    if (isAutoGenerateButton) {
      sizeClasses = [
        { class: 'size-sm', weight: 0.30 },
        { class: 'size-md', weight: 0.50 },
        { class: 'size-lg', weight: 0.20 },
      ];
    } else {
      sizeClasses = [
        { class: 'size-xs', weight: 0.70 },
        { class: 'size-sm', weight: 0.30 },
      ];
    }
    
    // Weighted random selection for size
    let randomWeight = Math.random();
    let cumulativeWeight = 0;
    let sizeClass = 'size-sm'; // Default
    
    for (const size of sizeClasses) {
      cumulativeWeight += size.weight;
      if (randomWeight <= cumulativeWeight) {
        sizeClass = size.class;
        break;
      }
    }
    
    particleSizes.push(getSizeInPixels(sizeClass));
  }

  // Generate well-distributed positions using size information
  const positions = generateWellDistributedPositions(particleCount, particleSizes);

  for (let i = 0; i < particleCount; i++) {
    // Create particle element
    const particle = document.createElement('div');

    // Randomly decide if this will be a filled or outlined icon
    const isFilled = Math.random() > 0.5; // 50% chance of filled icons

    // Use pre-calculated size (convert back to class for compatibility)
    const particleSize = particleSizes[i];
    let sizeClass;
    switch (particleSize) {
      case 8: sizeClass = 'size-xs'; break;
      case 12: sizeClass = 'size-sm'; break;
      case 16: sizeClass = 'size-md'; break;
      case 20: sizeClass = 'size-lg'; break;
      default: sizeClass = 'size-sm'; break;
    }

    // Determine particle type
    let particleTypeRandomWeight = Math.random();
    let particleTypeCumulativeWeight = 0;
    let particleType = 'normal';

    for (const type of particleTypes) {
      particleTypeCumulativeWeight += type.chance;
      if (particleTypeRandomWeight <= particleTypeCumulativeWeight) {
        particleType = type.type;
        break;
      }
    }

    // Use pre-generated well-distributed position
    let x, y;
    if (i < positions.length) {
      x = positions[i].x;
      y = positions[i].y;
    } else {
      // Fallback to random position if we somehow have more particles than positions
      x = 10 + Math.random() * 80;
      y = 10 + Math.random() * 80;
    }

    // Create the particle object using our utility function
    // Use special star for auto-generate buttons
    const particleObj = createParticle(x, y, sizeClass, isFilled, isAutoGenerateButton);

    // Add DOM element reference
    particleObj.element = particle;

    // Add to button particles collection
    buttonParticles.push(particleObj);

    // Set up the particle element
    particle.className = `gemini-mini-icon dynamic ${sizeClass} ${particleType}`;
    particle.innerHTML = particleObj.svg;
    particle.style.position = 'absolute';
    particle.style.left = `${x}%`;
    particle.style.top = `${y}%`;
    particle.style.transform = `rotate(${particleObj.rotation}deg)`;
    particle.style.opacity = '0'; // Start invisible
    particle.style.transition = 'opacity 0.3s ease-out';

    // Add the particle to the container
    container.appendChild(particle);

    // Create trail particles if this is a trail type
    if (particleType === 'trail') {
      particleObj.trailParticles = [];
      const trailCount = 3 + Math.floor(Math.random() * 3); // 3-5 trail particles

      for (let t = 0; t < trailCount; t++) {
        const trailElement = document.createElement('div');
        trailElement.className = `gemini-mini-icon trail ${sizeClass}`;
        trailElement.innerHTML = particleObj.svg;
        trailElement.style.position = 'absolute';
        trailElement.style.left = `${x}%`;
        trailElement.style.top = `${y}%`;
        trailElement.style.transform = `rotate(${particleObj.rotation}deg) scale(${0.8 - (t * 0.15)})`;
        trailElement.style.opacity = '0';
        trailElement.style.transition = 'opacity 0.3s ease-out';
        trailElement.style.zIndex = '-1';

        container.appendChild(trailElement);

        particleObj.trailParticles.push({
          element: trailElement,
          offsetX: 0,
          offsetY: 0,
          opacity: 0.7 - (t * 0.2)
        });
      }
    }
  }

  return buttonParticles;
};

/**
 * Clean up particles that are no longer in the DOM
 * @param {Array} particles - Array of particles
 * @returns {Array} - Filtered array of particles
 */
export const cleanupParticles = (particles) => {
  return particles.filter(particle => {
    if (!particle.element.isConnected) {
      // Remove any trail particles
      if (particle.trailParticles) {
        particle.trailParticles.forEach(trail => {
          if (trail.element && trail.element.parentNode) {
            trail.element.remove();
          }
        });
      }
      return false; // Remove this particle from the array
    }
    return true; // Keep this particle in the array
  });
};
