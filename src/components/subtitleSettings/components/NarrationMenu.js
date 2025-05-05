import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Narration Menu component
 *
 * @param {Object} props - Component props
 * @param {boolean} props.showNarrationMenu - Whether to show the narration menu
 * @param {Function} props.setShowNarrationMenu - Function to set showNarrationMenu state
 * @param {string} props.narrationSource - Current narration source
 * @param {Function} props.setNarrationSource - Function to set narrationSource state
 * @param {number} props.narrationVolume - Current narration volume
 * @param {Function} props.setNarrationVolume - Function to set narrationVolume state
 * @param {number} props.videoVolume - Current video volume
 * @param {Function} props.setVideoVolume - Function to set videoVolume state
 * @param {Object} props.currentNarration - Current playing narration
 * @param {boolean} props.hasOriginalNarrations - Whether original narrations are available
 * @param {boolean} props.hasTranslatedNarrations - Whether translated narrations are available
 * @param {boolean} props.hasAnyNarrations - Whether any narrations are available
 * @returns {JSX.Element} - Rendered component
 */
const NarrationMenu = ({
  showNarrationMenu,
  setShowNarrationMenu,
  narrationSource,
  setNarrationSource,
  narrationVolume,
  setNarrationVolume,
  videoVolume,
  setVideoVolume,
  currentNarration,
  hasOriginalNarrations,
  hasTranslatedNarrations,
  hasAnyNarrations
}) => {
  const { t } = useTranslation();
  const menuRef = useRef(null);

  // Add escape key and click outside handlers to close the menu
  useEffect(() => {
    // Handle escape key
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showNarrationMenu) {
        setShowNarrationMenu(false);
      }
    };

    // Handle click outside
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && showNarrationMenu) {
        setShowNarrationMenu(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNarrationMenu, setShowNarrationMenu]);

  return (
    <div ref={menuRef} className="narration-menu-container">
      <button
        className={`action-button narration-settings-toggle md-filled-tonal-button ${showNarrationMenu ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          const newShowNarrationMenu = !showNarrationMenu;
          setShowNarrationMenu(newShowNarrationMenu);
          console.log(`Narration menu ${newShowNarrationMenu ? 'opened' : 'closed'}`);
        }}
        title={t('narration.settingsTooltip', 'Narration Settings')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
        <span>{t('narration.toggleSettings', 'Narration Settings')}</span>
      </button>

      {/* Narration menu panel with subtitle-settings styling */}
      {showNarrationMenu && (
        <div
          className="subtitle-settings-panel narration-panel"
          style={{ position: 'absolute', top: 'calc(100%)', right: '-10px', height: '505px', width: '320px', zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="settings-header">
            <h4>{t('narration.playbackTitle', 'Narration')}</h4>
            <div className="settings-header-actions">
              <button
                className="close-settings-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNarrationMenu(false);
                }}
              >
                &times;
              </button>
            </div>
          </div>

          <div className="settings-content">
            {/* Narration Source Selection */}
            <div className="setting-group subtitle-language-group">
              <label>{t('narration.narrationSource', 'Source')}</label>
              <div className="radio-pill-group">
                <div className="radio-pill">
                  <input
                    type="radio"
                    id="source-original"
                    name="narration-source"
                    checked={narrationSource === 'original'}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (hasOriginalNarrations) {
                        setNarrationSource('original');
                      }
                    }}
                    disabled={!hasOriginalNarrations}
                  />
                  <label
                    htmlFor="source-original"
                    className={!hasOriginalNarrations ? 'disabled' : ''}
                  >
                    {t('narration.original', 'Original')}
                    {!hasOriginalNarrations ? ` (${t('narration.notAvailable', 'Not Available')})` : ''}
                  </label>
                </div>
                <div className="radio-pill">
                  <input
                    type="radio"
                    id="source-translated"
                    name="narration-source"
                    checked={narrationSource === 'translated'}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (hasTranslatedNarrations) {
                        setNarrationSource('translated');
                      }
                    }}
                    disabled={!hasTranslatedNarrations}
                  />
                  <label
                    htmlFor="source-translated"
                    className={!hasTranslatedNarrations ? 'disabled' : ''}
                  >
                    {t('narration.translated', 'Translated')}
                    {!hasTranslatedNarrations ? ` (${t('narration.notAvailable', 'Not Available')})` : ''}
                  </label>
                </div>
              </div>
            </div>

            {/* Status message when no narrations are available */}
            {!hasAnyNarrations && (
              <div className="setting-group">
                <div className="notification-message warning">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <span>
                    {t('narration.noNarrationsAvailable', 'No narrations available. Generate narration first.')}
                  </span>
                </div>
              </div>
            )}

            {/* Volume Controls */}
            <div className="setting-group">
              <label className={hasAnyNarrations ? '' : 'disabled'}>
                <span className="icon-label-container">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  </svg>
                  <span>
                    {t('narration.narrationVolume', 'Narration Volume')}
                    {currentNarration && (
                      <span className="narration-status-indicator">
                        <span className="status-dot"></span>
                        {t('narration.playing', 'Playing')}
                      </span>
                    )}
                  </span>
                </span>
              </label>
              <div className="slider-with-value">
                {hasAnyNarrations ? (
                  <div className="custom-slider-container">
                    <div className="custom-slider-track">
                      <div
                        className="custom-slider-fill"
                        style={{ width: `${narrationVolume * 100}%` }}
                      ></div>
                      <div
                        className="custom-slider-thumb"
                        style={{ left: `${narrationVolume * 100}%` }}
                      ></div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={narrationVolume}
                      onChange={(e) => {
                        e.stopPropagation();
                        setNarrationVolume(parseFloat(e.target.value));
                      }}
                      className="custom-slider-input"
                    />
                  </div>
                ) : (
                  <div className="custom-slider-container disabled">
                    <div className="custom-slider-track">
                      <div
                        className="custom-slider-fill"
                        style={{ width: `${narrationVolume * 100}%` }}
                      ></div>
                      <div
                        className="custom-slider-thumb"
                        style={{ left: `${narrationVolume * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <div className="slider-value-display">{Math.round(narrationVolume * 100)}%</div>
              </div>
            </div>

            <div className="setting-group">
              <label>
                <span className="icon-label-container">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                  <span>{t('narration.videoVolume', 'Video Audio Volume')}</span>
                </span>
              </label>
              <div className="slider-with-value">
                <div className="custom-slider-container video-volume-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${videoVolume * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${videoVolume * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={videoVolume}
                    onChange={(e) => {
                      e.stopPropagation();
                      setVideoVolume(parseFloat(e.target.value));
                    }}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{Math.round(videoVolume * 100)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NarrationMenu;
