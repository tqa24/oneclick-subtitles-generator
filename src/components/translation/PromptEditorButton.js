import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PromptEditor from '../PromptEditor';

/**
 * Prompt editor button component
 * @param {Object} props - Component props
 * @param {string} props.customPrompt - Current custom prompt
 * @param {Function} props.onSavePrompt - Function to handle prompt save
 * @returns {JSX.Element} - Rendered component
 */
const PromptEditorButton = ({ customPrompt, onSavePrompt }) => {
  const { t } = useTranslation();
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);

  return (
    <div className="translation-row prompt-row">
      <div className="row-label">
        <label>{t('translation.promptSettings', 'Prompt')}:</label>
      </div>
      <div className="row-content">
        <button
          className="edit-prompt-button-with-text"
          onClick={() => setIsPromptEditorOpen(true)}
          title={t('promptEditor.editPromptTooltip', 'Edit Gemini prompt')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
          <span>{t('promptEditor.editPrompt', 'Edit Prompt')}</span>
        </button>

        <PromptEditor
          isOpen={isPromptEditorOpen}
          onClose={() => setIsPromptEditorOpen(false)}
          initialPrompt={customPrompt || `Translate the following subtitles to {targetLanguage}.

{subtitlesText}`}
          onSave={onSavePrompt}
          title={t('promptEditor.editTranslationPrompt', 'Edit Translation Prompt')}
          promptType="translation" // Explicitly set the prompt type
          description={t('promptEditor.customizeTranslationDesc', 'Add custom instructions for translation. The system will automatically handle formatting.')}
        />
      </div>
    </div>
  );
};

export default PromptEditorButton;
