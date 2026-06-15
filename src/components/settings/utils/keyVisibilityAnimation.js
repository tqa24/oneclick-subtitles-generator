// Helper function for animating input visibility toggle with subtle fade
export const animateToggle = (elementId, currentState, setState) => {
  const element = document.getElementById(elementId);
  if (!element) {
    setState(!currentState);
    return;
  }

  // Apply fade-out animation
  element.style.animation = 'fade-out 0.15s ease-in-out forwards';

  // After animation completes, toggle state
  setTimeout(() => {
    setState(!currentState);

    // Apply fade-in animation after state change
    setTimeout(() => {
      element.style.animation = 'fade-in 0.15s ease-in-out forwards';
    }, 50);
  }, 150);
};

// Toggle key visibility with subtle fade animation
export const toggleKeyVisibility = (index, setVisibleKeyIndices) => {
  // Get the key element
  const keyElement = document.querySelector(`#gemini-key-${index} .gemini-key-content`);

  if (keyElement) {
    // Apply fade-out animation
    keyElement.style.animation = 'fade-out 0.15s ease-in-out forwards';

    // After animation completes, toggle visibility
    setTimeout(() => {
      setVisibleKeyIndices(prev => ({
        ...prev,
        [index]: !prev[index]
      }));

      // Apply fade-in animation after state change
      setTimeout(() => {
        keyElement.style.animation = 'fade-in 0.15s ease-in-out forwards';
      }, 50);
    }, 150);
  } else {
    // Fallback if element not found
    setVisibleKeyIndices(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }
};
