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
    revealMode: getChevronModeFromIndex(value, options)
  }));
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

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
      // Otherwise, close
      setIsOpen(false);
    };

    // Use mousedown so it feels instantaneous, but respect clicks inside portal
    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, [isOpen]);

  // Initialize custom scrollbar when dropdown opens
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const timer = setTimeout(() => {
        initializeDropdownScrollbar(menuRef.current);
      }, 50); // Shorter delay for better responsiveness

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Custom scrollbar implementation specifically for dropdown
  const initializeDropdownScrollbar = (container) => {
    const optionsList = container.querySelector('.dropdown-options-list');
    if (!optionsList) return;

    // Remove any existing scrollbar
    const existingThumb = container.querySelector('.custom-scrollbar-thumb');
    if (existingThumb) existingThumb.remove();

    // Check if scrolling is needed
    if (optionsList.scrollHeight <= optionsList.clientHeight) return;

    // Create thumb element
    const thumb = document.createElement('div');
    thumb.className = 'custom-scrollbar-thumb';
    container.appendChild(thumb);

    // Add scrollable content class
    container.classList.add('has-scrollable-content');

    // Update thumb position and size
    const updateThumb = () => {
      const scrollRatio = optionsList.scrollTop / (optionsList.scrollHeight - optionsList.clientHeight);
      const thumbHeight = Math.max(20, (optionsList.clientHeight / optionsList.scrollHeight) * optionsList.clientHeight);
      const thumbTop = scrollRatio * (optionsList.clientHeight - thumbHeight);

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
        setIsOpen(false);
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

  const selectedOption = options.find(option => option.value === value);

  // Calculate dropdown anchored expansion around selected option (pill center)
  const calculatePosition = () => {
    if (!dropdownRef.current) return;

    const optionHeight = 44; // Fixed per your spec
    const maxMenuHeight = 400; // Cap to keep UI compact
    const spacing = 4;

    const buttonRect = dropdownRef.current.getBoundingClientRect();
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
    const menuHeight = Math.min(maxMenuHeight, visibleCount * optionHeight);

    // Position so the selected option stays anchored at the pill center
    const topPosition = centerY - (upCount + 0.5) * optionHeight;


    const revealMode = (upCount === 0 && downCount > 0) ? 'down' : (downCount === 0 && upCount > 0) ? 'up' : 'center';

    setDropdownPosition({
      top: Math.max(spacing, Math.min(topPosition, viewportHeight - menuHeight - spacing)),
      left: buttonRect.left,
      width: buttonRect.width,
      height: menuHeight,
      upCount,
      downCount,
      revealMode
    });

    // After the menu renders, we will set the list scrollTop to keep selected anchored
    // This is done in the isOpen effect below.
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

  // Opening/closing animation control using reveal (clip-path), not scale
  useEffect(() => {
    if (!menuRef.current) return;
    const el = menuRef.current;
    // Establish initial state when opening
    if (isOpen) {
      const targetH = dropdownPosition.height || 200;
      el.style.setProperty('--menu-height', `${targetH}px`);

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

      // next frame: animate reveal to full height and smaller radius
      requestAnimationFrame(() => {
        el.classList.add('is-open');
        el.style.clipPath = `inset(0 0 0 0 round var(--dropdown-radius, 12px))`;
      });
    } else {
      // Closing: reverse the opening direction and remove open class
      const targetH = dropdownPosition.height || 200;
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
  }, [isOpen, dropdownPosition.height]);

  // After opening, sync the scroll so the selected item stays anchored at center
  useEffect(() => {
    if (isOpen && menuRef.current) {
      // Trigger radius animation on next frame
      requestAnimationFrame(() => {
        if (menuRef.current) {
          menuRef.current.classList.add('radius-open');
        }
      });

      const optionsList = menuRef.current.querySelector('.dropdown-options-list');
      if (optionsList) {
        const optionHeight = 44;
        const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
        const firstVisibleIndex = Math.max(0, selectedIndex - dropdownPosition.upCount);
        optionsList.scrollTop = firstVisibleIndex * optionHeight;
      }
    }
  }, [isOpen, value, dropdownPosition.upCount]);

  const handleOptionSelect = (optionValue) => {
    // Aggressive morph animation: keep menu open briefly, animate items shifting so new selection moves to center
    if (menuRef.current) {
      const list = menuRef.current.querySelector('.dropdown-options-list');
      const buttons = list ? Array.from(list.querySelectorAll('.dropdown-option')) : [];
      const optionHeight = 44;
      const newIndex = Math.max(0, options.findIndex(o => o.value === optionValue));

      if (list) {
        // Freeze height reveal during morph
        const targetH = dropdownPosition.height || 200;
        menuRef.current.style.setProperty('--menu-height', `${targetH}px`);
        // Compute target scrollTop so new selection is centered based on current upCount
        const newFirstVis = Math.max(0, newIndex - dropdownPosition.upCount);
        const targetScrollTop = newFirstVis * optionHeight;
        list.style.scrollBehavior = 'smooth';
        list.scrollTop = targetScrollTop;
        setTimeout(() => {
          if (list) list.style.scrollBehavior = 'auto';
        }, 220);

        // Nudge non-selected items to visually shift up/down in addition to the smooth scroll
        buttons.forEach((btn, idx) => {
          btn.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
          if (idx < newIndex) {
            btn.style.transform = 'translateY(-6px)';
          } else if (idx > newIndex) {
            btn.style.transform = 'translateY(6px)';
          } else {
            // Selected: slight scale emphasis
            btn.style.transform = 'translateY(0) scale(1.02)';
          }
        });
        setTimeout(() => {
          buttons.forEach((btn) => {
            btn.style.transform = 'translateY(0) scale(1)';
          });
        }, 180);
      }
    }

    // Fire change and then close after morph
    onChange(optionValue);
    setTimeout(() => setIsOpen(false), 200);
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
        <span className="dropdown-value">
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
            width: `${dropdownPosition.width}px`,
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
                  className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOptionSelect(option.value);
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
