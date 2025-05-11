/**
 * Utility functions for narration management
 */

/**
 * Find subtitle data for a narration
 *
 * @param {Object} narration - Narration object
 * @returns {Object|null} - Subtitle data or null if not found
 */
export const findSubtitleData = (narration) => {
  if (!narration || !narration.subtitle_id) return null;

  // Try to find the matching subtitle
  let subtitleData;
  if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
    subtitleData = window.subtitlesData.find(sub => sub.id === narration.subtitle_id);
  }
  if (!subtitleData && window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
    subtitleData = window.originalSubtitles.find(sub => sub.id === narration.subtitle_id);
  }
  if (!subtitleData && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
    subtitleData = window.translatedSubtitles.find(sub => sub.id === narration.subtitle_id);
  }

  return subtitleData;
};

/**
 * Get the latest version of a narration from global arrays
 *
 * @param {Object} narration - Narration object
 * @param {string} source - Source of narration (original/translated)
 * @returns {Object} - Latest narration object
 */
export const getLatestNarration = (narration, source) => {
  if (!narration || !narration.subtitle_id) return narration;

  let latestNarration = narration;

  // Get the latest narration data from the appropriate source
  if (source === 'original' && window.originalNarrations) {
    const updatedNarration = window.originalNarrations.find(n => n.subtitle_id === narration.subtitle_id);
    if (updatedNarration) {
      latestNarration = updatedNarration;

    }
  } else if (source === 'translated' && window.translatedNarrations) {
    const updatedNarration = window.translatedNarrations.find(n => n.subtitle_id === narration.subtitle_id);
    if (updatedNarration) {
      latestNarration = updatedNarration;

    }
  }

  // AGGRESSIVE FIX: Always create a fresh copy of the narration with a timestamp
  // This ensures that the audio URL will always be different, forcing a reload
  const freshNarration = {
    ...latestNarration,
    _timestamp: Date.now() // Add a timestamp to ensure the audio URL is always different
  };



  return freshNarration;
};

/**
 * Calculate the start time for audio playback
 *
 * @param {Object} videoRef - Reference to the video element
 * @param {Object} narration - Narration object
 * @param {number} audioDuration - Duration of the audio
 * @returns {number} - Start time for audio playback
 */
export const calculateAudioStartTime = (videoRef, narration, audioDuration) => {
  if (!narration || !videoRef?.current) return 0;

  // Find the subtitle start time
  let subtitleStart = 0;
  if (narration.subtitleData) {
    subtitleStart = typeof narration.subtitleData.start === 'number' ?
      narration.subtitleData.start : parseFloat(narration.subtitleData.start);
  } else {
    // Try to find the subtitle data
    const subtitleData = findSubtitleData(narration);

    if (subtitleData) {
      subtitleStart = typeof subtitleData.start === 'number' ?
        subtitleData.start : parseFloat(subtitleData.start);
    }
  }

  if (audioDuration) {
    // Simply calculate how far we are from the subtitle start
    const videoCurrentTime = videoRef.current.currentTime;
    const timeFromSubtitleStart = videoCurrentTime - subtitleStart;

    // If we're already past the subtitle start, set audio position accordingly
    // Otherwise, start from the beginning of the audio
    const audioStartTime = Math.max(0, timeFromSubtitleStart);



    // Ensure the start time is within valid bounds
    if (audioStartTime >= 0 && audioStartTime < audioDuration) {
      return audioStartTime;
    }
  }

  return 0;
};
