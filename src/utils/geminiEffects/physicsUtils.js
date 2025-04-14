/**
 * Physics utilities for Gemini button effects
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

/**
 * Apply physics to a particle
 * @param {Object} particle - The particle to update
 * @param {boolean} isActive - Whether the particle is active
 */
export const applyPhysics = (particle) => {
  if (!particle.isActive) return;

  // Apply friction
  particle.vx *= PHYSICS.friction;
  particle.vy *= PHYSICS.friction;

  // Apply additional damping for more elegant movement
  particle.vx *= PHYSICS.damping;
  particle.vy *= PHYSICS.damping;

  // Removed random movement to prevent pulsing effect
  // particle.vx += (Math.random() - 0.5) * 0.01;
  // particle.vy += (Math.random() - 0.5) * 0.01;

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

  // Limit velocity
  const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
  if (speed > PHYSICS.maxVelocity) {
    particle.vx = (particle.vx / speed) * PHYSICS.maxVelocity;
    particle.vy = (particle.vy / speed) * PHYSICS.maxVelocity;
  }
};

/**
 * Apply return to origin behavior for a particle
 * @param {Object} particle - The particle to update
 */
export const applyReturnToOrigin = (particle) => {
  if (!particle.returnToOrigin) return;

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
};
