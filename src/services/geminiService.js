import { parseGeminiResponse } from '../utils/subtitleParser';

export const callGeminiApi = async (input, inputType) => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    // Get the model from localStorage or use default
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
                    { text: "Transcribe this video. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text." },
                    {
                        fileData: {
                            fileUri: input
                        }
                    }
                ]
            }
        ];
    } else if (inputType === 'video' || inputType === 'audio' || inputType === 'file-upload') {
        // For file-upload, treat it the same as video/audio files
        const base64Data = await fileToBase64(input);

        // Determine content type based on file MIME type
        const contentType = input.type.startsWith('video/') ? 'video' : 'audio';

        // Check if this is a video segment with time range metadata
        let transcriptionPrompt = `Transcribe this ${contentType}. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text.`;

        if (input.segmentStartTime !== undefined && input.segmentEndTime !== undefined) {
            const startMinutes = Math.floor(input.segmentStartTime / 60);
            const startSeconds = Math.floor(input.segmentStartTime % 60);
            const endMinutes = Math.floor(input.segmentEndTime / 60);
            const endSeconds = Math.floor(input.segmentEndTime % 60);

            transcriptionPrompt = `Transcribe this ${contentType} segment from ${startMinutes}:${startSeconds.toString().padStart(2, '0')} to ${endMinutes}:${endSeconds.toString().padStart(2, '0')}. IMPORTANT: Only focus on this specific time range. Ignore any content outside this range. Format the output as a transcript with BOTH start AND end timestamps for each line in the format [START_TIME - END_TIME] where times are in the format MMmSSsNNNms (minutes, seconds, milliseconds). For example: [0m30s000ms - 0m35s500ms] or [1m45s200ms - 1m50s000ms]. Each subtitle entry should be 1-2 sentences maximum. Return ONLY the transcript and no other text."`;
        }

        requestData.contents = [
            {
                role: "user",
                parts: [
                    { text: transcriptionPrompt },
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