import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, dropUp: false });
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

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

  // Calculate dropdown position
  const calculatePosition = () => {
    if (!dropdownRef.current) return;

    const buttonRect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spacing = 4; // Consistent spacing for both directions

    // Calculate actual dropdown content height
    const optionHeight = 44; // Approximate height per option (padding + text)
    const dropdownPadding = 16; // Top and bottom padding of dropdown
    const actualContentHeight = (options.length * optionHeight) + dropdownPadding;
    const maxDropdownHeight = 200; // Max height from CSS
    const dropdownHeight = Math.min(actualContentHeight, maxDropdownHeight);

    const spaceBelow = viewportHeight - buttonRect.bottom - spacing;
    const spaceAbove = buttonRect.top - spacing;

    // Determine if we should drop up or down
    const shouldDropUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    let topPosition;
    if (shouldDropUp) {
      // For drop-up: position dropdown so its bottom edge is just above button's top edge
      topPosition = buttonRect.top - dropdownHeight - spacing;

      // Debug logging
      console.log('Drop-up positioning:', {
        buttonTop: buttonRect.top,
        buttonBottom: buttonRect.bottom,
        actualContentHeight,
        dropdownHeight,
        spacing,
        calculatedTop: topPosition,
        spaceAbove,
        spaceBelow,
        optionsCount: options.length
      });

      // Safety check: don't go above viewport
      topPosition = Math.max(spacing, topPosition);
    } else {
      // Position dropdown's top edge just below button's bottom edge
      topPosition = buttonRect.bottom + spacing;

      // Safety check: don't go below viewport
      const maxTop = viewportHeight - dropdownHeight - spacing;
      topPosition = Math.min(topPosition, maxTop);
    }

    setDropdownPosition({
      top: topPosition,
      left: buttonRect.left,
      width: buttonRect.width,
      dropUp: shouldDropUp
    });
  };

  const handleToggle = () => {
    if (!disabled) {
      if (!isOpen) {
        // Initial positioning - will be refined after render
        calculatePosition();
      }
      setIsOpen(!isOpen);
    }
  };

  // Recalculate position after dropdown renders to get actual height
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const timer = setTimeout(() => {
        const actualDropdownHeight = menuRef.current.offsetHeight;
        const buttonRect = dropdownRef.current.getBoundingClientRect();
        const spacing = 4;

        // Recalculate with actual height
        const spaceBelow = window.innerHeight - buttonRect.bottom - spacing;
        const spaceAbove = buttonRect.top - spacing;
        const shouldDropUp = spaceBelow < actualDropdownHeight && spaceAbove > spaceBelow;

        let topPosition;
        if (shouldDropUp) {
          topPosition = buttonRect.top - actualDropdownHeight - spacing;
          topPosition = Math.max(spacing, topPosition);
        } else {
          topPosition = buttonRect.bottom + spacing;
          const maxTop = window.innerHeight - actualDropdownHeight - spacing;
          topPosition = Math.min(topPosition, maxTop);
        }

        console.log('Refined positioning:', {
          actualDropdownHeight,
          shouldDropUp,
          topPosition,
          buttonTop: buttonRect.top,
          buttonBottom: buttonRect.bottom
        });

        setDropdownPosition(prev => ({
          ...prev,
          top: topPosition,
          dropUp: shouldDropUp
        }));
      }, 0); // Next tick after render

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleOptionSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
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
      >
        <span className="dropdown-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FiChevronDown 
          className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`}
          size={16}
        />
      </button>

      {/* Dropdown menu - rendered as portal to avoid clipping */}
      {isOpen && !disabled && createPortal(
        <div
          ref={menuRef}
          className={`custom-dropdown-menu custom-scrollbar-container ${dropdownPosition.dropUp ? 'drop-up' : 'drop-down'}`}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 9999
          }}
          role="listbox"
          onMouseDown={(e) => {
            // Prevent outside handler from closing before option handler runs
            e.stopPropagation();
          }}
        >
          <div className="dropdown-options-list">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOptionSelect(option.value);
                }}
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomDropdown;
