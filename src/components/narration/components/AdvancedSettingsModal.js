import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import NarrationAdvancedSettings from '../NarrationAdvancedSettings';
import '../../../styles/narration/advancedSettingsModal.css';

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
          <button className="pill-button primary" onClick={onClose}>
            {t('common.done', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsModal;
