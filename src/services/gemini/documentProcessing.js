/**
 * Document processing functionality for Gemini API
 * Handles document consolidation and summarization
 */

import i18n from '../../i18n/i18n';
import { getLanguageCode } from '../../utils/languageUtils';
import { createConsolidationSchema, createSummarizationSchema, addResponseSchema } from '../../utils/schemaUtils';
import { getDefaultConsolidatePrompt, getDefaultSummarizePrompt } from './promptManagement';
import { createRequestController, removeRequestController } from './requestManagement';

/**
 * Consolidate document from subtitles text
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
    const { requestId, signal } = createRequestController();

    try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Create the prompt for document completion
        let documentPrompt;

        // Try to detect the language of the subtitles
        // First check if we're using translated subtitles
        const translatedLanguage = localStorage.getItem('translation_target_language');

        // Get the source parameter indicating if we're using original or translated subtitles
        const source = localStorage.getItem('current_processing_source');

        // Determine the language based on the source
        let language = null;

        if (source === 'translated' && translatedLanguage) {
            // If we're using translated subtitles, use the target language of the translation
            language = translatedLanguage;
            console.log(`Using translated subtitles language: ${language}`);
        } else {
            // For original subtitles, try to detect the language from the first few lines
            // This is a simple approach - in a production environment, you might want to use
            // a more sophisticated language detection library
            try {
                // In a future enhancement, we could get a sample of the text for language detection
                // const sampleText = subtitlesText.substring(0, 500);
                console.log(`Attempting to detect language from original subtitles`);
                // For now, we'll rely on the language instruction in the prompt
                // A future enhancement could be to add actual language detection here
            } catch (error) {
                console.log(`Error detecting language: ${error.message}`);
            }
        }

        if (customPrompt) {
            // Replace variables in the custom prompt
            documentPrompt = customPrompt.replace('{subtitlesText}', subtitlesText);
        } else {
            documentPrompt = getDefaultConsolidatePrompt(subtitlesText, language);
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

        // Add language code to generation config if available
        if (language) {
            const languageCode = getLanguageCode(language);
            if (languageCode) {
                console.log(`Setting language code for consolidation: ${languageCode}`);
                requestData.generationConfig.stopSequences = [];
                // Note: Gemini doesn't have a direct language parameter, but we can use this approach
                // to help guide the model to maintain the correct language
            }
        }

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

            // Log the language information if available
            if (language) {
                console.log(`Expected consolidation language: ${language}`);
            }

            // Convert structured JSON to plain text
            if (typeof structuredJson === 'string') {
                return structuredJson;
            } else if (typeof structuredJson === 'object') {
                // Special handling for title+content format
                if (structuredJson.title && structuredJson.content) {
                    console.log('Found title and content properties in structured JSON');

                    // Check if the content appears to be in the expected language
                    if (language) {
                        console.log(`Verifying content is in expected language: ${language}`);
                        // In a future enhancement, we could add language detection here
                    }

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

        // Check if the response is a JSON array
        if (completedText.trim().startsWith('[') && completedText.trim().endsWith(']')) {
            try {
                // Try to parse as JSON
                const jsonArray = JSON.parse(completedText);
                if (Array.isArray(jsonArray)) {
                    console.log('Detected JSON array format with', jsonArray.length, 'items');
                    // Join the array items into a single text
                    return jsonArray.join('\n\n');
                }
            } catch (e) {
                console.log('Failed to parse as JSON array, continuing with text processing');
            }
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
        removeRequestController(requestId);

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
                removeRequestController(requestId);
            }
            throw error;
        }
    }
};

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
    const { requestId, signal } = createRequestController();

    try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Create the prompt for document summarization
        let summaryPrompt;

        // Try to detect the language of the subtitles
        // First check if we're using translated subtitles
        const translatedLanguage = localStorage.getItem('translation_target_language');

        // Get the source parameter indicating if we're using original or translated subtitles
        const source = localStorage.getItem('current_processing_source');

        // Determine the language based on the source
        let language = null;

        if (source === 'translated' && translatedLanguage) {
            // If we're using translated subtitles, use the target language of the translation
            language = translatedLanguage;
            console.log(`Using translated subtitles language: ${language}`);
        } else {
            // For original subtitles, try to detect the language from the first few lines
            // This is a simple approach - in a production environment, you might want to use
            // a more sophisticated language detection library
            try {
                // In a future enhancement, we could get a sample of the text for language detection
                // const sampleText = subtitlesText.substring(0, 500);
                console.log(`Attempting to detect language from original subtitles`);
                // For now, we'll rely on the language instruction in the prompt
                // A future enhancement could be to add actual language detection here
            } catch (error) {
                console.log(`Error detecting language: ${error.message}`);
            }
        }

        if (customPrompt) {
            // Replace variables in the custom prompt
            summaryPrompt = customPrompt.replace('{subtitlesText}', subtitlesText);
        } else {
            summaryPrompt = getDefaultSummarizePrompt(subtitlesText, language);
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

        // Add language code to generation config if available
        if (language) {
            const languageCode = getLanguageCode(language);
            if (languageCode) {
                console.log(`Setting language code for summarization: ${languageCode}`);
                requestData.generationConfig.stopSequences = [];
                // Note: Gemini doesn't have a direct language parameter, but we can use this approach
                // to help guide the model to maintain the correct language
            }
        }

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

            // Log the language information if available
            if (language) {
                console.log(`Expected summary language: ${language}`);
            }

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

                // Check if the summary appears to be in the expected language
                if (language) {
                    console.log(`Verifying summary is in expected language: ${language}`);
                    // In a future enhancement, we could add language detection here
                }

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

            // Check if the response is a JSON array
            if (summarizedText.trim().startsWith('[') && summarizedText.trim().endsWith(']')) {
                try {
                    // Try to parse as JSON
                    const jsonArray = JSON.parse(summarizedText);
                    if (Array.isArray(jsonArray)) {
                        console.log('Detected JSON array format with', jsonArray.length, 'items');
                        // Join the array items into a single text
                        summarizedText = jsonArray.join('\n\n');
                    }
                } catch (e) {
                    console.log('Failed to parse as JSON array, continuing with text processing');
                }
            }
        }

        if (!summarizedText) {
            throw new Error('No summary returned from Gemini');
        }

        // Remove this controller from the map after successful response
        removeRequestController(requestId);

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
                removeRequestController(requestId);
            }
            throw error;
        }
    }
};
