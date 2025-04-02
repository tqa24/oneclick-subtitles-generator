import { parseGeminiResponse } from '../utils/subtitleParser';

export const callGeminiApi = async (input, inputType) => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    const MODEL = "gemini-2.5-pro-exp-03-25";
    
    let requestData = {
        model: MODEL,
        contents: []
    };

    if (inputType === 'youtube') {
        requestData.contents = [
            {
                role: "user",
                parts: [
                    { text: "Transcribe this video" },
                    { 
                        fileData: {
                            fileUri: input
                        }
                    }
                ]
            }
        ];
    } else if (inputType === 'video' || inputType === 'audio') {
        const base64Data = await fileToBase64(input);
        requestData.contents = [
            {
                role: "user",
                parts: [
                    { text: `Transcribe this ${inputType}` },
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