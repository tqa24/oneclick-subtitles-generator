import { parseGeminiResponse, parseTranslatedSubtitles } from '../utils/subtitleParser';
import { convertAudioForGemini, isAudioFormatSupportedByGemini } from '../utils/audioConverter';
import { getLanguageCode } from '../utils/languageUtils';
import i18n from '../i18n/i18n';
import {
    createSubtitleSchema,
    createTranslationSchema,
    createConsolidationSchema,
    createSummarizationSchema,
    addResponseSchema
} from '../utils/schemaUtils';
import { getTranscriptionRules } from '../utils/transcriptionRulesStore';

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
        prompt: `You are an expert transcriber. Your task is to transcribe the primary spoken content in this ${'{contentType}'}. Ignore non-essential background noise and periods of silence. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed text (1-2 sentences max). For example: [00m30s000ms - 00m35s500ms] This is the transcribed speech. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted transcript lines. Do not include any headers, summaries, introductions, or any other text whatsoever.

IMPORTANT: If there is no speech or spoken content in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'extract-text',
        title: 'Extract text',
        prompt: `Your task is to extract only the visible text and/or hardcoded subtitles appearing on screen within this ${'{contentType}'}. Completely ignore all audio content. Format the output as a sequential transcript showing exactly when the text appears and disappears. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Extracted on-screen text (1-2 lines/sentences max). For example: [00m30s000ms - 00m35s500ms] This text appeared on screen. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted text entries with their timestamps. Provide absolutely no other text, headers, or explanations.

IMPORTANT: If there is no visible text in the video, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    // --- Replaced 'focus-speech' with two specific presets ---
    {
        id: 'focus-spoken-words', // New ID
        title: 'Focus on Spoken Words', // New Title
        // Prompt modified to EXCLUDE lyrics
        prompt: `Focus exclusively on the spoken words (dialogue, narration) in this ${'{contentType}'}. Transcribe ONLY the audible speech. Explicitly ignore any song lyrics, background music, on-screen text, and non-speech sounds. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed spoken words (1-2 sentences max). For example: [00m30s000ms - 00m35s500ms] This is the spoken dialogue. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted transcript lines of spoken words, with no extra text, headers, or explanations.

IMPORTANT: If there is no spoken dialogue in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'focus-lyrics', // New ID
        title: 'Focus on Lyrics', // New Title
        // Prompt created to INCLUDE ONLY lyrics
        prompt: `Focus exclusively on the song lyrics sung in this ${'{contentType}'}. Transcribe ONLY the audible lyrics. Explicitly ignore any spoken words (dialogue, narration), background music without vocals, on-screen text, and non-lyrical sounds. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed lyrics (1-2 lines/sentences max). For example: [00m45s100ms - 00m50s250ms] These are the lyrics being sung. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted transcript lines of lyrics, with no extra text, headers, or explanations.

IMPORTANT: If there are no sung lyrics in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    // --- End of replaced presets ---
    {
        id: 'describe-video',
        title: 'Describe video',
        prompt: `Describe the significant visual events, actions, and scene changes occurring in this ${'{contentType}'} in chronological order. Focus solely on what is visually happening on screen. Format the output as a descriptive log. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Visual description (1-2 sentences max). For example: [00m30s000ms - 00m35s500ms] A person walks across the screen. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted descriptions with their timestamps. Do not include any audio transcription, headers, or other commentary.

IMPORTANT: If the video is blank or has no significant visual content, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'translate-vietnamese',
        title: 'Translate directly',
        prompt: `Identify the spoken language(s) in this ${'{contentType}'} and translate the speech directly into TARGET_LANGUAGE. If multiple languages are spoken, translate all spoken segments into TARGET_LANGUAGE. Format the output as a sequential transcript of the translation. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] translated text (1-2 translated sentences max). For example: [00m30s000ms - 00m35s500ms] This is the translated text. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted translation lines with timestamps. Do not include the original language transcription, headers, or any other text.

IMPORTANT: If there is no speech in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
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

    // Get the transcription rules if available
    const transcriptionRules = getTranscriptionRules();

    // Base prompt (either custom or default)
    let basePrompt;
    if (customPrompt && customPrompt.trim() !== '') {
        basePrompt = customPrompt.replace('{contentType}', contentType);
    } else {
        basePrompt = PROMPT_PRESETS[0].prompt.replace('{contentType}', contentType);
    }

    // If we have transcription rules, append them to the prompt
    if (transcriptionRules) {
        let rulesText = '\n\nAdditional transcription rules to follow:\n';

        // Add atmosphere if available
        if (transcriptionRules.atmosphere) {
            rulesText += `\n- Atmosphere: ${transcriptionRules.atmosphere}\n`;
        }

        // Add terminology if available
        if (transcriptionRules.terminology && transcriptionRules.terminology.length > 0) {
            rulesText += '\n- Terminology and Proper Nouns:\n';
            transcriptionRules.terminology.forEach(term => {
                rulesText += `  * ${term.term}: ${term.definition}\n`;
            });
        }

        // Add speaker identification if available
        if (transcriptionRules.speakerIdentification && transcriptionRules.speakerIdentification.length > 0) {
            rulesText += '\n- Speaker Identification:\n';
            transcriptionRules.speakerIdentification.forEach(speaker => {
                rulesText += `  * ${speaker.speakerId}: ${speaker.description}\n`;
            });
        }

        // Add formatting conventions if available
        if (transcriptionRules.formattingConventions && transcriptionRules.formattingConventions.length > 0) {
            rulesText += '\n- Formatting and Style Conventions:\n';
            transcriptionRules.formattingConventions.forEach(convention => {
                rulesText += `  * ${convention}\n`;
            });
        }

        // Add spelling and grammar rules if available
        if (transcriptionRules.spellingAndGrammar && transcriptionRules.spellingAndGrammar.length > 0) {
            rulesText += '\n- Spelling, Grammar, and Punctuation:\n';
            transcriptionRules.spellingAndGrammar.forEach(rule => {
                rulesText += `  * ${rule}\n`;
            });
        }

        // Add relationships if available
        if (transcriptionRules.relationships && transcriptionRules.relationships.length > 0) {
            rulesText += '\n- Relationships and Social Hierarchy:\n';
            transcriptionRules.relationships.forEach(relationship => {
                rulesText += `  * ${relationship}\n`;
            });
        }

        // Add additional notes if available
        if (transcriptionRules.additionalNotes && transcriptionRules.additionalNotes.length > 0) {
            rulesText += '\n- Additional Notes:\n';
            transcriptionRules.additionalNotes.forEach(note => {
                rulesText += `  * ${note}\n`;
            });
        }

        // Append the rules to the base prompt
        return basePrompt + rulesText;
    }

    // Return the base prompt if no rules are available
    return basePrompt;
};

export const callGeminiApi = async (input, inputType) => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    const MODEL = localStorage.getItem('gemini_model') || "gemini-2.0-flash";

    let requestData = {
        model: MODEL,
        contents: []
    };

    // Always use structured output
    requestData = addResponseSchema(requestData, createSubtitleSchema());
    console.log('Using structured output with schema:', JSON.stringify(requestData));

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

        // Check if the response contains empty subtitles
        if (data?.candidates?.[0]?.content?.parts?.[0]?.structuredJson) {
            const structuredJson = data.candidates[0].content.parts[0].structuredJson;
            if (Array.isArray(structuredJson)) {
                let emptyCount = 0;
                for (const item of structuredJson) {
                    if (item.startTime === '00m00s000ms' &&
                        item.endTime === '00m00s000ms' &&
                        (!item.text || item.text.trim() === '')) {
                        emptyCount++;
                    }
                }

                if (emptyCount > 0 && emptyCount / structuredJson.length > 0.9) {
                    console.warn(`Found ${emptyCount} empty subtitles out of ${structuredJson.length}. The audio may not contain any speech or the model failed to transcribe it.`);

                    if (emptyCount === structuredJson.length) {
                        throw new Error('No speech detected in the audio. The model returned empty subtitles.');
                    }
                }
            }
        }

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
    // Count the number of subtitles by counting the [n] markers
    const subtitleCount = (subtitleText.match(/\[\d+\]/g) || []).length;

    return `Translate the following ${subtitleCount} subtitle texts to ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1. KEEP the [n] numbering at the beginning of each line exactly as is.
2. ONLY translate the text content after the [n] marker.
3. DO NOT add any timestamps, SRT formatting, or other formatting.
4. DO NOT include any explanations, comments, or additional text in your response.
5. DO NOT include any SRT entry numbers, timestamps, or formatting in your translations.
6. DO NOT include quotes around your translations.
7. MAINTAIN exactly ${subtitleCount} numbered lines in the same order.
8. Each line in your response should correspond to the same numbered line in the input.
9. If a line is empty after the [n] marker, keep it empty in your response.

Format your response exactly like this:
[1] Translated text for first subtitle
[2] Translated text for second subtitle
...
[${subtitleCount}] Translated text for last subtitle

Here are the ${subtitleCount} subtitle texts to translate:\n\n${subtitleText}`;
};

export const getDefaultConsolidatePrompt = (subtitlesText) => {
    return `I have a collection of subtitles from a video or audio. Please convert these into a coherent document, organizing the content naturally based on the context. Maintain the original meaning but improve flow and readability.

IMPORTANT: Your response should ONLY contain the consolidated document text as plain text.
DO NOT include any explanations, comments, headers, JSON formatting, or additional text in your response.
DO NOT structure your response as JSON with title and content fields.
DO NOT use markdown formatting.
Just return the plain text of the consolidated document.

Here are the subtitles:\n\n${subtitlesText}`;
};

export const getDefaultSummarizePrompt = (subtitlesText) => {
    return `I have a collection of subtitles from a video or audio. Please create a concise summary of the main points and key information. The summary should be about 1/3 the length of the original text but capture all essential information.

IMPORTANT: Your response should ONLY contain the summary text as plain text.
DO NOT include any explanations, comments, headers, JSON formatting, or additional text in your response.
DO NOT structure your response as JSON with title and content fields.
DO NOT use markdown formatting.
Just return the plain text of the summary.

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
    // Only create and store the map if we're not in a chunked translation (splitDuration=0)
    // This prevents overwriting the complete map when processing individual chunks
    if (splitDuration === 0 && !localStorage.getItem('original_subtitles_map')) {
        const originalSubtitlesMap = {};
        subtitles.forEach((sub, index) => {
            // Ensure each subtitle has a unique ID
            const id = sub.id || index + 1;
            // Store the subtitle with its ID and index for reference
            originalSubtitlesMap[id] = {
                ...sub,
                id: id,  // Ensure ID is set
                index: index  // Store the index for order-based matching
            };
        });

        // Store the original subtitles map in localStorage for reference
        console.log('Storing original subtitles map with', Object.keys(originalSubtitlesMap).length, 'entries');
        localStorage.setItem('original_subtitles_map', JSON.stringify(originalSubtitlesMap));
    } else if (splitDuration === 0) {
        console.log('Using existing original subtitles map from localStorage');
    }

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

    // Format subtitles as numbered text lines for Gemini (text only, no timestamps)
    const subtitleText = subtitles.map((sub, index) => `[${index + 1}] ${sub.text}`).join('\n');

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

        // Create request data with structured output
        let requestData = {
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
        };

        // Always use structured output
        requestData = addResponseSchema(requestData, createTranslationSchema());
        console.log('Using structured output for translation with schema:', JSON.stringify(requestData));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: signal // Add the AbortController signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('Raw translation response:', JSON.stringify(data).substring(0, 500) + '...');

        // Process the translation response
        let translatedTexts = [];
        let retryCount = 0;
        const maxRetries = 10;

        // Function to process the response and extract translated texts
        const processResponse = (responseData) => {
            // Check if this is a structured JSON response
            if (responseData.candidates?.[0]?.content?.parts?.[0]?.structuredJson) {
                console.log('Received structured JSON translation response');
                const structuredJson = responseData.candidates[0].content.parts[0].structuredJson;

                // If it's an array of translations
                if (Array.isArray(structuredJson)) {
                    return structuredJson.map(item => item.text || '').filter(text => text !== undefined);
                }
                // If it has a translations array property
                else if (structuredJson.translations && Array.isArray(structuredJson.translations)) {
                    return structuredJson.translations.map(item => item.text || '').filter(text => text !== undefined);
                }
            }

            // Handle text response
            const translatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (translatedText) {
                // Log the full response for debugging
                console.log('Full translation text response:', translatedText);

                // Check if the response is a JSON array
                if (translatedText.trim().startsWith('[') && translatedText.trim().endsWith(']')) {
                    try {
                        // Try to parse as JSON
                        const jsonArray = JSON.parse(translatedText);
                        if (Array.isArray(jsonArray)) {
                            console.log('Detected JSON array format with', jsonArray.length, 'items');
                            // Return the array items directly
                            return jsonArray.map(item => {
                                // Remove any quotes if the item is a string
                                return typeof item === 'string' ? item.replace(/^"|"$/g, '') : item;
                            });
                        }
                    } catch (e) {
                        console.log('Failed to parse as JSON array, continuing with text processing');
                    }
                }

                // Split the text by lines and extract the text after the [n] marker
                const lines = translatedText.split('\n').map(line => line.trim());
                const translatedLines = [];

                // Log the number of lines for debugging
                console.log(`Number of lines in response: ${lines.length}`);
                console.log(`First few lines: ${lines.slice(0, 5).join('\n')}`);
                console.log(`Last few lines: ${lines.slice(-5).join('\n')}`);

                // Check for and remove any header or footer lines that might be causing the n+2 issue
                let startIndex = 0;
                let endIndex = lines.length;

                // Look for header lines that don't match the [n] format
                while (startIndex < lines.length && !lines[startIndex].match(/^\[(\d+)\]\s*.*$/)) {
                    console.log(`Skipping header line: ${lines[startIndex]}`);
                    startIndex++;
                }

                // Look for footer lines that don't match the [n] format
                while (endIndex > startIndex && !lines[endIndex - 1].match(/^\[(\d+)\]\s*.*$/)) {
                    console.log(`Skipping footer line: ${lines[endIndex - 1]}`);
                    endIndex--;
                }

                // Process only the lines that match our expected format
                const filteredLines = lines.slice(startIndex, endIndex);
                console.log(`After filtering headers/footers: ${filteredLines.length} lines`);

                // Process each line to extract the text after the [n] marker
                for (const line of filteredLines) {
                    // Skip empty lines
                    if (!line) continue;

                    // Match the [n] marker and extract the text after it
                    const match = line.match(/^\[(\d+)\]\s*(.*)$/);
                    if (match) {
                        const index = parseInt(match[1]) - 1; // Convert to 0-based index
                        const text = match[2].trim();

                        // Store the translation at the correct index
                        if (index >= 0) {
                            // Ensure the array is big enough
                            while (translatedLines.length <= index) {
                                translatedLines.push('');
                            }
                            translatedLines[index] = text;
                        }
                    } else {
                        // If the line doesn't match the expected format, log it but don't add it
                        console.log(`Skipping line with unexpected format: ${line}`);
                    }
                }

                return translatedLines;
            }

            return [];
        };

        // Try to process the response
        translatedTexts = processResponse(data);

        // Check if we have the correct number of translations
        while (translatedTexts.length !== subtitles.length && retryCount < maxRetries) {
            console.warn(`Translation count mismatch: got ${translatedTexts.length}, expected ${subtitles.length}. Retrying (${retryCount + 1}/${maxRetries})...`);
            retryCount++;

            // Special handling for the n+2 case which happens consistently
            if (translatedTexts.length === subtitles.length + 2) {
                console.log('Detected the n+2 pattern - removing the last two entries');
                // Remove the last two entries which are likely extra information or commentary
                translatedTexts = translatedTexts.slice(0, subtitles.length);
                console.log(`After removing last two entries: ${translatedTexts.length} translations`);
                continue;
            }

            // Try to fix the response by splitting or combining
            if (translatedTexts.length < subtitles.length) {
                // We have fewer translations than subtitles
                // Try to split longer translations
                const newTranslatedTexts = [];
                let deficit = subtitles.length - translatedTexts.length;

                for (let i = 0; i < translatedTexts.length && deficit > 0; i++) {
                    const text = translatedTexts[i];
                    if (text.length > 50) { // Only split longer texts
                        const parts = text.split(/[.!?]\s+/);
                        if (parts.length > 1) {
                            const midpoint = Math.floor(parts.length / 2);
                            const firstHalf = parts.slice(0, midpoint).join('. ') + '.';
                            const secondHalf = parts.slice(midpoint).join('. ');
                            newTranslatedTexts.push(firstHalf);
                            newTranslatedTexts.push(secondHalf);
                            deficit--;
                            continue;
                        }
                    }
                    newTranslatedTexts.push(text);
                }

                if (newTranslatedTexts.length > translatedTexts.length) {
                    translatedTexts = newTranslatedTexts;
                    continue;
                }
            } else if (translatedTexts.length > subtitles.length) {
                // We have more translations than subtitles
                // First, check if we can just truncate the array (if the extra entries are at the end)
                if (translatedTexts.length > subtitles.length) {
                    const truncatedTexts = translatedTexts.slice(0, subtitles.length);
                    console.log(`Truncating ${translatedTexts.length} translations to ${truncatedTexts.length}`);
                    translatedTexts = truncatedTexts;
                    continue;
                }

                // If truncation doesn't work, try to combine shorter translations
                const newTranslatedTexts = [];
                let i = 0;
                while (i < translatedTexts.length) {
                    if (i < translatedTexts.length - 1 &&
                        translatedTexts[i].length + translatedTexts[i+1].length < 100) {
                        newTranslatedTexts.push(`${translatedTexts[i]} ${translatedTexts[i+1]}`);
                        i += 2;
                    } else {
                        newTranslatedTexts.push(translatedTexts[i]);
                        i++;
                    }
                }

                if (newTranslatedTexts.length < translatedTexts.length) {
                    translatedTexts = newTranslatedTexts;
                    continue;
                }
            }

            // If we couldn't fix it by splitting/combining, try again with the API
            try {
                // Retry the translation with a more explicit prompt
                const retryPrompt = `Translate the following ${subtitles.length} subtitle texts to ${targetLanguage}.

IMPORTANT: Your response MUST contain EXACTLY ${subtitles.length} numbered lines in the format [n] translated text.
Keep the [n] numbering exactly as in the input.
Do not skip any numbers or add any extra text.
DO NOT include any SRT entry numbers, timestamps, or formatting in your translations.
DO NOT include quotes around your translations.
DO NOT add any timestamps, SRT formatting, or other formatting.

${subtitleText}`;

                const retryRequestData = {
                    contents: [
                        {
                            role: "user",
                            parts: [
                                { text: retryPrompt }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        topK: 32,
                        topP: 0.95,
                        maxOutputTokens: 65536,
                    },
                };

                const retryResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(retryRequestData),
                    signal: signal
                });

                if (!retryResponse.ok) {
                    throw new Error(`Retry failed with status ${retryResponse.status}`);
                }

                const retryData = await retryResponse.json();
                translatedTexts = processResponse(retryData);
            } catch (retryError) {
                console.error('Translation retry failed:', retryError);
                break; // Exit the retry loop if the API call fails
            }
        }

        // If we still don't have the right number of translations after all retries
        if (translatedTexts.length !== subtitles.length) {
            console.error(`Failed to get the correct number of translations after ${maxRetries} retries. Got ${translatedTexts.length}, expected ${subtitles.length}.`);
            throw new Error(`Translation failed: received ${translatedTexts.length} translations but expected ${subtitles.length}. Please try again.`);
        }

        // Create translated subtitles by combining original timing with translated text
        const translatedSubtitles = subtitles.map((originalSub, index) => {
            return {
                id: originalSub.id || index + 1,
                start: originalSub.start,
                end: originalSub.end,
                startTime: originalSub.startTime,
                endTime: originalSub.endTime,
                text: translatedTexts[index] || originalSub.text, // Fallback to original text if no translation
                originalId: originalSub.id || index + 1,
                language: getLanguageCode(targetLanguage)
            };
        });

        console.log('Created', translatedSubtitles.length, 'translated subtitles');
        if (translatedSubtitles.length > 0) {
            console.log('First translated subtitle:', JSON.stringify(translatedSubtitles[0]));
            console.log('Last translated subtitle:', JSON.stringify(translatedSubtitles[translatedSubtitles.length - 1]));
        }

        // Remove this controller from the map after successful response
        activeAbortControllers.delete(requestId);
        return translatedSubtitles;
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
 * @param {number} splitDuration - Duration in minutes for each chunk (0 = no split)
 * @returns {Promise<string>} - Completed document text
 */
export const completeDocument = async (subtitlesText, model = 'gemini-2.0-flash', customPrompt = null, splitDuration = 0) => {
    if (!subtitlesText || subtitlesText.trim() === '') {
        throw new Error('No text to process');
    }

    // If splitDuration is specified and not 0, split text into chunks
    if (splitDuration > 0) {
        console.log(`Splitting document into chunks of ${splitDuration} minutes`);
        // Dispatch event to update UI with status
        window.dispatchEvent(new CustomEvent('consolidation-status', {
            detail: { message: i18n.t('consolidation.splittingText', 'Splitting text into chunks of {{duration}} minutes', {
                duration: splitDuration
            }) }
        }));
        return await completeDocumentByChunks(subtitlesText, model, customPrompt, splitDuration);
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

        // Create request data with structured output
        let requestData = {
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
        };

        // Always use structured output
        requestData = addResponseSchema(requestData, createConsolidationSchema());
        console.log('Using structured output for consolidation with schema:', JSON.stringify(requestData));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: signal // Add the AbortController signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // Check if this is a structured JSON response
        if (data.candidates[0]?.content?.parts[0]?.structuredJson) {
            console.log('Received structured JSON document response');
            const structuredJson = data.candidates[0].content.parts[0].structuredJson;
            console.log('Structured JSON content:', JSON.stringify(structuredJson).substring(0, 200) + '...');

            // Convert structured JSON to plain text
            if (typeof structuredJson === 'string') {
                return structuredJson;
            } else if (typeof structuredJson === 'object') {
                // Special handling for title+content format
                if (structuredJson.title && structuredJson.content) {
                    console.log('Found title and content properties in structured JSON');
                    // Format as a proper document with title and content
                    return `${structuredJson.title}\n\n${structuredJson.content}`;
                }
                // If it's an object with a text or content property, use that
                else if (structuredJson.content) {
                    console.log('Found content property in structured JSON');
                    return structuredJson.content;
                } else if (structuredJson.text) {
                    console.log('Found text property in structured JSON');
                    return structuredJson.text;
                } else if (structuredJson.document) {
                    console.log('Found document property in structured JSON');
                    return structuredJson.document;
                } else {
                    // Otherwise, stringify it and extract plain text
                    console.log('No direct text property found, extracting from object properties');
                    // Extract any text fields from the JSON
                    const textFields = [];
                    const extractText = (obj, key = null) => {
                        if (!obj) return;
                        if (typeof obj === 'string') {
                            // Skip short strings that are likely field names
                            if (obj.length > 10 || key === 'title' || key === 'content' || key === 'text') {
                                textFields.push(obj);
                            }
                        } else if (Array.isArray(obj)) {
                            obj.forEach(item => extractText(item));
                        } else if (typeof obj === 'object') {
                            Object.entries(obj).forEach(([k, value]) => extractText(value, k));
                        }
                    };
                    extractText(structuredJson);

                    if (textFields.length > 0) {
                        console.log(`Found ${textFields.length} text fields in structured JSON`);
                        return textFields.join('\n\n');
                    } else {
                        // If no text fields found, return the stringified JSON as a last resort
                        console.log('No text fields found, returning stringified JSON');
                        return JSON.stringify(structuredJson, null, 2);
                    }
                }
            }
        }

        // Handle text response
        let completedText = data.candidates[0]?.content?.parts[0]?.text;

        if (!completedText) {
            throw new Error('No completed document returned from Gemini');
        }

        // Check if the response contains structured output and extract plain text if needed
        if (completedText.includes('```json') ||
            (completedText.includes('```') && completedText.includes('```') && completedText.trim().startsWith('```')) ||
            (completedText.includes('{"') && completedText.includes('"}') && completedText.trim().startsWith('{')) ||
            (completedText.includes('# ') && completedText.includes('## ') && completedText.trim().startsWith('#'))) {

            console.log('Detected structured output in consolidation response, extracting plain text...');

            // Try to parse as JSON first if it looks like JSON
            if ((completedText.includes('{"') && completedText.includes('"}')) ||
                (completedText.includes('```json') && completedText.includes('```'))) {
                try {
                    // Extract JSON from code blocks if present
                    let jsonText = completedText;
                    const jsonMatch = completedText.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (jsonMatch && jsonMatch[1]) {
                        jsonText = jsonMatch[1].trim();
                    }

                    // Try to parse the JSON
                    const jsonData = JSON.parse(jsonText);
                    console.log('Successfully parsed text as JSON');

                    // Extract content from the JSON
                    if (jsonData.content) {
                        console.log('Found content property in parsed JSON');
                        return jsonData.content;
                    } else if (jsonData.text) {
                        console.log('Found text property in parsed JSON');
                        return jsonData.text;
                    } else if (jsonData.document) {
                        console.log('Found document property in parsed JSON');
                        return jsonData.document;
                    } else if (jsonData.title && jsonData.content) {
                        console.log('Found title and content properties in parsed JSON');
                        return `${jsonData.title}\n\n${jsonData.content}`;
                    } else {
                        // Extract text fields from the JSON object
                        const textFields = [];
                        const extractText = (obj, key = null) => {
                            if (!obj) return;
                            if (typeof obj === 'string') {
                                if (obj.length > 10 || key === 'title' || key === 'content' || key === 'text') {
                                    textFields.push(obj);
                                }
                            } else if (Array.isArray(obj)) {
                                obj.forEach(item => extractText(item));
                            } else if (typeof obj === 'object') {
                                Object.entries(obj).forEach(([k, value]) => extractText(value, k));
                            }
                        };
                        extractText(jsonData);

                        if (textFields.length > 0) {
                            console.log(`Found ${textFields.length} text fields in parsed JSON`);
                            return textFields.join('\n\n');
                        }
                    }
                } catch (error) {
                    console.log('Failed to parse as JSON, falling back to text extraction', error);
                }
            }

            // If JSON parsing failed or wasn't applicable, selectively clean the text
            let cleanedText = completedText;

            // Remove markdown code blocks but preserve their content
            cleanedText = cleanedText.replace(/```(?:json|javascript|html|css|[a-z]*)\s*([\s\S]*?)```/g, '$1');

            // Remove markdown headers but keep the text
            cleanedText = cleanedText.replace(/#+\s+(.*?)\n/g, '$1\n');

            // Only remove JSON-like structures if they appear to be examples, not the main content
            if (cleanedText.includes('Example:') || cleanedText.includes('```json')) {
                cleanedText = cleanedText.replace(/\{[\s\S]*?\}/g, '');
            }

            // Remove markdown formatting characters but preserve the text
            cleanedText = cleanedText.replace(/[\*\#\`\[\]\(\)\|\>]/g, '');

            // Normalize whitespace
            cleanedText = cleanedText.replace(/\n\s*\n/g, '\n\n');

            // If after all this cleaning we have very little text left, return the original
            if (cleanedText.trim().length < completedText.trim().length * 0.3) {
                console.log('Cleaned text is too short, returning original text');
                return completedText;
            }

            return cleanedText.trim();
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
/**
 * Split text into chunks based on approximate word count and process each chunk
 * @param {string} subtitlesText - Plain text content from subtitles
 * @param {string} model - Gemini model to use
 * @param {string} customPrompt - Optional custom prompt to use
 * @param {number} splitDuration - Duration in minutes for each chunk
 * @returns {Promise<string>} - Completed document text with all chunks combined
 */
const completeDocumentByChunks = async (subtitlesText, model, customPrompt, splitDuration) => {
    // Estimate words per minute for reading (average speaking rate)
    const WORDS_PER_MINUTE = 150;

    // Calculate approximate word count per chunk based on duration
    const wordsPerChunk = WORDS_PER_MINUTE * splitDuration;

    // Split text into words
    const words = subtitlesText.split(/\s+/);

    // Group words into chunks
    const chunks = [];
    let currentChunk = [];

    for (let i = 0; i < words.length; i++) {
        currentChunk.push(words[i]);

        // Start a new chunk when we reach the word limit
        if (currentChunk.length >= wordsPerChunk && i < words.length - 1) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
        }
    }

    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    console.log(`Split text into ${chunks.length} chunks`);

    // Dispatch event to update UI with status
    const splitMessage = i18n.t('consolidation.splitComplete', 'Split text into {{chunks}} chunks', {
        chunks: chunks.length
    });
    window.dispatchEvent(new CustomEvent('consolidation-status', {
        detail: { message: splitMessage }
    }));

    // Process each chunk
    const processedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Dispatch event to update UI with status
        const chunkMessage = i18n.t('consolidation.processingChunk', 'Processing chunk {{current}}/{{total}}', {
            current: i + 1,
            total: chunks.length
        });
        window.dispatchEvent(new CustomEvent('consolidation-status', {
            detail: { message: chunkMessage }
        }));

        try {
            // Call completeDocument with the current chunk, but with splitDuration=0 to avoid infinite recursion
            const processedChunk = await completeDocument(chunk, model, customPrompt, 0);
            processedChunks.push(processedChunk);
        } catch (error) {
            console.error(`Error processing chunk ${i + 1}:`, error);
            // If a chunk fails, add the original text to maintain the structure
            processedChunks.push(`[Processing failed] ${chunk.substring(0, 100)}...`);
        }
    }

    // Dispatch event to update UI with completion status
    const completionMessage = i18n.t('consolidation.processingComplete', 'Processing completed for all {{count}} chunks', {
        count: chunks.length
    });
    window.dispatchEvent(new CustomEvent('consolidation-status', {
        detail: { message: completionMessage }
    }));

    // Combine all processed chunks
    console.log(`Combining ${processedChunks.length} processed chunks`);

    // Check if any chunks are empty or very short
    const validChunks = processedChunks.filter(chunk => chunk && chunk.trim().length > 10);
    if (validChunks.length < processedChunks.length) {
        console.log(`Filtered out ${processedChunks.length - validChunks.length} empty or very short chunks`);
    }

    // If we have no valid chunks, return a message
    if (validChunks.length === 0) {
        return 'The consolidation process did not produce any valid output. Please try again with different settings.';
    }

    // Process each chunk to extract content
    const processedTextChunks = validChunks.map(chunk => {
        console.log('Processing chunk:', chunk.substring(0, 100) + '...');

        // Check if the chunk looks like JSON
        if (chunk.trim().startsWith('{') && chunk.trim().endsWith('}')) {
            try {
                // Try to parse as JSON
                const jsonData = JSON.parse(chunk);
                console.log('Successfully parsed chunk as JSON with keys:', Object.keys(jsonData).join(', '));

                // Extract content field if it exists
                if (jsonData.content) {
                    console.log('Extracted content field from JSON');
                    return jsonData.content;
                } else if (jsonData.text) {
                    console.log('Extracted text field from JSON');
                    return jsonData.text;
                } else if (jsonData.document) {
                    console.log('Extracted document field from JSON');
                    return jsonData.document;
                } else {
                    // If no content field, stringify the entire object
                    console.log('No content field found in JSON, using entire object');
                    return JSON.stringify(jsonData);
                }
            } catch (error) {
                console.log('Failed to parse as JSON:', error.message);
                // If parsing fails, return the original chunk
                return chunk;
            }
        }

        // Check for JSON code blocks
        const jsonBlockMatch = chunk.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
            try {
                const jsonData = JSON.parse(jsonBlockMatch[1].trim());
                console.log('Successfully parsed JSON code block');

                // Extract content field if it exists
                if (jsonData.content) {
                    console.log('Extracted content field from JSON code block');
                    return jsonData.content;
                } else if (jsonData.text) {
                    console.log('Extracted text field from JSON code block');
                    return jsonData.text;
                } else if (jsonData.document) {
                    console.log('Extracted document field from JSON code block');
                    return jsonData.document;
                } else {
                    // If no content field, use the entire JSON block content
                    return jsonBlockMatch[1].trim();
                }
            } catch (error) {
                console.log('Failed to parse JSON code block:', error.message);
                // If parsing fails, remove the code block markers
                return jsonBlockMatch[1].trim();
            }
        }

        // If not JSON, return the original chunk
        return chunk;
    });

    // Filter out any empty chunks after processing
    const nonEmptyChunks = processedTextChunks.filter(chunk => chunk && chunk.trim().length > 0);
    if (nonEmptyChunks.length === 0) {
        console.log('All chunks were empty after processing, returning original chunks');
        return validChunks.join('\n\n');
    }

    // Join the processed chunks into a single text
    console.log(`Joining ${nonEmptyChunks.length} processed chunks`);
    return nonEmptyChunks.join('\n\n');
};

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

        // Create request data with structured output
        let requestData = {
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
        };

        // Always use structured output
        requestData = addResponseSchema(requestData, createSummarizationSchema());
        console.log('Using structured output for summarization with schema:', JSON.stringify(requestData));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: signal // Add the AbortController signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // Check if this is a structured JSON response
        if (data.candidates[0]?.content?.parts[0]?.structuredJson) {
            console.log('Received structured JSON summary response');
            const structuredJson = data.candidates[0].content.parts[0].structuredJson;
            return structuredJson;
        }

        // Handle response - could be structured JSON or plain text
        let summarizedText;

        // Check if we have structured JSON response
        if (data.candidates[0]?.content?.parts[0]?.structuredJson) {
            const structuredJson = data.candidates[0].content.parts[0].structuredJson;
            console.log('Received structured JSON summary:', structuredJson);

            // Extract the summary text from the structured JSON
            if (structuredJson.summary) {
                // Just return the summary text as plain text
                summarizedText = structuredJson.summary;

                // Optionally add key points if available
                if (structuredJson.keyPoints && Array.isArray(structuredJson.keyPoints) && structuredJson.keyPoints.length > 0) {
                    summarizedText += '\n\nKey Points:\n';
                    structuredJson.keyPoints.forEach((point, index) => {
                        summarizedText += `\n${index + 1}. ${point}`;
                    });
                }
            } else {
                // Fallback to stringifying the JSON if no summary field
                console.warn('Structured JSON response missing summary field');
                summarizedText = JSON.stringify(structuredJson, null, 2);
            }
        } else {
            // Handle plain text response
            summarizedText = data.candidates[0]?.content?.parts[0]?.text;
        }

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

            // If this is a count mismatch error, try one more time with a more explicit prompt
            if (error.message && error.message.includes('received') && error.message.includes('expected')) {
                try {
                    console.log(`Retrying chunk ${i + 1} with more explicit prompt...`);
                    // Create a more explicit prompt for this chunk with numbered lines
                    const explicitPrompt = `Translate the following ${chunk.length} subtitle texts to ${targetLanguage}.

IMPORTANT: Your response MUST contain EXACTLY ${chunk.length} numbered lines in the format [n] translated text.
Keep the [n] numbering exactly as in the input.
Do not skip any numbers or add any extra text.
DO NOT include any SRT entry numbers, timestamps, or formatting in your translations.
DO NOT include quotes around your translations.
DO NOT add any timestamps, SRT formatting, or other formatting.

${chunk.map((sub, idx) => `[${idx + 1}] ${sub.text}`).join('\n')}`;

                    // Call translateSubtitles with the explicit prompt
                    const translatedChunk = await translateSubtitles(chunk, targetLanguage, model, explicitPrompt, 0);
                    translatedChunks.push(translatedChunk);
                    continue;
                } catch (retryError) {
                    console.error(`Retry for chunk ${i + 1} also failed:`, retryError);
                }
            }

            // If all retries fail, add the original subtitles to maintain the structure
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
    const result = translatedChunks.flat();

    // Log the result
    console.log(`Translation completed with ${result.length} total subtitles across ${chunks.length} chunks`);
    if (result.length > 0) {
        console.log('First translated subtitle:', JSON.stringify(result[0]));
        console.log('Last translated subtitle:', JSON.stringify(result[result.length - 1]));
    }

    return result;
};

export { callGeminiApi as transcribeVideo, callGeminiApi as transcribeAudio, callGeminiApi as transcribeYouTubeVideo, translateSubtitles };