import { useEffect } from 'react';
import { checkNarrationStatusWithRetry } from '../../../services/narrationService';
import { checkGeminiAvailability } from '../../../services/gemini/geminiNarrationService';
import { checkChatterboxAvailability, isChatterboxServiceInitialized, checkChatterboxShouldBeAvailable } from '../../../services/chatterboxService';

/**
 * Custom hook for checking narration service availability
 * @param {Object} params - Parameters
 * @param {string} params.narrationMethod - Current narration method
 * @param {Function} params.setIsAvailable - Function to set F5-TTS availability
 * @param {Function} params.setIsGeminiAvailable - Function to set Gemini availability
 * @param {Function} params.setIsChatterboxAvailable - Function to set Chatterbox availability
 * @param {Function} params.setError - Function to set error message
 * @param {Function} params.t - Translation function
 * @returns {void}
 */
const useAvailabilityCheck = ({
  narrationMethod,
  setIsAvailable,
  setIsGeminiAvailable,
  setIsChatterboxAvailable,
  setError,
  t
}) => {
  // Check if narration services are available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        // First, do immediate checks for services that can be determined quickly

        // Check Chatterbox immediate availability (server configuration)
        const chatterboxQuickCheck = await checkChatterboxShouldBeAvailable();
        setIsChatterboxAvailable(chatterboxQuickCheck.shouldBeRunning);

        // Check F5-TTS availability in the background
        const f5Status = await checkNarrationStatusWithRetry(20, 10000, true);

        // Set F5-TTS availability based on the actual status
        setIsAvailable(f5Status.available);

        // Check Gemini availability
        const geminiStatus = await checkGeminiAvailability();

        // Set Gemini availability
        setIsGeminiAvailable(geminiStatus.available);

        // If Chatterbox should be running according to server config, do a full check
        let chatterboxStatus = chatterboxQuickCheck;
        if (chatterboxQuickCheck.shouldBeRunning) {
          // Use fewer retries if service is already initialized, more if not
          const chatterboxMaxAttempts = isChatterboxServiceInitialized() ? 1 : 3;
          const chatterboxDelay = isChatterboxServiceInitialized() ? 1000 : 2000;
          chatterboxStatus = await checkChatterboxAvailability(chatterboxMaxAttempts, chatterboxDelay);

          // Update Chatterbox availability with full check result
          setIsChatterboxAvailable(chatterboxStatus.available);
        }

        // Set error message based on current method
        if (!geminiStatus.available && narrationMethod === 'gemini' && geminiStatus.message) {
          setError(geminiStatus.message);
        }
        else if (!f5Status.available && narrationMethod === 'f5tts' && f5Status.message) {
          setError(f5Status.message);
        }
        else if (!chatterboxStatus.available && narrationMethod === 'chatterbox' && chatterboxStatus.message) {
          setError(chatterboxStatus.message);
        }
        else {
          // Clear any previous errors
          setError('');
        }
      } catch (error) {
        console.error('Error checking service availability:', error);

        // Set error based on current method
        if (narrationMethod === 'f5tts') {
          setIsAvailable(false);
          setError(t('narration.serviceUnavailableMessage', "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."));
        }
        else if (narrationMethod === 'chatterbox') {
          setIsChatterboxAvailable(false);
          setError(t('narration.chatterboxUnavailableMessage', "Chatterbox API is not available. Please start the Chatterbox service."));
        }
        else {
          setIsGeminiAvailable(false);
          setError(t('narration.geminiUnavailableMessage', "Gemini API is not available. Please check your API key in settings."));
        }
      }
    };

    // Check availability once when component mounts or narration method changes
    checkAvailability();
  }, [t, narrationMethod, setIsAvailable, setIsGeminiAvailable, setIsChatterboxAvailable, setError]);
};

export default useAvailabilityCheck;
