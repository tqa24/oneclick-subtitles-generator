import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import CloseButton from '../common/CloseButton';
import CustomScrollbarTextarea from '../common/CustomScrollbarTextarea';
import CustomDropdown from '../common/CustomDropdown';
import '../../styles/PromptEditor.css';
import '../../styles/background/BackgroundPromptEditor.css';

const BackgroundPromptEditor = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);

  // Local UI state
  const [isSaving, setIsSaving] = useState(false);

  // State for the two prompts
  const [promptOne, setPromptOne] = useState(
    `song title: \${songName || 'Unknown Song'}\n\n\${lyrics}\n\ngenerate one prompt to put in a image generator to describe the atmosphere/object of this song, should be simple but abstract because I will use this image as youtube video background for a lyrics video, return the prompt only, no extra texts`
  );

  const [promptTwo, setPromptTwo] = useState(
    `Expand the image into 16:9 ratio (landscape ratio). Then decorate my given image with \${prompt}`
  );

  // Model selections
  const [promptModel, setPromptModel] = useState('gemini-2.5-flash-lite');
  const [imageModel, setImageModel] = useState('gemini-2.0-flash-preview-image-generation');


  // Track initial (loaded) values to detect changes
  const [initialPromptOne, setInitialPromptOne] = useState(promptOne);
  const [initialPromptTwo, setInitialPromptTwo] = useState(promptTwo);
  const [initialPromptModel, setInitialPromptModel] = useState(promptModel);
  const [initialImageModel, setInitialImageModel] = useState(imageModel);

  // Load the current prompts from the server
  useEffect(() => {
    if (isOpen) {
      const fetchPrompts = async () => {
        try {
          const response = await fetch('http://127.0.0.1:3031/api/gemini/get-prompts');
          if (response.ok) {
            const data = await response.json();
            if (data.promptOne) setPromptOne(data.promptOne);
            if (data.promptTwo) setPromptTwo(data.promptTwo);
            if (data.promptModel) setPromptModel(data.promptModel);
            if (data.imageModel) setImageModel(data.imageModel);

	      // After loading, snapshot as initial values to compare for changes
	      if (response.ok) {
	        setInitialPromptOne((prev) => (data.promptOne ?? prev));
	        setInitialPromptTwo((prev) => (data.promptTwo ?? prev));
	        setInitialPromptModel((prev) => (data.promptModel ?? prev));
	        setInitialImageModel((prev) => (data.imageModel ?? prev));
	      }

          }
        } catch (error) {
          console.error('Error fetching prompts:', error);
        }
      };

      fetchPrompts();
    }
  }, [isOpen]);

  // Handle clicks outside the modal to close it
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

  // Handle ESC key to close the modal
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

  // Handle saving the prompts
  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Save the prompts and selected models to the server
      const response = await fetch('http://127.0.0.1:3031/api/settings/update-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptOne,
          promptTwo,
          promptModel,
          imageModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save prompts');
      }

      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error saving prompts:', error);
      alert(`Error saving prompts: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };


	  // Determine if there are changes
	  const hasChanges = (
	    promptOne !== initialPromptOne ||
	    promptTwo !== initialPromptTwo ||
	    promptModel !== initialPromptModel ||
	    imageModel !== initialImageModel
	  );

  // Handle reset to default
  const handleReset = () => {
    // Reset prompts to defaults
    setPromptOne(
      `song title: \${songName || 'Unknown Song'}\n\n\${lyrics}\n\ngenerate one prompt to put in a image generator to describe the atmosphere/object of this song, should be simple but abstract because I will use this image as youtube video background for a lyrics video, return the prompt only, no extra texts`
    );

    setPromptTwo(
      `Expand the image into 16:9 ratio (landscape ratio). Then decorate my given image with \${prompt}`
    );

    // Reset models to defaults
    setPromptModel('gemini-2.5-flash-lite');
    setImageModel('gemini-2.0-flash-preview-image-generation');
  };

  // Handle prompt one change with special handling for protected variables
  const handlePromptOneChange = (e) => {
    const newValue = e.target.value;

    // Check if both protected variables are still present in the new value
    if (!newValue.includes(`\${lyrics}`) || !newValue.includes(`\${songName || 'Unknown Song'}`)) {
      // If any protected variable is missing, don't update the state
      // Just silently ignore the change - no popup needed
      return;
    }

    setPromptOne(newValue);
  };

  // Handle prompt two change with special handling for ${prompt}
  const handlePromptTwoChange = (e) => {
    const newValue = e.target.value;

    // Check if ${prompt} is still present in the new value
    if (!newValue.includes(`\${prompt}`)) {
      // If not, don't update the state - silently ignore the change
      return;
    }

    setPromptTwo(newValue);
  };

  if (!isOpen) return null;

  // Create the modal content
  const modalContent = (
    <div className="prompt-editor-overlay">
      <div className="prompt-editor-modal background-prompt-editor" ref={modalRef}>
        <div className="prompt-editor-header">
          <h3>{t('promptEditor.editBackgroundPrompts', 'Edit Background Generation Prompts')}</h3>
          <CloseButton onClick={onClose} variant="modal" size="medium" />
        </div>

        <div className="prompt-editor-content">
          <p className="prompt-editor-description">
            {t('promptEditor.customizeBackgroundPromptDesc', 'Customize how Gemini generates background images from lyrics and album art.')}
          </p>

          {/* Prompt One Section */}
          <div className="prompt-section">
            <h4>{t('promptEditor.promptOne', 'Prompt for Generating Image Description')}</h4>
            <p className="prompt-section-description">
              {t('promptEditor.promptOneDescription', 'This prompt is used to generate a description from the lyrics.')}
            </p>
            <div className="prompt-editor-container">
              <CustomScrollbarTextarea
                className="prompt-editor-textarea"
                value={promptOne}
                onChange={handlePromptOneChange}
                rows={8}
                placeholder={t('promptEditor.enterPrompt', 'Enter your custom prompt here...')}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            <div className="prompt-model-row">
              <label className="prompt-model-label">
                {t('promptEditor.promptModelLabel', 'Model for "Generate the prompt"')}
              </label>
              <CustomDropdown
                value={promptModel}
                onChange={(value) => setPromptModel(value)}
                options={[
                  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
                  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
                ]}
                placeholder={t('promptEditor.selectModel', 'Select Model')}
              />
            </div>
            <div className="variables-info">
              <h5>{t('promptEditor.availableVariables', 'Available Variables:')}</h5>
              <ul>
                <li className="required-variable"><code>{`\${songName || 'Unknown Song'}`}</code> - {t('promptEditor.songNameVarDesc', 'The song name (required, cannot be removed)')}</li>
                <li className="required-variable"><code>{`\${lyrics}`}</code> - {t('promptEditor.lyricsVarDesc', 'The song lyrics (required, cannot be removed)')}</li>
              </ul>
            </div>
          </div>

          {/* Prompt Two Section */}
          <div className="prompt-section">
            <h4>{t('promptEditor.promptTwo', 'Prompt for Generating Background Image')}</h4>
            <p className="prompt-section-description">
              {t('promptEditor.promptTwoDescription', 'This prompt is used to generate the background image using the album art and the generated description.')}
            </p>
            <div className="prompt-editor-container">
              <CustomScrollbarTextarea
                className="prompt-editor-textarea"
                value={promptTwo}
                onChange={handlePromptTwoChange}
                rows={4}
                placeholder={t('promptEditor.enterPrompt', 'Enter your custom prompt here...')}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            <div className="prompt-model-row">
              <label className="prompt-model-label">
                {t('promptEditor.imageModelLabel', 'Model for image generation')}
              </label>
              <CustomDropdown
                value={imageModel}
                onChange={(value) => setImageModel(value)}
                options={[
                  { value: 'gemini-2.5-flash-image-preview', label: 'Nano Banana' },
                  { value: 'gemini-2.0-flash-preview-image-generation', label: 'Gemini 2.0 Flash Preview (Image Generation)' }
                ]}
                placeholder={t('promptEditor.selectImageModel', 'Select Image Model')}
              />
            </div>
            <div className="variables-info">
              <h5>{t('promptEditor.availableVariables', 'Available Variables:')}</h5>
              <ul>
                <li className="required-variable">
                  <code>{`\${prompt}`}</code> - {t('promptEditor.promptVarDesc', 'The generated description (required, cannot be removed)')}
                </li>
              </ul>
            </div>
          </div>

        </div>
        <div className="prompt-editor-footer">
          <div className="right-buttons">
            <button className="reset-button" onClick={handleReset} disabled={isSaving}>
              {t('promptEditor.reset', 'Reset to Default')}
            </button>
            <button className="save-button" onClick={handleSave} disabled={isSaving || !hasChanges}>
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use ReactDOM.createPortal to render the modal directly to the document body
  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};

export default BackgroundPromptEditor;
