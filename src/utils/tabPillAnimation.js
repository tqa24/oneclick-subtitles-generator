/**
 * Handles the pill sliding animation for tab components
 * This adds a Material Design 3 style pill background that slides between tabs
 */

/**
 * Initialize the pill sliding animation for the given tabs container
 * @param {string} tabsSelector - CSS selector for the tabs container
 */
export const initTabPillAnimation = (tabsSelector = '.input-tabs') => {
  // Find all tab containers
  const tabContainers = document.querySelectorAll(tabsSelector);

  if (!tabContainers.length) return;

  // For each tab container, set up the animation
  tabContainers.forEach(tabContainer => {
    // Initial positioning of the pill
    positionPillForActiveTab(tabContainer);

    // Add event listeners to all tab buttons
    const tabButtons = tabContainer.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Reset wasActive and lastActive flags on all tabs when any tab is clicked
        tabButtons.forEach(tab => {
          if (tab !== button) {
            tab.dataset.wasActive = 'false';
            tab.dataset.lastActive = 'false';
          }
        });

        // Small delay to allow the active class to be applied
        setTimeout(() => positionPillForActiveTab(tabContainer), 10);
      });
    });

    // Also handle window resize events
    window.addEventListener('resize', () => {
      // Reset wasActive and lastActive flags on resize to ensure proper recalculation
      tabButtons.forEach(tab => {
        tab.dataset.wasActive = 'false';
        tab.dataset.lastActive = 'false';
      });
      positionPillForActiveTab(tabContainer);
    });
  });
};

/**
 * Position the pill background for the active tab
 * @param {HTMLElement} tabContainer - The tabs container element
 */
const positionPillForActiveTab = (tabContainer) => {
  const activeTab = tabContainer.querySelector('.tab-btn.active');

  // If no active tab, hide the pill
  if (!activeTab) {
    tabContainer.style.setProperty('--pill-width', '0px');
    tabContainer.style.setProperty('--pill-left', '0px');
    return;
  }

  // Check if pill width is already set and this is just a re-click on the same tab
  // Only skip recalculation if it's the same tab being clicked again
  const currentPillWidth = tabContainer.style.getPropertyValue('--pill-width');
  const isReclick = activeTab.dataset.wasActive === 'true' &&
                    activeTab.dataset.lastActive === 'true';

  if (currentPillWidth && currentPillWidth !== '0px' && isReclick) {
    // This is a re-click on the same tab, no need to recalculate
    return;
  }

  // Mark all tabs as not being the last active tab
  const allTabs = tabContainer.querySelectorAll('.tab-btn');
  allTabs.forEach(tab => {
    tab.dataset.lastActive = 'false';
  });

  // Mark this tab as having been active and as the last active tab
  activeTab.dataset.wasActive = 'true';
  activeTab.dataset.lastActive = 'true';

  // Get the position and dimensions of the active tab
  const tabRect = activeTab.getBoundingClientRect();
  const containerRect = tabContainer.getBoundingClientRect();

  // Calculate the left position relative to the container
  let left = tabRect.left - containerRect.left + tabContainer.scrollLeft;

  // Add a small padding to make the pill slightly wider than the tab for a more modern look
  const pillPadding = 8; // 4px on each side

  // Create a clone of the active tab to measure its true width without scaling
  const tabClone = activeTab.cloneNode(true);
  tabClone.style.transform = 'none'; // Remove any transform
  tabClone.style.position = 'absolute';
  tabClone.style.visibility = 'hidden';
  tabClone.style.display = 'flex'; // Ensure it's displayed the same way
  tabClone.classList.remove('active'); // Remove active class to avoid scaling
  document.body.appendChild(tabClone);

  // Get the natural width of the tab without scaling
  const naturalWidth = tabClone.getBoundingClientRect().width;

  // Clean up
  document.body.removeChild(tabClone);

  // Calculate pill width based on the natural width plus padding
  const pillWidth = naturalWidth + pillPadding;

  // Adjust the left position to account for the scaling effect
  // The scaling happens from the center, so we need to adjust the left position
  const scaleAdjustment = 1.2;
  const widthDifference = tabRect.width - (naturalWidth);
  left = left + (widthDifference / 2);

  // Set the custom properties for the pill
  tabContainer.style.setProperty('--pill-width', `${pillWidth}px`);
  tabContainer.style.setProperty('--pill-left', `${left - (pillPadding / 2)}px`);
};

export default initTabPillAnimation;
