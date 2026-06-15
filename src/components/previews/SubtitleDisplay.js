import React from 'react';

/**
 * Pure custom-subtitle overlay: renders the current subtitle text inside the
 * video wrapper and injects the inline <style> that drives its appearance from
 * the user's subtitle settings.
 *
 * Props:
 *   - currentSubtitleText: the text to display (empty string hides the bubble)
 *   - subtitleSettings: the user's subtitle styling settings object
 */
const SubtitleDisplay = ({ currentSubtitleText, subtitleSettings }) => {
  return (
    <>
      {/* Custom subtitle display - positioned inside video-wrapper for proper layering */}
      <div className="custom-subtitle-container" style={{ width: `${subtitleSettings.boxWidth || '80'}%` }}>
        {currentSubtitleText && (
          <div className="custom-subtitle">
            {currentSubtitleText.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {index > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Apply subtitle styling to the video element */}
      <style>
        {`
          /* Set CSS variables for custom subtitle styling */
          :root {
            --subtitle-position: ${subtitleSettings.position || '90'}%;
            --subtitle-box-width: ${subtitleSettings.boxWidth || '80'}%;
            --subtitle-background-radius: ${subtitleSettings.backgroundRadius || '4'}px;
            --subtitle-background-padding: ${subtitleSettings.backgroundPadding || '10'}px;
            --subtitle-text-transform: ${subtitleSettings.textTransform || 'none'};
            --subtitle-letter-spacing: ${subtitleSettings.letterSpacing || '0'}px;
          }

          /* Native track subtitles disabled - using only custom subtitle display */

          /* Video container positioning */
          .native-video-container {
            position: relative;
          }

          /* Style for custom subtitle display */
          .custom-subtitle-container {
            position: absolute;
            left: 0;
            right: 0;
            width: var(--subtitle-box-width);
            max-width: 100%;
            margin: 0 auto;
            text-align: center;
            z-index: 2; /* Above video (z-index: 1) but below UI controls (z-index: 3+) */
            /* Calculate top position based on percentage (0% = top, 100% = bottom) */
            bottom: calc(100% - var(--subtitle-position));
            transform: translateY(16%);
            pointer-events: none; /* Allow clicks to pass through to video and controls */
          }

          .custom-subtitle {
            display: inline-block;
            background-color: rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)}, ${subtitleSettings.opacity});
            color: ${subtitleSettings.textColor};
            font-family: ${subtitleSettings.fontFamily};
            font-variation-settings: ${subtitleSettings.fontVariationSettings || 'normal'};
            font-size: ${subtitleSettings.fontSize}px;
            font-weight: ${subtitleSettings.fontWeight};
            line-height: ${subtitleSettings.lineSpacing || '1.4'};
            text-align: ${subtitleSettings.textAlign || 'center'};
            text-transform: var(--subtitle-text-transform);
            letter-spacing: var(--subtitle-letter-spacing);
            padding: ${subtitleSettings.backgroundPadding || '10'}px;
            border-radius: ${subtitleSettings.backgroundRadius || '4'}px;
            text-shadow: ${subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ? '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none'};
            max-width: 100%;
            word-wrap: break-word;
          }

        `}
      </style>
    </>
  );
};

export default SubtitleDisplay;
