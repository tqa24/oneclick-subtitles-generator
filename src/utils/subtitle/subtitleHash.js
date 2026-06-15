/**
 * Stable 32-bit hash of a subtitle list, used as a cache key.
 *
 * Keyed on "<id|subtitle_id>:<text>" per entry. Single source for what was duplicated in
 * useTranslationState and the narration result components (which used a narrower
 * "<subtitle_id>:<text>" key — identical for data without a separate `id`).
 *
 * @param {Array<{id?: any, subtitle_id?: any, text?: string}>} subtitles
 * @returns {string} hex hash, or '' for an empty list
 */
export const generateSubtitleHash = (subtitles) => {
  if (!subtitles || !subtitles.length) return '';

  const subtitleString = subtitles.map((s) => `${s.id || s.subtitle_id || ''}:${s.text}`).join('|');

  let hash = 0;
  for (let i = 0; i < subtitleString.length; i++) {
    const char = subtitleString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
};
