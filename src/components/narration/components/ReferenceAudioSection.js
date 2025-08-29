import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MaterialSwitch from '../../common/MaterialSwitch';
import { initializeFunctionalScrollbars } from '../../../utils/functionalScrollbar';
import '../../../styles/common/material-switch.css';

/**
 * Isolated Text Input component that doesn't get affected by parent re-renders
 */
class IsolatedTextInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.value || ''
    };
    this.textareaRef = React.createRef();
  }

  // Update local state when props change, but only if not focused
  componentDidUpdate(prevProps) {
    // Only update if the value prop changed and the textarea is not focused
    if (prevProps.value !== this.props.value &&
        document.activeElement !== this.textareaRef.current) {
      this.setState({ value: this.props.value || '' });
    }
  }

  handleChange = (e) => {
    const newValue = e.target.value;
    // Update local state immediately
    this.setState({ value: newValue });
    // Notify parent component
    if (this.props.onChange) {
      this.props.onChange(newValue);
    }
  };

  render() {
    const { placeholder, disabled, rows } = this.props;

    return (
      <textarea
        ref={this.textareaRef}
        className="reference-text"
        value={this.state.value}
        onChange={this.handleChange}
        placeholder={placeholder}
        rows={rows || 2}
        disabled={disabled}
      />
    );
  }
}

/**
 * Reference Audio Section component
 * @param {Object} props - Component props
 * @param {Object} props.referenceAudio - Reference audio object
 * @param {boolean} props.autoRecognize - Whether to auto-recognize voice
 * @param {Function} props.setAutoRecognize - Function to set auto-recognize
 * @param {boolean} props.isRecognizing - Whether voice recognition is in progress
 * @param {string} props.referenceText - Reference text
 * @param {Function} props.setReferenceText - Function to set reference text
 * @param {Function} props.clearReferenceAudio - Function to clear reference audio
 * @param {boolean} props.isRecording - Whether recording is in progress
 * @param {boolean} props.isExtractingSegment - Whether segment extraction is in progress
 * @returns {JSX.Element} - Rendered component
 */
const ReferenceAudioSection = ({
  referenceAudio,
  autoRecognize,
  setAutoRecognize,
  isRecognizing,
  referenceText,
  setReferenceText,
  clearReferenceAudio,
  isRecording,
  isExtractingSegment
}) => {
  const { t } = useTranslation();

  // Initialize functional scrollbar when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeFunctionalScrollbars();
    }, 100); // Small delay to ensure DOM is ready

    return () => clearTimeout(timer);
  }, []);

  // Function to handle text changes from the isolated component
  const handleTextChange = (newText) => {
    // Use setTimeout to avoid immediate state updates that might cause issues
    setTimeout(() => {
      setReferenceText(newText);
    }, 0);
  };

  return (
    <div className="narration-row reference-audio-row">
      <div className="row-label">
        <label>{t('narration.referenceAudio', 'Văn bản tham chiếu')}:</label>
      </div>
      <div className="row-content">
        <div className="reference-audio-container">
          {/* Reference Content Row */}
          <div className="reference-content-row">
            {/* Reference Text */}
            <div className="reference-text-container">
              <IsolatedTextInput
                value={referenceText}
                onChange={handleTextChange}
                placeholder={t('narration.referenceTextPlaceholder', 'Enter text that matches the reference audio...')}
                rows={2}
                disabled={isRecognizing}
              />
              {isRecognizing && (
                <div className="status-message info recognizing-indicator">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {t('narration.recognizing', 'Recognizing voice...')}
                </div>
              )}
            </div>

            {/* Auto-Recognition Switch */}
            <div className="material-switch-container">
              <MaterialSwitch
                id="auto-recognize"
                checked={autoRecognize}
                onChange={(e) => setAutoRecognize(e.target.checked)}
                disabled={isRecording || isExtractingSegment || isRecognizing}
                ariaLabel={t('narration.autoRecognize', 'Auto-recognize voice')}
                icons={true}
              />
              <span>{t('narration.autoRecognize', 'Auto-recognize voice')}</span>
              <div className="help-icon-container" title={t('narration.autoRecognizeDescription', 'Automatically transcribe audio after recording or uploading')}>
                <svg className="help-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceAudioSection;
