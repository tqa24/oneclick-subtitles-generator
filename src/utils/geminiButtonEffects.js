/**
 * Gemini Button Effects - Advanced physics-based animations for Gemini buttons
 */

// Physics constants
const PHYSICS = {
  friction: 0.95,
  bounce: 0.7,
  gravity: 0.05,
  maxVelocity: 3,
  collisionDistance: 15,
  cursorForce: 0.8,
  cursorRadius: 40
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

        // Simply activate the existing particles
        currentParticles.forEach(particle => {
          particle.isActive = true;
          // Give a small random velocity on hover
          particle.vx = (Math.random() - 0.5) * 2;
          particle.vy = (Math.random() - 0.5) * 2;
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
  const variants = ['standard', 'simplified', 'rounded', 'sharp'];
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

    // Choose a random variant with weighted distribution
    // Standard is most common, others are rarer
    const variantWeights = [0.7, 0.1, 0.1, 0.1]; // standard, simplified, rounded, sharp
    randomWeight = Math.random();
    cumulativeWeight = 0;
    let variant = 'standard';

    for (let j = 0; j < variants.length; j++) {
      cumulativeWeight += variantWeights[j];
      if (randomWeight <= cumulativeWeight) {
        variant = variants[j];
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

    // Assign random position - different distribution for each button
    let x, y;
    if (isGenerateButton) {
      // Generate button has more particles in the center
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.pow(Math.random(), 0.5) * 40; // Square root for more uniform distribution
      x = 50 + Math.cos(angle) * distance;
      y = 50 + Math.sin(angle) * distance;
    } else {
      // Retry button has more particles around the edges
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 30; // 30-60% from center
      x = 50 + Math.cos(angle) * distance;
      y = 50 + Math.sin(angle) * distance;
    }

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
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * (isGenerateButton ? 1 : 3), // Retry button has faster rotation
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
    particle.style.transform = `rotate(${particleObj.rotation}deg)`;
    particle.innerHTML = createGeminiSVG(isFilled, colorSchemeIndex, variant);

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
        trailParticle.style.transform = `rotate(${particleObj.rotation}deg) scale(${0.8 - t * 0.15})`;
        trailParticle.style.opacity = `${0.6 - t * 0.15}`;
        trailParticle.innerHTML = createGeminiSVG(isFilled, colorSchemeIndex, variant);

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
const createGeminiSVG = (isFilled, colorSchemeIndex = 0, variant = 'standard') => {
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

  // Different path variants for more visual variety
  let pathD = '';

  switch(variant) {
    case 'simplified':
      // Simplified version with fewer points
      pathD = 'M14 28C14 21 14 7 14 0C14 7 14 21 14 28ZM0 14C7 14 21 14 28 14C21 14 7 14 0 14Z';
      break;
    case 'rounded':
      // Rounded corners version
      pathD = 'M14 28C14 26 13.6 24 12.9 22.5C12.2 20.8 11.2 19.4 9.9 18.1C8.6 16.8 7.2 15.8 5.5 15.1C3.8 14.4 1.9 14 0 14C1.9 14 3.8 13.6 5.5 12.9C7.2 12.2 8.6 11.2 9.9 9.9C11.2 8.6 12.2 7.2 12.9 5.5C13.6 3.8 14 1.9 14 0C14 1.9 14.4 3.8 15.1 5.5C15.8 7.2 16.8 8.6 18.1 9.9C19.4 11.2 20.8 12.2 22.5 12.9C24.2 13.6 26 14 28 14C26 14 24.2 14.4 22.5 15.1C20.8 15.8 19.4 16.8 18.1 18.1C16.8 19.4 15.8 20.8 15.1 22.5C14.4 24.2 14 26 14 28Z';
      break;
    case 'sharp':
      // Sharp corners version
      pathD = 'M14 28L14 0L14 28ZM0 14L28 14L0 14Z';
      break;
    default:
      // Standard Gemini icon path
      pathD = 'M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z';
  }

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
 * Handle mouse movement over buttons to track cursor position
 */
const handleMouseMove = (event) => {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();

  // Calculate cursor position relative to button
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Update CSS variables for cursor position
  button.style.setProperty('--cursor-x', x);
  button.style.setProperty('--cursor-y', y);

  // Determine if this is the generate button or retry button for different effects
  const isGenerateButton = button.classList.contains('generate-btn');

  // Find particles belonging to this button and apply physics
  const buttonParticles = particles.filter(p => {
    // Check if the particle belongs to this button (either directly or via container)
    const parent = p.element.parentNode;
    return (parent === button || parent.parentNode === button) && p.isActive;
  });

  // Apply cursor force to nearby particles
  buttonParticles.forEach(particle => {
    // Convert percentage positions to pixel values
    const particleX = (particle.x / 100) * rect.width;
    const particleY = (particle.y / 100) * rect.height;

    // Calculate distance from cursor to particle
    const dx = x - particleX;
    const dy = y - particleY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Different cursor interaction based on button type
    if (isGenerateButton) {
      // Generate button: particles are attracted to cursor
      if (distance < PHYSICS.cursorRadius * 1.5) { // Larger radius for generate button
        // Calculate force (stronger when closer)
        const force = (1 - distance / (PHYSICS.cursorRadius * 1.5)) * PHYSICS.cursorForce * 0.7;

        // Apply force toward cursor (attract)
        particle.vx += (dx / distance) * force;
        particle.vy += (dy / distance) * force;

        // Increase rotation speed when near cursor
        particle.rotationSpeed *= 1.01;

        // Special effects for different particle types
        if (particle.particleType === 'pulse') {
          // Pulse particles pulse faster near cursor
          particle.pulseSpeed *= 1.05;
        }
      }
    } else {
      // Retry button: particles are repelled from cursor with swirl effect
      if (distance < PHYSICS.cursorRadius) {
        // Calculate force (stronger when closer)
        const force = (1 - distance / PHYSICS.cursorRadius) * PHYSICS.cursorForce;

        // Apply force in the opposite direction (repel from cursor)
        particle.vx -= (dx / distance) * force;
        particle.vy -= (dy / distance) * force;

        // Add swirl effect (perpendicular force)
        const swirlForce = force * 0.5;
        particle.vx += (dy / distance) * swirlForce;
        particle.vy -= (dx / distance) * swirlForce;

        // Special effects for different particle types
        if (particle.particleType === 'trail') {
          // Trail particles get a speed boost
          particle.vx *= 1.05;
          particle.vy *= 1.05;
        }
      }
    }

    // For all particles, limit max rotation speed
    const maxRotationSpeed = 5;
    if (Math.abs(particle.rotationSpeed) > maxRotationSpeed) {
      particle.rotationSpeed = Math.sign(particle.rotationSpeed) * maxRotationSpeed;
    }
  });
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

      // Apply gravity (subtle pull toward center)
      particle.vx += (50 - particle.x) * 0.0005;
      particle.vy += (50 - particle.y) * 0.0005;

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

      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Boundary collision with improved physics
      if (particle.x < 0) {
        particle.x = 0;
        particle.vx *= -PHYSICS.bounce;
        // Add some random vertical velocity on horizontal bounce
        particle.vy += (Math.random() - 0.5) * 0.5;
      } else if (particle.x > 100) {
        particle.x = 100;
        particle.vx *= -PHYSICS.bounce;
        // Add some random vertical velocity on horizontal bounce
        particle.vy += (Math.random() - 0.5) * 0.5;
      }

      if (particle.y < 0) {
        particle.y = 0;
        particle.vy *= -PHYSICS.bounce;
        // Add some random horizontal velocity on vertical bounce
        particle.vx += (Math.random() - 0.5) * 0.5;
      } else if (particle.y > 100) {
        particle.y = 100;
        particle.vy *= -PHYSICS.bounce;
        // Add some random horizontal velocity on vertical bounce
        particle.vx += (Math.random() - 0.5) * 0.5;
      }

      // Update rotation - different for each variant
      if (particle.variant === 'sharp') {
        // Sharp variants rotate faster
        particle.rotation += particle.rotationSpeed * 1.5;
      } else if (particle.variant === 'simplified') {
        // Simplified variants rotate slower
        particle.rotation += particle.rotationSpeed * 0.7;
      } else {
        particle.rotation += particle.rotationSpeed;
      }

      // No constellation mode
    }
    // Return to origin if flagged
    else if (particle.returnToOrigin) {
      // Calculate distance to origin
      const dx = particle.originX - particle.x;
      const dy = particle.originY - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If close enough to origin, snap to it
      if (distance < 0.5) {
        particle.x = particle.originX;
        particle.y = particle.originY;
        particle.returnToOrigin = false;
      } else {
        // Move toward origin with easing
        particle.x += dx * 0.1;
        particle.y += dy * 0.1;
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

    particle.element.style.transform = `rotate(${particle.rotation}deg) scale(${pulseScale})`;

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

  // Check for collisions between particles with improved physics
  handleCollisionsAdvanced();

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

    // Update rotation to follow main particle
    trail.rotation += (particle.rotation - trail.rotation) * 0.1;

    // Apply position and rotation
    trail.element.style.left = `${trail.x}%`;
    trail.element.style.top = `${trail.y}%`;
    trail.element.style.transform = `rotate(${trail.rotation}deg) scale(${0.8 - i * 0.15})`;

    // Fade opacity based on speed
    const dx = trail.x - oldX;
    const dy = trail.y - oldY;
    const speed = Math.sqrt(dx * dx + dy * dy);
    const baseOpacity = 0.6 - i * 0.15;
    const opacityBoost = Math.min(speed * 2, 0.3); // Boost opacity based on speed

    trail.element.style.opacity = `${baseOpacity + opacityBoost}`;
  }
};



/**
 * Handle collisions between particles with advanced physics
 */
const handleCollisionsAdvanced = () => {
  // Group particles by their parent button to avoid checking collisions across buttons
  const buttonGroups = {};

  particles.forEach(particle => {
    if (!particle.element.isConnected) return;

    // Find the button parent - could be either direct parent or grandparent
    let parent = particle.element.parentNode;
    if (parent && !parent.classList.contains('generate-btn') && !parent.classList.contains('retry-gemini-btn')) {
      parent = parent.parentNode;
    }

    if (!buttonGroups[parent]) {
      buttonGroups[parent] = [];
    }
    buttonGroups[parent].push(particle);
  });

  // Check collisions within each button group
  Object.values(buttonGroups).forEach(group => {
    for (let i = 0; i < group.length; i++) {
      const p1 = group[i];
      if (!p1.isActive) continue;

      for (let j = i + 1; j < group.length; j++) {
        const p2 = group[j];
        if (!p2.isActive) continue;

        // Calculate distance between particles
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Use size for collision detection, with a small buffer
        const collisionBuffer = 0.5; // Extra buffer to make collisions more likely
        const minDistance = (p1.size + p2.size) / 2 + collisionBuffer;

        // If collision detected
        if (distance < minDistance) {
          // Calculate collision normal
          const nx = dx / distance;
          const ny = dy / distance;

          // Calculate relative velocity
          const vx = p1.vx - p2.vx;
          const vy = p1.vy - p2.vy;

          // Calculate relative velocity in terms of the normal direction
          const velAlongNormal = vx * nx + vy * ny;

          // Do not resolve if velocities are separating
          if (velAlongNormal > 0) continue;

          // Calculate restitution (bounciness) - vary based on particle types
          let restitution = PHYSICS.bounce;

          // Pulse particles are bouncier
          if (p1.particleType === 'pulse' || p2.particleType === 'pulse') {
            restitution += 0.1;
          }

          // Calculate impulse scalar with mass consideration
          const invMass1 = 1 / (p1.mass || 1);
          const invMass2 = 1 / (p2.mass || 1);
          const impulseScalar = -(1 + restitution) * velAlongNormal / (invMass1 + invMass2);

          // Apply impulse with mass consideration
          p1.vx += impulseScalar * nx * invMass1;
          p1.vy += impulseScalar * ny * invMass1;
          p2.vx -= impulseScalar * nx * invMass2;
          p2.vy -= impulseScalar * ny * invMass2;

          // Move particles apart to prevent sticking
          const overlap = minDistance - distance;
          const percent = 0.6; // Penetration resolution percentage
          const moveX = overlap * nx * percent;
          const moveY = overlap * ny * percent;

          // Move proportional to inverse mass
          const totalInvMass = invMass1 + invMass2;
          p1.x += moveX * (invMass1 / totalInvMass);
          p1.y += moveY * (invMass1 / totalInvMass);
          p2.x -= moveX * (invMass2 / totalInvMass);
          p2.y -= moveY * (invMass2 / totalInvMass);

          // Add some random rotation on collision
          p1.rotationSpeed += (Math.random() - 0.5) * 0.5;
          p2.rotationSpeed += (Math.random() - 0.5) * 0.5;

          // Special effects for different particle types
          if (p1.particleType === 'trail' || p2.particleType === 'trail') {
            // Trail particles get a speed boost on collision
            const boost = 0.3;
            if (p1.particleType === 'trail') {
              p1.vx *= (1 + boost);
              p1.vy *= (1 + boost);
            }
            if (p2.particleType === 'trail') {
              p2.vx *= (1 + boost);
              p2.vy *= (1 + boost);
            }
          }

          if (p1.particleType === 'pulse' || p2.particleType === 'pulse') {
            // Pulse particles affect the other particle's pulse phase
            if (p1.particleType === 'pulse') {
              p2.pulsePhase = p1.pulsePhase;
            } else {
              p1.pulsePhase = p2.pulsePhase;
            }
          }
        }
      }
    }
  });
};



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
