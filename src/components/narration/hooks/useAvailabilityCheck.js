import { useEffect } from 'react';
import { checkNarrationStatusWithRetry } from '../../../services/narrationService';
import { checkGeminiAvailability } from '../../../services/gemini/geminiNarrationService';

/**
 * Custom hook for checking narration service availability
 * @param {Object} params - Parameters
 * @param {string} params.narrationMethod - Current narration method
 * @param {Function} params.setIsAvailable - Function to set F5-TTS availability
 * @param {Function} params.setIsGeminiAvailable - Function to set Gemini availability
 * @param {Function} params.setError - Function to set error message
 * @param {Function} params.t - Translation function
 * @returns {void}
 */
const useAvailabilityCheck = ({
  narrationMethod,
  setIsAvailable,
  setIsGeminiAvailable,
  setError,
  t
}) => {
  // Check if narration services are available
  useEffect(() => {
    const checkAvailability = async () => {
      try {


        // Check F5-TTS availability in the background
        const f5Status = await checkNarrationStatusWithRetry(20, 10000, true);


        // Set F5-TTS availability based on the actual status
        setIsAvailable(f5Status.available);

        // Check Gemini availability
        const geminiStatus = await checkGeminiAvailability();


        // Set Gemini availability
        setIsGeminiAvailable(geminiStatus.available);

        // Set error message if Gemini is not available and we're using Gemini method
        if (!geminiStatus.available && narrationMethod === 'gemini' && geminiStatus.message) {
          setError(geminiStatus.message);
        }
        // Set error message if F5-TTS is not available and we're using F5-TTS method
        else if (!f5Status.available && narrationMethod === 'f5tts' && f5Status.message) {
          setError(f5Status.message);
        }
        else {
          // Clear any previous errors
          setError('');
        }
      } catch (error) {
        console.error('Error checking service availability:', error);

        // If we're using F5-TTS, show F5-TTS error
        if (narrationMethod === 'f5tts') {
          setIsAvailable(false);
          setError(t('narration.serviceUnavailableMessage', "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."));
        }
        // If we're using Gemini, show Gemini error
        else {
          setIsGeminiAvailable(false);
          setError(t('narration.geminiUnavailableMessage', "Gemini API is not available. Please check your API key in settings."));
        }
      }
    };

    // Check availability once when component mounts or narration method changes
    checkAvailability();
  }, [t, narrationMethod, setIsAvailable, setIsGeminiAvailable, setError]);
};

export default useAvailabilityCheck;
