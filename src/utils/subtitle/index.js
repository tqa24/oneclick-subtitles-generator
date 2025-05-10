/**
 * Main subtitle parser module
 * Exports all subtitle parsing functionality
 */

import { parseRawTextManually } from './formatParsers';
import { parseStructuredJsonResponse } from './structuredJsonParser';
import { parseTranslatedSubtitles } from './translationParser';
import { convertTimeStringToSeconds, formatSecondsToSRTTime } from './timeUtils';
import { deduplicateAndSortSubtitles } from './subtitleUtils';
import { 
    parseOriginalFormat, 
    parseMillisecondsFormat, 
    parseSingleTimestampFormat, 
    parseBracketSpaceFormat 
} from './formatParsers';

/**
 * Parse Gemini API response to extract subtitles
 * @param {Object} response - The response from Gemini API
 * @returns {Array} - Array of subtitle objects
 */
export const parseGeminiResponse = (response) => {


    // Check if this is a structured JSON response
    if (response?.candidates?.[0]?.content?.parts?.[0]?.structuredJson) {

        try {
            return parseStructuredJsonResponse(response);
        } catch (error) {
            console.error('Error parsing structured JSON response:', error);
            // Continue to try other parsing methods
        }
    }

    // Fall back to text parsing if not structured JSON
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from Gemini API');
    }

    const text = response.candidates[0].content.parts[0].text;


    // Check if the text is a JSON string
    if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
        try {

            const jsonData = JSON.parse(text);

            if (Array.isArray(jsonData)) {


                // Check if it's a subtitle array
                if (jsonData.length > 0) {
                    const firstItem = jsonData[0];


                    // Check for standard subtitle format with text
                    if (firstItem.startTime && firstItem.endTime && firstItem.text) {

                        // Create a mock structured response
                        const mockResponse = {
                            candidates: [{
                                content: {
                                    parts: [{
                                        structuredJson: jsonData
                                    }]
                                }
                            }]
                        };
                        return parseStructuredJsonResponse(mockResponse);
                    }
                    // Check for timing-only format with index (for user-provided subtitles)
                    else if (firstItem.startTime && firstItem.endTime && firstItem.index !== undefined) {

                        // Create a mock structured response
                        const mockResponse = {
                            candidates: [{
                                content: {
                                    parts: [{
                                        structuredJson: jsonData
                                    }]
                                }
                            }]
                        };
                        return parseStructuredJsonResponse(mockResponse);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to parse text as JSON:', e);

        }
    }

    const subtitles = [];
    let hasTimestamps = false;
    let match;

    // Try new format with descriptions and on-screen text: [0:08 - 0:16] (Description)
    const regexNewFormat = /\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(?:\((.*?)\)|(.+?)(?=\[|$))/gs;

    while ((match = regexNewFormat.exec(text)) !== null) {
        hasTimestamps = true;
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const endMin = parseInt(match[3]);
        const endSec = parseInt(match[4]);

        let content = match[5] || match[6];
        if (content) {
            content = content.trim();
            if (content.startsWith('On-screen text:')) {
                content = content.substring('On-screen text:'.length).trim();
            }

            subtitles.push({
                id: subtitles.length + 1,
                start: startMin * 60 + startSec,
                end: endMin * 60 + endSec,
                text: content
            });
        }
    }

    // Try other formats if new format didn't work
    if (subtitles.length === 0) {
        subtitles.push(...parseOriginalFormat(text));
    }

    if (subtitles.length === 0) {
        subtitles.push(...parseMillisecondsFormat(text));
    }

    if (subtitles.length === 0) {
        subtitles.push(...parseSingleTimestampFormat(text));
    }

    // Try the new bracket format with spaces: [ 0m0s - 0m1s ] Text
    if (subtitles.length === 0) {
        subtitles.push(...parseBracketSpaceFormat(text));
    }

    if (!hasTimestamps && subtitles.length === 0) {
        // Check if this is a JSON array with all empty subtitles
        if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
            try {
                const jsonData = JSON.parse(text);
                if (Array.isArray(jsonData)) {
                    // Handle completely empty array
                    if (jsonData.length === 0) {

                        return []; // Return empty array instead of throwing an error
                    }

                    let emptyCount = 0;
                    for (const item of jsonData) {
                        if (item.startTime === '00m00s000ms' &&
                            item.endTime === '00m00s000ms' &&
                            (!item.text || item.text.trim() === '')) {
                            emptyCount++;
                        }
                    }

                    if (emptyCount > 0 && emptyCount / jsonData.length > 0.9) {
                        throw new Error(JSON.stringify({
                            type: 'empty_subtitles',
                            message: `Found ${emptyCount} empty subtitles out of ${jsonData.length}. The audio may not contain any speech or the model failed to transcribe it.`,
                            rawText: text
                        }));
                    }
                }
            } catch (e) {
                // If JSON parsing fails, continue with the default error
                console.error('Error parsing JSON in empty subtitle check:', e);
            }
        }

        throw new Error(JSON.stringify({
            type: 'unrecognized_format',
            message: 'Unrecognized subtitle format. Please add handling for this new format and try again.',
            rawText: text
        }));
    }

    return deduplicateAndSortSubtitles(subtitles);
};

// Export all functions
export {
    parseRawTextManually,
    parseTranslatedSubtitles,
    convertTimeStringToSeconds,
    formatSecondsToSRTTime,
    deduplicateAndSortSubtitles,
    parseStructuredJsonResponse
};
