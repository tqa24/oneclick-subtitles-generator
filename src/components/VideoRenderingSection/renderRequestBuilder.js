// Pure async helpers that turn the selected video / narration into the inputs the
// renderer expects. The render-state orchestration (progress, SSE, error handling)
// stays in the parent's handleStartRender; only the upload/conversion mechanics live
// here.
import {
  RENDERER_BASE_URL,
  uploadFileToRenderer,
  downloadVideoFromUrl,
  convertBlobUrlToFile,
} from '../../utils/videoRendererClient';

/**
 * Upload/convert the selected video and return the renderer-side audio file ref.
 *
 * @param {File|object} selectedVideoFile File or { url, name, isActualVideo }
 * @param {Function} setRenderStatus status setter for progress messaging
 * @param {Function} t i18n translate
 * @returns {Promise<*>} the renderer audioFile identifier
 */
export const resolveAudioFile = async (selectedVideoFile, setRenderStatus, t) => {
  if (selectedVideoFile instanceof File) {
    setRenderStatus(t('videoRendering.uploadingVideo', 'Uploading video...'));
    return uploadFileToRenderer(selectedVideoFile, 'video');
  }

  if (selectedVideoFile && typeof selectedVideoFile === 'object' && selectedVideoFile.url) {
    // If it's the actual video URL from the player
    if (selectedVideoFile.isActualVideo) {
      // Check if it's a blob URL
      if (selectedVideoFile.url.startsWith('blob:')) {
        setRenderStatus(t('videoRendering.convertingVideo', 'Converting video...'));
        // Convert blob URL to File and upload
        const videoFile = await convertBlobUrlToFile(selectedVideoFile.url, selectedVideoFile.name || 'video.mp4');
        setRenderStatus(t('videoRendering.uploadingVideo', 'Uploading video...'));
        return uploadFileToRenderer(videoFile, 'video');
      }
      setRenderStatus(t('videoRendering.downloadingVideo', 'Downloading video...'));
      return downloadVideoFromUrl(selectedVideoFile.url);
    }
    throw new Error(t('videoRendering.urlNotSupported', 'URL videos not yet supported. Please upload a file.'));
  }

  throw new Error(t('videoRendering.invalidVideoFile', 'Invalid video file. Please select a valid video file.'));
};

/**
 * Resolve, upload, and return an HTTP narration URL for the renderer, or null when
 * narration is not selected/available.
 *
 * @param {string} selectedNarration 'none' | 'generated'
 * @param {Function} getNarrationAudioUrl resolver from useNarration
 * @param {Function} setRenderStatus status setter for progress messaging
 * @param {Function} t i18n translate
 * @returns {Promise<string|null>}
 */
export const resolveNarrationUrl = async (selectedNarration, getNarrationAudioUrl, setRenderStatus, t) => {
  if (selectedNarration !== 'generated') {
    return null;
  }

  setRenderStatus(t('videoRendering.preparingNarration', 'Preparing narration...'));
  const narrationBlobUrl = await getNarrationAudioUrl();
  if (!narrationBlobUrl) {
    return null;
  }

  setRenderStatus(t('videoRendering.uploadingNarration', 'Uploading narration...'));

  // Handle blob URLs for narration audio
  let narrationFileObj;
  if (narrationBlobUrl.startsWith('blob:')) {
    // Convert blob URL to File object (client-side)
    const narrationResponse = await fetch(narrationBlobUrl);
    const narrationBlob = await narrationResponse.blob();
    narrationFileObj = new File([narrationBlob], 'narration.wav', { type: 'audio/wav' });
  } else {
    // Handle HTTP URLs
    const narrationResponse = await fetch(narrationBlobUrl);
    if (!narrationResponse.ok) {
      throw new Error('Failed to download narration from URL');
    }
    const narrationBlob = await narrationResponse.blob();
    narrationFileObj = new File([narrationBlob], 'narration.wav', { type: 'audio/wav' });
  }

  // Upload the file to renderer and get HTTP URL
  const uploadedNarrationFilename = await uploadFileToRenderer(narrationFileObj, 'audio');
  return `${RENDERER_BASE_URL}/uploads/${uploadedNarrationFilename}`;
};

/**
 * Assemble the render request payload sent to the renderer.
 *
 * @param {object} params
 * @param {*} params.audioFile renderer audio file ref
 * @param {Array} params.lyrics current subtitles
 * @param {object} params.renderSettings
 * @param {object} params.queueItem queue item carrying customization + cropSettings
 * @param {string|null} params.narrationUrl
 * @returns {object} render request body
 */
export const buildRenderRequest = ({ audioFile, lyrics, renderSettings, queueItem, narrationUrl }) => ({
  compositionId: 'subtitled-video',
  audioFile: audioFile,
  lyrics: lyrics,
  metadata: {
    ...renderSettings,
    subtitleCustomization: queueItem.customization, // Include subtitle customization in metadata
    cropSettings: queueItem.cropSettings, // Include crop settings in metadata
    trimStart: typeof renderSettings.trimStart === 'number' ? renderSettings.trimStart : 0,
    trimEnd: typeof renderSettings.trimEnd === 'number' ? renderSettings.trimEnd : 0,
  },
  narrationUrl: narrationUrl, // Use HTTP URL instead of blob URL
  isVideoFile: true,
});
