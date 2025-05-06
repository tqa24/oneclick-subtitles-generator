/**
 * Handles the dragging functionality for settings tabs
 * This allows users to scroll horizontally through tabs by dragging
 */

/**
 * Initialize the drag functionality for the settings tabs
 * @param {string} tabsSelector - CSS selector for the settings tabs container
 */
export const initSettingsTabsDrag = (tabsSelector = '.settings-tabs') => {
  // Find all settings tab containers
  const tabContainers = document.querySelectorAll(tabsSelector);

  if (!tabContainers.length) return;

  // For each tab container, set up the drag functionality
  tabContainers.forEach(tabContainer => {
    // Variables to track drag state
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let animationFrameId = null;

    // Import the pill animation function
    const initSettingsTabPillAnimation = require('./settingsTabPillAnimation').default;

    // Check if tabs overflow and add indicator class
    const checkOverflow = () => {
      if (tabContainer.scrollWidth > tabContainer.clientWidth) {
        tabContainer.classList.add('has-overflow');
      } else {
        tabContainer.classList.remove('has-overflow');
      }
    };

    // Initial overflow check
    checkOverflow();

    // Function to update pill position when scrolling
    const updatePillPosition = () => {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        initSettingsTabPillAnimation(tabsSelector);
      }, 10);
    };

    // Handle mouse down event
    const handleMouseDown = (e) => {
      // Only handle primary mouse button (left click)
      if (e.button !== 0) return;

      isDragging = true;
      tabContainer.classList.add('dragging');
      startX = e.pageX;
      startScrollLeft = tabContainer.scrollLeft;

      // Prevent default behavior to avoid text selection
      e.preventDefault();
    };

    // Handle touch start event
    const handleTouchStart = (e) => {
      isDragging = true;
      tabContainer.classList.add('dragging');
      startX = e.touches[0].pageX;
      startScrollLeft = tabContainer.scrollLeft;
    };

    // Handle mouse move event
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      // Calculate how far the mouse has moved
      const x = e.pageX;
      const deltaX = x - startX;

      // Use requestAnimationFrame for smooth scrolling
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        tabContainer.scrollLeft = startScrollLeft - deltaX;
      });
    };

    // Handle touch move event
    const handleTouchMove = (e) => {
      if (!isDragging) return;

      // Calculate how far the touch has moved
      const x = e.touches[0].pageX;
      const deltaX = x - startX;

      // Use requestAnimationFrame for smooth scrolling
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        tabContainer.scrollLeft = startScrollLeft - deltaX;
      });

      // Prevent page scrolling
      e.preventDefault();
    };

    // Handle mouse up event
    const handleMouseUp = () => {
      isDragging = false;
      tabContainer.classList.remove('dragging');

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      // Update pill position after scrolling stops
      updatePillPosition();
    };

    // Handle touch end event
    const handleTouchEnd = () => {
      isDragging = false;
      tabContainer.classList.remove('dragging');

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      // Update pill position after scrolling stops
      updatePillPosition();
    };

    // Handle window resize event
    const handleResize = () => {
      checkOverflow();
    };

    // Handle scroll event
    const handleScroll = () => {
      // Use debounce to avoid too many updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        updatePillPosition();
      });
    };

    // Add event listeners
    tabContainer.addEventListener('mousedown', handleMouseDown);
    tabContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('resize', handleResize);
    tabContainer.addEventListener('scroll', handleScroll, { passive: true });

    // Store cleanup function on the element
    tabContainer._cleanupDrag = () => {
      tabContainer.removeEventListener('mousedown', handleMouseDown);
      tabContainer.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
      tabContainer.removeEventListener('scroll', handleScroll);
    };
  });

  // Return a cleanup function
  return () => {
    tabContainers.forEach(tabContainer => {
      if (tabContainer._cleanupDrag) {
        tabContainer._cleanupDrag();
        delete tabContainer._cleanupDrag;
      }
    });
  };
};

export default initSettingsTabsDrag;
