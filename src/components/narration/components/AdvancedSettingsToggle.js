import React from 'react';
import { useTranslation } from 'react-i18next';
import AdvancedSettingsModal from './AdvancedSettingsModal';

/**
 * Advanced Settings Toggle component
 * @param {Object} props - Component props
 * @param {Object} props.advancedSettings - Advanced settings object
 * @param {Function} props.setAdvancedSettings - Function to update advanced settings
 * @param {boolean} props.isGenerating - Whether narration is being generated
 * @returns {JSX.Element} - Rendered component
 */
const AdvancedSettingsToggle = ({
  advancedSettings,
  setAdvancedSettings,
  isGenerating
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="narration-row advanced-settings-row">
      <div className="row-label">
        <label>{t('narration.advancedSettings', 'Advanced Settings')}:</label>
      </div>
      <div className="row-content">
        <button
          className="pill-button secondary advanced-settings-button"
          onClick={openModal}
        >
          <span className="advanced-settings-button-label">
            {t('narration.advancedSettingsToggle', 'Voice & Audio Settings')}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        {/* Advanced Settings Modal */}
        <AdvancedSettingsModal
          isOpen={isModalOpen}
          onClose={closeModal}
          settings={advancedSettings}
          onSettingsChange={setAdvancedSettings}
          disabled={isGenerating}
        />
      </div>
    </div>
  );
};

export default AdvancedSettingsToggle;
