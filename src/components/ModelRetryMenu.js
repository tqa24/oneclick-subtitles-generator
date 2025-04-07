import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ModelRetryMenu.css';
import { FiRefreshCw, FiChevronDown, FiZap, FiStar, FiAward, FiCpu } from 'react-icons/fi';

/**
 * Component for the model selection dropdown menu for retrying segments
 * @param {Object} props - Component props
 * @param {number} props.segmentIndex - Index of the segment
 * @param {Function} props.onRetryWithModel - Function to retry with a specific model
 * @returns {JSX.Element} - Rendered component
 */
const ModelRetryMenu = ({ segmentIndex, onRetryWithModel }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  // We don't need menuRef anymore
  // const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Position the dropdown relative to the button
  const positionDropdown = useCallback(() => {
    if (!buttonRef.current || !dropdownRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownEl = dropdownRef.current;

    // Position below the button
    dropdownEl.style.top = `${buttonRect.bottom + 8}px`;

    // Ensure the dropdown doesn't go off-screen to the right
    const rightEdge = buttonRect.right;
    const windowWidth = window.innerWidth;
    const dropdownWidth = 240; // Width from CSS

    if (rightEdge + dropdownWidth > windowWidth) {
      // Position to the left of the button's right edge
      dropdownEl.style.right = `${windowWidth - rightEdge}px`;
      dropdownEl.style.left = 'auto';
    } else {
      // Position aligned with button's left edge
      dropdownEl.style.left = `${buttonRect.left}px`;
      dropdownEl.style.right = 'auto';
    }
  }, []);

  // Handle button click
  const handleButtonClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle dropdown state
    setIsOpen(prev => !prev);
  }, []);

  // Position dropdown when it opens
  useEffect(() => {
    if (isOpen) {
      positionDropdown();

      // Add event listeners when dropdown is open
      const handleClickOutside = (e) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target) &&
          buttonRef.current &&
          !buttonRef.current.contains(e.target)
        ) {
          setIsOpen(false);
        }
      };

      const handleResize = () => {
        positionDropdown();
      };

      // Use capture phase to ensure we get the events first
      document.addEventListener('click', handleClickOutside, true);
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener('click', handleClickOutside, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, positionDropdown]);

  // Model options with their icons and colors
  const modelOptions = [
    {
      id: 'gemini-2.5-pro-exp-03-25',
      name: t('models.gemini25Pro', 'Gemini 2.5 Pro'),
      description: t('models.bestAccuracy', 'Best accuracy'),
      icon: <FiStar className="model-icon star-icon" />,
      color: 'var(--md-tertiary)',
      bgColor: 'rgba(var(--md-tertiary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash-thinking-exp-01-21',
      name: t('models.gemini20FlashThinking', 'Gemini 2.0 Flash Thinking'),
      description: t('models.highAccuracy', 'High accuracy'),
      icon: <FiAward className="model-icon award-icon" />,
      color: 'var(--md-secondary)',
      bgColor: 'rgba(var(--md-secondary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash',
      name: t('models.gemini20Flash', 'Gemini 2.0 Flash'),
      description: t('models.balancedModel', 'Balanced'),
      icon: <FiZap className="model-icon zap-icon" />,
      color: 'var(--md-primary)',
      bgColor: 'rgba(var(--md-primary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: t('models.gemini20FlashLite', 'Gemini 2.0 Flash Lite'),
      description: t('models.fastestModel', 'Fastest'),
      icon: <FiCpu className="model-icon cpu-icon" />,
      color: 'var(--success-color)',
      bgColor: 'rgba(var(--success-color-rgb), 0.1)'
    }
  ];

  // Handle model selection
  const handleModelSelect = useCallback((e, modelId) => {
    e.preventDefault();
    e.stopPropagation();

    // Close the dropdown immediately
    setIsOpen(false);

    // Call the retry function
    onRetryWithModel(segmentIndex, modelId);
  }, [onRetryWithModel, segmentIndex]);

  return (
    <div className="model-retry-menu-container">
      <button
        className="segment-retry-btn model-retry-btn"
        onClick={handleButtonClick}
        title={t('output.retryWithModel', 'Retry with different model')}
        ref={buttonRef}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <FiRefreshCw size={14} />
        <FiChevronDown size={10} className="dropdown-icon" />
      </button>

      {isOpen && (
        <div
          className="model-options-dropdown"
          ref={dropdownRef}
          role="menu"
        >
          <div className="model-options-header">
            {t('output.selectModel', 'Select model for retry')}
          </div>
          <div className="model-options-list">
            {modelOptions.map((model) => (
              <button
                key={model.id}
                className="model-option-btn"
                onClick={(e) => handleModelSelect(e, model.id)}
                style={{
                  '--model-color': model.color,
                  '--model-bg-color': model.bgColor
                }}
                role="menuitem"
              >
                <div className="model-option-icon">{model.icon}</div>
                <div className="model-option-text">
                  <div className="model-option-name">{model.name}</div>
                  <div className="model-option-description">{model.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelRetryMenu;
