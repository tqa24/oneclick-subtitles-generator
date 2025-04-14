/**
 * Particle utilities for Gemini button effects
 */

import { createGeminiSVG, getSizeInPixels } from './renderUtils';

/**
 * Create a new particle
 * @param {number} x - X position (0-100)
 * @param {number} y - Y position (0-100)
 * @param {string} sizeClass - Size class name
 * @param {boolean} isFilled - Whether to use filled version
 * @returns {Object} - Particle object
 */
export const createParticle = (x, y, sizeClass, isFilled = false) => {
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
    svg: createGeminiSVG(isFilled || Math.random() > 0.5, colorSchemeIndex),
    isActive: true,
    opacity: 1,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 0.5, // Slower rotation
    returnToOrigin: false
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
  const isForceStopButton = buttonElement.classList.contains('force-stop-btn');

  // Set particle count based on button type and limit parameter
  let particleCount;
  if (limit !== undefined) {
    // Use the exact limit if provided (for hover state)
    particleCount = limit;
  } else {
    // Default counts for initial state - more particles for larger buttons
    if (isGenerateButton) {
      particleCount = 40 + Math.floor(Math.random() * 15); // 40-55 particles for generate button (more particles for larger button)
    } else if (isForceStopButton) {
      particleCount = 20 + Math.floor(Math.random() * 10); // 20-30 particles for force stop button
    } else {
      particleCount = 20 + Math.floor(Math.random() * 10); // 20-30 particles for other buttons
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

  for (let i = 0; i < particleCount; i++) {
    // Create particle element
    const particle = document.createElement('div');

    // Randomly decide if this will be a filled or outlined icon
    const isFilled = Math.random() > 0.5; // 50% chance of filled icons

    // Assign random size with weighted distribution based on button type
    let sizeClasses;

    if (isGenerateButton) {
      // For generate button - only extra small and small stars
      sizeClasses = [
        { class: 'size-xs', weight: 0.70 }, // Mostly extra small stars for generate button
        { class: 'size-sm', weight: 0.30 }, // Some small stars
        // No medium stars at all for generate button
      ];
    } else {
      // For other buttons - standard distribution
      sizeClasses = [
        { class: 'size-xs', weight: 0.50 }, // Mostly extra small stars
        { class: 'size-sm', weight: 0.35 }, // Some small stars
        { class: 'size-md', weight: 0.15 }, // Few medium stars
      ];
    }

    // Weighted random selection
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

    // Determine particle type
    randomWeight = Math.random();
    cumulativeWeight = 0;
    let particleType = 'normal';

    for (const type of particleTypes) {
      cumulativeWeight += type.chance;
      if (randomWeight <= cumulativeWeight) {
        particleType = type.type;
        break;
      }
    }

    // Assign random position - scattered throughout the button
    let x, y;

    // Fully random positions across the button for a scattered look
    x = 10 + Math.random() * 80; // 10-90% of width
    y = 10 + Math.random() * 80; // 10-90% of height

    // Create the particle object using our utility function
    const particleObj = createParticle(x, y, sizeClass, isFilled);

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
