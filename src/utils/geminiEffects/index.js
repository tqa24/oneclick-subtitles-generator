/**
 * Gemini Button Effects - Main entry point
 * Advanced physics-based animations for Gemini buttons
 */

import { updateParticles } from './physicsEngine';
import { updateParticleElements } from './renderUtils';
import { cleanupParticles } from './particleUtils';
import { setupButtonObserver, initializeButton, setupButtonEventListeners } from './domUtils';
import { resetGeminiButtonState as resetButtonState } from './buttonState';

// Collection of all active particles
let particles = [];

// Set to track initialized buttons to prevent duplicate initialization
const initializedButtons = new Set();

// Flag to track if the observer is already set up
let observerInitialized = false;

// Track cursor position for interactions
const cursorPosition = { x: 0, y: 0 };
const isHovering = { value: false };

/**
 * Initialize Gemini button effects
 */
export const initGeminiButtonEffects = () => {
  // Set up the MutationObserver to detect new buttons
  observerInitialized = setupButtonObserver(initGeminiButtonEffects, observerInitialized);

  // Find all Gemini buttons
  const generateButtons = document.querySelectorAll('.generate-btn');
  const retryButtons = document.querySelectorAll('.retry-gemini-btn');
  const forceStopButtons = document.querySelectorAll('.force-stop-btn');
  const srtUploadButtons = document.querySelectorAll('.srt-upload-button');
  const addSubtitlesButtons = document.querySelectorAll('.add-subtitles-button');

  // First, clean up any particles that are no longer in the DOM
  particles = cleanupParticles(particles);

  // Apply effects to all buttons
  [...generateButtons, ...retryButtons, ...forceStopButtons, ...srtUploadButtons, ...addSubtitlesButtons].forEach(button => {
    // Initialize the button and get updated particles array
    particles = initializeButton(button, initializedButtons, particles);

    // Set up event listeners for the button
    setupButtonEventListeners(button, particles, cursorPosition, isHovering);
  });

  // Start the animation loop if it's not already running
  if (!window.geminiAnimationFrameId) {
    window.geminiAnimationFrameId = requestAnimationFrame(animateParticles);
  }
};

/**
 * Reset processing state when generation is complete
 */
export const resetGeminiButtonState = () => {
  resetButtonState();
};

/**
 * Completely reset all Gemini button effects
 * This will remove all particles and reinitialize the effects
 */
export const resetAllGeminiButtonEffects = () => {
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
  initializedButtons.clear();


  // Re-initialize the effects
  initGeminiButtonEffects();
};

/**
 * Animate all particles
 */
const animateParticles = () => {
  // Update all particles
  updateParticles(particles, cursorPosition, isHovering.value);

  // Update DOM elements to match particle states
  updateParticleElements(particles);

  // Continue animation loop
  window.geminiAnimationFrameId = requestAnimationFrame(animateParticles);
};

// Export the initialization function
export default initGeminiButtonEffects;
