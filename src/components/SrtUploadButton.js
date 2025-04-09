import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiUpload } from 'react-icons/fi';
import '../styles/SrtUploadButton.css';

/**
 * Button component for uploading SRT files
 * @param {Object} props - Component props
 * @param {Function} props.onSrtUpload - Function called when an SRT file is uploaded
 * @param {boolean} props.disabled - Whether the button is disabled
 * @returns {JSX.Element} - Rendered component
 */
const SrtUploadButton = ({ onSrtUpload, disabled = false }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add processing animation when file is being read
  useEffect(() => {
    if (isProcessing) {
      const timer = setTimeout(() => {
        setIsProcessing(false);
      }, 2000); // Reset after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [isProcessing]);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.name.toLowerCase().endsWith('.srt')) {
      setIsProcessing(true); // Start processing animation
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        onSrtUpload(content, file.name);
      };
      reader.readAsText(file);
    } else if (file) {
      alert(t('errors.invalidSrtFile', 'Please select a valid SRT file'));
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="srt-upload-button-container">
      <button
        className={`srt-upload-button ${isProcessing ? 'processing' : ''}`}
        onClick={handleButtonClick}
        disabled={disabled || isProcessing}
        title={t('srtUpload.tooltip', 'Upload your own SRT file')}
      >
        {/* Static Gemini icons for decoration */}
        <div className="gemini-icon-container">
          <div className="gemini-mini-icon random-1 size-sm">
            <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="gemini-mini-icon random-3 size-md">
            <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        </div>

        {isProcessing ? (
          <span className="processing-text-container">
            <span className="processing-gemini-icon">
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
            <span className="processing-text">
              {t('srtUpload.processing', 'Processing...')}
            </span>
            <span className="processing-dots"></span>
          </span>
        ) : (
          <>
            <FiUpload size={16} />
            <span>{t('srtUpload.buttonText', 'Upload SRT')}</span>
          </>
        )}
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".srt"
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default SrtUploadButton;
