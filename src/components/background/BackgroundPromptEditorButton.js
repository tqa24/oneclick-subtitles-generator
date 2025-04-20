import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BackgroundPromptEditor from './BackgroundPromptEditor';

/**
 * Button component to open the background prompt editor
 * @returns {JSX.Element} - Rendered component
 */
const BackgroundPromptEditorButton = () => {
  const { t } = useTranslation();
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);

  return (
    <>
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

      <BackgroundPromptEditor
        isOpen={isPromptEditorOpen}
        onClose={() => setIsPromptEditorOpen(false)}
      />
    </>
  );
};

export default BackgroundPromptEditorButton;
