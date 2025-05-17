import { useEffect } from 'react';

/**
 * Custom hook for UI-related effects
 * @param {Object} params - Parameters
 * @param {boolean} params.isGenerating - Whether generation is in progress
 * @param {string} params.generationStatus - Generation status message
 * @param {Object} params.statusRef - Reference to status element
 * @param {Function} params.t - Translation function
 * @param {Object} params.referenceAudio - Reference audio object
 * @param {string} params.segmentStartTime - Segment start time
 * @param {string} params.segmentEndTime - Segment end time
 * @param {Function} params.setError - Function to set error message
 * @returns {void}
 */
const useUIEffects = ({
  isGenerating,
  generationStatus,
  statusRef,
  t,
  referenceAudio,
  segmentStartTime,
  segmentEndTime,
  setError
}) => {
  // Scroll to status only when generation starts, not for every status update
  useEffect(() => {
    if (isGenerating && statusRef.current && generationStatus === t('narration.preparingGeneration', 'Preparing to generate narration...')) {
      statusRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isGenerating, generationStatus, t, statusRef]);

  // Reset error when inputs change (excluding referenceText)
  useEffect(() => {
    setError('');
  }, [referenceAudio, segmentStartTime, segmentEndTime, setError]);

  return {};
};

export default useUIEffects;
