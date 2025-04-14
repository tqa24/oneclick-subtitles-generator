/**
 * Format time in seconds to HH:MM:SS.mmm format
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export const formatTimeString = (timeInSeconds) => {
  if (timeInSeconds === undefined || timeInSeconds === null) return '00:00:00.000';

  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.floor((timeInSeconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};

export default formatTimeString;
