import { parseGeminiResponse, parseTranslatedSubtitles } from '../utils/subtitleParser';
import { convertAudioForGemini, isAudioFormatSupportedByGemini } from '../utils/audioConverter';
import { getLanguageCode } from '../utils/languageUtils';
import i18n from '../i18n/i18n';

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
        prompt: `You are an expert transcriber. Your task is to transcribe the primary spoken content in this ${'{contentType}'}. Ignore non-essential background noise and periods of silence. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed text (1-2 sentences max). For example: [0m30s000ms - 0m35s500ms] This is the transcribed speech. Return ONLY the formatted transcript lines. Do not include any headers, summaries, introductions, or any other text whatsoever.`
    },
    {
        id: 'extract-text',
        title: 'Extract text',
        prompt: `Your task is to extract only the visible text and/or hardcoded subtitles appearing on screen within this ${'{contentType}'}. Completely ignore all audio content. Format the output as a sequential transcript showing exactly when the text appears and disappears. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Extracted on-screen text (1-2 lines/sentences max). For example: [0m30s000ms - 0m35s500ms] This text appeared on screen. Return ONLY the formatted text entries with their timestamps. Provide absolutely no other text, headers, or explanations.`
    },
    // --- Replaced 'focus-speech' with two specific presets ---
    {
        id: 'focus-spoken-words', // New ID
        title: 'Focus on Spoken Words', // New Title
        // Prompt modified to EXCLUDE lyrics
        prompt: `Focus exclusively on the spoken words (dialogue, narration) in this ${'{contentType}'}. Transcribe ONLY the audible speech. Explicitly ignore any song lyrics, background music, on-screen text, and non-speech sounds. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed spoken words (1-2 sentences max). For example: [0m30s000ms - 0m35s500ms] This is the spoken dialogue. Return ONLY the formatted transcript lines of spoken words, with no extra text, headers, or explanations.`
    },
    {
        id: 'focus-lyrics', // New ID
        title: 'Focus on Lyrics', // New Title
        // Prompt created to INCLUDE ONLY lyrics
        prompt: `Focus exclusively on the song lyrics sung in this ${'{contentType}'}. Transcribe ONLY the audible lyrics. Explicitly ignore any spoken words (dialogue, narration), background music without vocals, on-screen text, and non-lyrical sounds. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed lyrics (1-2 lines/sentences max). For example: [0m45s100ms - 0m50s250ms] These are the lyrics being sung. Return ONLY the formatted transcript lines of lyrics, with no extra text, headers, or explanations.`
    },
    // --- End of replaced presets ---
    {
        id: 'describe-video',
        title: 'Describe video',
        prompt: `Describe the significant visual events, actions, and scene changes occurring in this ${'{contentType}'} in chronological order. Focus solely on what is visually happening on screen. Format the output as a descriptive log. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Visual description (1-2 sentences max). For example: [0m30s000ms - 0m35s500ms] A person walks across the screen. Return ONLY the formatted descriptions with their timestamps. Do not include any audio transcription, headers, or other commentary.`
    },
    {
        id: 'translate-vietnamese',
        title: 'Translate directly',
        prompt: `Identify the spoken language(s) in this ${'{contentType}'} and translate the speech directly into TARGET_LANGUAGE. If multiple languages are spoken, translate all spoken segments into TARGET_LANGUAGE. Format the output as a sequential transcript of the translation. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] translated text (1-2 translated sentences max). Return ONLY the formatted translation lines with timestamps. Do not include the original language transcription, headers, or any other text.`
    },
    {
        id: 'chaptering',
        title: 'Chaptering',
        prompt: `You are an expert content analyst. Your task is to analyze this ${'{contentType}'} and identify distinct chapters or thematic segments based on major topic shifts or significant changes in activity/scene. Format the output as a sequential list, with each chapter on a new line. Each line MUST strictly follow the format: [HH:MM:SS] Chapter Title (5-7 words max) :: Chapter Summary (1-2 sentences). Use the specific timestamp format [HH:MM:SS] (hours, minutes, seconds) representing the chapter's start time. Use ' :: ' (space, two colons, space) as the separator between the title and the summary.

Example of two chapter lines:
[00:05:15] Introduction to Topic :: This chapter introduces the main subject discussed and sets the stage for later details.
[00:15:30] Exploring Detail A :: The speaker dives into the first major detail, providing supporting examples.

Ensure titles are concise (5-7 words max) and summaries are brief (1-2 sentences). Focus on major segmentation points. Return ONLY the formatted chapter lines following this exact single-line structure. Do not include any introductory text, concluding remarks, blank lines, lists, or any other text or formatting.`
    },
    {
        id: 'diarize-speakers',
        title: 'Identify Speakers',
        prompt: `You are an expert transcriber capable of speaker identification (diarization). Your task is to transcribe the spoken content in this ${'{contentType}'} AND identify who is speaking for each segment. Assign generic labels like 'Speaker 1', 'Speaker 2', etc., consistently throughout the transcript if specific names are not clearly identifiable or mentioned. Format the output as a sequential transcript. Each line MUST strictly follow the format: Speaker Label [MMmSSsNNNms - MMmSSsNNNms] Transcribed text. Example: Speaker 1 [0m5s123ms - 0m10s456ms] This is what the first speaker said. Each entry must represent a continuous segment from a single speaker. Return ONLY the formatted speaker transcript lines following this exact structure. Do not include headers, speaker inventories, introductions, summaries, or any other text or formatting.`
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
    const requestId = `request_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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

// Default prompts for different operations
export const getDefaultTranslationPrompt = (subtitleText, targetLanguage) => {
    return `Translate the following subtitles to ${targetLanguage}.

IMPORTANT: You MUST preserve the exact SRT format with numbers and timestamps.
DO NOT modify the timestamps or subtitle numbers.
ONLY translate the text content between timestamps and blank lines.
DO NOT include any explanations, comments, or additional text in your response.

Format must be exactly:
1
00:01:23,456 --> 00:01:26,789
Translated text here

2
00:01:27,123 --> 00:01:30,456
Next translated text here

Here are the subtitles to translate:\n\n${subtitleText}`;
};

export const getDefaultConsolidatePrompt = (subtitlesText) => {
    return `I have a collection of subtitles from a video or audio. Please convert these into a coherent document, organizing the content naturally based on the context. Maintain the original meaning but improve flow and readability.

IMPORTANT: Your response should ONLY contain the consolidated document text.
DO NOT include any explanations, comments, headers, or additional text in your response.

Here are the subtitles:\n\n${subtitlesText}`;
};

export const getDefaultSummarizePrompt = (subtitlesText) => {
    return `I have a collection of subtitles from a video or audio. Please create a concise summary of the main points and key information. The summary should be about 1/3 the length of the original text but capture all essential information.

IMPORTANT: Your response should ONLY contain the summary text.
DO NOT include any explanations, comments, headers, or additional text in your response.
DO NOT include phrases like "Here's a summary" or "In summary" at the beginning.

Here are the subtitles:\n\n${subtitlesText}`;
};

// Function to translate subtitles to a different language while preserving timing
const translateSubtitles = async (subtitles, targetLanguage, model = 'gemini-2.0-flash', customPrompt = null, splitDuration = 0) => {
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

    // If splitDuration is specified and not 0, split subtitles into chunks based on duration
    if (splitDuration > 0) {
        console.log(`Splitting translation into chunks of ${splitDuration} minutes`);
        // Dispatch event to update UI with status
        const message = i18n.t('translation.splittingSubtitles', 'Splitting {{count}} subtitles into chunks of {{duration}} minutes', {
            count: subtitles.length,
            duration: splitDuration
        });
        window.dispatchEvent(new CustomEvent('translation-status', {
            detail: { message }
        }));
        return await translateSubtitlesByChunks(subtitles, targetLanguage, model, customPrompt, splitDuration);
    }

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
    let translationPrompt;
    if (customPrompt) {
        // Replace variables in the custom prompt
        translationPrompt = customPrompt
            .replace('{subtitlesText}', subtitleText)
            .replace('{targetLanguage}', targetLanguage);
    } else {
        translationPrompt = getDefaultTranslationPrompt(subtitleText, targetLanguage);
    }

    // Create a unique ID for this request
    const requestId = `translation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        // Use the model parameter passed to the function
        // This allows for model selection specific to translation
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
                    maxOutputTokens: 65536, // Increased to maximum allowed value (65536 per Gemini documentation)
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

/**
 * consolidate document from subtitles text
 * @param {string} subtitlesText - Plain text content from subtitles
 * @param {string} model - Gemini model to use
 * @param {string} customPrompt - Optional custom prompt to use
 * @returns {Promise<string>} - Completed document text
 */
export const completeDocument = async (subtitlesText, model = 'gemini-2.0-flash', customPrompt = null) => {
    if (!subtitlesText || subtitlesText.trim() === '') {
        throw new Error('No text to process');
    }

    // Create a unique ID for this request
    const requestId = `document_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Create a new AbortController for this request
        const controller = new AbortController();
        activeAbortControllers.set(requestId, controller);
        const signal = controller.signal;

        // Create the prompt for document completion
        let documentPrompt;
        if (customPrompt) {
            // Replace variables in the custom prompt
            documentPrompt = customPrompt.replace('{subtitlesText}', subtitlesText);
        } else {
            documentPrompt = getDefaultConsolidatePrompt(subtitlesText);
        }

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
                            { text: documentPrompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    topK: 32,
                    topP: 0.95,
                    maxOutputTokens: 65536, // Increased to maximum allowed value (65536 per Gemini documentation)
                },
            }),
            signal: signal // Add the AbortController signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const completedText = data.candidates[0]?.content?.parts[0]?.text;

        if (!completedText) {
            throw new Error('No completed document returned from Gemini');
        }

        // Remove this controller from the map after successful response
        activeAbortControllers.delete(requestId);

        return completedText;
    } catch (error) {
        // Check if this is an AbortError
        if (error.name === 'AbortError') {
            console.log('Document completion request was aborted');
            throw new Error('Document completion request was aborted');
        } else {
            console.error('Document completion error:', error);
            // Remove this controller from the map on error
            if (requestId) {
                activeAbortControllers.delete(requestId);
            }
            throw error;
        }
    }
};

/**
 * Summarize document from subtitles text
 * @param {string} subtitlesText - Plain text content from subtitles
 * @param {string} model - Gemini model to use
 * @param {string} customPrompt - Optional custom prompt to use
 * @returns {Promise<string>} - Summarized document text
 */
export const summarizeDocument = async (subtitlesText, model = 'gemini-2.0-flash', customPrompt = null) => {
    if (!subtitlesText || subtitlesText.trim() === '') {
        throw new Error('No text to process');
    }

    // Create a unique ID for this request
    const requestId = `summary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Create a new AbortController for this request
        const controller = new AbortController();
        activeAbortControllers.set(requestId, controller);
        const signal = controller.signal;

        // Create the prompt for document summarization
        let summaryPrompt;
        if (customPrompt) {
            // Replace variables in the custom prompt
            summaryPrompt = customPrompt.replace('{subtitlesText}', subtitlesText);
        } else {
            summaryPrompt = getDefaultSummarizePrompt(subtitlesText);
        }

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
                            { text: summaryPrompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    topK: 32,
                    topP: 0.95,
                    maxOutputTokens: 65536, // Increased to maximum allowed value (65536 per Gemini documentation)
                },
            }),
            signal: signal // Add the AbortController signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const summarizedText = data.candidates[0]?.content?.parts[0]?.text;

        if (!summarizedText) {
            throw new Error('No summary returned from Gemini');
        }

        // Remove this controller from the map after successful response
        activeAbortControllers.delete(requestId);

        return summarizedText;
    } catch (error) {
        // Check if this is an AbortError
        if (error.name === 'AbortError') {
            console.log('Summary request was aborted');
            throw new Error('Summary request was aborted');
        } else {
            console.error('Summary error:', error);
            // Remove this controller from the map on error
            if (requestId) {
                activeAbortControllers.delete(requestId);
            }
            throw error;
        }
    }
};

/**
 * Split subtitles into chunks based on duration and translate each chunk
 * @param {Array} subtitles - Subtitles to translate
 * @param {string} targetLanguage - Target language
 * @param {string} model - Gemini model to use
 * @param {string} customPrompt - Custom prompt for translation
 * @param {number} splitDuration - Duration in minutes for each chunk
 * @returns {Promise<Array>} - Array of translated subtitles
 */
const translateSubtitlesByChunks = async (subtitles, targetLanguage, model, customPrompt, splitDuration) => {
    // Convert splitDuration from minutes to seconds
    const splitDurationSeconds = splitDuration * 60;

    // Group subtitles into chunks based on their timestamps
    const chunks = [];
    let currentChunk = [];
    let chunkStartTime = subtitles[0]?.start || 0;

    subtitles.forEach(subtitle => {
        // If this subtitle would exceed the chunk duration, start a new chunk
        if (subtitle.start - chunkStartTime > splitDurationSeconds) {
            if (currentChunk.length > 0) {
                chunks.push([...currentChunk]);
                currentChunk = [];
                chunkStartTime = subtitle.start;
            }
        }

        currentChunk.push(subtitle);
    });

    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    console.log(`Split ${subtitles.length} subtitles into ${chunks.length} chunks`);

    // Dispatch event to update UI with status
    const splitMessage = i18n.t('translation.splitComplete', 'Split {{count}} subtitles into {{chunks}} chunks', {
        count: subtitles.length,
        chunks: chunks.length
    });
    window.dispatchEvent(new CustomEvent('translation-status', {
        detail: { message: splitMessage }
    }));

    // Translate each chunk
    const translatedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Translating chunk ${i + 1}/${chunks.length} with ${chunk.length} subtitles`);

        // Dispatch event to update UI with status
        const chunkMessage = i18n.t('translation.translatingChunk', 'Translating chunk {{current}}/{{total}} with {{count}} subtitles', {
            current: i + 1,
            total: chunks.length,
            count: chunk.length
        });
        window.dispatchEvent(new CustomEvent('translation-status', {
            detail: { message: chunkMessage }
        }));

        try {
            // Call translateSubtitles with the current chunk, but with splitDuration=0 to avoid infinite recursion
            const translatedChunk = await translateSubtitles(chunk, targetLanguage, model, customPrompt, 0);
            translatedChunks.push(translatedChunk);
        } catch (error) {
            console.error(`Error translating chunk ${i + 1}:`, error);
            // If a chunk fails, add the original subtitles to maintain the structure
            translatedChunks.push(chunk.map(sub => ({
                ...sub,
                text: `[Translation failed] ${sub.text}`,
                language: getLanguageCode(targetLanguage)
            })));
        }
    }

    // Dispatch event to update UI with completion status
    const completionMessage = i18n.t('translation.translationComplete', 'Translation completed for all {{count}} chunks', {
        count: chunks.length
    });
    window.dispatchEvent(new CustomEvent('translation-status', {
        detail: { message: completionMessage }
    }));

    // Flatten the array of translated chunks
    return translatedChunks.flat();
};

export { callGeminiApi as transcribeVideo, callGeminiApi as transcribeAudio, callGeminiApi as transcribeYouTubeVideo, translateSubtitles };