/**
 * Functional custom scrollbar for reference text areas
 * Creates a real scrollbar that shows position and allows dragging
 */

class FunctionalScrollbar {
  constructor(container, textarea) {
    this.container = container;
    this.textarea = textarea;
    this.thumb = null;
    this.isDragging = false;
    this.dragStartY = 0;
    this.dragStartScrollTop = 0;
    
    this.init();
  }
  
  init() {
    // Ensure the container is positioned for absolute thumb placement
    try {
      const style = window.getComputedStyle(this.container);
      if (style.position === 'static') {
        this.container.style.position = 'relative';
      }
    } catch {}

    // Create thumb element
    this.thumb = document.createElement('div');
    this.thumb.className = 'custom-scrollbar-thumb';
    this.container.appendChild(this.thumb);

    // Bind event handlers
    this.handleScroll = this.handleScroll.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleThumbClick = this.handleThumbClick.bind(this);

    // Add event listeners
    this.textarea.addEventListener('scroll', this.handleScroll);
    this.thumb.addEventListener('mousedown', this.handleMouseDown);
    this.container.addEventListener('click', this.handleThumbClick);

    // Initial update
    this.updateThumbPosition();

    // Update on content changes
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateThumbPosition();
      });
      this.resizeObserver.observe(this.textarea);
    }
  }
  
  updateScrollbar() {
    this.updateThumbPosition();
  }
  
  handleScroll() {
    if (!this.isDragging) {
      this.updateThumbPosition();
    }
  }
  
  handleMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.isDragging = true;
    this.dragStartY = e.clientY;
    this.dragStartScrollTop = this.textarea.scrollTop;
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    
    // Add dragging class for visual feedback
    this.thumb.classList.add('dragging');
    document.body.style.userSelect = 'none';
  }
  
  handleMouseMove(e) {
    if (!this.isDragging) return;

    e.preventDefault();

    const deltaY = e.clientY - this.dragStartY;
    const containerHeight = this.container.clientHeight - 16;
    const { scrollHeight, clientHeight } = this.textarea;
    const maxScrollTop = scrollHeight - clientHeight;

    // Calculate scroll position based on thumb movement
    const scrollRatio = deltaY / containerHeight;
    const newScrollTop = this.dragStartScrollTop + (scrollRatio * maxScrollTop);

    // Clamp scroll position
    const clampedScrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));
    this.textarea.scrollTop = clampedScrollTop;

    // Update thumb position immediately for real-time feedback
    this.updateThumbPosition(clampedScrollTop);
  }

  updateThumbPosition(scrollTop = null) {
    const { scrollHeight, clientHeight } = this.textarea;
    const currentScrollTop = scrollTop !== null ? scrollTop : this.textarea.scrollTop;

    // Check if content overflows
    const hasScrollableContent = scrollHeight > clientHeight;

    // Update container class for track visibility
    if (hasScrollableContent) {
      this.container.classList.add('has-scrollable-content');
    } else {
      this.container.classList.remove('has-scrollable-content');
    }

    // Hide scrollbar if content doesn't overflow
    if (!hasScrollableContent) {
      this.thumb.style.opacity = '0';
      this.thumb.style.pointerEvents = 'none';
      return;
    }

    // Calculate thumb position
    const containerHeight = this.container.clientHeight - 16; // Account for padding
    const thumbHeight = Math.max((clientHeight / scrollHeight) * containerHeight, 20);
    const maxScrollTop = scrollHeight - clientHeight;
    const scrollPercentage = maxScrollTop > 0 ? currentScrollTop / maxScrollTop : 0;
    const maxThumbTop = containerHeight - thumbHeight;
    const thumbTop = scrollPercentage * maxThumbTop + 8; // Add top padding

    // Update thumb styles
    this.thumb.style.height = `${thumbHeight}px`;
    this.thumb.style.top = `${thumbTop}px`;
    this.thumb.style.pointerEvents = 'auto';

    // Show scrollbar when container or parent lyric-item is hovered/focused
    const parentItem = this.container.closest ? this.container.closest('.lyric-item') : null;
    const parentHovered = parentItem && parentItem.matches ? parentItem.matches(':hover') : false;
    const isVisible = this.container.matches(':hover, :focus-within') || parentHovered || this.isDragging;
    this.thumb.style.opacity = isVisible ? '1' : '0';
  }
  
  handleMouseUp() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    
    // Remove global mouse event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Remove dragging class
    this.thumb.classList.remove('dragging');
    document.body.style.userSelect = '';
    
    this.updateThumbPosition();
  }
  
  handleThumbClick(e) {
    // Only handle clicks on the track area (right side), ignore normal clicks on content
    if (e.target === this.thumb) return;

    const rect = this.container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top - 8; // Account for padding

    // Define a 12px wide track area from the right edge
    const trackZoneStart = rect.width - 12;
    if (clickX < trackZoneStart) {
      return; // Don't interfere with regular content clicks
    }

    const containerHeight = this.container.clientHeight - 16;
    const { scrollHeight, clientHeight } = this.textarea;
    const maxScrollTop = scrollHeight - clientHeight;

    // Calculate target scroll position
    const scrollPercentage = Math.max(0, Math.min(1, clickY / containerHeight));
    const targetScrollTop = scrollPercentage * maxScrollTop;

    // Jump instantly to target position (no smooth behavior)
    this.textarea.scrollTop = targetScrollTop;
  }
  
  destroy() {
    // Remove event listeners
    this.textarea.removeEventListener('scroll', this.handleScroll);
    this.thumb.removeEventListener('mousedown', this.handleMouseDown);
    this.container.removeEventListener('click', this.handleThumbClick);

    // Clean up global listeners if dragging
    if (this.isDragging) {
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
      document.body.style.userSelect = '';
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Remove container class
    this.container.classList.remove('has-scrollable-content');

    // Remove thumb element
    if (this.thumb && this.thumb.parentNode) {
      this.thumb.parentNode.removeChild(this.thumb);
    }
  }
}

/**
 * Initialize functional scrollbars for all custom scrollbar containers
 */
export function initializeFunctionalScrollbars() {
  // 1) Lyric items: anchor on row, scroll element is .lyric-text
  const lyricItems = document.querySelectorAll('.lyric-item:not([data-fs-initialized])');
  lyricItems.forEach((thumbContainer) => {
    const scrollEl = thumbContainer.querySelector('.lyric-text');
    if (!scrollEl) return;
    thumbContainer.setAttribute('data-fs-initialized', 'true');
    thumbContainer._functionalScrollbar = new FunctionalScrollbar(thumbContainer, scrollEl);
  });

  // 2) Generic containers
  const genericContainers = document.querySelectorAll(
    '.reference-text-container:not([data-fs-initialized]), .custom-scrollbar-textarea-container:not([data-fs-initialized])'
  );
  genericContainers.forEach((thumbContainer) => {
    const scrollEl = thumbContainer.querySelector('.reference-text, .custom-scrollbar-textarea');
    if (!scrollEl) return;
    thumbContainer.setAttribute('data-fs-initialized', 'true');
    thumbContainer._functionalScrollbar = new FunctionalScrollbar(thumbContainer, scrollEl);
  });
}

/**
 * Clean up all functional scrollbars (based on data attribute)
 */
export function cleanupFunctionalScrollbars() {
  const initializedContainers = document.querySelectorAll('[data-fs-initialized]');
  initializedContainers.forEach((container) => {
    if (container._functionalScrollbar) {
      container._functionalScrollbar.destroy();
      delete container._functionalScrollbar;
    }
    container.removeAttribute('data-fs-initialized');
  });
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFunctionalScrollbars);
  } else {
    initializeFunctionalScrollbars();
  }
  
  // Re-initialize when new content is added
  const observer = new MutationObserver((mutations) => {
    let shouldReinit = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('reference-text-container') ||
                node.classList?.contains('custom-scrollbar-textarea-container') ||
                node.classList?.contains('lyric-text') ||
                node.matches?.('.lyric-item-container .lyric-text') ||
                node.querySelector?.('.reference-text-container') ||
                node.querySelector?.('.custom-scrollbar-textarea-container') ||
                node.querySelector?.('.lyric-item-container .lyric-text')) {
              shouldReinit = true;
            }
          }
        });
      }
    });
    
    if (shouldReinit) {
      setTimeout(initializeFunctionalScrollbars, 100);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
