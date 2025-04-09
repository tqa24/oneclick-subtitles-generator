/**
 * Button state management utilities for Gemini effects
 */

/**
 * Reset processing state when generation is complete
 */
export const resetGeminiButtonState = () => {
  const buttons = document.querySelectorAll('.generate-btn, .retry-gemini-btn, .srt-upload-button');
  buttons.forEach(button => {
    button.classList.remove('processing');
  });
};

/**
 * Completely reset all Gemini button effects
 * This will remove all particles and reinitialize the effects
 * @param {Function} initGeminiButtonEffects - Function to initialize button effects
 * @param {Array} particles - Array of particles to clear
 * @param {Set} initializedButtons - Set of initialized button IDs to clear
 */
export const resetAllGeminiButtonEffects = (initGeminiButtonEffects, particles, initializedButtons) => {
  // Remove all particles from the DOM
  if (particles && particles.length > 0) {
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
    particles.length = 0;
  }

  // Clear the initialized buttons set
  if (initializedButtons) {
    initializedButtons.clear();
  }


  // Re-initialize the effects
  if (typeof initGeminiButtonEffects === 'function') {
    initGeminiButtonEffects();
  }
};
