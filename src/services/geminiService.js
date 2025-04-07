import { parseGeminiResponse } from '../utils/subtitleParser';

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
        const base64Data = await fileToBase64(input);
        const contentType = input.type.startsWith('video/') ? 'video' : 'audio';

        requestData.contents = [
            {
                role: "user",
                parts: [
                    { text: getTranscriptionPrompt(contentType) },
                    {
                        inlineData: {
                            mimeType: input.type,
                            data: base64Data
                        }
                    }
                ]
            }
        ];
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('Gemini API response:', data);

        return parseGeminiResponse(data);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
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
