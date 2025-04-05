/**
 * Gemini Button Effects - Advanced physics-based animations for Gemini buttons
 */

// Physics constants
const PHYSICS = {
  friction: 0.97,       // Higher friction for slower movement (was 0.95)
  bounce: 0.4,          // Lower bounce for more elegant collisions (was 0.7)
  gravity: 0.02,        // Reduced gravity for gentler center pull (was 0.05)
  maxVelocity: 1.5,     // Lower max velocity for more controlled movement (was 3)
  collisionDistance: 15,
  cursorForce: 0.4,     // Reduced cursor force for subtler interactions (was 0.8)
  cursorRadius: 60,     // Larger radius for smoother influence (was 40)
  damping: 0.92         // Additional damping to slow down movements
};

// Color schemes for particles
const COLOR_SCHEMES = [
  // Default Gemini gradient
  {
    stops: [
      { offset: '0%', color: 'rgba(145, 104, 192, 0.8)' },
      { offset: '50%', color: 'rgba(86, 132, 209, 0.8)' },
      { offset: '100%', color: 'rgba(27, 161, 227, 0.8)' }
    ],
    stroke: 'currentColor',
    glow: '0 0 5px rgba(86, 132, 209, 0.5)'
  },
  // Purple-pink scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(171, 71, 188, 0.8)' },
      { offset: '100%', color: 'rgba(236, 64, 122, 0.8)' }
    ],
    stroke: 'rgba(236, 64, 122, 0.9)',
    glow: '0 0 5px rgba(236, 64, 122, 0.5)'
  },
  // Blue-green scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(3, 169, 244, 0.8)' },
      { offset: '100%', color: 'rgba(0, 150, 136, 0.8)' }
    ],
    stroke: 'rgba(0, 150, 136, 0.9)',
    glow: '0 0 5px rgba(0, 150, 136, 0.5)'
  },
  // Orange-red scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(255, 152, 0, 0.8)' },
      { offset: '100%', color: 'rgba(244, 67, 54, 0.8)' }
    ],
    stroke: 'rgba(244, 67, 54, 0.9)',
    glow: '0 0 5px rgba(244, 67, 54, 0.5)'
  },
  // Green-yellow scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(76, 175, 80, 0.8)' },
      { offset: '100%', color: 'rgba(255, 235, 59, 0.8)' }
    ],
    stroke: 'rgba(76, 175, 80, 0.9)',
    glow: '0 0 5px rgba(76, 175, 80, 0.5)'
  },
  // Monochrome scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(255, 255, 255, 0.1)' },
      { offset: '100%', color: 'rgba(255, 255, 255, 0.6)' }
    ],
    stroke: 'rgba(255, 255, 255, 0.9)',
    glow: '0 0 5px rgba(255, 255, 255, 0.7)'
  }
];

// Collection of all active particles
let particles = [];

// Set to track initialized buttons to prevent duplicate initialization
const initializedButtons = new Set();

// Flag to track if the observer is already set up
let observerInitialized = false;

// MutationObserver to detect when new buttons are added to the DOM
const setupButtonObserver = () => {
  if (observerInitialized) return;

  const observer = new MutationObserver((mutations) => {
    let shouldReinitialize = false;

    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any of the added nodes are buttons or contain buttons
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is a button with the relevant classes
            if (
              (node.classList &&
               (node.classList.contains('generate-btn') || node.classList.contains('retry-gemini-btn')))
            ) {
              shouldReinitialize = true;
            }

            // Check if the node contains buttons with the relevant classes
            const buttons = node.querySelectorAll('.generate-btn, .retry-gemini-btn');
            if (buttons.length > 0) {
              shouldReinitialize = true;
            }
          }
        });
      }
    });

    if (shouldReinitialize) {
      console.log('Detected new buttons, reinitializing Gemini button effects');
      initGeminiButtonEffects();
    }
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });

  observerInitialized = true;
};

/**
 * Initialize Gemini button effects
 */
export const initGeminiButtonEffects = () => {
  // Set up the MutationObserver to detect new buttons
  setupButtonObserver();

  // Find all Gemini buttons
  const generateButtons = document.querySelectorAll('.generate-btn');
  const retryButtons = document.querySelectorAll('.retry-gemini-btn');

  console.log(`Found ${generateButtons.length} generate buttons and ${retryButtons.length} retry buttons`);

  // First, clean up any particles that are no longer in the DOM
  particles = particles.filter(particle => {
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

  // Apply effects to all buttons
  [...generateButtons, ...retryButtons].forEach(button => {
    // Generate a unique ID for this button if it doesn't have one
    if (!button.dataset.geminiButtonId) {
      button.dataset.geminiButtonId = `gemini-button-${Math.random().toString(36).substring(2, 11)}`;
    }

    const buttonId = button.dataset.geminiButtonId;

    // Check if this button has already been initialized
    const isInitialized = initializedButtons.has(buttonId);

    // Check if the button already has a gemini-icon-container
    let iconContainer = button.querySelector('.gemini-icon-container');

    // If not, create a new one
    if (!iconContainer) {
      iconContainer = document.createElement('div');
      iconContainer.className = 'gemini-icon-container';
      button.appendChild(iconContainer);
    }

    // If the button is already initialized, remove all existing particles for this button
    if (isInitialized) {
      // Find all particles belonging to this button
      const buttonParticles = particles.filter(p => {
        return p.element.parentNode === iconContainer ||
               (p.element.parentNode && p.element.parentNode.parentNode === iconContainer);
      });

      // Remove these particles from the global collection
      particles = particles.filter(p => !buttonParticles.includes(p));

      // Remove the particles from the DOM
      buttonParticles.forEach(particle => {
        if (particle.element && particle.element.parentNode) {
          particle.element.remove();
        }

        // Also remove any trail particles
        if (particle.trailParticles) {
          particle.trailParticles.forEach(trail => {
            if (trail.element && trail.element.parentNode) {
              trail.element.remove();
            }
          });
        }
      });

      // Clear the container
      iconContainer.innerHTML = '';
      console.log(`Cleared existing particles for button ${buttonId}`);
    }

    // Create a collection of particles for this button - use a few particles for initial state
    const initialCount = button.classList.contains('generate-btn') ? 10 : 4;
    const buttonParticles = createParticles(button, iconContainer, initialCount);
    particles = [...particles, ...buttonParticles];

    // Make sure they're initially inactive/invisible
    buttonParticles.forEach(particle => {
      particle.isActive = false;
    });

    // Mark this button as initialized
    initializedButtons.add(buttonId);

    // Add mouse move event listener for cursor tracking
    button.addEventListener('mousemove', handleMouseMove);

    // Add processing class when button is clicked (for animation state)
    button.addEventListener('click', () => {
      if (!button.disabled) {
        button.classList.add('processing');
      }
    });

    // Add mouse enter/leave events for special effects
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        // Find all particles belonging to this button
        const buttonId = button.dataset.geminiButtonId;
        const currentParticles = particles.filter(p => {
          return p.element.parentNode === iconContainer ||
                 (p.element.parentNode && p.element.parentNode.parentNode === iconContainer);
        });

        // Activate the existing particles with scattered velocities
        currentParticles.forEach(particle => {
          particle.isActive = true;

          // Give each particle a unique direction to create a scattered effect
          const angle = Math.random() * Math.PI * 2; // Random angle in radians
          const speed = 0.2 + Math.random() * 0.4; // Random speed between 0.2 and 0.6

          // Convert angle and speed to x,y velocity components
          particle.vx = Math.cos(angle) * speed;
          particle.vy = Math.sin(angle) * speed;
        });

        console.log(`Activated ${currentParticles.length} particles for button ${buttonId} (${button.classList.contains('generate-btn') ? 'generate' : 'retry'})`);
      }
    });

    button.addEventListener('mouseleave', () => {
      // Find all particles belonging to this button
      const currentParticles = particles.filter(p => {
        return p.element.parentNode === iconContainer ||
               (p.element.parentNode && p.element.parentNode.parentNode === iconContainer);
      });

      // Return particles to their original positions when mouse leaves
      currentParticles.forEach(particle => {
        particle.isActive = false;
        // Gradually return to origin
        particle.returnToOrigin = true;
      });
    });
  });

  // Start the animation loop
  requestAnimationFrame(animateParticles);
};

/**
 * Create a collection of Gemini icon particles
 * @param {HTMLElement} buttonElement - The button element
 * @param {HTMLElement} container - The container for particles
 * @param {number} [limit] - Optional limit for number of particles (used for hover state)
 */
const createParticles = (buttonElement, container, limit) => {
  const buttonParticles = [];

  // Determine if this is the generate button or retry button to create different effects
  const isGenerateButton = buttonElement.classList.contains('generate-btn');

  // Set particle count based on button type and limit parameter
  let particleCount;
  if (limit !== undefined) {
    // Use the exact limit if provided (for hover state)
    particleCount = limit;
  } else {
    // Default counts for initial state
    particleCount = isGenerateButton ?
      (15 + Math.floor(Math.random() * 10)) : // 15-25 particles for generate button
      (10 + Math.floor(Math.random() * 5));  // 10-15 particles for retry button
  }

  // Clear any existing static icons
  const existingStaticIcons = container.querySelectorAll('.gemini-mini-icon:not(.dynamic)');
  existingStaticIcons.forEach(icon => {
    icon.remove();
  });

  // Create a unique set of particles for this button
  const variant = 'standard'; // Only using standard variant
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

    // Assign random size with weighted distribution
    const sizeClasses = [
      { class: 'size-xs', weight: 0.3 },
      { class: 'size-sm', weight: 0.4 },
      { class: 'size-md', weight: 0.2 },
      { class: 'size-lg', weight: 0.1 }
    ];

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

    // Choose a random color scheme - different distribution for each button type
    let colorSchemeIndex;
    if (isGenerateButton) {
      // Generate button favors blue/purple schemes (0, 1, 2)
      colorSchemeIndex = Math.floor(Math.random() * 3);
    } else {
      // Retry button favors orange/red/green schemes (3, 4, 5)
      colorSchemeIndex = 3 + Math.floor(Math.random() * 3);
    }

    // Using only standard variant

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

    // Ensure within bounds
    x = Math.max(5, Math.min(95, x));
    y = Math.max(5, Math.min(95, y));

    // Create the particle object with physics properties
    const particleObj = {
      element: particle,
      x: x,
      y: y,
      originX: x,
      originY: y,
      vx: 0,
      vy: 0,
      size: getSizeInPixels(sizeClass),
      // No rotation for Gemini icons
      rotation: 0,
      rotationSpeed: 0,
      isActive: false,
      returnToOrigin: false,
      isFilled: isFilled,
      colorScheme: colorSchemeIndex,
      variant: variant,
      particleType: particleType,
      pulsePhase: Math.random() * Math.PI * 2, // Random starting phase for pulse
      pulseSpeed: 0.03 + Math.random() * 0.02, // Random pulse speed
      trailLength: particleType === 'trail' ? 3 + Math.floor(Math.random() * 3) : 0, // 3-5 trail particles
      trailParticles: [],
      connections: [], // Will store connections to other particles
      mass: getSizeInPixels(sizeClass) / 10, // Mass proportional to size for physics
      charge: Math.random() > 0.5 ? 1 : -1 // Random charge for attraction/repulsion
    };

    // Set up the particle element
    particle.className = `gemini-mini-icon ${sizeClass} dynamic ${particleType}`;
    particle.style.left = `${x}%`;
    particle.style.top = `${y}%`;
    // No rotation for Gemini icons
    particle.style.transform = `scale(1)`;
    particle.innerHTML = createGeminiSVG(isFilled, colorSchemeIndex);

    // Add to container and particle collection
    container.appendChild(particle);
    buttonParticles.push(particleObj);

    // Create trail particles if needed
    if (particleType === 'trail') {
      for (let t = 0; t < particleObj.trailLength; t++) {
        const trailParticle = document.createElement('div');
        trailParticle.className = `gemini-mini-icon ${sizeClass} dynamic trail-particle`;
        trailParticle.style.left = `${x}%`;
        trailParticle.style.top = `${y}%`;
        // No rotation for Gemini icons
        trailParticle.style.transform = `scale(${0.8 - t * 0.15})`;
        trailParticle.style.opacity = `${0.6 - t * 0.15}`;
        trailParticle.innerHTML = createGeminiSVG(isFilled, colorSchemeIndex);

        container.appendChild(trailParticle);
        particleObj.trailParticles.push({
          element: trailParticle,
          x: x,
          y: y,
          rotation: particleObj.rotation
        });
      }
    }
  }

  return buttonParticles;
};



/**
 * Get size in pixels based on size class
 */
const getSizeInPixels = (sizeClass) => {
  switch (sizeClass) {
    case 'size-xs': return 8;
    case 'size-sm': return 12;
    case 'size-md': return 16;
    case 'size-lg': return 20;
    default: return 14;
  }
};

/**
 * Create the Gemini SVG markup with option for filled version
 */
const createGeminiSVG = (isFilled, colorSchemeIndex = 0) => {
  // Get color scheme (default to first scheme if invalid index)
  const scheme = COLOR_SCHEMES[colorSchemeIndex] || COLOR_SCHEMES[0];

  // Create gradient ID with random number to avoid conflicts
  const gradientId = `gemini-gradient-${Math.floor(Math.random() * 10000)}`;
  const fillValue = isFilled ? `url(#${gradientId})` : 'none';
  const strokeWidth = isFilled ? '1' : '1.5';

  // Generate gradient stops
  const gradientStops = scheme.stops.map(stop =>
    `<stop offset="${stop.offset}" stop-color="${stop.color}" />`
  ).join('');

  // Only use the standard Gemini icon path (no plus icons)
  const pathD = 'M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z';

  // Add filter for glow effect if specified
  const filterId = `glow-${Math.floor(Math.random() * 10000)}`;
  const filterDef = scheme.glow ?
    `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>` : '';

  const filterAttr = scheme.glow ? `filter="url(#${filterId})"` : '';

  return `<svg width="100%" height="100%" viewBox="0 0 28 28" fill="${fillValue}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${gradientStops}
      </linearGradient>
      ${filterDef}
    </defs>
    <path d="${pathD}" stroke="${scheme.stroke}" stroke-width="${strokeWidth}" ${filterAttr}/>
  </svg>`;
};

/**
 * Handle mouse movement over buttons - simplified to do nothing
 * We keep this function to maintain compatibility with existing event listeners
 */
const handleMouseMove = () => {
  // No cursor interaction - removed to prevent sucking effect
  // No rotation animation for Gemini icons
};

/**
 * Animate all particles with physics
 */
const animateParticles = () => {
  // Process each particle
  particles.forEach(particle => {
    if (!particle.element.isConnected) return; // Skip if element is no longer in DOM

    // Apply physics if active
    if (particle.isActive) {
      // Apply friction
      particle.vx *= PHYSICS.friction;
      particle.vy *= PHYSICS.friction;

      // Apply additional damping for more elegant movement
      particle.vx *= PHYSICS.damping;
      particle.vy *= PHYSICS.damping;

      // No center gravity - just random gentle movement
      // Add very subtle random movement to create a floating effect
      particle.vx += (Math.random() - 0.5) * 0.01;
      particle.vy += (Math.random() - 0.5) * 0.01;

      // Apply the velocity
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Boundary checking - bounce off edges with reduced velocity
      if (particle.x < 5) {
        particle.x = 5;
        particle.vx = Math.abs(particle.vx) * 0.5; // Bounce with reduced energy
      } else if (particle.x > 95) {
        particle.x = 95;
        particle.vx = -Math.abs(particle.vx) * 0.5; // Bounce with reduced energy
      }

      if (particle.y < 5) {
        particle.y = 5;
        particle.vy = Math.abs(particle.vy) * 0.5; // Bounce with reduced energy
      } else if (particle.y > 95) {
        particle.y = 95;
        particle.vy = -Math.abs(particle.vy) * 0.5; // Bounce with reduced energy
      }

      // Update pulse effect
      particle.pulsePhase += particle.pulseSpeed;

      // Apply special effects based on particle type
      switch(particle.particleType) {
        case 'pulse':
          // Pulsing particles have stronger pulse effect
          particle.pulsePhase += particle.pulseSpeed * 2;
          break;
        case 'trail':
          // Trail particles leave a trail
          updateTrailParticles(particle);
          break;
        default:
          // Normal particles have no special effects
          break;
      }

      // Limit velocity
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      if (speed > PHYSICS.maxVelocity) {
        particle.vx = (particle.vx / speed) * PHYSICS.maxVelocity;
        particle.vy = (particle.vy / speed) * PHYSICS.maxVelocity;
      }

      // Store previous position for collision detection (for future use)
      // const prevX = particle.x;
      // const prevY = particle.y;

      // Position is already updated with boundary checking above

      // No rotation for Gemini icons

      // No constellation mode
    }
    // When mouse leaves, just slow down and fade out instead of returning to origin
    else if (particle.returnToOrigin) {
      // Apply stronger damping to gradually stop movement
      particle.vx *= 0.9;
      particle.vy *= 0.9;

      // Apply the velocity
      particle.x += particle.vx;
      particle.y += particle.vy;

      // If almost stopped, mark as not returning to origin
      if (Math.abs(particle.vx) < 0.01 && Math.abs(particle.vy) < 0.01) {
        particle.returnToOrigin = false;
      }

      // No connections to hide

      // Hide trail particles when returning to origin
      if (particle.trailParticles) {
        particle.trailParticles.forEach(trail => {
          if (trail.element) {
            trail.element.style.opacity = '0';
          }
        });
      }
    }

    // Apply position and rotation to element
    particle.element.style.left = `${particle.x}%`;
    particle.element.style.top = `${particle.y}%`;

    // Apply pulse effect to transform - different for each particle type
    let pulseScale = 1;
    if (particle.isActive) {
      if (particle.particleType === 'pulse') {
        // Stronger pulse effect
        pulseScale = 1 + 0.2 * Math.sin(particle.pulsePhase);
      } else {
        // Normal pulse effect
        pulseScale = 1 + 0.1 * Math.sin(particle.pulsePhase);
      }
    }

    // No rotation, only scale for pulse effect
    particle.element.style.transform = `scale(${pulseScale})`;

    // Set opacity based on activity and particle type
    let opacity = 0;
    if (particle.isActive) {
      if (particle.particleType === 'pulse') {
        // Pulsing opacity for pulse particles
        opacity = 0.5 + 0.3 * Math.sin(particle.pulsePhase);
      } else {
        opacity = 0.8;
      }
    }

    particle.element.style.opacity = opacity.toString();
  });

  // Collision detection disabled to prevent intense fighting of icons
  // handleCollisionsAdvanced();

  // Continue animation loop
  requestAnimationFrame(animateParticles);
};

/**
 * Update trail particles to follow the main particle
 */
const updateTrailParticles = (particle) => {
  if (!particle.trailParticles || particle.trailParticles.length === 0) return;

  // Update each trail particle to follow the main particle with delay
  for (let i = 0; i < particle.trailParticles.length; i++) {
    const trail = particle.trailParticles[i];
    if (!trail.element) continue;

    // Calculate delay factor based on position in trail
    const delay = (i + 1) * 0.2; // 0.2, 0.4, 0.6, etc.

    // Store current position
    const oldX = trail.x;
    const oldY = trail.y;

    // Move toward main particle's position with delay
    trail.x += (particle.x - trail.x) * (1 / delay);
    trail.y += (particle.y - trail.y) * (1 / delay);

    // Apply position and scale (no rotation)
    trail.element.style.left = `${trail.x}%`;
    trail.element.style.top = `${trail.y}%`;
    trail.element.style.transform = `scale(${0.8 - i * 0.15})`;

    // Fade opacity based on speed
    const dx = trail.x - oldX;
    const dy = trail.y - oldY;
    const speed = Math.sqrt(dx * dx + dy * dy);
    const baseOpacity = 0.6 - i * 0.15;
    const opacityBoost = Math.min(speed * 2, 0.3); // Boost opacity based on speed

    trail.element.style.opacity = `${baseOpacity + opacityBoost}`;
  }
};



// Collision detection removed - no longer needed



/**
 * Reset processing state when generation is complete
 */
export const resetGeminiButtonState = () => {
  const buttons = document.querySelectorAll('.generate-btn, .retry-gemini-btn');
  buttons.forEach(button => {
    button.classList.remove('processing');
  });
};

/**
 * Completely reset all Gemini button effects
 * This will remove all particles and clear the initialized buttons set
 */
export const resetAllGeminiButtonEffects = () => {
  // Remove all particles from the DOM
  particles.forEach(particle => {
    if (particle.element && particle.element.parentNode) {
      particle.element.remove();
    }

    // Also remove any trail particles
    if (particle.trailParticles) {
      particle.trailParticles.forEach(trail => {
        if (trail.element && trail.element.parentNode) {
          trail.element.remove();
        }
      });
    }
  });

  // Clear the particles array
  particles = [];

  // Clear the initialized buttons set
  initializedButtons.clear();

  console.log('Reset all Gemini button effects');

  // Re-initialize the effects
  initGeminiButtonEffects();
};
