/**
 * Module for parsing structured JSON responses from Gemini API
 */

import { convertTimeStringToSeconds } from './timeUtils';

/**
 * Parse structured JSON response from Gemini
 * @param {Object} response - The response from Gemini API
 * @returns {Array} - Array of subtitle objects
 */
export const parseStructuredJsonResponse = (response) => {
    try {
        const structuredJson = response.candidates[0].content.parts[0].structuredJson;
        console.log('Structured JSON response:', JSON.stringify(structuredJson).substring(0, 200) + '...');

        // Check for translations array in the new schema format
        if (structuredJson.translations && Array.isArray(structuredJson.translations)) {
            console.log('Found translations array in structured JSON with', structuredJson.translations.length, 'items');

            const subtitles = [];

            for (let i = 0; i < structuredJson.translations.length; i++) {
                const item = structuredJson.translations[i];
                console.log(`Processing translation item ${i + 1}:`, JSON.stringify(item));

                if (!item || !item.text) {
                    console.warn(`Skipping item ${i + 1} - missing text property`);
                    continue;
                }

                // Try to get original subtitle from localStorage
                try {
                    const originalSubtitlesMapJson = localStorage.getItem('original_subtitles_map');
                    if (originalSubtitlesMapJson) {
                        const originalSubtitlesMap = JSON.parse(originalSubtitlesMapJson);
                        const originalSub = originalSubtitlesMap[item.id];

                        if (originalSub) {
                            console.log(`Found original subtitle for ID ${item.id}:`, originalSub);
                            subtitles.push({
                                id: parseInt(item.id),
                                start: originalSub.start,
                                end: originalSub.end,
                                text: item.text,
                                originalId: parseInt(item.id)
                            });
                            continue;
                        } else {
                            console.warn(`Original subtitle not found for ID ${item.id} in map`);
                        }
                    } else {
                        console.warn('No original subtitles map found in localStorage');
                    }
                } catch (error) {
                    console.error('Error loading original subtitles map:', error);
                }

                // Fallback if original subtitle not found - try to find by index
                try {
                    const originalSubtitlesMapJson = localStorage.getItem('original_subtitles_map');
                    if (originalSubtitlesMapJson) {
                        const originalSubtitlesMap = JSON.parse(originalSubtitlesMapJson);
                        const originalSubsArray = Object.values(originalSubtitlesMap);

                        if (i < originalSubsArray.length) {
                            const originalSub = originalSubsArray[i];
                            console.log(`Using original subtitle at index ${i} for ID ${item.id}:`, originalSub);
                            subtitles.push({
                                id: parseInt(item.id) || (i + 1),
                                start: originalSub.start,
                                end: originalSub.end,
                                text: item.text,
                                originalId: originalSub.id || (i + 1)
                            });
                            continue;
                        }
                    }
                } catch (error) {
                    console.error('Error using index-based fallback:', error);
                }

                // Last resort fallback
                console.warn(`Using default timing for subtitle ID ${item.id} at index ${i}`);
                subtitles.push({
                    id: parseInt(item.id) || (i + 1),
                    start: 0,
                    end: 0,
                    text: item.text,
                    originalId: parseInt(item.id) || (i + 1)
                });
            }

            console.log(`Processed ${subtitles.length} out of ${structuredJson.translations.length} translation items`);
            return subtitles;
        }
        // If it's an array, assume it's a subtitle array
        else if (Array.isArray(structuredJson)) {
            // Log the first item to help with debugging
            if (structuredJson.length > 0) {
                console.log('First item in structured JSON array:', JSON.stringify(structuredJson[0]));
                console.log('Time format example:', structuredJson[0].startTime);
                console.log('Total items in array:', structuredJson.length);
            }

            const subtitles = [];

            // Check if all subtitles are empty with 00m00s000ms timestamps
            let allEmpty = true;
            let emptyCount = 0;

            // Skip this check for timing-only format (with index property)
            const isTimingOnlyFormat = structuredJson.length > 0 &&
                                      structuredJson[0].index !== undefined &&
                                      structuredJson[0].startTime &&
                                      structuredJson[0].endTime;

            if (!isTimingOnlyFormat) {
                for (let i = 0; i < structuredJson.length; i++) {
                    const item = structuredJson[i];
                    if (item.startTime === '00m00s000ms' &&
                        item.endTime === '00m00s000ms' &&
                        (!item.text || item.text.trim() === '')) {
                        emptyCount++;
                    } else {
                        allEmpty = false;
                        break;
                    }
                }
            } else {
                // For timing-only format, we don't need to check for empty subtitles
                allEmpty = false;
                console.log('Skipping empty subtitle check for timing-only format');
            }

            // If all subtitles are empty or more than 90% are empty, this is likely an error
            if (allEmpty || (emptyCount > 0 && emptyCount / structuredJson.length > 0.9)) {
                console.log(`Found ${emptyCount} empty subtitles out of ${structuredJson.length} total`);
                if (allEmpty) {
                    console.error('All subtitles are empty with 00m00s000ms timestamps. This is likely an error.');
                    throw new Error('No valid subtitles found in the response. All subtitles have empty text and 00m00s000ms timestamps.');
                } else {
                    console.warn(`${emptyCount} out of ${structuredJson.length} subtitles are empty with 00m00s000ms timestamps.`);
                }
            }

            // Skip empty subtitles at 00m00s000ms
            let startIndex = 0;

            // Skip this check for timing-only format
            if (!isTimingOnlyFormat) {
                while (startIndex < structuredJson.length &&
                       structuredJson[startIndex].startTime === '00m00s000ms' &&
                       structuredJson[startIndex].endTime === '00m00s000ms' &&
                       (!structuredJson[startIndex].text || structuredJson[startIndex].text.trim() === '')) {
                    console.log(`Skipping empty subtitle at index ${startIndex}`);
                    startIndex++;
                }
            } else {
                console.log('Skipping empty subtitle check for timing-only format');
            }

            for (let i = startIndex; i < structuredJson.length; i++) {
                const item = structuredJson[i];

                // Handle timing-only format (for user-provided subtitles)
                if (item.startTime && item.endTime && item.index !== undefined) {
                    try {
                        // Convert time format from MMmSSsNNNms to seconds
                        const start = convertTimeStringToSeconds(item.startTime);
                        const end = convertTimeStringToSeconds(item.endTime);
                        const index = item.index;

                        console.log(`Converted time for timing-only item ${index}: ${item.startTime} -> ${start}, ${item.endTime} -> ${end}`);

                        // Get the corresponding text from user-provided subtitles
                        const userProvidedSubtitles = localStorage.getItem('user_provided_subtitles');
                        if (userProvidedSubtitles) {
                            const subtitleLines = userProvidedSubtitles.trim().split('\n').filter(line => line.trim() !== '');
                            if (index < subtitleLines.length) {
                                const text = subtitleLines[index].trim();
                                console.log(`Using user-provided subtitle text for index ${index}: ${text}`);

                                subtitles.push({
                                    id: i + 1,
                                    start,
                                    end,
                                    text: text
                                });
                            } else {
                                console.warn(`Index ${index} out of range for user-provided subtitles (length: ${subtitleLines.length}) - skipping this entry`);
                                // Skip this entry instead of throwing an error
                            }
                        } else {
                            console.error('No user-provided subtitles found in localStorage');
                        }
                    } catch (error) {
                        console.error(`Error processing timing-only item ${i + 1}:`, error);
                    }
                }
                // Handle regular subtitle format
                else if (item.startTime && item.endTime) {
                    try {
                        // Convert time format from MMmSSsNNNms to seconds
                        const start = convertTimeStringToSeconds(item.startTime);
                        const end = convertTimeStringToSeconds(item.endTime);

                        console.log(`Converted time for item ${i + 1}: ${item.startTime} -> ${start}, ${item.endTime} -> ${end}`);

                        // Skip empty subtitles at the beginning of the video
                        if (start === 0 && end === 0 && (!item.text || item.text.trim() === '')) {
                            console.log(`Skipping empty subtitle at position ${i + 1}`);
                            continue;
                        }

                        subtitles.push({
                            id: i + 1,
                            start,
                            end,
                            text: item.text || ''
                        });
                    } catch (error) {
                        console.error(`Error processing item ${i + 1}:`, error);
                    }
                }

                // Handle translation format
                else if (item.id && item.text) {
                    // Try to get original subtitle from localStorage
                    try {
                        const originalSubtitlesMapJson = localStorage.getItem('original_subtitles_map');
                        if (originalSubtitlesMapJson) {
                            const originalSubtitlesMap = JSON.parse(originalSubtitlesMapJson);
                            const originalSub = originalSubtitlesMap[item.id];

                            if (originalSub) {
                                console.log(`Found original subtitle for ID ${item.id}:`, originalSub);
                                subtitles.push({
                                    id: parseInt(item.id),
                                    start: originalSub.start,
                                    end: originalSub.end,
                                    text: item.text,
                                    originalId: parseInt(item.id)
                                });
                                continue;
                            } else {
                                console.warn(`Original subtitle not found for ID ${item.id} in map`);
                            }
                        } else {
                            console.warn('No original subtitles map found in localStorage');
                        }
                    } catch (error) {
                        console.error('Error loading original subtitles map:', error);
                    }

                    // Fallback if original subtitle not found - try to find by index
                    // This is important for when the ID in the response doesn't match the original ID
                    // but the order is preserved
                    try {
                        const originalSubtitlesMapJson = localStorage.getItem('original_subtitles_map');
                        if (originalSubtitlesMapJson) {
                            const originalSubtitlesMap = JSON.parse(originalSubtitlesMapJson);
                            // Get all values from the map as an array
                            const originalSubsArray = Object.values(originalSubtitlesMap);

                            // If we have an original subtitle at this index, use its timing
                            if (i < originalSubsArray.length) {
                                const originalSub = originalSubsArray[i];
                                console.log(`Using original subtitle at index ${i} for ID ${item.id}:`, originalSub);
                                subtitles.push({
                                    id: parseInt(item.id) || (i + 1),
                                    start: originalSub.start,
                                    end: originalSub.end,
                                    text: item.text,
                                    originalId: originalSub.id || (i + 1)
                                });
                                continue;
                            }
                        }
                    } catch (error) {
                        console.error('Error using index-based fallback:', error);
                    }

                    // Last resort fallback if original subtitle not found
                    console.warn(`Using default timing for subtitle ID ${item.id} at index ${i}`);
                    subtitles.push({
                        id: parseInt(item.id) || (i + 1),
                        start: 0, // Default start time
                        end: 0,   // Default end time
                        text: item.text,
                        originalId: parseInt(item.id) || (i + 1)
                    });
                }

                // Default case
                else {
                    console.warn(`Item ${i + 1} doesn't have required fields:`, JSON.stringify(item));
                }
            }

            console.log(`Processed ${subtitles.length} out of ${structuredJson.length} items`);
            return subtitles;
        }

        // Handle consolidation or summarization response
        if (structuredJson.title && structuredJson.content) {
            // This is a consolidated document
            return structuredJson;
        }

        if (structuredJson.summary && structuredJson.keyPoints) {
            // This is a summary
            return structuredJson;
        }

        // Unknown structure, return as is
        return structuredJson;
    } catch (error) {
        console.error('Error parsing structured JSON response:', error);
        console.error('Response was:', JSON.stringify(response).substring(0, 500) + '...');

        // Try to extract the text content as a fallback
        if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const text = response.candidates[0].content.parts[0].text;
            console.log('Falling back to text parsing. Text starts with:', text.substring(0, 100));

            // Check if the text is a JSON string
            if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
                try {
                    const jsonData = JSON.parse(text);
                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        console.log('Successfully parsed JSON from text content');
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
                } catch (e) {
                    console.error('Failed to parse text as JSON in fallback:', e);
                }
            }

            // Create a mock response with just the text
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            text: text
                        }]
                    }
                }]
            };

            // Import and use text parsing methods
            const { parseOriginalFormat, parseMillisecondsFormat, parseSingleTimestampFormat, parseBracketSpaceFormat } = require('./formatParsers');
            const { deduplicateAndSortSubtitles } = require('./subtitleUtils');

            // Parse the text directly to avoid infinite recursion
            const subtitles = [];

            // Try all the text parsing methods
            subtitles.push(...parseOriginalFormat(text));
            subtitles.push(...parseMillisecondsFormat(text));
            subtitles.push(...parseSingleTimestampFormat(text));
            subtitles.push(...parseBracketSpaceFormat(text));

            if (subtitles.length > 0) {
                return deduplicateAndSortSubtitles(subtitles);
            }
        }

        throw new Error('Failed to parse structured JSON response: ' + error.message);
    }
};
