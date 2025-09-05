import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import '../../styles/common/CustomDropdown.css';

const CustomDropdown = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select option...', 
  disabled = false,
  className = '',
  style = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const getChevronModeFromIndex = (val, opts) => {
    const idx = Math.max(0, opts.findIndex(o => o.value === val));
    if (idx === 0) return 'down';
    if (idx === opts.length - 1) return 'up';
    return 'center';
  };
  const [dropdownPosition, setDropdownPosition] = useState(() => ({
    top: 0, left: 0, width: 0, height: 0, upCount: 0, downCount: 0,
    revealMode: getChevronModeFromIndex(value, options),
    expandedWidth: 0 // Track the expanded width for menu
  }));
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const isDraggingRef = useRef(false);
  const hoveredIndexRef = useRef(null);
  const pendingSelectionRef = useRef(null);

  // Chevron that switches based on reveal mode
  const DropdownChevron = ({ mode }) => {
    // mode: 'center' | 'up' | 'down'
    if (mode === 'down') {
      return (
        <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M480-338q-12 0-24-5t-21-14L252-540q-18-18-18-44t18-44q18-18 44-18t44 18l140 140 140-140q18-18 44-18t44 18q18 18 18 44t-18 44L525-357q-9 9-21 14t-24 5Z"/>
        </svg>
      );
    }
    if (mode === 'up') {
      return (
        <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M480-496 340-356q-18 18-44 18t-44-18q-18-18-18-44t18-44l183-183q19-19 45-19t45 19l183 183q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-496Z"/>
        </svg>
      );
    }
    // two-direction center icon
    return (
      <svg className="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="m480-225 140-139q18-18 44-18t44 18q18 18 18 44t-18 44L569-137q-37 37-89 37t-89-37L252-276q-18-18-18-44t18-44q18-18 44-18t44 18l140 139Zm0-510L340-596q-18 18-44 18t-44-18q-18-18-18-44t18-44l139-139q37-37 89-37t89 37l139 139q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-735Z"/>
      </svg>
    );
  };

  // Close dropdown when clicking outside (account for portal menu)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      const target = event.target;
      // If click is inside the trigger/button, ignore
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      // If click is inside the portal menu, ignore
      if (menuRef.current && menuRef.current.contains(target)) return;
      // Otherwise, trigger smooth close
      handleSmoothClose();
    };

    // Use mousedown so it feels instantaneous, but respect clicks inside portal
    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, [isOpen]);

  // Initialize/update custom scrollbar when dropdown opens or position changes
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const timer = setTimeout(() => {
        initializeDropdownScrollbar(menuRef.current);
      }, 50); // Shorter delay for better responsiveness

      return () => clearTimeout(timer);
    }
  }, [isOpen, dropdownPosition.height]); // Re-initialize when height changes

  // Custom scrollbar implementation specifically for dropdown
  const initializeDropdownScrollbar = (container) => {
    if (!container) return; // Guard against null container
    
    const optionsList = container.querySelector('.dropdown-options-list');
    if (!optionsList) return;

    // Remove any existing scrollbar
    const existingThumb = container.querySelector('.custom-scrollbar-thumb');
    if (existingThumb) existingThumb.remove();

    // Remove scrollable class first (will be re-added if needed)
    container.classList.remove('has-scrollable-content');

    // Check if scrolling is needed
    if (optionsList.scrollHeight <= optionsList.clientHeight) {
      // No scrollbar needed, ensure class is removed
      return;
    }

    // Create thumb element
    const thumb = document.createElement('div');
    thumb.className = 'custom-scrollbar-thumb';
    container.appendChild(thumb);

    // Add scrollable content class
    container.classList.add('has-scrollable-content');

    // Update thumb position and size
    const updateThumb = () => {
      // Recalculate in case dimensions changed
      const scrollHeight = optionsList.scrollHeight;
      const clientHeight = optionsList.clientHeight;
      
      if (scrollHeight <= clientHeight) {
        // No longer needs scrolling
        thumb.style.display = 'none';
        return;
      }
      
      thumb.style.display = 'block';
      const scrollRatio = optionsList.scrollTop / (scrollHeight - clientHeight);
      const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * clientHeight);
      const thumbTop = scrollRatio * (clientHeight - thumbHeight);

      thumb.style.height = `${thumbHeight}px`;
      thumb.style.top = `${thumbTop + 8}px`; // 8px offset from top
    };

    // Initial update
    updateThumb();

    // Update on scroll
    optionsList.addEventListener('scroll', updateThumb);

    // Dragging functionality
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollTop = 0;

    thumb.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStartY = e.clientY;
      dragStartScrollTop = optionsList.scrollTop;
      thumb.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaY = e.clientY - dragStartY;
      const scrollRatio = deltaY / (optionsList.clientHeight - thumb.offsetHeight);
      const newScrollTop = dragStartScrollTop + scrollRatio * (optionsList.scrollHeight - optionsList.clientHeight);

      optionsList.scrollTop = Math.max(0, Math.min(newScrollTop, optionsList.scrollHeight - optionsList.clientHeight));
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        thumb.classList.remove('dragging');
      }
    });
  };

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleSmoothClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Recalculate position on window resize or scroll
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        calculatePosition();
        // Re-initialize scrollbar after position change
        setTimeout(() => {
          if (menuRef.current) {
            initializeDropdownScrollbar(menuRef.current);
          }
        }, 100);
      }
    };

    if (isOpen) {
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [isOpen]);

  // Use ResizeObserver to detect when menu actually changes size
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Menu size changed, update scrollbar
        if (entry.target && entry.target === menuRef.current && menuRef.current) {
          initializeDropdownScrollbar(menuRef.current);
        }
      }
    });

    // Small delay to ensure menu is rendered
    const timeoutId = setTimeout(() => {
      if (menuRef.current) {
        resizeObserver.observe(menuRef.current);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [isOpen]);

  const selectedOption = options.find(option => option.value === value);

  // Calculate dropdown anchored expansion around selected option (pill center)
  const calculatePosition = () => {
    if (!dropdownRef.current) return;

    // Dynamically calculate option height from first rendered option or use fallback
    let optionHeight = 48; // Default fallback height
    let maxOptionWidth = 0; // Track the widest option
    
    // If menu is already open, try to measure actual option height and width
    if (menuRef.current) {
      const allOptions = menuRef.current.querySelectorAll('.dropdown-option');
      if (allOptions.length > 0) {
        // Get height from first option
        const actualHeight = allOptions[0].offsetHeight;
        if (actualHeight > 0) {
          optionHeight = Math.ceil(actualHeight);
        }
        
        // Measure all options to find the widest one
        allOptions.forEach(option => {
          // Temporarily remove width constraints to measure natural width
          const originalWidth = option.style.width;
          option.style.width = 'auto';
          option.style.whiteSpace = 'nowrap';
          const naturalWidth = option.scrollWidth;
          option.style.width = originalWidth;
          option.style.whiteSpace = '';
          
          maxOptionWidth = Math.max(maxOptionWidth, naturalWidth);
        });
      }
    }
    
    // Get button rect once for all calculations
    const buttonRect = dropdownRef.current.getBoundingClientRect();
    
    // If we haven't measured options yet, estimate based on button width
    if (maxOptionWidth === 0) {
      maxOptionWidth = Math.max(buttonRect.width, 200); // Default minimum of 200px
    } else {
      // Add padding to the measured width for comfortable spacing
      maxOptionWidth = maxOptionWidth + 32; // Add 32px padding (16px each side)
    }
    
    // Check screen constraints and adjust if needed
    const availableWidth = window.innerWidth - buttonRect.left - 8; // 8px margin from edge
    
    // Don't exceed available screen space
    if (maxOptionWidth > availableWidth) {
      maxOptionWidth = availableWidth;
    }
    
    const borderCompensation = 2; // 1px border top + 1px border bottom
    const menuPadding = 4; // Container padding: 2px top + 2px bottom
    const extraBuffer = 2; // Small buffer to prevent scrollbar (reduced from 8)
    const maxMenuHeight = 400; // Cap to keep UI compact
    const spacing = 4;

    // buttonRect already declared above
    const centerY = buttonRect.top + buttonRect.height / 2; // Anchor baseline = pill center
    const viewportHeight = window.innerHeight;

    const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));

    // Available space around the anchor baseline
    const spaceAbove = centerY - spacing;
    const spaceBelow = viewportHeight - centerY - spacing;

    // Max items that can fit above/below at 44px each
    const maxUp = Math.floor(spaceAbove / optionHeight);
    const maxDown = Math.floor(spaceBelow / optionHeight);

    // Initial allocation limited by items available on each side
    let upCount = Math.min(selectedIndex, maxUp);
    let downCount = Math.min(options.length - 1 - selectedIndex, maxDown);

    // Try to allocate extra space to the side that still has room until we hit max height
    const totalMaxVisible = Math.floor(maxMenuHeight / optionHeight);
    const canShow = Math.min(totalMaxVisible, options.length);
    while (upCount + 1 + downCount < canShow) {
      const needUp = selectedIndex - upCount > 0 && upCount < maxUp;
      const needDown = (options.length - 1 - selectedIndex) - downCount > 0 && downCount < maxDown;
      if (!needUp && !needDown) break;
      // Prefer allocating to the side with more remaining room; if near an edge, expand mostly one direction
      if ((maxDown - downCount) >= (maxUp - upCount) && needDown) {
        downCount++;
      } else if (needUp) {
        upCount++;
      } else if (needDown) {
        downCount++;
      } else {
        break;
      }
    }

    const visibleCount = upCount + 1 + downCount;
    // Add border compensation, padding, and extra buffer to the calculated menu height
    const contentHeight = visibleCount * optionHeight;
    const totalCompensation = borderCompensation + menuPadding + extraBuffer;
    const menuHeight = Math.min(maxMenuHeight, contentHeight + totalCompensation);

    // Position so the selected option stays anchored at the pill center
    const topPosition = centerY - (upCount + 0.5) * optionHeight;


    const revealMode = (upCount === 0 && downCount > 0) ? 'down' : (downCount === 0 && upCount > 0) ? 'up' : 'center';

    // Calculate left position - shift left if dropdown would overflow right edge
    let leftPosition = buttonRect.left;
    if (leftPosition + maxOptionWidth > window.innerWidth - spacing) {
      // Shift left to fit, but don't go past left edge
      leftPosition = Math.max(spacing, window.innerWidth - maxOptionWidth - spacing);
    }
    
    setDropdownPosition({
      top: Math.max(spacing, Math.min(topPosition, viewportHeight - menuHeight - spacing)),
      left: leftPosition,
      width: buttonRect.width,
      height: menuHeight,
      upCount,
      downCount,
      revealMode,
      expandedWidth: maxOptionWidth // Store the target expanded width
    });

    // After position update, reinitialize scrollbar if menu is already open
    // Note: menuRef.current might not exist yet during initial calculation
  };

  // Ensure chevron shows correct direction before first open
  useEffect(() => {
    calculatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  const handleToggle = () => {
    if (!disabled) {
      if (!isOpen) {
        // Initial positioning - will be refined after render
        calculatePosition();
      }
      setIsOpen(!isOpen);
    }
  };

  // Opening/closing animation control using reveal (clip-path) and width expansion
  useEffect(() => {
    if (!menuRef.current) return;
    const el = menuRef.current;
    // Establish initial state when opening
    if (isOpen) {
      const targetH = dropdownPosition.height || 200;
      const targetW = dropdownPosition.expandedWidth || dropdownPosition.width;
      el.style.setProperty('--menu-height', `${targetH}px`);
      el.style.setProperty('--menu-width', `${targetW}px`);
      
      // Start with button width for smooth expansion
      el.style.width = `${dropdownPosition.width}px`;

      // Compute initial clip based on reveal mode: 'center', 'up', or 'down'
      let clipTop = 0, clipBottom = 0;
      if (dropdownPosition.revealMode === 'up') {
        // Reveal upward only: start collapsed at bottom edge
        clipTop = Math.max(0, targetH - 42);
        clipBottom = 0;
      } else if (dropdownPosition.revealMode === 'down') {
        // Reveal downward only: start collapsed at top edge
        clipTop = 0;
        clipBottom = Math.max(0, targetH - 42);
      } else {
        // Center reveal (default)
        const inset = Math.max(0, (targetH - 42) / 2);
        clipTop = inset;
        clipBottom = inset;
      }
      el.style.clipPath = `inset(${clipTop}px 0 ${clipBottom}px 0 round var(--dropdown-radius, 24px))`;

      // next frame: animate reveal to full height and width
      requestAnimationFrame(() => {
        el.classList.add('is-open');
        el.style.width = `${targetW}px`; // Expand to full width
        el.style.clipPath = `inset(0 0 0 0 round var(--dropdown-radius, 12px))`;
        
        // Trigger font morphing for selected item
        const selectedIdx = options.findIndex(o => o.value === value);
        const buttons = el.querySelectorAll('.dropdown-option');
        if (buttons[selectedIdx]) {
          buttons[selectedIdx].classList.add('morphing-from-button');
          setTimeout(() => {
            if (buttons[selectedIdx]) {
              buttons[selectedIdx].classList.remove('morphing-from-button');
            }
          }, 300);
        }
      });
    } else if (!el.classList.contains('is-closing-with-selection')) {
      // Only apply default closing if not handled by selection animation
      const targetH = dropdownPosition.height || 200;
      
      // Smooth transition for closing without selection
      el.style.transition = 'clip-path 200ms cubic-bezier(0.4, 0, 0.2, 1), width 200ms cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.width = `${dropdownPosition.width}px`; // Shrink back to button width
      
      let clipTop = 0, clipBottom = 0;
      if (dropdownPosition.revealMode === 'up') {
        clipTop = Math.max(0, targetH - 42);
        clipBottom = 0;
      } else if (dropdownPosition.revealMode === 'down') {
        clipTop = 0;
        clipBottom = Math.max(0, targetH - 42);
      } else {
        const inset = Math.max(0, (targetH - 42) / 2);
        clipTop = inset;
        clipBottom = inset;
      }
      el.style.clipPath = `inset(${clipTop}px 0 ${clipBottom}px 0 round var(--dropdown-radius, 24px))`;
      el.classList.remove('is-open');
    }
  }, [isOpen, dropdownPosition.height, dropdownPosition.width, dropdownPosition.expandedWidth]);

  // After opening, sync the scroll so the selected item stays anchored at center
  useEffect(() => {
    if (isOpen && menuRef.current) {
      // Trigger radius animation on next frame
      requestAnimationFrame(() => {
        if (menuRef.current) {
          menuRef.current.classList.add('radius-open');
          
          // Recalculate position after menu is rendered to get accurate measurements
          setTimeout(() => {
            calculatePosition();
            
            // Initialize scrollbar after position calculation
            setTimeout(() => {
              if (menuRef.current) {
                initializeDropdownScrollbar(menuRef.current);
                
                // Check if scrollbar appeared and adjust if needed
                const optionsList = menuRef.current.querySelector('.dropdown-options-list');
                if (optionsList && optionsList.scrollHeight > optionsList.clientHeight) {
                  // Scrollbar is present but we want to hide it if possible
                  const currentHeight = parseInt(menuRef.current.style.getPropertyValue('--menu-height') || '0');
                  if (currentHeight > 0 && currentHeight < 400) {
                    menuRef.current.style.setProperty('--menu-height', `${currentHeight + 4}px`);
                    // Re-initialize scrollbar after height adjustment
                    setTimeout(() => {
                      if (menuRef.current) {
                        initializeDropdownScrollbar(menuRef.current);
                      }
                    }, 50);
                  }
                }
              }
            }, 30);
          }, 20);
        }
      });

      const optionsList = menuRef.current.querySelector('.dropdown-options-list');
      if (optionsList) {
        // Get actual option height from rendered element
        const firstOption = optionsList.querySelector('.dropdown-option');
        const optionHeight = firstOption ? firstOption.offsetHeight : 52;
        
        const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
        const firstVisibleIndex = Math.max(0, selectedIndex - dropdownPosition.upCount);
        optionsList.scrollTop = firstVisibleIndex * optionHeight;
      }
    }
  }, [isOpen, value, dropdownPosition.upCount]);

  // Smooth close animation for non-selection closes
  const handleSmoothClose = () => {
    if (menuRef.current) {
      const list = menuRef.current.querySelector('.dropdown-options-list');
      const buttons = list ? Array.from(list.querySelectorAll('.dropdown-option')) : [];
      
      // Add closing class for smooth animation
      menuRef.current.classList.add('is-closing-no-selection');
      
      // Find currently selected/highlighted item if any
      const currentValue = value;
      const currentIndex = options.findIndex(o => o.value === currentValue);
      const currentBtn = buttons[currentIndex];
      
      if (list && currentBtn) {
        // Get position of current selection
        const selectedRect = currentBtn.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const optionHeight = currentBtn.offsetHeight;
        const selectedRelativeTop = selectedRect.top - menuRect.top;
        const menuHeight = menuRef.current.offsetHeight;
        
        // Fade all items with staggered timing based on distance from selected
        buttons.forEach((btn, idx) => {
          const distance = Math.abs(idx - currentIndex);
          const delay = distance * 20; // 20ms delay per item distance
          
          btn.style.transition = `opacity 200ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms,
                                   transform 200ms cubic-bezier(0.4, 0, 0.2, 1)`;
          btn.style.opacity = '0';
          btn.style.transform = 'scale(0.95)';
        });
        
        // Collapse around current selection
        const clipTop = selectedRelativeTop * 0.8; // Don't fully collapse, leave some space
        const clipBottom = (menuHeight - selectedRelativeTop - optionHeight) * 0.8;
        
        menuRef.current.style.transition = 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)';
        menuRef.current.style.clipPath = `inset(${clipTop}px 0 ${clipBottom}px 0 round var(--dropdown-radius, 24px))`;
        menuRef.current.style.width = `${dropdownPosition.width}px`;
        menuRef.current.style.opacity = '0';
        
      } else {
        // No selection - uniform fade and shrink
        buttons.forEach((btn, idx) => {
          const delay = idx * 15; // Staggered fade
          btn.style.transition = `opacity 150ms ease-out ${delay}ms`;
          btn.style.opacity = '0';
        });
        
        // Center collapse
        const menuHeight = menuRef.current.offsetHeight;
        const collapseAmount = menuHeight * 0.4;
        
        menuRef.current.style.transition = 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)';
        menuRef.current.style.clipPath = `inset(${collapseAmount}px 0 ${collapseAmount}px 0 round var(--dropdown-radius, 24px))`;
        menuRef.current.style.width = `${dropdownPosition.width}px`;
        menuRef.current.style.opacity = '0';
      }
      
      // Close after animation
      setTimeout(() => {
        setIsOpen(false);
        if (menuRef.current) {
          menuRef.current.classList.remove('is-closing-no-selection');
          menuRef.current.style.opacity = '';
          buttons.forEach(btn => {
            btn.style.opacity = '';
            btn.style.transform = '';
            btn.style.transition = '';
          });
        }
      }, 250);
    } else {
      // Fallback immediate close
      setIsOpen(false);
    }
  };

  const handleOptionSelect = (optionValue) => {
    if (menuRef.current) {
      const list = menuRef.current.querySelector('.dropdown-options-list');
      const buttons = list ? Array.from(list.querySelectorAll('.dropdown-option')) : [];
      const newIndex = Math.max(0, options.findIndex(o => o.value === optionValue));
      const selectedBtn = buttons[newIndex];

      if (list && selectedBtn) {
        // Add closing animation class
        menuRef.current.classList.add('is-closing-with-selection');
        
        // Get the selected button's position relative to the menu
        const selectedRect = selectedBtn.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const optionHeight = selectedBtn.offsetHeight;
        
        // Calculate where the selected item is in the menu
        const selectedRelativeTop = selectedRect.top - menuRect.top;
        const menuHeight = menuRef.current.offsetHeight;
        
        // The menu will collapse to just show the selected item
        // We want to keep the selected item where it is visually
        // So we clip from top and bottom equally around the selected item
        
        // Calculate clip amounts to center on selected item
        const clipTop = selectedRelativeTop;
        const clipBottom = menuHeight - selectedRelativeTop - optionHeight;
        
        // NO TRANSFORM - items stay where they are!
        // Just fade non-selected items
        buttons.forEach((btn, idx) => {
          btn.style.transition = 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)';
          
          if (idx === newIndex) {
            // Selected item stays fully visible and morphs font
            btn.style.opacity = '1';
            btn.style.backgroundColor = 'var(--md-primary-container)';
            btn.classList.add('morphing-to-button');
          } else {
            // Fade other items
            btn.style.opacity = '0';
          }
        });
        
        // Apply the clipping animation to collapse around selected item
        // NO WIDTH CHANGE - keep expanded width for cleaner animation
        menuRef.current.style.transition = 'clip-path 300ms cubic-bezier(0.4, 0, 0.2, 1)';
        menuRef.current.style.clipPath = `inset(${clipTop}px 0 ${clipBottom}px 0 round var(--dropdown-radius, 24px))`;
        
        // Fire change callback
        onChange(optionValue);
        
        // Close after animation completes
        setTimeout(() => {
          setIsOpen(false);
          // Clean up
          if (menuRef.current) {
            menuRef.current.classList.remove('is-closing-with-selection');
            buttons.forEach(btn => {
              btn.style.opacity = '';
              btn.style.backgroundColor = '';
              btn.style.transition = '';
            });
          }
        }, 300);
      } else {
        // Fallback
        onChange(optionValue);
        setIsOpen(false);
      }
    } else {
      // Fallback
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  return (
    <div 
      className={`custom-dropdown ${className} ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}
      ref={dropdownRef}
      style={style}
    >
      {/* Dropdown button */}
      <button
        type="button"
        className="custom-dropdown-button"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={isOpen ? { boxShadow: 'none', borderColor: 'transparent' } : undefined}
      >
        <span className={`dropdown-value ${isOpen ? 'morphing-open' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <DropdownChevron mode={getChevronModeFromIndex(value, options)} />
      </button>

      {/* Dropdown menu - rendered as portal to avoid clipping */}
      {isOpen && !disabled && createPortal(
        <div
          ref={menuRef}
          className={`custom-dropdown-menu custom-scrollbar-container anchored-expand`}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.expandedWidth || dropdownPosition.width}px`,
            minWidth: `${dropdownPosition.width}px`,
            zIndex: 999999
          }}
          role="listbox"
          onMouseDown={(e) => {
            // Prevent outside handler from closing before option handler runs
            e.stopPropagation();
          }}
        >
          <div className="dropdown-options-list">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`dropdown-option ${isSelected ? 'selected morphing-item' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Start drag mode - don't select yet
                    isDraggingRef.current = true;
                    hoveredIndexRef.current = options.findIndex(o => o.value === option.value);
                    pendingSelectionRef.current = option.value;
                    
                    // Add visual feedback for pressed state
                    e.currentTarget.classList.add('pressed');
                    
                    // Set up global mouse up listener
                    const handleMouseUp = (upEvent) => {
                      if (isDraggingRef.current) {
                        isDraggingRef.current = false;
                        
                        // Remove pressed state from all buttons
                        const allButtons = menuRef.current?.querySelectorAll('.dropdown-option');
                        allButtons?.forEach(btn => btn.classList.remove('pressed', 'hover-preview'));
                        
                        // If mouse is still over the same item, select it
                        if (pendingSelectionRef.current && hoveredIndexRef.current === options.findIndex(o => o.value === pendingSelectionRef.current)) {
                          handleOptionSelect(pendingSelectionRef.current);
                        } else {
                          // Mouse was dragged away - just cancel
                          pendingSelectionRef.current = null;
                          hoveredIndexRef.current = null;
                        }
                        
                        // Clean up listener
                        document.removeEventListener('mouseup', handleMouseUp);
                      }
                    };
                    
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                  onMouseEnter={(e) => {
                    // Track which item the mouse is over during drag
                    const idx = options.findIndex(o => o.value === option.value);
                    
                    if (isDraggingRef.current) {
                      hoveredIndexRef.current = idx;
                      // Update visual feedback
                      const allButtons = menuRef.current?.querySelectorAll('.dropdown-option');
                      allButtons?.forEach((btn, i) => {
                        btn.classList.remove('hover-preview');
                        if (i === idx) {
                          btn.classList.add('hover-preview');
                        }
                      });
                      
                      // Update pending selection if hovering over different item
                      if (idx === options.findIndex(o => o.value === pendingSelectionRef.current)) {
                        pendingSelectionRef.current = option.value;
                      } else {
                        pendingSelectionRef.current = null;
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isDraggingRef.current) {
                      e.currentTarget.classList.remove('hover-preview');
                    }
                  }}
                  role="option"
                  aria-selected={isSelected}
                  style={{
                    opacity: 0.999, // trigger GPU layer
                    transform: isSelected ? 'translateY(0)' : 'translateY(0)',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomDropdown;
