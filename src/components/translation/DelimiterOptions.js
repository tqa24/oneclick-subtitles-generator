import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Delimiter options component for multi-language translation
 * @param {Object} props - Component props
 * @param {string} props.selectedDelimiter - Currently selected delimiter
 * @param {Function} props.onDelimiterChange - Function to handle delimiter change
 * @param {boolean} props.useParentheses - Whether to use parentheses
 * @param {Function} props.onParenthesesChange - Function to handle parentheses toggle
 * @param {boolean} props.disabled - Whether the options are disabled
 * @param {boolean} props.showParenthesesOption - Whether to show the parentheses option
 * @returns {JSX.Element} - Rendered component
 */
const DelimiterOptions = ({
  selectedDelimiter,
  onDelimiterChange,
  useParentheses,
  onParenthesesChange,
  disabled = false,
  showParenthesesOption = false
}) => {
  const { t } = useTranslation();

  // Available delimiters
  const delimiters = [
    { id: 'space', value: ' ', label: t('translation.delimiterSpace', 'Space') },
    { id: 'newline', value: '\n', label: t('translation.delimiterNewline', 'New Line') },
    { id: 'slash', value: ' / ', label: t('translation.delimiterSlash', 'Slash (/)') },
    { id: 'pipe', value: ' | ', label: t('translation.delimiterPipe', 'Pipe (|)') },
    { id: 'dash', value: ' - ', label: t('translation.delimiterDash', 'Dash (-)') },
    { id: 'colon', value: ' : ', label: t('translation.delimiterColon', 'Colon (:)') },
    { id: 'semicolon', value: ' ; ', label: t('translation.delimiterSemicolon', 'Semicolon (;)') },
    { id: 'comma', value: ', ', label: t('translation.delimiterComma', 'Comma (,)') },
    { id: 'dot', value: '. ', label: t('translation.delimiterDot', 'Dot (.)') }
  ];

  return (
    <div className="translation-row delimiter-row">
      <div className="row-label">
        <label>{t('translation.delimiterSettings', 'Delimiter Settings')}:</label>
      </div>
      <div className="row-content">
        <div className="delimiter-options">
          <div className="delimiter-pills">
            {delimiters.map(delimiter => (
              <button
                key={delimiter.id}
                className={`delimiter-pill ${selectedDelimiter === delimiter.value ? 'active' : ''}`}
                onClick={() => {
                  onDelimiterChange(delimiter.value);
                  // When selecting a delimiter, turn off parentheses
                  if (useParentheses) onParenthesesChange(false);
                }}
                disabled={disabled}
              >
                {delimiter.label}
              </button>
            ))}

            {/* Parentheses option - only show when exactly one additional language */}
            {showParenthesesOption && (
              <button
                className={`delimiter-pill parentheses-pill ${useParentheses ? 'active' : ''}`}
                onClick={() => {
                  onParenthesesChange(!useParentheses);
                  // When enabling parentheses, clear the delimiter selection
                  if (!useParentheses) onDelimiterChange('');
                }}
                disabled={disabled}
                title={t('translation.useParenthesesDescription', 'Add second language in parentheses')}
              >
                {t('translation.useParentheses', 'Use Parentheses')}
              </button>
            )}
          </div>
        </div>
        <p className="setting-description">
          {t('translation.delimiterDescription', 'Choose how to separate multiple languages in the output')}
        </p>
      </div>
    </div>
  );
};

export default DelimiterOptions;
