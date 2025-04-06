/**
 * Physics engine for Gemini button effects
 */

import { PHYSICS } from './constants';

/**
 * Apply physics to a particle
 * @param {Object} particle - The particle to update
 */
export const applyPhysics = (particle) => {
  if (!particle.isActive) return;

  // Apply friction
  particle.vx *= PHYSICS.friction;
  particle.vy *= PHYSICS.friction;

  // Apply additional damping for more elegant movement
  particle.vx *= PHYSICS.damping;
  particle.vy *= PHYSICS.damping;

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

  // Limit velocity
  const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
  if (speed > PHYSICS.maxVelocity) {
    particle.vx = (particle.vx / speed) * PHYSICS.maxVelocity;
    particle.vy = (particle.vy / speed) * PHYSICS.maxVelocity;
  }

  // Update rotation
  particle.rotation += particle.rotationSpeed;
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

/**
 * Apply cursor interaction to a particle
 * @param {Object} particle - The particle to update
 * @param {Object} cursorPosition - Current cursor position
 */
export const applyCursorInteraction = (particle, cursorPosition) => {
  // Calculate distance from cursor to particle
  const dx = (cursorPosition.x - particle.x);
  const dy = (cursorPosition.y - particle.y);
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Apply force if within cursor radius
  if (distance < PHYSICS.cursorRadius) {
    // Calculate force based on distance (stronger when closer)
    const force = (1 - distance / PHYSICS.cursorRadius) * PHYSICS.cursorForce;

    // Apply force away from cursor
    particle.vx -= (dx / distance) * force;
    particle.vy -= (dy / distance) * force;
  }
};

/**
 * Handle collisions between particles
 * @param {Array} particles - Array of particles
 */
export const handleCollisions = (particles) => {
  // Check each pair of particles for collisions
  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i];
    if (!p1.isActive) continue;

    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      if (!p2.isActive) continue;

      // Calculate distance between particles
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if particles are colliding
      const minDistance = (p1.size + p2.size) / 2 / 10; // Convert to percentage
      if (distance < minDistance) {
        // Calculate collision response
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Rotate velocities
        const vx1 = p1.vx * cos + p1.vy * sin;
        const vy1 = p1.vy * cos - p1.vx * sin;
        const vx2 = p2.vx * cos + p2.vy * sin;
        const vy2 = p2.vy * cos - p2.vx * sin;

        // Calculate new velocities
        const newVx1 = ((vx1 * (p1.size - p2.size) + 2 * p2.size * vx2) / (p1.size + p2.size)) * PHYSICS.bounce;
        const newVx2 = ((vx2 * (p2.size - p1.size) + 2 * p1.size * vx1) / (p1.size + p2.size)) * PHYSICS.bounce;

        // Apply new velocities
        p1.vx = newVx1 * cos - vy1 * sin;
        p1.vy = vy1 * cos + newVx1 * sin;
        p2.vx = newVx2 * cos - vy2 * sin;
        p2.vy = vy2 * cos + newVx2 * sin;

        // Move particles apart to prevent sticking
        const overlap = minDistance - distance;
        const moveX = (overlap / 2) * cos;
        const moveY = (overlap / 2) * sin;
        p1.x -= moveX;
        p1.y -= moveY;
        p2.x += moveX;
        p2.y += moveY;
      }
    }
  }
};

/**
 * Update particles based on physics and interactions
 * @param {Array} particles - Array of particles
 * @param {Object} cursorPosition - Current cursor position
 * @param {boolean} isHovering - Whether cursor is hovering
 */
export const updateParticles = (particles, cursorPosition, isHovering) => {
  // Update each particle
  particles.forEach(particle => {
    // Apply physics
    applyPhysics(particle);

    // Apply return to origin behavior
    applyReturnToOrigin(particle);

    // Apply cursor interaction if hovering
    if (isHovering && cursorPosition) {
      applyCursorInteraction(particle, cursorPosition);
    }
  });

  // Handle collisions between particles
  handleCollisions(particles);
};
