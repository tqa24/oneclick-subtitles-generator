/**
 * Gemini Button Effects - Handles cursor tracking and animation effects for Gemini buttons
 */

/**
 * Initialize Gemini button effects by adding event listeners and SVG elements
 */
export const initGeminiButtonEffects = () => {
  // Find all Gemini buttons - use more specific selectors to avoid conflicts
  const generateButtons = document.querySelectorAll('.buttons-container .generate-btn');
  const retryButtons = document.querySelectorAll('.buttons-container .retry-gemini-btn');

  // Apply effects to all buttons
  [...generateButtons, ...retryButtons].forEach(button => {
    // Create container for Gemini icons
    const iconContainer = document.createElement('div');
    iconContainer.className = 'gemini-icon-container';

    // Add mini Gemini icons with different sizes and positions
    for (let i = 1; i <= 6; i++) {
      const miniIcon = createGeminiIcon(`random-${i}`, getRandomSize());
      iconContainer.appendChild(miniIcon);
    }

    // Add cursor-reactive icons
    for (let i = 1; i <= 4; i++) {
      const reactiveIcon = createGeminiIcon('cursor-reactive', getRandomSize());
      reactiveIcon.style.top = `${10 + Math.random() * 80}%`;
      reactiveIcon.style.left = `${10 + Math.random() * 80}%`;
      iconContainer.appendChild(reactiveIcon);
    }

    // Add cursor follower icon
    const cursorFollower = document.createElement('div');
    cursorFollower.className = 'gemini-cursor-follower';
    cursorFollower.innerHTML = createGeminiSVG();
    iconContainer.appendChild(cursorFollower);

    // Add the container to the button
    button.appendChild(iconContainer);

    // Add mouse move event listener for cursor tracking
    button.addEventListener('mousemove', handleMouseMove);

    // Add processing class when button is clicked (for animation state)
    button.addEventListener('click', () => {
      if (!button.disabled) {
        button.classList.add('processing');
      }
    });
  });
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
};

/**
 * Create a Gemini mini icon element
 */
const createGeminiIcon = (positionClass, sizeClass) => {
  const icon = document.createElement('div');
  icon.className = `gemini-mini-icon ${positionClass} ${sizeClass}`;
  icon.innerHTML = createGeminiSVG();
  return icon;
};

/**
 * Get a random size class for variety
 */
const getRandomSize = () => {
  const sizes = ['size-xs', 'size-sm', 'size-md', 'size-lg'];
  return sizes[Math.floor(Math.random() * sizes.length)];
};

/**
 * Create the Gemini SVG markup
 */
const createGeminiSVG = () => {
  return `<svg width="100%" height="100%" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" stroke-width="1.5"/>
  </svg>`;
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
