import { SERVER_URL } from '../../../config';

/**
 * Ask the server to delete narration output directories for subtitle IDs that are no longer part
 * of the current grouped-subtitle set. Best-effort: logs on failure, never throws.
 *
 * Single source of truth — previously duplicated verbatim in useChatterboxNarration and
 * useGeminiNarration.
 * @param {Array} groupedSubtitles
 */
export const cleanupOldSubtitleDirectories = async (groupedSubtitles) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/narration/cleanup-old-directories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupedSubtitles }),
    });

    if (!response.ok) {
      console.error('Failed to cleanup old subtitle directories');
    }
  } catch (error) {
    console.error('Error calling cleanup API:', error);
  }
};
