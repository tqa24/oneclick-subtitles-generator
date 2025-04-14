/**
 * Module for parsing translated subtitles
 */

import { parseStructuredJsonResponse } from './structuredJsonParser';
import { formatSecondsToSRTTime } from './timeUtils';

/**
 * Parse translated subtitles from Gemini response
 * @param {string|Object} response - The response from Gemini (text or structured JSON)
 * @returns {Array} - Array of subtitle objects
 */
export const parseTranslatedSubtitles = (response) => {
    console.log('Parsing translated subtitles, response type:', typeof response);

    // Check if this is a structured JSON response
    if (typeof response === 'object' && response?.candidates?.[0]?.content?.parts?.[0]?.structuredJson) {
        console.log('Found structuredJson in response');
        try {
            const result = parseStructuredJsonResponse(response);
            console.log('Parsed structured JSON response:', result ? result.length : 0, 'subtitles');
            if (result && result.length > 0) {
                return result;
            } else {
                console.warn('Structured JSON parsing returned no subtitles, falling back to text parsing');
            }
        } catch (error) {
            console.error('Error parsing structured JSON response:', error);
            console.log('Falling back to text parsing');
        }
    }

    // Try to parse the response as JSON if it's a string
    if (typeof response === 'string') {
        try {
            const jsonData = JSON.parse(response);
            console.log('Successfully parsed response string as JSON');

            // Check if it matches our expected format
            if (jsonData.translations && Array.isArray(jsonData.translations)) {
                console.log('Found translations array in parsed JSON with', jsonData.translations.length, 'items');

                // Process the translations
                const subtitles = [];

                for (let index = 0; index < jsonData.translations.length; index++) {
                    const item = jsonData.translations[index];
                    if (!item || !item.text) continue;

                    // Get the original subtitle from the map
                    let originalSub = null;
                    try {
                        const originalSubtitlesMapJson = localStorage.getItem('original_subtitles_map');
                        if (originalSubtitlesMapJson) {
                            const originalSubtitlesMap = JSON.parse(originalSubtitlesMapJson);
                            originalSub = originalSubtitlesMap[item.id];
                        }
                    } catch (error) {
                        console.error('Error loading original subtitles map:', error);
                    }

                    // Create the translated subtitle
                    subtitles.push({
                        id: parseInt(item.id) || (index + 1),
                        start: originalSub ? originalSub.start : 0,
                        end: originalSub ? originalSub.end : 5,
                        text: item.text,
                        originalId: originalSub ? originalSub.id : (parseInt(item.id) || (index + 1)),
                        language: localStorage.getItem('translation_target_language')
                    });
                }

                if (subtitles.length > 0) {
                    console.log('Created', subtitles.length, 'translated subtitles from parsed JSON string');
                    return subtitles;
                }
            }
        } catch (error) {
            console.log('Response string is not valid JSON, proceeding with SRT parsing');
        }
    }

    // Handle text response
    const text = typeof response === 'object' ?
        response.candidates[0].content.parts[0].text :
        response;

    if (!text) return [];

    const subtitles = [];
    const lines = text.split('\n');
    let currentSubtitle = {};
    let index = 0;
    let originalId = null;

    while (index < lines.length) {
        const line = lines[index].trim();

        // Skip empty lines
        if (!line) {
            index++;
            continue;
        }

        // Check if this is a subtitle number
        if (/^\d+$/.test(line)) {
            // If we have a complete subtitle, add it to the list
            if (currentSubtitle.startTime && currentSubtitle.endTime && currentSubtitle.text) {
                subtitles.push({
                    id: subtitles.length + 1,
                    startTime: currentSubtitle.startTime,
                    endTime: currentSubtitle.endTime,
                    text: currentSubtitle.text,
                    originalId: currentSubtitle.originalId
                });
            }

            // Start a new subtitle
            currentSubtitle = { id: parseInt(line) };
            originalId = null; // Reset originalId for the new subtitle
            index++;
        }
        // Check if this is a timestamp line
        else if (line.includes('-->')) {
            const times = line.split('-->');
            if (times.length === 2) {
                currentSubtitle.startTime = times[0].trim();
                currentSubtitle.endTime = times[1].trim();
            }
            index++;
        }
        // Check if this is an original ID comment
        else if (line.startsWith('<!-- original_id:')) {
            const idMatch = line.match(/<!-- original_id:\s*(\d+)\s*-->/);
            if (idMatch && idMatch[1]) {
                currentSubtitle.originalId = parseInt(idMatch[1]);
            }
            index++;
        }
        // This must be the subtitle text
        else {
            // Collect all text lines until we hit an empty line, a number, or an original ID comment
            let textLines = [];
            while (index < lines.length &&
                  lines[index].trim() &&
                  !/^\d+$/.test(lines[index].trim()) &&
                  !lines[index].trim().startsWith('<!-- original_id:')) {
                textLines.push(lines[index].trim());
                index++;
            }

            currentSubtitle.text = textLines.join(' ');

            // Check if the next line is an original ID comment
            if (index < lines.length && lines[index].trim().startsWith('<!-- original_id:')) {
                const idMatch = lines[index].trim().match(/<!-- original_id:\s*(\d+)\s*-->/);
                if (idMatch && idMatch[1]) {
                    currentSubtitle.originalId = parseInt(idMatch[1]);
                }
                index++;
            }

            // If we've reached the end or the next line is a number, add this subtitle
            if (index >= lines.length || (index < lines.length && /^\d+$/.test(lines[index].trim()))) {
                if (currentSubtitle.startTime && currentSubtitle.endTime && currentSubtitle.text) {
                    subtitles.push({
                        id: subtitles.length + 1,
                        startTime: currentSubtitle.startTime,
                        endTime: currentSubtitle.endTime,
                        text: currentSubtitle.text,
                        originalId: currentSubtitle.originalId
                    });
                }
                currentSubtitle = {};
            }
        }
    }

    // Add the last subtitle if it exists
    if (currentSubtitle.startTime && currentSubtitle.endTime && currentSubtitle.text) {
        subtitles.push({
            id: subtitles.length + 1,
            startTime: currentSubtitle.startTime,
            endTime: currentSubtitle.endTime,
            text: currentSubtitle.text,
            originalId: currentSubtitle.originalId
        });
    }

    // Try to load the original subtitles map from localStorage and fix timing
    try {
        const originalSubtitlesMapJson = localStorage.getItem('original_subtitles_map');
        if (originalSubtitlesMapJson) {
            const originalSubtitlesMap = JSON.parse(originalSubtitlesMapJson);
            console.log('Found original subtitles map with', Object.keys(originalSubtitlesMap).length, 'entries');

            // Fix timing for each subtitle based on originalId
            for (let i = 0; i < subtitles.length; i++) {
                const sub = subtitles[i];

                // Try to find the original subtitle by ID
                if (sub.originalId) {
                    const originalSub = originalSubtitlesMap[sub.originalId];
                    if (originalSub) {
                        console.log(`Found original subtitle for ID ${sub.originalId} at index ${i}`);
                        sub.start = originalSub.start;
                        sub.end = originalSub.end;

                        // Format the time strings
                        if (sub.start !== undefined) {
                            sub.startTime = formatSecondsToSRTTime(sub.start);
                        }

                        if (sub.end !== undefined) {
                            sub.endTime = formatSecondsToSRTTime(sub.end);
                        }
                        continue;
                    }
                }

                // If not found by ID, try to find by index
                const originalSubsArray = Object.values(originalSubtitlesMap);
                originalSubsArray.sort((a, b) => a.index - b.index);

                if (i < originalSubsArray.length) {
                    const originalSub = originalSubsArray[i];
                    console.log(`Using original subtitle at index ${i} as fallback for subtitle ${i+1}`);
                    sub.start = originalSub.start;
                    sub.end = originalSub.end;
                    sub.originalId = originalSub.id;

                    // Format the time strings
                    if (sub.start !== undefined) {
                        sub.startTime = formatSecondsToSRTTime(sub.start);
                    }

                    if (sub.end !== undefined) {
                        sub.endTime = formatSecondsToSRTTime(sub.end);
                    }
                }
            }

            // Add a reference to the target language
            const targetLanguage = localStorage.getItem('translation_target_language');
            if (targetLanguage) {
                subtitles.forEach(sub => {
                    sub.language = targetLanguage;
                });
            }
        }
    } catch (error) {
        console.error('Error loading original subtitles map:', error);
    }

    return subtitles;
};
