import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiImage, FiUpload, FiRefreshCw, FiDownload, FiX } from 'react-icons/fi';
import '../styles/BackgroundImageGenerator.css';

/**
 * Component for generating background images based on lyrics and album art
 */
const BackgroundImageGenerator = ({ lyrics, albumArt, songName, onClose }) => {
  const { t } = useTranslation();
  const [customLyrics, setCustomLyrics] = useState(lyrics || '');
  const [customAlbumArt, setCustomAlbumArt] = useState(albumArt || '');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState('');
  const [customSongName, setCustomSongName] = useState(songName || '');
  const [autoExecutionComplete, setAutoExecutionComplete] = useState(false);

  // Use a ref to track if the auto-execution effect has already run
  // This helps prevent double execution in React StrictMode
  const autoExecutionRef = useRef(false);

  // Generate prompt using Gemini
  const generatePrompt = async () => {
    if (!customLyrics.trim()) {
      setError('Please provide lyrics to generate a prompt');
      return;
    }

    setIsGeneratingPrompt(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:3007/api/gemini/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lyrics: customLyrics,
          songName: customSongName || songName || 'Unknown Song'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate prompt');
      }

      const data = await response.json();
      setGeneratedPrompt(data.prompt);
      return data.prompt; // Return the prompt for chaining
    } catch (err) {
      setError(`Error generating prompt: ${err.message}`);
      console.error('Error generating prompt:', err);
      return null;
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Generate image using Gemini
  const generateImage = async (promptToUse = null) => {
    const currentPrompt = promptToUse || generatedPrompt;

    if (!currentPrompt.trim()) {
      setError('Please generate a prompt first');
      return;
    }

    if (!customAlbumArt) {
      setError('Please provide album art to generate an image');
      return;
    }

    setIsGeneratingImage(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:3007/api/gemini/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          albumArtUrl: customAlbumArt
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();
      setGeneratedImage(`data:${data.mime_type};base64,${data.data}`);
      return data;
    } catch (err) {
      setError(`Error generating image: ${err.message}`);
      console.error('Error generating image:', err);
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Auto-execute prompt generation and image generation when component mounts
  // but only if we came from the background-prompt-message (i.e., we have lyrics and albumArt)
  useEffect(() => {
    const autoExecute = async () => {
      // Skip if we've already run this effect in the current render cycle
      // or if we don't have the necessary data or if auto-execution is already complete
      if (autoExecutionRef.current || !lyrics || !albumArt || autoExecutionComplete) {
        return;
      }

      // Mark that we've run this effect
      autoExecutionRef.current = true;

      console.log('Auto-executing prompt generation and image generation');

      try {
        // First, make sure we have the latest lyrics and album art
        if (!customLyrics.trim()) {
          setError('No lyrics provided for auto-execution');
          return;
        }

        if (!customAlbumArt) {
          setError('No album art provided for auto-execution');
          return;
        }

        setIsGeneratingPrompt(true);
        setError('');

        // Generate the prompt directly without caching
        const response = await fetch('http://127.0.0.1:3007/api/gemini/generate-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lyrics: customLyrics,
            songName: customSongName || songName || 'Unknown Song'
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate prompt');
        }

        const data = await response.json();
        const generatedPromptText = data.prompt;

        // Update the state with the generated prompt
        setGeneratedPrompt(generatedPromptText);
        setIsGeneratingPrompt(false);

        console.log('Prompt generated successfully:', generatedPromptText);

        // Now generate the image directly without waiting for state updates
        setIsGeneratingImage(true);

        const imageResponse = await fetch('http://127.0.0.1:3007/api/gemini/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: generatedPromptText, // Use the prompt directly
            albumArtUrl: customAlbumArt
          }),
        });

        if (!imageResponse.ok) {
          const errorData = await imageResponse.json();
          throw new Error(errorData.error || 'Failed to generate image');
        }

        const imageData = await imageResponse.json();
        setGeneratedImage(`data:${imageData.mime_type};base64,${imageData.data}`);
        setIsGeneratingImage(false);

        console.log('Image generated successfully');
        setAutoExecutionComplete(true);
      } catch (error) {
        console.error('Error during auto-execution:', error);
        setError(`Auto-execution error: ${error.message}`);
        setIsGeneratingPrompt(false);
        setIsGeneratingImage(false);
        setAutoExecutionComplete(true); // Mark as complete even on error to prevent retries
      }
    };

    autoExecute();

    // Cleanup function to reset the ref when the component unmounts
    return () => {
      // We don't reset the ref here because we want to prevent re-execution
      // even if the effect is called multiple times due to StrictMode
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyrics, albumArt, autoExecutionComplete]);


  // Handle file upload for custom album art
  const handleAlbumArtUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomAlbumArt(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };



  // Download generated image
  const downloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `background-${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="background-generator-container">
      <div className="background-generator-header">
        <h2>{t('backgroundGenerator.title', 'Background Image Generator')}</h2>
        <button className="close-button" onClick={onClose}>
          <FiX />
        </button>
      </div>

      <div className="background-generator-content">
        <div className="input-section">
          <div className="lyrics-input-container">
            <h3>{t('backgroundGenerator.lyrics', 'Lyrics')}</h3>
            <textarea
              value={customLyrics}
              onChange={(e) => setCustomLyrics(e.target.value)}
              placeholder={t('backgroundGenerator.lyricsPlaceholder', 'Enter lyrics here...')}
              rows={8}
            />
            <div className="song-name-input">
              <label>{t('backgroundGenerator.songName', 'Song Name:')}</label>
              <input
                type="text"
                value={customSongName}
                onChange={(e) => setCustomSongName(e.target.value)}
                placeholder={t('backgroundGenerator.songNamePlaceholder', 'Enter song name (optional)')}
              />
            </div>
          </div>

          <div className="album-art-container">
            <h3>{t('backgroundGenerator.albumArt', 'Album Art')}</h3>
            <div className="album-art-preview">
              {customAlbumArt ? (
                <img src={customAlbumArt} alt="Album Art" />
              ) : (
                <div className="upload-placeholder">
                  <FiImage size={48} />
                  <p>{t('backgroundGenerator.noAlbumArt', 'No album art')}</p>
                </div>
              )}
            </div>
            <div className="album-art-actions">
              <label className="upload-button">
                <FiUpload />
                <span>{t('backgroundGenerator.uploadAlbumArt', 'Upload Album Art')}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAlbumArtUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="prompt-section">
          <h3>{t('backgroundGenerator.prompt', 'Generated Prompt')}</h3>
          <div className="prompt-container">
            <textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              placeholder={t('backgroundGenerator.promptPlaceholder', 'Generated prompt will appear here...')}
              rows={3}
            />
            <button
              className={`generate-button ${isGeneratingPrompt ? 'loading' : ''}`}
              onClick={() => generatePrompt()}
              disabled={isGeneratingPrompt || !customLyrics.trim()}
            >
              {isGeneratingPrompt ? (
                <span className="loading-spinner"></span>
              ) : (
                <FiRefreshCw />
              )}
              <span>
                {isGeneratingPrompt
                  ? t('backgroundGenerator.generatingPrompt', 'Generating...')
                  : t('backgroundGenerator.generatePrompt', 'Generate Prompt')}
              </span>
            </button>
          </div>
        </div>

        <div className="image-section">
          <h3>{t('backgroundGenerator.generatedImage', 'Generated Image')}</h3>
          <div className="image-preview">
            {generatedImage ? (
              <img src={generatedImage} alt="Generated Background" />
            ) : (
              <div className="preview-placeholder">
                <FiImage size={64} />
                <p>{t('backgroundGenerator.noGeneratedImage', 'No image generated yet')}</p>
              </div>
            )}
          </div>
          <div className="image-actions">
            <button
              className={`generate-button ${isGeneratingImage ? 'loading' : ''}`}
              onClick={() => generateImage()}
              disabled={isGeneratingImage || !generatedPrompt.trim() || !customAlbumArt}
            >
              {isGeneratingImage ? (
                <span className="loading-spinner"></span>
              ) : (
                <FiRefreshCw />
              )}
              <span>
                {isGeneratingImage
                  ? t('backgroundGenerator.generatingImage', 'Generating...')
                  : t('backgroundGenerator.generateImage', 'Generate Image')}
              </span>
            </button>
            {generatedImage && (
              <button className="download-button" onClick={downloadImage}>
                <FiDownload />
                <span>{t('backgroundGenerator.downloadImage', 'Download')}</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundImageGenerator;
