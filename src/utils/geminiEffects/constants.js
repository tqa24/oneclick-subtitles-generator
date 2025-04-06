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
