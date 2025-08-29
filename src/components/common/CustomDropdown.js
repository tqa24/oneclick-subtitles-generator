import React, { useState, useRef, useEffect } from 'react';
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
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const selectedOption = options.find(option => option.value === value);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

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

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <div
          ref={menuRef}
          className="custom-dropdown-menu custom-scrollbar-container"
          role="listbox"
        >
          <div className="dropdown-options-list">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(option.value)}
                  role="option"
                  aria-selected={option.value === value}
                >
                  {option.label}
                </button>
              ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
