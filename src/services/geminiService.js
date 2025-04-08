import { parseGeminiResponse, parseTranslatedSubtitles } from '../utils/subtitleParser';
import { convertAudioForGemini, isAudioFormatSupportedByGemini } from '../utils/audioConverter';

// Map to store multiple AbortControllers for parallel requests
const activeAbortControllers = new Map();

// Global flag to indicate when processing should be completely stopped
let _processingForceStopped = false;

// Getter and setter functions for the processing force stopped flag
export const getProcessingForceStopped = () => _processingForceStopped;
export const setProcessingForceStopped = (value) => {
    _processingForceStopped = value;
    console.log(`Force stop flag set to ${value}`);
};

// Default transcription prompts
export const PROMPT_PRESETS = [
    {
        id: 'general',
        title: 'General purpose',
        prompt: `Transcribe this ${'{contentType}'}. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text.`
    },
    {
        id: 'extract-text',
        title: 'Extract text',
        prompt: `Only extract the text/or hardcoded subtitles shown on screen, ignore audio for this ${'{contentType}'}. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text.`
    },
    {
        id: 'focus-speech',
        title: 'Focus on speech',
        prompt: `Transcribe the spoken speech/lyrics in the this ${'{contentType}'}, focus on the sound only. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text.`
    },
    {
        id: 'describe-video',
        title: 'Describe video',
        prompt: `Describe anything happen in this ${'{contentType}'} in sequential fashion. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text.`
    },
    {
        id: 'translate-vietnamese',
        title: 'Translate directly',
        prompt: `Whatever language is spoken in this ${'{contentType}'}, translate them directly in Vietnamese. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text.`
    }
];

// Default transcription prompt that will be used if no custom prompt is set
export const DEFAULT_TRANSCRIPTION_PROMPT = PROMPT_PRESETS[0].prompt;

// Helper function to get saved user presets
export const getUserPromptPresets = () => {
    try {
        const savedPresets = localStorage.getItem('user_prompt_presets');
        return savedPresets ? JSON.parse(savedPresets) : [];
    } catch (error) {
        console.error('Error loading user prompt presets:', error);
        return [];
    }
};

// Helper function to save user presets
export const saveUserPromptPresets = (presets) => {
    try {
        localStorage.setItem('user_prompt_presets', JSON.stringify(presets));
    } catch (error) {
        console.error('Error saving user prompt presets:', error);
    }
};

// Function to abort all ongoing Gemini API requests
export const abortAllRequests = () => {
    if (activeAbortControllers.size > 0) {
        console.log(`Aborting all ongoing Gemini API requests (${activeAbortControllers.size} active)`);

        // Set the global flag to indicate processing should be completely stopped
        setProcessingForceStopped(true);

        // Abort all controllers in the map
        for (const [id, controller] of activeAbortControllers.entries()) {
            console.log(`Aborting request ID: ${id}`);
            controller.abort();
        }

        // Clear the map
        activeAbortControllers.clear();

        // Dispatch an event to notify components that requests have been aborted
        window.dispatchEvent(new CustomEvent('gemini-requests-aborted'));

        return true;
    }
    return false;
};

// Get the active prompt (either from localStorage or default)
const getTranscriptionPrompt = (contentType) => {
    // Get custom prompt from localStorage or use default
    const customPrompt = localStorage.getItem('transcription_prompt');

    // If custom prompt exists and is not empty, replace {contentType} with the actual content type
    if (customPrompt && customPrompt.trim() !== '') {
        return customPrompt.replace('{contentType}', contentType);
    }

    // Otherwise use the default prompt
    return PROMPT_PRESETS[0].prompt.replace('{contentType}', contentType);
};

export const callGeminiApi = async (input, inputType) => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    const MODEL = localStorage.getItem('gemini_model') || "gemini-2.0-flash";

    let requestData = {
        model: MODEL,
        contents: []
    };

    if (inputType === 'youtube') {
        requestData.contents = [
            {
                role: "user",
                parts: [
                    { text: getTranscriptionPrompt('video') },
                    {
                        fileData: {
                            fileUri: input
                        }
                    }
                ]
            }
        ];
    } else if (inputType === 'video' || inputType === 'audio' || inputType === 'file-upload') {
        // Determine if this is a video or audio file
        const isAudio = input.type.startsWith('audio/');
        const contentType = isAudio ? 'audio' : 'video';

        // For audio files, convert to a format supported by Gemini
        let processedInput = input;
        if (isAudio) {
            console.log('Processing audio file:', input.name);
            console.log('Audio file type:', input.type);
            console.log('Audio file size:', input.size);

            // Check if the audio format is supported by Gemini
            if (!isAudioFormatSupportedByGemini(input)) {
                console.warn('Audio format not directly supported by Gemini API, attempting conversion');
            }

            // Convert the audio file to a supported format
            processedInput = await convertAudioForGemini(input);
            console.log('Processed audio file type:', processedInput.type);
        }

        const base64Data = await fileToBase64(processedInput);

        // Use the MIME type from the processed input
        const mimeType = processedInput.type;

        // Log detailed information about the processed file
        console.log('Processed file details:', {
            name: processedInput.name,
            type: processedInput.type,
            size: processedInput.size,
            lastModified: new Date(processedInput.lastModified).toISOString()
        });

        // For audio files, we need to ensure the prompt is appropriate
        const promptText = getTranscriptionPrompt(contentType);

        // Log the prompt being used
        console.log(`Using ${contentType} prompt: ${promptText.substring(0, 100)}...`);

        requestData.contents = [
            {
                role: "user",
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }
        ];

        // Log the MIME type being sent to the API
        console.log('Using MIME type for Gemini API:', mimeType);
    }

    // Create a unique ID for this request
    const requestId = `request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        // Log request data for debugging (without the actual base64 data to keep logs clean)
        console.log('Gemini API request model:', MODEL);
        console.log('Request MIME type:', inputType === 'file-upload' ? input.type : 'N/A');

        // Create a deep copy of the request data for logging
        const debugRequestData = JSON.parse(JSON.stringify(requestData));
        if (debugRequestData.contents && debugRequestData.contents[0] && debugRequestData.contents[0].parts) {
            for (let i = 0; i < debugRequestData.contents[0].parts.length; i++) {
                const part = debugRequestData.contents[0].parts[i];
                if (part.inlineData && part.inlineData.data) {
                    debugRequestData.contents[0].parts[i] = {
                        ...part,
                        inlineData: {
                            ...part.inlineData,
                            data: '[BASE64_DATA]'
                        }
                    };
                }
            }
        }
        console.log('Gemini API request structure:', debugRequestData);

        // Create a new AbortController for this request
        const controller = new AbortController();
        activeAbortControllers.set(requestId, controller);
        const signal = controller.signal;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: signal // Add the AbortController signal
            }
        );

        if (!response.ok) {
            try {
                // Clone the response before reading it to avoid the "body stream already read" error
                const responseClone = response.clone();
                try {
                    const errorData = await response.json();
                    console.error('Gemini API error details:', errorData);

                    // Log more detailed information about the error
                    if (errorData.error) {
                        console.error('Error code:', errorData.error.code);
                        console.error('Error message:', errorData.error.message);
                        console.error('Error status:', errorData.error.status);

                        // Check for specific error messages related to audio/video processing
                        if (errorData.error.message.includes('invalid argument')) {
                            console.error('This may be due to an unsupported file format or MIME type');
                            console.error('Supported audio formats: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg, audio/flac');
                            console.error('File type used:', input.type);
                        }
                    }

                    throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
                } catch (jsonError) {
                    console.error('Error parsing Gemini API error response as JSON:', jsonError);
                    const errorText = await responseClone.text();
                    console.error('Raw error response:', errorText);
                    throw new Error(`API error: ${response.statusText}. Status code: ${response.status}`);
                }
            } catch (error) {
                console.error('Error handling Gemini API error response:', error);
                throw new Error(`API error: ${response.statusText}. Status code: ${response.status}`);
            }
        }

        const data = await response.json();
        console.log('Gemini API response:', data);

        // Remove this controller from the map after successful response
        activeAbortControllers.delete(requestId);
        return parseGeminiResponse(data);
    } catch (error) {
        // Check if this is an AbortError
        if (error.name === 'AbortError') {
            console.log('Gemini API request was aborted');
            throw new Error('Request was aborted');
        } else {
            console.error('Error calling Gemini API:', error);
            // Remove this controller from the map on error
            if (requestId) {
                activeAbortControllers.delete(requestId);
            }
            throw error;
        }
    }
};

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
};

// Function to translate subtitles to a different language while preserving timing
const translateSubtitles = async (subtitles, targetLanguage) => {
    // Store the target language for reference
    localStorage.setItem('translation_target_language', targetLanguage);
    if (!subtitles || subtitles.length === 0) {
        throw new Error('No subtitles to translate');
    }

    // Create a map of original subtitles with their IDs for reference
    const originalSubtitlesMap = {};
    subtitles.forEach(sub => {
        // Ensure each subtitle has a unique ID
        const id = sub.id || subtitles.indexOf(sub) + 1;
        originalSubtitlesMap[id] = sub;
    });

    // Store the original subtitles map in localStorage for reference
    localStorage.setItem('original_subtitles_map', JSON.stringify(originalSubtitlesMap));

    // Format subtitles as proper SRT text for Gemini
    const subtitleText = subtitles.map((sub, index) => {
        // Convert timestamps to SRT format if they're not already
        let startTime = sub.startTime;
        let endTime = sub.endTime;

        // If we have numeric start/end instead of formatted strings
        if (sub.start !== undefined && !startTime) {
            const startHours = Math.floor(sub.start / 3600);
            const startMinutes = Math.floor((sub.start % 3600) / 60);
            const startSeconds = Math.floor(sub.start % 60);
            const startMs = Math.floor((sub.start % 1) * 1000);
            startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:${String(startSeconds).padStart(2, '0')},${String(startMs).padStart(3, '0')}`;
        }

        if (sub.end !== undefined && !endTime) {
            const endHours = Math.floor(sub.end / 3600);
            const endMinutes = Math.floor((sub.end % 3600) / 60);
            const endSeconds = Math.floor(sub.end % 60);
            const endMs = Math.floor((sub.end % 1) * 1000);
            endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:${String(endSeconds).padStart(2, '0')},${String(endMs).padStart(3, '0')}`;
        }

        // Use the subtitle's ID or create one based on index
        const id = sub.id || index + 1;

        // Include a special comment with the original subtitle ID that won't affect translation
        return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}\n<!-- original_id: ${id} -->`;
    }).join('\n\n');

    // Create the prompt for translation
    const translationPrompt = `Translate the following subtitles to ${targetLanguage}.

IMPORTANT: You MUST preserve the exact SRT format with numbers and timestamps.
DO NOT modify the timestamps or subtitle numbers.
ONLY translate the text content between timestamps and blank lines.

Format must be exactly:
1
00:01:23,456 --> 00:01:26,789
Translated text here

2
00:01:27,123 --> 00:01:30,456
Next translated text here

Here are the subtitles to translate:\n\n${subtitleText}`;

    // Create a unique ID for this request
    const requestId = `translation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        // Get selected model from localStorage or use default
        const model = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Create a new AbortController for this request
        const controller = new AbortController();
        activeAbortControllers.set(requestId, controller);
        const signal = controller.signal;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: translationPrompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    topK: 32,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                },
            }),
            signal: signal // Add the AbortController signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const translatedText = data.candidates[0]?.content?.parts[0]?.text;

        if (!translatedText) {
            throw new Error('No translation returned from Gemini');
        }

        // Remove this controller from the map after successful response
        activeAbortControllers.delete(requestId);

        // Parse the translated subtitles
        return parseTranslatedSubtitles(translatedText);
    } catch (error) {
        // Check if this is an AbortError
        if (error.name === 'AbortError') {
            console.log('Translation request was aborted');
            throw new Error('Translation request was aborted');
        } else {
            console.error('Translation error:', error);
            // Remove this controller from the map on error
            if (requestId) {
                activeAbortControllers.delete(requestId);
            }
            throw error;
        }
    }
};

export { callGeminiApi as transcribeVideo, callGeminiApi as transcribeAudio, callGeminiApi as transcribeYouTubeVideo, translateSubtitles };