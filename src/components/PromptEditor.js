import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/PromptEditor.css';

const PromptEditor = ({
  isOpen,
  onClose,
  initialPrompt,
  onSave,
  title,
  description
}) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(initialPrompt);
  const modalRef = useRef(null);
  const textareaRef = useRef(null);
  const subtitlesTextCardRef = useRef(null);
  const targetLanguageCardRef = useRef(null);

  // Focus the textarea when the modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at the end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, [isOpen]);

  // Effect to handle the floating variable cards positioning
  useEffect(() => {
    const textarea = textareaRef.current;
    const subtitlesTextCard = subtitlesTextCardRef.current;
    const targetLanguageCard = targetLanguageCardRef.current;

    if (!textarea || !subtitlesTextCard || !targetLanguageCard || !isOpen) return;



    // Create overlay to hide the actual variable text
    const createTextOverlay = (variablePos, variableName) => {
      // Remove any existing overlays
      document.querySelectorAll('.variable-text-overlay').forEach(el => el.remove());

      // Get the exact position of the variable in the textarea
      const { left, top, width, height } = getExactVariablePosition(variablePos, variableName);

      // Create an overlay to hide the variable text
      const overlay = document.createElement('div');
      overlay.className = 'variable-text-overlay';
      overlay.style.position = 'absolute';
      overlay.style.left = left + 'px';
      overlay.style.top = top + 'px';
      overlay.style.backgroundColor = window.getComputedStyle(textarea).backgroundColor;
      overlay.style.width = width + 'px';
      overlay.style.height = height + 'px';
      overlay.style.zIndex = '10';
      overlay.style.pointerEvents = 'none';

      // Add the overlay to the container
      textarea.parentElement.appendChild(overlay);
    };

    // Function to update the position of the variable cards
    const updateCardPositions = () => {
      // Remove any existing overlays
      document.querySelectorAll('.variable-text-overlay').forEach(el => el.remove());

      // Find the positions of the variables in the text
      const subtitlesTextPos = prompt.indexOf('{subtitlesText}');
      const targetLanguagePos = prompt.indexOf('{targetLanguage}');

      // Calculate positions for both cards
      if (subtitlesTextPos !== -1) {
        positionCard(subtitlesTextCard, subtitlesTextPos, '{subtitlesText}');
      } else {
        // Hide the card if the variable is not in the text
        subtitlesTextCard.style.display = 'none';
      }

      if (targetLanguagePos !== -1) {
        positionCard(targetLanguageCard, targetLanguagePos, '{targetLanguage}');
      } else {
        // Hide the card if the variable is not in the text
        targetLanguageCard.style.display = 'none';
      }
    };

    // Helper function to position a card based on variable position
    const positionCard = (card, variablePos, variableName) => {
      // Show the card
      card.style.display = 'flex';

      // Get the exact position of the variable in the textarea
      const { left, top, height } = getExactVariablePosition(variablePos, variableName);

      // Position the card to exactly cover the variable text
      card.style.left = left + 'px';
      card.style.top = (top + height / 2) + 'px';

      // Create an overlay to hide the variable text
      createTextOverlay(variablePos, variableName);
    };

    // Helper function to get the exact position of a variable in the textarea
    const getExactVariablePosition = (variablePos, variableName) => {
      // Create a mirror div to exactly match the textarea's content and styling
      const mirror = document.createElement('div');
      mirror.style.position = 'absolute';
      mirror.style.top = '0';
      mirror.style.left = '0';
      mirror.style.visibility = 'hidden';
      mirror.style.pointerEvents = 'none';
      mirror.style.width = textarea.clientWidth + 'px';
      mirror.style.height = 'auto';
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.overflowWrap = 'break-word';
      mirror.style.boxSizing = 'border-box';

      // Copy all relevant styles from the textarea
      const textareaStyle = window.getComputedStyle(textarea);
      mirror.style.font = textareaStyle.font;
      mirror.style.padding = textareaStyle.padding;
      mirror.style.border = textareaStyle.border;
      mirror.style.lineHeight = textareaStyle.lineHeight;

      // Split the text into three parts: before variable, variable, and after variable
      const textBeforeVariable = prompt.substring(0, variablePos);
      const variableText = variableName;

      // Create spans for each part
      const beforeSpan = document.createElement('span');
      beforeSpan.textContent = textBeforeVariable;

      const variableSpan = document.createElement('span');
      variableSpan.textContent = variableText;
      variableSpan.id = 'variable-position-marker';
      variableSpan.style.position = 'relative';

      // Add the spans to the mirror
      mirror.appendChild(beforeSpan);
      mirror.appendChild(variableSpan);

      // Add the mirror to the document
      document.body.appendChild(mirror);

      // Get the position of the variable span
      const variableRect = variableSpan.getBoundingClientRect();
      const textareaRect = textarea.getBoundingClientRect();

      // Calculate the position relative to the textarea
      const left = variableRect.left - textareaRect.left;
      const top = variableRect.top - textareaRect.top + textarea.scrollTop;

      // Clean up
      document.body.removeChild(mirror);

      return {
        left,
        top,
        width: variableRect.width,
        height: variableRect.height
      };
    };

    // Update positions initially and on text changes
    updateCardPositions();

    // Add event listeners
    textarea.addEventListener('click', updateCardPositions);
    textarea.addEventListener('keyup', updateCardPositions);
    textarea.addEventListener('scroll', updateCardPositions);
    textarea.addEventListener('input', updateCardPositions);

    // Clean up event listeners
    return () => {
      textarea.removeEventListener('click', updateCardPositions);
      textarea.removeEventListener('keyup', updateCardPositions);
      textarea.removeEventListener('scroll', updateCardPositions);
      textarea.removeEventListener('input', updateCardPositions);

      // Remove any overlays
      document.querySelectorAll('.variable-text-overlay').forEach(el => el.remove());
    };
  }, [prompt, isOpen]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    onSave(prompt);
    onClose();
  };

  const handleReset = () => {
    setPrompt(initialPrompt);
  };

  // Handler functions to prevent deletion of variables
  const handleChange = (e) => {
    const newValue = e.target.value;
    const currentValue = prompt;
    const cursorPos = e.target.selectionStart;

    // Check if variables were removed
    const subtitlesTextRemoved = currentValue.includes('{subtitlesText}') && !newValue.includes('{subtitlesText}');
    const targetLanguageRemoved = currentValue.includes('{targetLanguage}') && !newValue.includes('{targetLanguage}');

    if (subtitlesTextRemoved || targetLanguageRemoved) {
      // Find where variables were in the original text
      const subtitlesTextPos = currentValue.indexOf('{subtitlesText}');
      const targetLanguagePos = currentValue.indexOf('{targetLanguage}');

      // Determine which variable was removed and restore it
      if (subtitlesTextRemoved && subtitlesTextPos !== -1) {
        // Determine if user is trying to delete the placeholder
        const isDeleteAttempt =
          // Check if cursor is at or near the placeholder position
          (cursorPos >= subtitlesTextPos && cursorPos <= subtitlesTextPos + '{subtitlesText}'.length) ||
          // Or if text before and after the placeholder matches the new value
          (currentValue.substring(0, subtitlesTextPos) +
           currentValue.substring(subtitlesTextPos + '{subtitlesText}'.length) === newValue);

        if (isDeleteAttempt) {
          // Prevent deletion by keeping the original value
          e.target.value = currentValue;
          // Restore cursor position
          setTimeout(() => {
            e.target.selectionStart = cursorPos;
            e.target.selectionEnd = cursorPos;
          }, 0);
          return; // Exit without updating state
        } else {
          // If it wasn't a direct deletion attempt, add it back at cursor position
          const restoredValue = newValue.substring(0, cursorPos) +
                              '{subtitlesText}' +
                              newValue.substring(cursorPos);
          setPrompt(restoredValue);
          // Position cursor after the placeholder
          setTimeout(() => {
            const newPos = cursorPos + '{subtitlesText}'.length;
            e.target.selectionStart = newPos;
            e.target.selectionEnd = newPos;
          }, 0);
          return;
        }
      }

      if (targetLanguageRemoved && targetLanguagePos !== -1) {
        // Determine if user is trying to delete the placeholder
        const isDeleteAttempt =
          // Check if cursor is at or near the placeholder position
          (cursorPos >= targetLanguagePos && cursorPos <= targetLanguagePos + '{targetLanguage}'.length) ||
          // Or if text before and after the placeholder matches the new value
          (currentValue.substring(0, targetLanguagePos) +
           currentValue.substring(targetLanguagePos + '{targetLanguage}'.length) === newValue);

        if (isDeleteAttempt) {
          // Prevent deletion by keeping the original value
          e.target.value = currentValue;
          // Restore cursor position
          setTimeout(() => {
            e.target.selectionStart = cursorPos;
            e.target.selectionEnd = cursorPos;
          }, 0);
          return; // Exit without updating state
        } else {
          // If it wasn't a direct deletion attempt, add it back at cursor position
          const restoredValue = newValue.substring(0, cursorPos) +
                              '{targetLanguage}' +
                              newValue.substring(cursorPos);
          setPrompt(restoredValue);
          // Position cursor after the placeholder
          setTimeout(() => {
            const newPos = cursorPos + '{targetLanguage}'.length;
            e.target.selectionStart = newPos;
            e.target.selectionEnd = newPos;
          }, 0);
          return;
        }
      }
    }

    // If we get here, the variables are still in the text or were handled above
    setPrompt(newValue);
  };

  // Prevent deletion of variables with Delete or Backspace keys
  const handleKeyDown = (e) => {
    // Check for variables in the text
    const subtitlesTextPos = prompt.indexOf('{subtitlesText}');
    const targetLanguagePos = prompt.indexOf('{targetLanguage}');

    if (subtitlesTextPos !== -1 || targetLanguagePos !== -1) {
      const cursorPos = e.target.selectionStart;
      const selectionEnd = e.target.selectionEnd;
      const hasSelection = cursorPos !== selectionEnd;

      // Check if selection includes any of the variables
      const selectionIncludesSubtitlesText =
        hasSelection &&
        subtitlesTextPos !== -1 &&
        cursorPos <= subtitlesTextPos + '{subtitlesText}'.length &&
        selectionEnd >= subtitlesTextPos;

      const selectionIncludesTargetLanguage =
        hasSelection &&
        targetLanguagePos !== -1 &&
        cursorPos <= targetLanguagePos + '{targetLanguage}'.length &&
        selectionEnd >= targetLanguagePos;

      // Check if cursor is at the start or end of variables
      const cursorAtSubtitlesTextStart =
        subtitlesTextPos !== -1 &&
        cursorPos === subtitlesTextPos &&
        e.key === 'Delete';

      const cursorAtSubtitlesTextEnd =
        subtitlesTextPos !== -1 &&
        cursorPos === subtitlesTextPos + '{subtitlesText}'.length &&
        e.key === 'Backspace';

      const cursorAtTargetLanguageStart =
        targetLanguagePos !== -1 &&
        cursorPos === targetLanguagePos &&
        e.key === 'Delete';

      const cursorAtTargetLanguageEnd =
        targetLanguagePos !== -1 &&
        cursorPos === targetLanguagePos + '{targetLanguage}'.length &&
        e.key === 'Backspace';

      // Check if cursor is inside variables
      const cursorInsideSubtitlesText =
        subtitlesTextPos !== -1 &&
        cursorPos > subtitlesTextPos &&
        cursorPos < subtitlesTextPos + '{subtitlesText}'.length &&
        (e.key === 'Delete' || e.key === 'Backspace');

      const cursorInsideTargetLanguage =
        targetLanguagePos !== -1 &&
        cursorPos > targetLanguagePos &&
        cursorPos < targetLanguagePos + '{targetLanguage}'.length &&
        (e.key === 'Delete' || e.key === 'Backspace');

      // Prevent cut/delete operations on the variables
      if ((selectionIncludesSubtitlesText || selectionIncludesTargetLanguage ||
           cursorAtSubtitlesTextStart || cursorAtSubtitlesTextEnd ||
           cursorAtTargetLanguageStart || cursorAtTargetLanguageEnd ||
           cursorInsideSubtitlesText || cursorInsideTargetLanguage) &&
          (e.key === 'Delete' || e.key === 'Backspace' ||
           (e.key === 'x' && e.ctrlKey) || (e.key === 'X' && e.ctrlKey))) {
        e.preventDefault();
      }
    }
  };

  // Prevent cutting the variables
  const handleCut = (e) => {
    const subtitlesTextPos = prompt.indexOf('{subtitlesText}');
    const targetLanguagePos = prompt.indexOf('{targetLanguage}');

    if (subtitlesTextPos !== -1 || targetLanguagePos !== -1) {
      const cursorPos = e.target.selectionStart;
      const selectionEnd = e.target.selectionEnd;

      // Check if selection includes any of the variables
      const selectionIncludesSubtitlesText =
        subtitlesTextPos !== -1 &&
        cursorPos <= subtitlesTextPos + '{subtitlesText}'.length &&
        selectionEnd >= subtitlesTextPos;

      const selectionIncludesTargetLanguage =
        targetLanguagePos !== -1 &&
        cursorPos <= targetLanguagePos + '{targetLanguage}'.length &&
        selectionEnd >= targetLanguagePos;

      if (selectionIncludesSubtitlesText || selectionIncludesTargetLanguage) {
        e.preventDefault();
      }
    }
  };

  // Handle paste to ensure variables are preserved
  const handlePaste = (e) => {
    const subtitlesTextPos = prompt.indexOf('{subtitlesText}');
    const targetLanguagePos = prompt.indexOf('{targetLanguage}');

    if (subtitlesTextPos !== -1 || targetLanguagePos !== -1) {
      const cursorPos = e.target.selectionStart;
      const selectionEnd = e.target.selectionEnd;

      // Check if selection includes any of the variables
      const selectionIncludesSubtitlesText =
        subtitlesTextPos !== -1 &&
        cursorPos <= subtitlesTextPos + '{subtitlesText}'.length &&
        selectionEnd >= subtitlesTextPos;

      const selectionIncludesTargetLanguage =
        targetLanguagePos !== -1 &&
        cursorPos <= targetLanguagePos + '{targetLanguage}'.length &&
        selectionEnd >= targetLanguagePos;

      if (selectionIncludesSubtitlesText || selectionIncludesTargetLanguage) {
        e.preventDefault();

        // Get pasted text
        const pastedText = e.clipboardData.getData('text');

        // Create new text with variables preserved
        let newText = prompt.substring(0, cursorPos) + pastedText + prompt.substring(selectionEnd);

        // If the new text doesn't include the variables, add them back
        if (selectionIncludesSubtitlesText && !newText.includes('{subtitlesText}')) {
          // Add variable at cursor position after paste
          newText = prompt.substring(0, cursorPos) +
                   pastedText +
                   '{subtitlesText}' +
                   prompt.substring(selectionEnd);
        }

        if (selectionIncludesTargetLanguage && !newText.includes('{targetLanguage}')) {
          // Add variable at cursor position after paste
          newText = prompt.substring(0, cursorPos) +
                   pastedText +
                   '{targetLanguage}' +
                   prompt.substring(selectionEnd);
        }

        setPrompt(newText);

        // Set cursor position after the pasted text
        setTimeout(() => {
          const newPos = cursorPos + pastedText.length;
          e.target.selectionStart = newPos;
          e.target.selectionEnd = newPos;
        }, 0);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="prompt-editor-overlay">
      <div className="prompt-editor-modal" ref={modalRef}>
        <div className="prompt-editor-header">
          <h3>{title || t('promptEditor.editPrompt', 'Edit Prompt')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="prompt-editor-content">
          {description && (
            <p className="prompt-editor-description">{description}</p>
          )}

          <div className="prompt-editor-container">
            <textarea
              ref={textareaRef}
              className="prompt-editor-textarea"
              value={prompt}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCut={handleCut}
              onPaste={handlePaste}
              rows={12}
              placeholder={t('promptEditor.enterPrompt', 'Enter your custom prompt here...')}
            />

            {/* Floating variable cards */}
            <div
              className="variable-floating-card subtitles-text-card"
              ref={subtitlesTextCardRef}
            >
              <span className="variable-icon">📝</span>
              <span className="variable-label">subtitlesText</span>
            </div>

            <div
              className="variable-floating-card target-language-card"
              ref={targetLanguageCardRef}
            >
              <span className="variable-icon">🌐</span>
              <span className="variable-label">targetLanguage</span>
            </div>
          </div>

          <div className="prompt-editor-variables">
            <h4>{t('promptEditor.availableVariables', 'Available Variables:')}</h4>
            <p className="variables-instruction">{t('promptEditor.variablesInstruction', 'The following variables are represented by icons in the text area:')}</p>
            <ul>
              <li>
                <span className="variable-icon" style={{ color: '#4caf50' }}>📝</span>
                <code>{'{subtitlesText}'}</code> - {t('promptEditor.subtitlesTextDesc', 'The subtitle text content')}
              </li>
              <li>
                <span className="variable-icon" style={{ color: '#2196f3' }}>🌐</span>
                <code>{'{targetLanguage}'}</code> - {t('promptEditor.targetLanguageDesc', 'The target language for translation')}
              </li>
            </ul>
          </div>

          <div className="prompt-editor-actions">
            <button className="secondary-button" onClick={handleReset}>
              {t('promptEditor.reset', 'Reset')}
            </button>
            <button className="primary-button" onClick={handleSave}>
              {t('promptEditor.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;
