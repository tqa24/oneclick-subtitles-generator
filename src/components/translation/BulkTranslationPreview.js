import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { VariableSizeList as List } from 'react-window';
import formatTimeString from './utils/formatTimeString';

/**
 * Individual subtitle row component for virtualized list
 */
const SubtitleRow = ({ index, style, data }) => {
  const { translatedSubtitles } = data;
  const subtitle = translatedSubtitles[index];

  // Determine the time display format
  let startTimeDisplay = subtitle.startTime;
  let endTimeDisplay = subtitle.endTime;

  // If we have start/end in seconds but no formatted time strings
  if (!startTimeDisplay && subtitle.start !== undefined) {
    startTimeDisplay = formatTimeString(subtitle.start);
  }

  if (!endTimeDisplay && subtitle.end !== undefined) {
    endTimeDisplay = formatTimeString(subtitle.end);
  }

  return (
    <div style={style} className="preview-subtitle-row">
      <div className="preview-number-sticky">
        {index + 1}
      </div>
      <div className="preview-content">
        <span className="preview-time">
          {startTimeDisplay || '00:00:00.000'} → {endTimeDisplay || '00:00:05.000'}
        </span>
        <span className="preview-text">
          {subtitle.text.split('\n').map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </span>
      </div>
    </div>
  );
};

/**
 * Bulk translation preview component with file selection pills
 * @param {Object} props - Component props
 * @param {Array} props.bulkTranslations - Array of bulk translation results
 * @param {Array} props.targetLanguages - Target languages
 * @param {Object} props.mainTranslation - Main translation (if any)
 * @returns {JSX.Element|null} - Rendered component or null if no translations
 */
const BulkTranslationPreview = ({ bulkTranslations, targetLanguages, mainTranslation }) => {
  const { t } = useTranslation();
  const listRef = useRef(null);

  // Get successful translations and include main translation if available
  const availableTranslations = useMemo(() => {
    const translations = [];
    
    // Add main translation first if available
    if (mainTranslation) {
      translations.push({
        id: 'main',
        name: mainTranslation.name,
        subtitles: mainTranslation.subtitles,
        loadedFromCache: mainTranslation.loadedFromCache,
        isMain: true
      });
    }

    // Add successful bulk translations
    bulkTranslations.forEach((bt, index) => {
      if (bt.success && bt.translatedSubtitles) {
        translations.push({
          id: `bulk-${index}`,
          name: bt.originalFile.name,
          subtitles: bt.translatedSubtitles,
          loadedFromCache: false,
          isMain: false
        });
      }
    });

    return translations;
  }, [bulkTranslations, mainTranslation]);

  // Selected translation state
  const [selectedTranslationId, setSelectedTranslationId] = useState(() => {
    return availableTranslations.length > 0 ? availableTranslations[0].id : null;
  });

  // Get currently selected translation
  const selectedTranslation = useMemo(() => {
    return availableTranslations.find(t => t.id === selectedTranslationId) || availableTranslations[0];
  }, [availableTranslations, selectedTranslationId]);

  // Memoize the item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    translatedSubtitles: selectedTranslation?.subtitles || []
  }), [selectedTranslation]);

  // Calculate dynamic row height based on content
  const getRowHeight = (index) => {
    const subtitle = selectedTranslation?.subtitles[index];
    if (!subtitle) return 80; // Default height

    // Base height for time and padding
    let height = 60;
    
    // Add height for each line break in the text
    const lineBreaks = (subtitle.text.match(/\n/g) || []).length;
    height += lineBreaks * 20; // 20px per additional line
    
    // Add extra height for longer text (rough estimation)
    const textLength = subtitle.text.length;
    if (textLength > 100) {
      height += Math.floor(textLength / 100) * 10;
    }
    
    return Math.max(height, 60); // Minimum height of 60px
  };

  if (availableTranslations.length === 0) return null;

  return (
    <div className="translation-row preview-row">
      <div className="translation-preview translation-preview-animated">
        <div className="translation-preview-header">
          <h4>
            {t('translation.preview', 'Translation Preview')}
            {targetLanguages.length > 1
              ? ` (${targetLanguages.map(lang => lang.value).filter(val => val.trim() !== '').join(', ')})`
              : targetLanguages[0]?.value?.trim() ? ` (${targetLanguages[0].value})` : ''}
            {selectedTranslation?.loadedFromCache && (
              <span className="cache-indicator" title={t('translation.fromCache', 'Loaded from cache')}>
                {" "}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12.5A5.5 5.5 0 0 1 7.5 7H18a4 4 0 0 1 0 8h-2.5"></path>
                  <path d="M12 20v-8"></path>
                  <path d="M16 16l-4 4-4-4"></path>
                </svg>
              </span>
            )}
          </h4>

          <div className="translation-preview-stats">
            {selectedTranslation && t('translation.totalSubtitles', 'Total: {{count}} subtitles', { count: selectedTranslation.subtitles.length })}
          </div>
        </div>

        {/* File selection pills */}
        <div className="bulk-preview-selector">
          <div className="bulk-preview-pills">
            {availableTranslations.map((translation) => (
              <button
                key={translation.id}
                className={`bulk-preview-pill ${selectedTranslationId === translation.id ? 'active' : ''}`}
                onClick={() => setSelectedTranslationId(translation.id)}
                title={translation.name}
              >
                {translation.isMain && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12,2 15.09,8.26 22,9 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9 8.91,8.26"></polygon>
                  </svg>
                )}
                <span className="pill-name">{translation.name}</span>
                <span className="pill-count">({translation.subtitles.length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Virtualized list */}
        {selectedTranslation && (
          <div className="translation-preview-virtualized">
            <List
              ref={listRef}
              className="translation-preview-list"
              height={400} // Fixed height for the virtualized container
              width="100%"
              itemCount={selectedTranslation.subtitles.length}
              itemSize={getRowHeight}
              itemData={itemData}
              overscanCount={5} // Number of items to render outside visible area
            >
              {SubtitleRow}
            </List>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkTranslationPreview;
