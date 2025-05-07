import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiMusic, FiImage } from 'react-icons/fi';
import '../styles/SubtitlesInputModal.css';
import LyricsInputSection from './LyricsInputSection';

/**
 * Modal component for inputting subtitles without timings
 * @param {Object} props - Component props
 * @param {string} props.initialText - Initial text for the textarea
 * @param {Function} props.onSave - Function called when subtitles are saved
 * @param {Function} props.onClose - Function called when modal is closed
 * @returns {JSX.Element} - Rendered component
 */
const SubtitlesInputModal = ({ initialText = '', onSave, onClose, onGenerateBackground }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const textareaRef = useRef(null);
  const [showLyricsInput, setShowLyricsInput] = useState(false);
  const [albumArt, setAlbumArt] = useState('');
  const [showBackgroundPrompt, setShowBackgroundPrompt] = useState(false);
  const [songName, setSongName] = useState('');



  // Focus the textarea when the modal opens
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSave = () => {
    onSave(text);
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  // Handle receiving lyrics from the LyricsInputSection component
  const handleLyricsReceived = (lyrics, albumArtUrl, songTitle) => {
    setText(lyrics);
    setAlbumArt(albumArtUrl);
    setSongName(songTitle || '');
    setShowBackgroundPrompt(true);
  };



  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Escape to close
    else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="subtitles-input-modal-overlay">
      <div className="subtitles-input-modal">
        <div className="subtitles-input-modal-header">
          <h2>{t('subtitlesInput.title', 'Add Your Subtitles')}</h2>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="subtitles-input-modal-content">
          <div className="explanation-example-container">
            <div className="explanation">
              {t('subtitlesInput.explanation',
                'Paste your subtitles here without timings. When you generate subtitles, the system will focus on matching these texts with the audio and creating accurate timings. Each line will be treated as a separate subtitle.')}
            </div>

            <div className="example">
              <h3>{t('subtitlesInput.exampleTitle', 'Example:')}</h3>
              <pre>
                {t('subtitlesInput.example',
                  'Hello, welcome to our tutorial.\nToday we will learn about machine learning.\nLet\'s get started!')}
              </pre>
            </div>
          </div>

          <div className="lyrics-autofill-toggle">
            <button
              className={`lyrics-toggle-button ${showLyricsInput ? 'active' : ''}`}
              onClick={() => setShowLyricsInput(!showLyricsInput)}
              title={t('subtitlesInput.lyricsToggle', 'Toggle lyrics search')}
            >
              <FiMusic /> {t('subtitlesInput.fetchLyrics', 'Fetch Song Lyrics')}
            </button>
          </div>

          {showLyricsInput && (
            <LyricsInputSection onLyricsReceived={handleLyricsReceived} />
          )}



          {showBackgroundPrompt && albumArt && (
            <div className="background-prompt-message" onClick={() => {
              console.log('Background prompt message clicked');
              console.log('onGenerateBackground exists:', !!onGenerateBackground);
              console.log('albumArt:', albumArt);
              console.log('songName:', songName);
              console.log('text length:', text.length);

              // First save the text
              onSave(text);

              // Then generate the background
              if (onGenerateBackground) {
                console.log('Calling onGenerateBackground with text, albumArt, and songName');
                onGenerateBackground(text, albumArt, songName);
                console.log('onGenerateBackground called successfully');
              } else {
                console.error('onGenerateBackground function is not available');
              }
            }}>
              <FiImage />
              <span>{t('subtitlesInput.generateBackground', 'Do you want to generate background image inspired from this album art and lyrics?')}</span>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={t('subtitlesInput.placeholder', 'Enter your subtitles here...')}
            rows={10}
          />

          <div className="keyboard-shortcuts">
            <span>{t('subtitlesInput.keyboardShortcuts', 'Keyboard shortcuts:')}</span>
            <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> {t('subtitlesInput.toSave', 'to save')}</span>
            <span><kbd>Esc</kbd> {t('subtitlesInput.toCancel', 'to cancel')}</span>
          </div>
        </div>

        <div className="subtitles-input-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            {t('subtitlesInput.cancel', 'Cancel')}
          </button>
          <button className="save-button" onClick={handleSave}>
            {t('subtitlesInput.save', 'Save Subtitles')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubtitlesInputModal;
