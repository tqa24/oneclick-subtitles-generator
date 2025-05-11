/**
 * Translate Button Effects - Add Gemini effects to translate buttons
 * This extends the Gemini button effects to work with translate buttons
 */

/**
 * Initialize Gemini effects for translate buttons
 * This function has been modified to disable Gemini effects for translate buttons
 * to reduce lag as requested by the user
 */
export const initTranslateButtonEffects = () => {
  // Gemini effects for translate buttons have been disabled to reduce lag

  // Find all translate buttons with the generate-btn class
  const translateButtons = document.querySelectorAll('.translate-button.generate-btn');

  if (translateButtons.length === 0) {
    return; // No translate buttons found
  }

  // Remove any existing gemini-icon-container from translate buttons
  translateButtons.forEach(button => {
    const iconContainer = button.querySelector('.gemini-icon-container');
    if (iconContainer) {
      iconContainer.remove();
    }
  });

  // No need to initialize Gemini effects for translate buttons
};

// Function removed as it's not used

export default initTranslateButtonEffects;
