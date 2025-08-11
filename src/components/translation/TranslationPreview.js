import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { VariableSizeList as List } from 'react-window';
import formatTimeString from './utils/formatTimeString';

/**
 * Calculate segments based on split duration and subtitles
 * @param {Array} subtitles - Array of subtitles
 * @param {number} splitDuration - Split duration in minutes (0 = no split)
 * @returns {Array} - Array of segment info objects
 */
const calculateSegments = (subtitles, splitDuration) => {
  if (!splitDuration || splitDuration === 0 || !subtitles || subtitles.length === 0) {
    // No splitting - all subtitles are in one segment
    return [{
      segmentNumber: 1,
      startIndex: 0,
      endIndex: subtitles.length - 1,
      subtitleCount: subtitles.length
    }];
  }

  const splitDurationSeconds = splitDuration * 60;
  const segments = [];
  let currentSegment = 1;
  let segmentStartIndex = 0;
  let chunkStartTime = subtitles[0]?.start || 0;

  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i];

    // Check if this subtitle would exceed the chunk duration
    if (subtitle.start - chunkStartTime > splitDurationSeconds && i > segmentStartIndex) {
      // End current segment
      segments.push({
        segmentNumber: currentSegment,
        startIndex: segmentStartIndex,
        endIndex: i - 1,
        subtitleCount: i - segmentStartIndex
      });

      // Start new segment
      currentSegment++;
      segmentStartIndex = i;
      chunkStartTime = subtitle.start;
    }
  }

  // Add the last segment
  if (segmentStartIndex < subtitles.length) {
    segments.push({
      segmentNumber: currentSegment,
      startIndex: segmentStartIndex,
      endIndex: subtitles.length - 1,
      subtitleCount: subtitles.length - segmentStartIndex
    });
  }

  return segments;
};

/**
 * Individual subtitle row component for virtualized list
 */
const SubtitleRow = ({ index, style, data }) => {
  const { t } = useTranslation();
  const { translatedSubtitles, segments, onRetrySegment, retryingSegments } = data;
  const subtitle = translatedSubtitles[index];

  // Find which segment this subtitle belongs to
  const currentSegment = segments.find(segment =>
    index >= segment.startIndex && index <= segment.endIndex
  );

  // Check if this is the first subtitle in the segment (for merged cell display)
  const isFirstInSegment = currentSegment && index === currentSegment.startIndex;

  // Check if this segment is currently being retried
  const isRetrying = currentSegment && retryingSegments && retryingSegments.has(currentSegment.segmentNumber);

  // Check if this individual subtitle is being retried
  const isSubtitleRetrying = retryingSegments && retryingSegments.has(`subtitle-${index + 1}`);

  // Determine the time display format - always format properly
  let startTimeDisplay, endTimeDisplay;

  // Prioritize formatted time strings, but ensure proper formatting
  if (subtitle.startTime && typeof subtitle.startTime === 'string') {
    startTimeDisplay = subtitle.startTime;
  } else if (subtitle.start !== undefined) {
    startTimeDisplay = formatTimeString(subtitle.start);
  } else {
    startTimeDisplay = '00:00:00.000';
  }

  if (subtitle.endTime && typeof subtitle.endTime === 'string') {
    endTimeDisplay = subtitle.endTime;
  } else if (subtitle.end !== undefined) {
    endTimeDisplay = formatTimeString(subtitle.end);
  } else {
    endTimeDisplay = '00:00:05.000';
  }

  return (
    <div style={style} className={`preview-subtitle-row ${isRetrying || isSubtitleRetrying ? 'retrying' : ''}`}>
      {/* Segment column - always present for consistent layout */}
      <div className="preview-segment-sticky">
        {/* Only show segment content for first subtitle in segment */}
        {isFirstInSegment && (
          <div className="segment-content">
            <div className="segment-label">
              {t('translation.segment', 'Segment')} {currentSegment.segmentNumber}
            </div>
            <button
              className={`segment-retry-btn ${isRetrying ? 'loading' : ''}`}
              onClick={() => onRetrySegment && onRetrySegment(currentSegment)}
              title={t('translation.retrySegment', 'Retry Segment')}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinning">
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M8 12a4 4 0 0 1 8 0c0 1.1-.4 2.1-1 2.8L12 18"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
              )}
            </button>
          </div>
        )}
        {/* Show segment indicator line for non-first rows */}
        {!isFirstInSegment && currentSegment && (
          <div className="segment-indicator">
            <div className={`segment-line ${isRetrying ? 'pulsing' : ''}`}></div>
          </div>
        )}
      </div>

      <div className="preview-number-sticky">
        <span className="subtitle-number">{index + 1}</span>
        <button
          className={`subtitle-retry-btn ${isSubtitleRetrying ? 'loading' : ''}`}
          onClick={() => data.onRetrySubtitle && data.onRetrySubtitle(index)}
          title={t('translation.retrySubtitle', 'Retry this subtitle')}
          disabled={isSubtitleRetrying}
        >
          {isSubtitleRetrying ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spinning">
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 12a4 4 0 0 1 8 0c0 1.1-.4 2.1-1 2.8L12 18"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          )}
        </button>
      </div>
      <div className="preview-content">
        <span className="preview-time">
          {startTimeDisplay} → {endTimeDisplay}
        </span>
        <span className="preview-text">
          {subtitle.text.split('\n').map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </span>
        {isRetrying && (
          <div className="retry-overlay">
            <div className="retry-spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Translation preview component with virtualized list
 * @param {Object} props - Component props
 * @param {Array} props.translatedSubtitles - Translated subtitles
 * @param {Array} props.targetLanguages - Target languages
 * @param {boolean} props.loadedFromCache - Whether translations were loaded from cache
 * @param {number} props.splitDuration - Split duration in minutes for segment calculation
 * @param {Function} props.onRetrySegment - Callback function to retry a specific segment
 * @returns {JSX.Element|null} - Rendered component or null if no translated subtitles
 */
const TranslationPreview = ({
  translatedSubtitles,
  targetLanguages,
  loadedFromCache,
  splitDuration = 0,
  onRetrySegment
}) => {
  const { t } = useTranslation();
  const listRef = useRef(null);
  const [retryingSegments, setRetryingSegments] = React.useState(new Set());



  // Calculate segments based on split duration
  const segments = useMemo(() => {
    return calculateSegments(translatedSubtitles, splitDuration);
  }, [translatedSubtitles, splitDuration]);

  // Enhanced retry handler with loading state
  const handleRetrySegment = React.useCallback(async (segment) => {
    // Add segment to retrying set
    setRetryingSegments(prev => new Set(prev).add(segment.segmentNumber));

    try {
      // Call the original retry handler
      await onRetrySegment(segment);
    } finally {
      // Remove segment from retrying set
      setRetryingSegments(prev => {
        const newSet = new Set(prev);
        newSet.delete(segment.segmentNumber);
        return newSet;
      });
    }
  }, [onRetrySegment]);

  // Handler for individual subtitle retry
  const handleRetrySubtitle = React.useCallback(async (subtitleIndex) => {
    // Create a single-subtitle segment for retry
    const singleSubtitleSegment = {
      segmentNumber: `subtitle-${subtitleIndex + 1}`,
      startIndex: subtitleIndex,
      endIndex: subtitleIndex,
      subtitleCount: 1
    };

    // Use the same retry logic as segment retry
    await handleRetrySegment(singleSubtitleSegment);
  }, [handleRetrySegment]);

  // Memoize the item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    translatedSubtitles: translatedSubtitles || [],
    segments,
    onRetrySegment: handleRetrySegment,
    onRetrySubtitle: handleRetrySubtitle,
    retryingSegments
  }), [translatedSubtitles, segments, handleRetrySegment, handleRetrySubtitle, retryingSegments]);

  // Calculate dynamic row height based on content
  const getRowHeight = React.useCallback((index) => {
    const subtitle = translatedSubtitles[index];
    if (!subtitle) return 70; // Default height

    const text = subtitle.text || '';

    // Base height for row structure (time display + padding)
    const baseHeight = 50; // Reduced base height

    // Count explicit line breaks
    const lineBreaks = (text.match(/\n/g) || []).length;

    // For text wrapping estimation, be more conservative
    const avgCharsPerLine = 80; // Increased chars per line
    const textWithoutBreaks = text.replace(/\n/g, '');
    const estimatedWrappedLines = Math.max(1, Math.ceil(textWithoutBreaks.length / avgCharsPerLine));

    // Total lines = 1 (base) + explicit breaks + additional wrapped lines
    const totalLines = 1 + lineBreaks + (estimatedWrappedLines - 1);

    // Each line needs exactly 20px (font-size 0.95rem * line-height 1.4 ≈ 20px)
    const textHeight = totalLines * 20;

    return baseHeight + textHeight;
  }, [translatedSubtitles]);

  if (!translatedSubtitles || translatedSubtitles.length === 0) return null;

  return (
    <div className="translation-row preview-row">
      <div className="translation-preview translation-preview-animated">
        <div className="translation-preview-header">
          <h4>
            {t('translation.preview', 'Translation Preview')}
            {targetLanguages.length > 1
              ? ` (${targetLanguages.map(lang => lang.value).filter(val => val.trim() !== '').join(', ')})`
              : targetLanguages[0]?.value?.trim() ? ` (${targetLanguages[0].value})` : ''}
            {loadedFromCache && (
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
            {t('translation.totalSubtitles', 'Total: {{count}} subtitles', { count: translatedSubtitles.length })}
          </div>
        </div>

        <div className="translation-preview-virtualized">
          <List
            ref={listRef}
            className="translation-preview-list"
            height={400} // Fixed height for the virtualized container
            width="100%"
            itemCount={translatedSubtitles.length}
            itemSize={getRowHeight}
            itemData={itemData}
            overscanCount={5} // Number of items to render outside visible area
          >
            {SubtitleRow}
          </List>
        </div>
      </div>
    </div>
  );
};

export default TranslationPreview;
