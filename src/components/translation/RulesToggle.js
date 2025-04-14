import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Rules toggle component
 * @param {Object} props - Component props
 * @param {boolean} props.includeRules - Whether to include rules
 * @param {Function} props.onIncludeRulesChange - Function to handle include rules change
 * @param {boolean} props.rulesAvailable - Whether rules are available
 * @param {boolean} props.hasUserProvidedSubtitles - Whether user-provided subtitles are present
 * @param {boolean} props.disabled - Whether the toggle is disabled
 * @returns {JSX.Element} - Rendered component
 */
const RulesToggle = ({
  includeRules,
  onIncludeRulesChange,
  rulesAvailable,
  hasUserProvidedSubtitles,
  disabled = false
}) => {
  const { t } = useTranslation();

  return (
    <div className="translation-row rules-row">
      <div className="row-label">
        <label htmlFor="include-rules">{t('translation.includeRules', 'Include Context Rules')}:</label>
      </div>
      <div className="row-content">
        <div className="toggle-switch-row">
          <label className="toggle-switch" htmlFor="include-rules">
            <input
              type="checkbox"
              id="include-rules"
              checked={includeRules}
              onChange={(e) => {
                const value = e.target.checked;
                onIncludeRulesChange(value);
              }}
              disabled={disabled || !rulesAvailable || hasUserProvidedSubtitles}
            />
            <span className="toggle-slider"></span>
          </label>
          <div className="label-with-help">
            <label htmlFor="include-rules" className="toggle-label">
              {t('translation.includeRulesLabel', 'Append transcription rules to translation requests')}
            </label>
            <div
              className="help-icon-container"
              title={hasUserProvidedSubtitles
                ? t('translation.customSubtitlesNoRules', 'This option is disabled because you provided custom subtitles. Custom subtitles mode skips video analysis and rule generation.')
                : rulesAvailable
                  ? t('translation.includeRulesDescription', 'Includes video analysis context and rules with each translation request for better consistency across segments.')
                  : t('translation.noRulesAvailable', 'No transcription rules available. This option requires analyzing the video with Gemini first.')}
            >
              <svg className="help-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulesToggle;
