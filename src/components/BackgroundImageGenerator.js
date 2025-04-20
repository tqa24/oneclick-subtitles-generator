import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiImage, FiUpload, FiRefreshCw, FiDownload, FiX, FiAlertTriangle } from 'react-icons/fi';
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
  const [generatedImages, setGeneratedImages] = useState([]);
  const [regularImageCount, setRegularImageCount] = useState(1);
  const [newPromptImageCount, setNewPromptImageCount] = useState(4); // Default to 4 for new prompt
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [pendingImageCount, setPendingImageCount] = useState(0); // Track how many images are pending
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
  const generateImage = async (promptToUse = null, count = null) => {
    const currentPrompt = promptToUse || generatedPrompt;
    const imagesToGenerate = count || regularImageCount;

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

    // Prepare the grid with placeholders
    setPendingImageCount(imagesToGenerate);

    // Create placeholder array
    const placeholders = Array(imagesToGenerate).fill(null).map((_, index) => ({
      url: null,
      timestamp: new Date().getTime() + index,
      prompt: currentPrompt,
      isLoading: true
    }));

    setGeneratedImages(placeholders);

    try {
      // Generate each image one by one
      const newImages = [...placeholders];

      for (let i = 0; i < imagesToGenerate; i++) {
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
          const imageUrl = `data:${data.mime_type};base64,${data.data}`;

          // Update this specific image in the array
          newImages[i] = {
            url: imageUrl,
            timestamp: new Date().getTime(),
            prompt: currentPrompt,
            isLoading: false
          };

          // Update the state with the progress
          setGeneratedImages([...newImages]);

          // Also update the single image view for backward compatibility
          if (i === 0) {
            setGeneratedImage(imageUrl);
          }

          // Decrease pending count
          setPendingImageCount(prev => prev - 1);
        } catch (err) {
          // Mark this image as failed
          newImages[i] = {
            url: null,
            timestamp: new Date().getTime(),
            prompt: currentPrompt,
            isLoading: false,
            error: err.message
          };
          setGeneratedImages([...newImages]);
          setPendingImageCount(prev => prev - 1);
          console.error(`Error generating image ${i+1}:`, err);
        }
      }

      return newImages.filter(img => img.url !== null);
    } catch (err) {
      setError(`Error generating images: ${err.message}`);
      console.error('Error in image generation process:', err);
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Reset state when lyrics or albumArt props change
  useEffect(() => {
    if (lyrics && albumArt) {
      // Reset all state to ensure fresh content
      setCustomLyrics(lyrics);
      setCustomAlbumArt(albumArt);
      setCustomSongName(songName || '');
      setGeneratedPrompt('');
      setGeneratedImage('');
      setGeneratedImages([]);
      setRegularImageCount(1); // Reset to default of 1 image for regular generation
      setNewPromptImageCount(4); // Keep default of 4 images for new prompt
      setPendingImageCount(0);
      setError('');
      setAutoExecutionComplete(false);
      autoExecutionRef.current = false; // Reset the ref to allow auto-execution
    }
  }, [lyrics, albumArt, songName]);

  // Auto-execute prompt generation and image generation when component mounts
  // or when lyrics/albumArt change - uses the default of 4 images for new prompt
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

        // Now generate multiple images directly without waiting for state updates
        setIsGeneratingImage(true);

        // Prepare the grid with placeholders
        const imagesToGenerate = newPromptImageCount;
        setPendingImageCount(imagesToGenerate);

        // Create placeholder array
        const placeholders = Array(imagesToGenerate).fill(null).map((_, index) => ({
          url: null,
          timestamp: new Date().getTime() + index,
          prompt: generatedPromptText,
          isLoading: true
        }));

        setGeneratedImages(placeholders);

        // Generate each image one by one
        const newImages = [...placeholders];

        for (let i = 0; i < imagesToGenerate; i++) {
          try {
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
            const imageUrl = `data:${imageData.mime_type};base64,${imageData.data}`;

            // Update this specific image in the array
            newImages[i] = {
              url: imageUrl,
              timestamp: new Date().getTime(),
              prompt: generatedPromptText,
              isLoading: false
            };

            // Update the state with the progress
            setGeneratedImages([...newImages]);

            // Also update the single image view for backward compatibility
            if (i === 0) {
              setGeneratedImage(imageUrl);
            }

            // Decrease pending count
            setPendingImageCount(prev => prev - 1);
          } catch (err) {
            // Mark this image as failed
            newImages[i] = {
              url: null,
              timestamp: new Date().getTime(),
              prompt: generatedPromptText,
              isLoading: false,
              error: err.message
            };
            setGeneratedImages([...newImages]);
            setPendingImageCount(prev => prev - 1);
            console.error(`Error generating image ${i+1}:`, err);
          }
        }

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
  }, [lyrics, albumArt, customLyrics, customAlbumArt, customSongName, autoExecutionComplete]);


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



  // Generate new prompt and then generate image
  const generateWithNewPrompt = async (count = null) => {
    if (!customLyrics.trim()) {
      setError('Please provide lyrics to generate a prompt');
      return;
    }

    if (!customAlbumArt) {
      setError('Please provide album art to generate an image');
      return;
    }

    // First generate a new prompt
    const newPrompt = await generatePrompt();

    // If prompt generation was successful, generate images with it
    if (newPrompt) {
      await generateImage(newPrompt, count || newPromptImageCount);
    }
  };

  // Handle image count selection for regular generation
  const handleRegularImageCountChange = (count) => {
    setRegularImageCount(parseInt(count, 10));
  };

  // Handle image count selection for new prompt generation
  const handleNewPromptImageCountChange = (count) => {
    setNewPromptImageCount(parseInt(count, 10));
  };

  // Download generated image
  const downloadImage = (imageUrl = null, index = null) => {
    // If no specific image is provided, use the main generatedImage
    const imageToDownload = imageUrl || generatedImage;
    if (!imageToDownload) return;

    const link = document.createElement('a');
    link.href = imageToDownload;
    link.download = `background-${index !== null ? index + 1 : new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all generated images as a batch
  const downloadAllImages = () => {
    if (!generatedImages.length) return;

    // Download each image with a slight delay to prevent browser issues
    generatedImages.forEach((image, index) => {
      setTimeout(() => {
        downloadImage(image.url, index);
      }, index * 300); // 300ms delay between downloads
    });
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
        {/* First row: Lyrics input on left, song name and prompt in middle, album art on right */}
        <div className="content-grid top-inputs-grid">
          {/* Lyrics input */}
          <div className="lyrics-input-container">
            <textarea
              value={customLyrics}
              onChange={(e) => setCustomLyrics(e.target.value)}
              placeholder={t('backgroundGenerator.lyricsPlaceholder', 'Enter lyrics here...')}
              rows={6}
            />
          </div>

          {/* Right side container for song name and prompt */}
          <div className="right-inputs-container">
            {/* Song name input */}
            <div className="song-name-input">
              <h3>{t('backgroundGenerator.songName', 'Song Name')}</h3>
              <div className="song-name-field-container">
                <input
                  type="text"
                  value={customSongName}
                  onChange={(e) => setCustomSongName(e.target.value)}
                  placeholder={t('backgroundGenerator.songNamePlaceholder', 'Enter song name (optional)')}
                />
              </div>
            </div>

            {/* Prompt section */}
            <div className="prompt-section">
              <div className="prompt-header">
                <h3>{t('backgroundGenerator.prompt', 'Generated Prompt')}</h3>
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
                      : t('backgroundGenerator.generatePrompt', 'Generate')}
                  </span>
                </button>
              </div>
              <div className="prompt-container">
                <textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  placeholder={t('backgroundGenerator.promptPlaceholder', 'Generated prompt will appear here...')}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Album art container */}
          <div className="album-art-container">
            <h3>{t('backgroundGenerator.albumArt', 'Album Art')}</h3>
            <div className="album-art-preview">
              {customAlbumArt ? (
                <>
                  <img src={customAlbumArt} alt="Album Art" />
                  {/* Floating upload button */}
                  <label className="floating-upload-button" title={t('backgroundGenerator.uploadAlbumArt', 'Upload Album Art')}>
                    <FiUpload size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAlbumArtUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {/* Floating download button */}
                  <button
                    className="floating-download-button"
                    onClick={() => {
                      // Create a temporary link to download the image
                      const link = document.createElement('a');
                      link.href = customAlbumArt;
                      link.download = 'album-art.png';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    title={t('backgroundGenerator.downloadAlbumArt', 'Download Album Art')}
                  >
                    <FiDownload size={20} />
                  </button>

                </>
              ) : (
                <>
                  <div className="upload-placeholder">
                    <FiImage size={36} />
                    <p>{t('backgroundGenerator.noAlbumArt', 'No album art')}</p>
                  </div>
                  {/* Floating upload button even when no image */}
                  <label className="floating-upload-button" title={t('backgroundGenerator.uploadAlbumArt', 'Upload Album Art')}>
                    <FiUpload size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAlbumArtUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </>
              )}
            </div>
            {/* Keep the original actions div for backward compatibility, but it's hidden via CSS */}
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

        {/* Second row: Generated image */}
        <div className="media-content-grid">

          {/* Generated image section */}
          <div className="image-section">
            <div className="image-section-header">
              <div className="image-title-container">
                <h3>{t('backgroundGenerator.generatedImage', 'Generated Image')}</h3>
                {generatedImages.length > 1 && (
                  <button className="header-download-button" onClick={downloadAllImages} title={t('backgroundGenerator.downloadAllImages', 'Download All Images')}>
                    <FiDownload size={16} />
                    <span>{t('backgroundGenerator.downloadAllImages', 'Download All')}</span>
                  </button>
                )}
              </div>
              <div className="image-header-actions">
                <div className="generate-button-group">
                  <button
                    className={`generate-button ${isGeneratingImage ? 'loading' : ''}`}
                    onClick={() => generateImage()}
                    disabled={isGeneratingImage || isGeneratingPrompt || !generatedPrompt.trim() || !customAlbumArt}
                  >
                    {isGeneratingImage ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      <FiRefreshCw />
                    )}
                    <span>
                      {isGeneratingImage
                        ? t('backgroundGenerator.generatingImage', 'Generating...')
                        : t('backgroundGenerator.generateImage', 'Generate')}
                    </span>
                  </button>

                  <select
                    className="image-count-dropdown"
                    value={regularImageCount}
                    onChange={(e) => handleRegularImageCountChange(e.target.value)}
                    disabled={isGeneratingImage || isGeneratingPrompt}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>

                  <span className="dropdown-label">{t('backgroundGenerator.images', 'images')}</span>
                </div>

                <div className="generate-button-group">
                  <button
                    className={`generate-button new-prompt-button ${isGeneratingPrompt || isGeneratingImage ? 'loading' : ''}`}
                    onClick={() => generateWithNewPrompt()}
                    disabled={isGeneratingPrompt || isGeneratingImage || !customLyrics.trim() || !customAlbumArt}
                  >
                    {isGeneratingPrompt || isGeneratingImage ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      <FiRefreshCw />
                    )}
                    <span>
                      {isGeneratingPrompt || isGeneratingImage
                        ? t('backgroundGenerator.generatingWithNewPrompt', 'Generating...')
                        : t('backgroundGenerator.generateWithNewPrompt', 'Generate with New Prompt')}
                    </span>
                  </button>

                  <select
                    className="image-count-dropdown"
                    value={newPromptImageCount}
                    onChange={(e) => handleNewPromptImageCountChange(e.target.value)}
                    disabled={isGeneratingImage || isGeneratingPrompt}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>

                  <span className="dropdown-label">{t('backgroundGenerator.images', 'images')}</span>
                </div>
              </div>
            </div>
            {generatedImages.length > 0 ? (
              <>
                <div className={`image-grid image-grid-${Math.min(generatedImages.length, 4)}`}>
                  {generatedImages.map((image, index) => (
                    <div className="image-grid-item" key={index}>
                      <div className={`image-preview ${image.isLoading ? 'loading' : ''}`}>
                        {image.url ? (
                          <>
                            <img src={image.url} alt={`Generated Background ${index + 1}`} />
                            <button
                              className="floating-download-button"
                              onClick={() => downloadImage(image.url, index)}
                              title={t('backgroundGenerator.downloadImage', 'Download')}
                            >
                              <FiDownload size={20} />
                            </button>
                          </>
                        ) : image.isLoading ? (
                          <div className="loading-placeholder">
                            <span className="loading-spinner large"></span>
                            <p>{t('backgroundGenerator.generatingImage', 'Generating...')}</p>
                          </div>
                        ) : image.error ? (
                          <div className="error-placeholder">
                            <FiAlertTriangle size={36} />
                            <p>{t('backgroundGenerator.generationFailed', 'Generation failed')}</p>
                          </div>
                        ) : (
                          <div className="preview-placeholder">
                            <FiImage size={36} />
                            <p>{t('backgroundGenerator.noGeneratedImage', 'No image generated yet')}</p>
                          </div>
                        )}
                        <div className="image-number">{index + 1}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : generatedImage ? (
              <div className="image-preview single-image">
                <img src={generatedImage} alt="Generated Background" />
                <button
                  className="floating-download-button"
                  onClick={() => downloadImage()}
                  title={t('backgroundGenerator.downloadImage', 'Download')}
                >
                  <FiDownload size={20} />
                </button>
              </div>
            ) : (
              <div className="image-preview">
                <div className="preview-placeholder">
                  <FiImage size={48} />
                  <p>{t('backgroundGenerator.noGeneratedImage', 'No image generated yet')}</p>
                </div>
              </div>
            )}
            {/* Image actions moved to header */}
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
