import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiChevronDown, FiStar, FiZap, FiCpu, FiTrendingUp, FiActivity } from 'react-icons/fi';
import '../styles/ModelDropdown.css';

/**
 * Reusable component for model selection dropdown
 * @param {Object} props - Component props
 * @param {Function} props.onModelSelect - Function called when a model is selected
 * @param {string} props.selectedModel - Currently selected model ID
 * @param {string} props.buttonClassName - Additional class name for the button
 * @param {string} props.label - Label to display on the button (optional)
 * @param {string} props.headerText - Text to display in the dropdown header
 * @param {boolean} props.isTranslationSection - Whether this dropdown is used in the translation section
 * @returns {JSX.Element} - Rendered component
 */
const ModelDropdown = ({
  onModelSelect,
  selectedModel = 'gemini-2.5-flash',
  buttonClassName = '',
  label = '',
  headerText,
  isTranslationSection = false
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Model options with their icons and colors
  const modelOptions = [
    {
      id: 'gemini-2.5-pro',
      name: t('models.gemini25Pro', 'Gemini 2.5 Pro'),
      description: isTranslationSection
        ? t('translation.modelGemini25Pro', 'output length 65536 tokens (usually no splitting needed)')
        : t('models.bestAccuracy', 'Best accuracy'),
      icon: <FiStar className="model-icon star-icon" />,
      color: 'var(--md-tertiary)',
      bgColor: 'rgba(var(--md-tertiary-rgb), 0.1)',
      isPaid: true
    },
    {
      id: 'gemini-2.5-flash',
      name: t('models.gemini25Flash', 'Gemini 2.5 Flash'),
      description: isTranslationSection
        ? t('translation.modelGemini25Flash', 'output length 65536 tokens (usually no splitting needed)')
        : t('models.smarterFaster', 'Smarter & faster'),
      icon: <FiZap className="model-icon zap-icon" style={{ color: 'var(--md-tertiary)' }} />,
      color: 'var(--md-tertiary)',
      bgColor: 'rgba(var(--md-tertiary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.5-flash-lite-preview-06-17',
      name: t('models.gemini25FlashLite', 'Gemini 2.5 Flash Lite'),
      description: isTranslationSection
        ? t('translation.modelGemini25FlashLite', 'output length 65536 tokens (usually no splitting needed)')
        : t('models.fastestAdvanced', 'Fastest 2.5 model'),
      icon: <FiTrendingUp className="model-icon trending-icon" style={{ color: 'var(--md-tertiary)' }} />,
      color: 'var(--md-tertiary)',
      bgColor: 'rgba(var(--md-tertiary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash',
      name: t('models.gemini20Flash', 'Gemini 2.0 Flash'),
      description: isTranslationSection
        ? t('translation.modelGemini20Flash', 'output length 8192 tokens (splitting recommended)')
        : t('models.balancedModel', 'Balanced'),
      icon: <FiActivity className="model-icon activity-icon" />,
      color: 'var(--md-primary)',
      bgColor: 'rgba(var(--md-primary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: t('models.gemini20FlashLite', 'Gemini 2.0 Flash Lite'),
      description: isTranslationSection
        ? t('translation.modelGemini20FlashLite', 'output length 8192 tokens (splitting recommended)')
        : t('models.fastestModel', 'Fastest'),
      icon: <FiCpu className="model-icon cpu-icon" />,
      color: 'var(--success-color)',
      bgColor: 'rgba(var(--success-color-rgb), 0.1)'
    }
  ];

  // Get the currently selected model
  const currentModel = modelOptions.find(model => model.id === selectedModel) || modelOptions[2]; // Default to Flash

  // Position the dropdown relative to the button
  const positionDropdown = useCallback(() => {
    if (!buttonRef.current || !dropdownRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownEl = dropdownRef.current;

    // Position above the button
    dropdownEl.style.bottom = `${window.innerHeight - buttonRect.top + 8}px`;

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

  // Handle model selection
  const handleModelSelect = useCallback((e, modelId) => {
    e.preventDefault();
    e.stopPropagation();

    // Close the dropdown immediately
    setIsOpen(false);

    // Call the selection function
    onModelSelect(modelId);
  }, [onModelSelect]);

  // Handle clicks outside to close the dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    // Position the dropdown when it opens
    positionDropdown();

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', positionDropdown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', positionDropdown);
    };
  }, [isOpen, positionDropdown]);

  return (
    <div className={`model-dropdown-container ${isOpen ? 'dropdown-open' : ''}`}>
      <button
        className={`model-dropdown-btn ${buttonClassName} ${isOpen ? 'active-dropdown-btn' : ''}`}
        onClick={handleButtonClick}
        title={t('common.selectModel', 'Select model')}
        ref={buttonRef}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {label && <span className="model-dropdown-label">{label}</span>}
        <span className="model-dropdown-selected">
          {currentModel.icon}
          <span className="model-name">{currentModel.name}</span>
        </span>
        <FiChevronDown size={14} className="dropdown-icon" />
      </button>

      {isOpen && (
        <div
          className="model-options-dropdown"
          ref={dropdownRef}
          role="menu"
        >
          <div className="model-options-header">
            {headerText || t('common.selectModel', 'Select model')}
          </div>
          <div className="model-options-list">
            {modelOptions.map((model) => (
              <button
                key={model.id}
                className={`model-option-btn ${model.id === selectedModel ? 'selected' : ''}`}
                onClick={(e) => handleModelSelect(e, model.id)}
                style={{
                  '--model-color': model.color,
                  '--model-bg-color': model.bgColor
                }}
                role="menuitem"
              >
                <div className="model-option-icon">{model.icon}</div>
                <div className="model-option-text">
                  <div className="model-option-name">
                    {model.name}
                    {model.isPaid && <span className="paid-badge">paid</span>}
                  </div>
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

export default ModelDropdown;
