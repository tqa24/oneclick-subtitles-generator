/**
 * Translate Button Effects - Add Gemini effects to translate buttons
 * This extends the Gemini button effects to work with translate buttons
 */

import initGeminiButtonEffects from './geminiEffects';

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

/**
 * Add static mini icons to a container
 * @param {HTMLElement} container - The container to add icons to
 */
const addStaticMiniIcons = (container) => {
  // Add a few static mini icons
  const iconPositions = [
    { class: 'random-1 size-sm', top: '15%', left: '12%' },
    { class: 'random-2 size-xs', top: '25%', right: '18%' },
    { class: 'random-3 size-md', bottom: '20%', left: '22%' },
    { class: 'random-4 size-sm', bottom: '30%', right: '15%' },
    { class: 'random-5 size-xs', top: '40%', left: '30%' },
    { class: 'random-6 size-md', top: '60%', right: '25%' }
  ];

  // Create each icon
  iconPositions.forEach(pos => {
    const icon = document.createElement('div');
    icon.className = `gemini-mini-icon ${pos.class}`;

    // Set position
    if (pos.top) icon.style.top = pos.top;
    if (pos.bottom) icon.style.bottom = pos.bottom;
    if (pos.left) icon.style.left = pos.left;
    if (pos.right) icon.style.right = pos.right;

    // Add SVG content
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
    </svg>`;

    // Add to container
    container.appendChild(icon);
  });
};

export default initTranslateButtonEffects;
