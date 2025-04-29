/**
 * Handles the pill sliding animation for settings tab components
 * This adds a Material Design 3 style pill background that slides between tabs
 */

/**
 * Initialize the pill sliding animation for the settings tabs
 * @param {string} tabsSelector - CSS selector for the settings tabs container
 */
export const initSettingsTabPillAnimation = (tabsSelector = '.settings-tabs') => {
  // Find all settings tab containers
  const tabContainers = document.querySelectorAll(tabsSelector);
  
  if (!tabContainers.length) return;
  
  // For each tab container, set up the animation
  tabContainers.forEach(tabContainer => {
    // Initial positioning of the pill
    positionPillForActiveTab(tabContainer);
    
    // Add event listeners to all tab buttons
    const tabButtons = tabContainer.querySelectorAll('.settings-tab');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Small delay to allow the active class to be applied
        setTimeout(() => positionPillForActiveTab(tabContainer), 10);
      });
    });
    
    // Also handle window resize events
    window.addEventListener('resize', () => {
      positionPillForActiveTab(tabContainer);
    });
  });
};

/**
 * Position the pill background for the active tab
 * @param {HTMLElement} tabContainer - The tabs container element
 */
const positionPillForActiveTab = (tabContainer) => {
  const activeTab = tabContainer.querySelector('.settings-tab.active');
  
  // If no active tab, hide the pill
  if (!activeTab) {
    tabContainer.style.setProperty('--settings-pill-width', '0px');
    tabContainer.style.setProperty('--settings-pill-left', '0px');
    return;
  }
  
  // Get the position and dimensions of the active tab
  const tabRect = activeTab.getBoundingClientRect();
  const containerRect = tabContainer.getBoundingClientRect();
  
  // Calculate the left position relative to the container
  const left = tabRect.left - containerRect.left + tabContainer.scrollLeft;
  
  // Add a small padding to make the pill slightly wider than the tab for a more modern look
  const pillPadding = 12; // 6px on each side
  const pillWidth = tabRect.width + pillPadding;
  
  // Set the custom properties for the pill
  tabContainer.style.setProperty('--settings-pill-width', `${pillWidth}px`);
  tabContainer.style.setProperty('--settings-pill-left', `${left - (pillPadding / 2)}px`);
};

export default initSettingsTabPillAnimation;
