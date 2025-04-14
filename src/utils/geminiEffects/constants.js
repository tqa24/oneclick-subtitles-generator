/**
 * Constants for Gemini button effects
 */

// Physics constants
export const PHYSICS = {
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
export const COLOR_SCHEMES = [
  // Default Gemini gradient
  {
    stops: [
      { offset: '0%', color: 'rgba(145, 104, 192, 1.0)' },
      { offset: '50%', color: 'rgba(86, 132, 209, 1.0)' },
      { offset: '100%', color: 'rgba(27, 161, 227, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(145, 104, 192, 0.9)' // Star-like glow with higher opacity
  },
  // Purple-pink scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(171, 71, 188, 1.0)' },
      { offset: '100%', color: 'rgba(236, 64, 122, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(236, 64, 122, 0.9)' // Star-like glow with higher opacity
  },
  // Blue-green scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(3, 169, 244, 1.0)' },
      { offset: '100%', color: 'rgba(0, 150, 136, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(3, 169, 244, 0.9)' // Star-like glow with higher opacity
  },
  // Gold-orange scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(255, 215, 0, 1.0)' },
      { offset: '100%', color: 'rgba(255, 152, 0, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(255, 215, 0, 0.9)' // Star-like glow with higher opacity
  },
  // Teal-blue scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(0, 188, 212, 1.0)' },
      { offset: '100%', color: 'rgba(33, 150, 243, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(0, 188, 212, 0.9)' // Star-like glow with higher opacity
  },
  // Silver-white scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(224, 224, 224, 1.0)' },
      { offset: '100%', color: 'rgba(255, 255, 255, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(255, 255, 255, 0.9)' // Star-like glow with higher opacity
  },
  // Pink-purple scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(233, 30, 99, 1.0)' },
      { offset: '100%', color: 'rgba(156, 39, 176, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(233, 30, 99, 0.9)' // Star-like glow with higher opacity
  },
  // Green-blue scheme
  {
    stops: [
      { offset: '0%', color: 'rgba(46, 204, 113, 1.0)' },
      { offset: '100%', color: 'rgba(52, 152, 219, 1.0)' }
    ],
    stroke: 'none',
    glow: 'rgba(46, 204, 113, 0.9)' // Star-like glow with higher opacity
  }
];
