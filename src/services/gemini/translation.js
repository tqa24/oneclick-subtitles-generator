/**
 * Translation functionality for Gemini API
 */

import { getLanguageCode } from '../../utils/languageUtils';
import i18n from '../../i18n/i18n';
import { createTranslationSchema, addResponseSchema } from '../../utils/schemaUtils';
import { getDefaultTranslationPrompt } from './promptManagement';
import { getTranscriptionRules } from '../../utils/transcriptionRulesStore';
import { createRequestController, removeRequestController } from './requestManagement';

/**
 * Translate subtitles to different language(s) while preserving timing
 * @param {Array} subtitles - Subtitles to translate
 * @param {string|Array} targetLanguage - Target language(s)
 * @param {string} model - Gemini model to use
 * @param {string|null} customPrompt - Custom prompt for translation
 * @param {number} splitDuration - Duration in minutes for each chunk (0 = no split)
 * @param {boolean} includeRules - Whether to include transcription rules in the prompt
 * @param {string|null} delimiter - Delimiter to use for multiple languages
 * @param {boolean} useParentheses - Whether to use parentheses for the second language
 *                                  For 2 languages, both delimiter and brackets can be used together
 *                                  For 3+ languages, only delimiter is used
 * @returns {Promise<Array>} - Array of translated subtitles
 */
export const translateSubtitles = async (subtitles, targetLanguage, model = 'gemini-2.0-flash', customPrompt = null, splitDuration = 0, includeRules = false, delimiter = ' ', useParentheses = false) => {
    // Determine if we're doing multi-language translation
    const isMultiLanguage = Array.isArray(targetLanguage) && targetLanguage.length > 0;

    // Store the target language(s) for reference
    localStorage.setItem('translation_target_language', isMultiLanguage ? JSON.stringify(targetLanguage) : targetLanguage);

    if (!subtitles || subtitles.length === 0) {
        throw new Error('No subtitles to translate');
    }

    // Get bracket style if using parentheses in single language mode
    let bracketStyle = ['(', ')'];
    if (!isMultiLanguage && useParentheses) {
        try {
            const savedStyle = localStorage.getItem('bracketStyle');
            if (savedStyle) {
                bracketStyle = JSON.parse(savedStyle);
            }
        } catch (error) {
            console.warn('Error loading bracket style:', error);
        }
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
        return await translateSubtitlesByChunks(subtitles, targetLanguage, model, customPrompt, splitDuration, includeRules, delimiter, useParentheses, bracketStyle);
    }

    // Format subtitles as text lines for Gemini (text only, no timestamps, no numbering)
    const subtitleText = subtitles.map(sub => sub.text).join('\n');

    // Create the prompt for translation
    let translationPrompt;
    if (customPrompt) {
        // Replace variables in the custom prompt
        translationPrompt = customPrompt
            .replace('{subtitlesText}', subtitleText)
            .replace('{targetLanguage}', isMultiLanguage ? targetLanguage.join(', ') : targetLanguage);
    } else {
        translationPrompt = getDefaultTranslationPrompt(subtitleText, targetLanguage, isMultiLanguage);
    }

    // If includeRules is true, append transcription rules to the prompt
    if (includeRules) {
        try {
            const transcriptionRules = getTranscriptionRules();

            if (transcriptionRules && Object.keys(transcriptionRules).length > 0) {
                console.log('Appending transcription rules to translation prompt');
                let rulesText = '\n\nIMPORTANT CONTEXT: Use the following rules and context from the video analysis to ensure consistent translation:\n';

                // Add atmosphere if available
                if (transcriptionRules.atmosphere) {
                    rulesText += `\n- Atmosphere/Context: ${transcriptionRules.atmosphere}\n`;
                }

                // Add terminology if available
                if (transcriptionRules.terminology && transcriptionRules.terminology.length > 0) {
                    rulesText += '\n- Terminology (maintain these terms consistently):\n';
                    transcriptionRules.terminology.forEach(term => {
                        rulesText += `  * ${term.term}: ${term.definition}\n`;
                    });
                }

                // Add speaker identification if available
                if (transcriptionRules.speakerIdentification && transcriptionRules.speakerIdentification.length > 0) {
                    rulesText += '\n- Speakers:\n';
                    transcriptionRules.speakerIdentification.forEach(speaker => {
                        rulesText += `  * ${speaker.speakerId}: ${speaker.description}\n`;
                    });
                }

                // Add formatting conventions if available
                if (transcriptionRules.formattingConventions && transcriptionRules.formattingConventions.length > 0) {
                    rulesText += '\n- Formatting Conventions:\n';
                    transcriptionRules.formattingConventions.forEach(convention => {
                        rulesText += `  * ${convention}\n`;
                    });
                }

                // Add additional notes if available
                if (transcriptionRules.additionalNotes && transcriptionRules.additionalNotes.length > 0) {
                    rulesText += '\n- Additional Notes:\n';
                    transcriptionRules.additionalNotes.forEach(note => {
                        rulesText += `  * ${note}\n`;
                    });
                }

                // Append the rules to the translation prompt
                translationPrompt += rulesText;
            } else {
                console.log('No transcription rules found to append to translation prompt');
            }
        } catch (error) {
            console.error('Error retrieving transcription rules:', error);
        }
    }

    // Create a unique ID for this request
    const { requestId, signal } = createRequestController();

    try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }

        // Use the model parameter passed to the function
        // This allows for model selection specific to translation
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
        requestData = addResponseSchema(requestData, createTranslationSchema(isMultiLanguage));
        console.log('Using structured output for translation with schema:', JSON.stringify(requestData));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: signal
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

                // For multi-language translation with the new schema
                if (isMultiLanguage && structuredJson.translations && Array.isArray(structuredJson.translations)) {
                    console.log('Processing multi-language translation response');

                    // Extract translations for each language
                    const languageTranslations = {};
                    structuredJson.translations.forEach(langData => {
                        if (langData.language && Array.isArray(langData.texts)) {
                            languageTranslations[langData.language] = langData.texts;
                        }
                    });

                    // Combine translations based on delimiter or parentheses
                    const combinedTranslations = [];
                    const languages = Object.keys(languageTranslations);

                    // Get the first language's translations as the base
                    const primaryLang = languages[0];
                    const primaryTexts = languageTranslations[primaryLang] || [];

                    // For each subtitle, combine translations from all languages
                    for (let i = 0; i < primaryTexts.length; i++) {
                        // Check if we have the new format with original and translated properties
                        const primaryItem = primaryTexts[i] || {};
                        let translatedText = '';

                        if (primaryItem.original !== undefined && primaryItem.translated !== undefined) {
                            // New format with original and translated properties
                            translatedText = primaryItem.translated;
                        } else {
                            // Old format with just the text
                            translatedText = primaryItem;
                        }

                        let combinedText = translatedText;

                        // If we have exactly one additional language and useParentheses is true
                        if (languages.length === 2 && useParentheses) {
                            const secondaryLang = languages[1];
                            const secondaryTexts = languageTranslations[secondaryLang] || [];
                            const secondaryItem = secondaryTexts[i] || {};

                            let secondaryTranslatedText = '';
                            if (secondaryItem.original !== undefined && secondaryItem.translated !== undefined) {
                                secondaryTranslatedText = secondaryItem.translated;
                            } else {
                                secondaryTranslatedText = secondaryItem;
                            }

                            if (secondaryTranslatedText) {
                                // For 2 languages with both options, use brackets and delimiter
                                if (delimiter && delimiter !== ' ') {
                                    combinedText += `${bracketStyle[0]}${secondaryTranslatedText}${bracketStyle[1]}`;
                                } else {
                                    combinedText += ` ${bracketStyle[0]}${secondaryTranslatedText}${bracketStyle[1]}`;
                                }
                            }
                        }
                        // Otherwise use the specified delimiter
                        else if (languages.length > 1 && delimiter) {
                            for (let j = 1; j < languages.length; j++) {
                                const lang = languages[j];
                                const texts = languageTranslations[lang] || [];
                                const secondaryItem = texts[i] || {};

                                let secondaryTranslatedText = '';
                                if (secondaryItem.original !== undefined && secondaryItem.translated !== undefined) {
                                    secondaryTranslatedText = secondaryItem.translated;
                                } else {
                                    secondaryTranslatedText = secondaryItem;
                                }

                                if (secondaryTranslatedText) {
                                    combinedText += `${delimiter}${secondaryTranslatedText}`;
                                }
                            }
                        }

                        combinedTranslations.push(combinedText);
                    }

                    return combinedTranslations;
                }

                // Original single language processing
                // If it's an array of translations with the new format (original + translated)
                if (Array.isArray(structuredJson)) {
                    return structuredJson.map(item => {
                        // Check if this is the new format with original and translated properties
                        if (item.original !== undefined && item.translated !== undefined) {
                            return useParentheses
                                ? `${item.original}${bracketStyle[0]}${item.translated}${bracketStyle[1]}`
                                : item.translated;
                        }
                        // Fall back to the old format or any other property that might contain the text
                        return item.text || item.translated || '';
                    }).filter(text => text !== undefined);
                }
                // If it has a translations array property (old format)
                else if (structuredJson.translations && Array.isArray(structuredJson.translations)) {
                    return structuredJson.translations.map(item => {
                        // Check if this is the new format with original and translated properties
                        if (item.original !== undefined && item.translated !== undefined) {
                            return useParentheses
                                ? `${item.original}${bracketStyle[0]}${item.translated}${bracketStyle[1]}`
                                : item.translated;
                        }
                        // Fall back to the old format
                        return item.text || '';
                    }).filter(text => text !== undefined);
                }
            }

            // Handle text response
            const translatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (translatedText) {
                // Log the full response for debugging
                console.log('Full translation text response:', translatedText);

                // Check if the response is a JSON object with translations array (multi-language format)
                if (isMultiLanguage && translatedText.includes('"translations"') && translatedText.includes('"language"') && translatedText.includes('"texts"')) {
                    try {
                        // Try to parse as JSON
                        const jsonObj = JSON.parse(translatedText);
                        if (jsonObj.translations && Array.isArray(jsonObj.translations)) {
                            console.log('Detected multi-language JSON format with', jsonObj.translations.length, 'languages');

                            // Extract translations for each language
                            const languageTranslations = {};
                            jsonObj.translations.forEach(langData => {
                                if (langData.language && Array.isArray(langData.texts)) {
                                    languageTranslations[langData.language] = langData.texts;
                                }
                            });

                            // Combine translations based on delimiter or parentheses
                            const combinedTranslations = [];
                            const languages = Object.keys(languageTranslations);

                            // Get the first language's translations as the base
                            const primaryLang = languages[0];
                            const primaryTexts = languageTranslations[primaryLang] || [];

                            // For each subtitle, combine translations from all languages
                            for (let i = 0; i < primaryTexts.length; i++) {
                                // Check if we have the new format with original and translated properties
                                const primaryItem = primaryTexts[i] || {};
                                let translatedText = '';

                                if (primaryItem.original !== undefined && primaryItem.translated !== undefined) {
                                    // New format with original and translated properties
                                    translatedText = primaryItem.translated;
                                } else {
                                    // Old format with just the text
                                    translatedText = primaryItem;
                                }

                                let combinedText = translatedText;

                                // If we have exactly one additional language and useParentheses is true
                                if (languages.length === 2 && useParentheses) {
                                    const secondaryLang = languages[1];
                                    const secondaryTexts = languageTranslations[secondaryLang] || [];
                                    const secondaryItem = secondaryTexts[i] || {};

                                    let secondaryTranslatedText = '';
                                    if (secondaryItem.original !== undefined && secondaryItem.translated !== undefined) {
                                        secondaryTranslatedText = secondaryItem.translated;
                                    } else {
                                        secondaryTranslatedText = secondaryItem;
                                    }

                                    if (secondaryTranslatedText) {
                                        // For 2 languages with both options, use brackets and delimiter
                                        if (delimiter && delimiter !== ' ') {
                                            combinedText += `${bracketStyle[0]}${secondaryTranslatedText}${bracketStyle[1]}`;
                                        } else {
                                            combinedText += ` ${bracketStyle[0]}${secondaryTranslatedText}${bracketStyle[1]}`;
                                        }
                                    }
                                }
                                // Otherwise use the specified delimiter
                                else if (languages.length > 1 && delimiter) {
                                    for (let j = 1; j < languages.length; j++) {
                                        const lang = languages[j];
                                        const texts = languageTranslations[lang] || [];
                                        const secondaryItem = texts[i] || {};

                                        let secondaryTranslatedText = '';
                                        if (secondaryItem.original !== undefined && secondaryItem.translated !== undefined) {
                                            secondaryTranslatedText = secondaryItem.translated;
                                        } else {
                                            secondaryTranslatedText = secondaryItem;
                                        }

                                        if (secondaryTranslatedText) {
                                            combinedText += `${delimiter}${secondaryTranslatedText}`;
                                        }
                                    }
                                }

                                combinedTranslations.push(combinedText);
                            }

                            return combinedTranslations;
                        }
                    } catch (e) {
                        console.log('Failed to parse as multi-language JSON:', e);
                    }
                }

                // Check if the response is a JSON array
                if (translatedText.trim().startsWith('[') && translatedText.trim().endsWith(']')) {
                    try {
                        // Try to parse as JSON
                        const jsonArray = JSON.parse(translatedText);
                        if (Array.isArray(jsonArray)) {
                            console.log('Detected JSON array format with', jsonArray.length, 'items');
                            // Return the array items directly
                            return jsonArray.map(item => {
                                // Check if this is the new format with original and translated properties
                                if (item && typeof item === 'object' && item.original !== undefined && item.translated !== undefined) {
                                    return useParentheses
                                        ? `${item.original}${bracketStyle[0]}${item.translated}${bracketStyle[1]}`
                                        : item.translated;
                                }
                                // Remove any quotes if the item is a string
                                return typeof item === 'string' ? item.replace(/^"|"$/g, '') : (item.text || item.translated || '');
                            });
                        }
                    } catch (e) {
                        console.log('Failed to parse as JSON array, continuing with text processing');
                    }
                }

                // Split the text by lines and remove empty lines
                const lines = translatedText.split('\n').map(line => line.trim()).filter(line => line.trim());

                // Log the number of lines for debugging
                console.log(`Number of lines in response: ${lines.length}`);
                console.log(`First few lines: ${lines.slice(0, 5).join('\n')}`);
                console.log(`Last few lines: ${lines.slice(-5).join('\n')}`);

                // No filtering of lines - we'll rely on the retry mechanism if the count is wrong
                return lines;
            }

            return [];
        };

        // Try to process the response
        translatedTexts = processResponse(data);

        // Check if we have the correct number of translations
        while (translatedTexts.length !== subtitles.length && retryCount < maxRetries) {
            console.warn(`Translation count mismatch: got ${translatedTexts.length}, expected ${subtitles.length}. Retrying (${retryCount + 1}/${maxRetries})...`);
            retryCount++;

            // No adjustments to the translations - we'll rely solely on the retry mechanism
            try {
                // Simplified retry prompt that focuses on the correct number of subtitles
                const retryPrompt = `Here is my request: ${translationPrompt} with ${subtitles.length} subtitle lines, but your last answer was incomplete which had ${translatedTexts.length}, please make it ${subtitles.length}`;

                // Use the same request structure as the original request
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

                // Always use structured output for retries too
                const schemaRequestData = addResponseSchema(retryRequestData, createTranslationSchema(isMultiLanguage));

                const retryResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(schemaRequestData),
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
                language: Array.isArray(targetLanguage) ? getLanguageCode(targetLanguage[0]) : getLanguageCode(targetLanguage)
            };
        });

        console.log('Created', translatedSubtitles.length, 'translated subtitles');
        if (translatedSubtitles.length > 0) {
            console.log('First translated subtitle:', JSON.stringify(translatedSubtitles[0]));
            console.log('Last translated subtitle:', JSON.stringify(translatedSubtitles[translatedSubtitles.length - 1]));
        }

        // Remove this controller from the map after successful response
        removeRequestController(requestId);
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
                removeRequestController(requestId);
            }
            throw error;
        }
    }
};

/**
 * Split subtitles into chunks based on duration and translate each chunk
 * @param {Array} subtitles - Subtitles to translate
 * @param {string|Array} targetLanguage - Target language(s)
 * @param {string} model - Gemini model to use
 * @param {string} customPrompt - Custom prompt for translation
 * @param {number} splitDuration - Duration in minutes for each chunk
 * @param {boolean} includeRules - Whether to include transcription rules in the prompt
 * @param {string|null} delimiter - Delimiter to use for multiple languages
 * @param {boolean} useParentheses - Whether to use parentheses for the second language
 *                                  For 2 languages, both delimiter and brackets can be used together
 *                                  For 3+ languages, only delimiter is used
 * @param {Array} bracketStyle - Custom bracket style for single language mode or dual language mode
 * @returns {Promise<Array>} - Array of translated subtitles
 */
const translateSubtitlesByChunks = async (subtitles, targetLanguage, model, customPrompt, splitDuration, includeRules = false, delimiter = ' ', useParentheses = false, bracketStyle = ['(', ')']) => {
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
            // Pass along all parameters to maintain consistency across chunks
            const translatedChunk = await translateSubtitles(chunk, targetLanguage, model, customPrompt, 0, includeRules, delimiter, useParentheses, bracketStyle);
            translatedChunks.push(translatedChunk);
        } catch (error) {
            console.error(`Error translating chunk ${i + 1}:`, error);

            // If this is a count mismatch error, try one more time with a simplified prompt
            if (error.message && error.message.includes('received') && error.message.includes('expected')) {
                try {
                    console.log(`Retrying chunk ${i + 1} with simplified prompt...`);
                    // Create a simplified retry prompt for this chunk
                    const originalPrompt = customPrompt || getDefaultTranslationPrompt(chunk.map(sub => sub.text).join('\n'), targetLanguage, Array.isArray(targetLanguage) && targetLanguage.length > 0);
                    const simplifiedPrompt = `Here is my request: ${originalPrompt} with ${chunk.length} subtitle lines, but your last answer was incomplete, please make it ${chunk.length}`;

                    // Call translateSubtitles with the simplified prompt
                    // Pass along all parameters to maintain consistency across chunks
                    const translatedChunk = await translateSubtitles(chunk, targetLanguage, model, simplifiedPrompt, 0, includeRules, delimiter, useParentheses, bracketStyle);
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
