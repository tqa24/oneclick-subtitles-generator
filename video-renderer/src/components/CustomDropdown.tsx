import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  dropUp: boolean;
}

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
  width: 100%;
  min-width: 120px;
`;

const DropdownButton = styled.button<{ $isOpen: boolean; $disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  background: var(--input-background);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-color);
  font-size: 14px;
  font-family: inherit;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  gap: 8px;
  
  &:hover:not(:disabled) {
    border-color: var(--accent-color);
  }
  
  &:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.2);
  }
  
  ${props => props.$isOpen && `
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.2);
  `}
  
  ${props => props.$disabled && `
    opacity: 0.6;
    background: var(--input-background-disabled);
    color: var(--text-color-disabled);
  `}
`;

const DropdownValue = styled.span`
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
`;

const DropdownArrow = styled.div<{ $rotated: boolean }>`
  flex-shrink: 0;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid var(--text-color);
  transition: transform 0.2s ease;
  transform: ${props => props.$rotated ? 'rotate(180deg)' : 'rotate(0deg)'};
`;

const DropdownMenu = styled.div<{ $dropUp: boolean }>`
  background: var(--dropdown-background, var(--input-background));
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow: hidden;
  animation: ${props => props.$dropUp ? 'dropdown-slide-up' : 'dropdown-slide-down'} 0.2s ease;
  transform-origin: ${props => props.$dropUp ? 'bottom center' : 'top center'};
  z-index: 9999;
  
  @keyframes dropdown-slide-down {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes dropdown-slide-up {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const DropdownOptionsList = styled.div`
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  
  /* Hide scrollbar */
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

const DropdownOption = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: var(--hover-background, rgba(255, 255, 255, 0.1));
  }
  
  &:focus {
    outline: none;
    background: var(--hover-background, rgba(255, 255, 255, 0.1));
  }
  
  ${props => props.$selected && `
    background: var(--accent-color);
    color: var(--accent-text-color, white);
    font-weight: 600;
    
    &:hover {
      background: var(--accent-color);
      opacity: 0.9;
    }
  `}
  
  &:first-child {
    border-radius: 8px 8px 0 0;
  }
  
  &:last-child {
    border-radius: 0 0 8px 8px;
  }
  
  &:only-child {
    border-radius: 8px;
  }
`;

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  style = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ 
    top: 0, 
    left: 0, 
    width: 0, 
    dropUp: false 
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside (account for portal menu)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // If click is inside the trigger/button, ignore
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      // If click is inside the portal menu, ignore
      if (menuRef.current && menuRef.current.contains(target)) return;
      // Otherwise, close
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Calculate dropdown position
  const calculatePosition = () => {
    if (!dropdownRef.current) return;

    const buttonRect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spacing = 4;
    
    // Calculate actual dropdown content height
    const optionHeight = 44;
    const dropdownPadding = 16;
    const actualContentHeight = (options.length * optionHeight) + dropdownPadding;
    const maxDropdownHeight = 200;
    const dropdownHeight = Math.min(actualContentHeight, maxDropdownHeight);
    
    const spaceBelow = viewportHeight - buttonRect.bottom - spacing;
    const spaceAbove = buttonRect.top - spacing;
    
    // Determine if we should drop up or down
    const shouldDropUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    
    let topPosition;
    if (shouldDropUp) {
      topPosition = buttonRect.top - dropdownHeight - spacing;
      topPosition = Math.max(spacing, topPosition);
    } else {
      topPosition = buttonRect.bottom + spacing;
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
        calculatePosition();
      }
      setIsOpen(!isOpen);
    }
  };

  const handleOptionSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(option => option.value === value);

  return (
    <DropdownContainer ref={dropdownRef} className={className} style={style}>
      <DropdownButton
        type="button"
        onClick={handleToggle}
        $disabled={disabled}
        $isOpen={isOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <DropdownValue>
          {selectedOption ? selectedOption.label : placeholder}
        </DropdownValue>
        <DropdownArrow $rotated={isOpen} />
      </DropdownButton>

      {isOpen && !disabled && createPortal(
        <DropdownMenu
          ref={menuRef}
          $dropUp={dropdownPosition.dropUp}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
          role="listbox"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <DropdownOptionsList>
            {options.map((option) => (
              <DropdownOption
                key={option.value}
                type="button"
                $selected={option.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOptionSelect(option.value);
                }}
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </DropdownOption>
            ))}
          </DropdownOptionsList>
        </DropdownMenu>,
        document.body
      )}
    </DropdownContainer>
  );
};

export default CustomDropdown;
