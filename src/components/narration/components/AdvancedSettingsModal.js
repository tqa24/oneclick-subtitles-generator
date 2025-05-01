import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import NarrationAdvancedSettings from '../NarrationAdvancedSettings';
import '../../../styles/narration/advancedSettingsModal.css';

// Default advanced settings
const DEFAULT_ADVANCED_SETTINGS = {
  // Voice Style Controls
  speechRate: 1.0,

  // Generation Quality Controls
  nfeStep: '32',  // Number of Function Evaluations (diffusion steps)
  swayCoef: -1.0, // Sway Sampling Coefficient
  cfgStrength: 2.0, // Classifier-Free Guidance Strength

  // Seed Control
  useRandomSeed: true,
  seed: 42,

  // Audio Processing Options
  removeSilence: true,

  // Output Format Options
  sampleRate: '44100',
  audioFormat: 'wav',

  // Batch Processing Options
  batchSize: '8'
};

/**
 * Advanced Settings Modal component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {Object} props.settings - Advanced settings
 * @param {Function} props.onSettingsChange - Function to update settings
 * @param {boolean} props.disabled - Whether settings are disabled
 * @returns {JSX.Element} - Rendered component
 */
const AdvancedSettingsModal = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);

  // Handle reset to defaults
  const handleResetToDefaults = () => {
    onSettingsChange(DEFAULT_ADVANCED_SETTINGS);
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Handle ESC key to close
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="advanced-settings-modal-overlay">
      <div className="advanced-settings-modal" ref={modalRef}>
        <div className="advanced-settings-modal-header">
          <h3>{t('narration.advancedSettings', 'Advanced Settings')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="advanced-settings-modal-content">
          <NarrationAdvancedSettings
            settings={settings}
            onSettingsChange={onSettingsChange}
            disabled={disabled}
          />
        </div>
        <div className="advanced-settings-modal-footer">
          <button
            className="pill-button secondary"
            onClick={handleResetToDefaults}
            disabled={disabled}
            style={{
              backgroundColor: 'rgba(var(--md-tertiary-rgb), 0.1)',
              color: 'var(--md-tertiary)',
              border: '1px solid rgba(var(--md-tertiary-rgb), 0.2)',
              boxShadow: 'var(--md-elevation-level1)',
              transition: 'all var(--md-duration-medium2) var(--md-easing-standard)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--md-tertiary-container)';
              e.currentTarget.style.color = 'var(--md-on-tertiary-container)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--md-elevation-level2)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--md-tertiary-rgb), 0.1)';
              e.currentTarget.style.color = 'var(--md-tertiary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--md-elevation-level1)';
              e.currentTarget.style.borderColor = 'rgba(var(--md-tertiary-rgb), 0.2)';
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" preserveAspectRatio="xMidYMid meet">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {t('common.resetToDefaults', 'Reset to Defaults')}
          </button>
          <button
            className="pill-button primary"
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(var(--md-primary-rgb), 0.1)',
              color: 'var(--md-primary)',
              border: '1px solid rgba(var(--md-primary-rgb), 0.2)',
              boxShadow: 'var(--md-elevation-level1)',
              transition: 'all var(--md-duration-medium2) var(--md-easing-standard)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--md-primary-container)';
              e.currentTarget.style.color = 'var(--md-on-primary-container)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--md-elevation-level2)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--md-primary-rgb), 0.1)';
              e.currentTarget.style.color = 'var(--md-primary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--md-elevation-level1)';
              e.currentTarget.style.borderColor = 'rgba(var(--md-primary-rgb), 0.2)';
            }}
          >
            {t('common.done', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsModal;
