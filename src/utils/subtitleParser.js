/**
 * Parse raw text from Gemini when the subtitle parser fails
 * @param {string} rawText - The raw text from Gemini
 * @param {number} startTime - The start time offset for this segment
 * @returns {Array} - Array of subtitle objects
 */
export const parseRawTextManually = (rawText, startTime = 0) => {
    if (!rawText) return [];

    const subtitles = [];

    // Match the format with both start and end times: [ 0m0s000ms - 0m1s500ms ] Text
    // This handles various formats including with or without milliseconds
    const regex = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*-\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|$)/g;
    let match;

    while ((match = regex.exec(rawText)) !== null) {
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const startMs = match[3] ? parseInt(match[3]) / 1000 : 0;
        const endMin = parseInt(match[4]);
        const endSec = parseInt(match[5]);
        const endMs = match[6] ? parseInt(match[6]) / 1000 : 0;
        const text = match[7].trim();

        if (text) {
            subtitles.push({
                id: subtitles.length + 1,
                start: startMin * 60 + startSec + startMs,
                end: endMin * 60 + endSec + endMs,
                text: text
            });
        }
    }

    // If no matches with the above format, try the single timestamp format: [ 0m0s437ms ] Text
    if (subtitles.length === 0) {
        const singleTimestampRegex = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|$)/g;

        // Process each subtitle
        while ((match = singleTimestampRegex.exec(rawText)) !== null) {
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const startMs = match[3] ? parseInt(match[3]) / 1000 : 0;
            const text = match[4].trim();

            const start = startMin * 60 + startSec + startMs;

            // If this is not the first subtitle, set the end time of the previous subtitle
            if (subtitles.length > 0) {
                subtitles[subtitles.length - 1].end = start;
            }

            // For the current subtitle, set the end time to start + 5 seconds (temporary)
            const end = start + 5;

            if (text) {
                subtitles.push({
                    id: subtitles.length + 1,
                    start: start,
                    end: end,
                    text: text
                });
            }
        }

        // Adjust the end time of the last subtitle if needed
        if (subtitles.length > 0) {
            const lastSubtitle = subtitles[subtitles.length - 1];
            if (lastSubtitle.end > lastSubtitle.start + 10) {
                lastSubtitle.end = lastSubtitle.start + 5; // Limit to 5 seconds if it's too long
            }
        }
    }

    // If no matches, try to split by lines and look for timestamps
    if (subtitles.length === 0) {
        const lines = rawText.split('\n');
        for (const line of lines) {
            const lineMatch = line.match(/\[\s*(\d+)m(\d+)s\s*-\s*(\d+)m(\d+)s\s*\]\s*(.+)/);
            if (lineMatch) {
                const startMin = parseInt(lineMatch[1]);
                const startSec = parseInt(lineMatch[2]);
                const endMin = parseInt(lineMatch[3]);
                const endSec = parseInt(lineMatch[4]);
                const text = lineMatch[5].trim();

                if (text) {
                    subtitles.push({
                        id: subtitles.length + 1,
                        start: startMin * 60 + startSec,
                        end: endMin * 60 + endSec,
                        text: text
                    });
                }
            }
        }
    }

    // Apply the start time offset to all subtitles
    if (startTime > 0 && subtitles.length > 0) {
        subtitles.forEach(subtitle => {
            subtitle.start += startTime;
            subtitle.end += startTime;
        });
    }

    return subtitles;
};

export const parseGeminiResponse = (response) => {
    console.log('Parsing Gemini response:', response ? 'Response received' : 'No response');

    // Check if this is a structured JSON response
    if (response?.candidates?.[0]?.content?.parts?.[0]?.structuredJson) {
        console.log('Detected structured JSON response');
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
    console.log('Raw text from Gemini:', text ? text.substring(0, 200) + '...' : 'Empty text');

    // Check if the text is a JSON string
    if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
        try {
            console.log('Detected potential JSON array in text response');
            const jsonData = JSON.parse(text);

            if (Array.isArray(jsonData)) {
                console.log('Successfully parsed JSON array with', jsonData.length, 'items');

                // Check if it's a subtitle array
                if (jsonData.length > 0) {
                    const firstItem = jsonData[0];
                    console.log('First item in JSON array:', JSON.stringify(firstItem));

                    if (firstItem.startTime && firstItem.endTime && firstItem.text) {
                        console.log('Detected subtitle format JSON array, parsing as structured data');
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
            console.log('JSON parse error. Text starts with:', text.substring(0, 100));
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
                        console.log('Empty JSON array detected, returning empty subtitles');
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

const parseOriginalFormat = (text) => {
    const subtitles = [];
    const regexOriginal = /\[\s*(\d+)m(\d+)s\s*-\s*(\d+)m(\d+)s\s*\](?:\n|\r\n?)+(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
    let match;

    while ((match = regexOriginal.exec(text)) !== null) {
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const endMin = parseInt(match[3]);
        const endSec = parseInt(match[4]);

        let subtitleText = match[5].trim();

        subtitles.push({
            id: subtitles.length + 1,
            start: startMin * 60 + startSec,
            end: endMin * 60 + endSec,
            text: subtitleText
        });
    }

    return subtitles;
};

const parseMillisecondsFormat = (text) => {
    const subtitles = [];
    const regexWithMs = /\[\s*(\d+)m(\d+)s(\d+)ms\s*-\s*(\d+)m(\d+)s(\d+)ms\s*\]\s*(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
    let match;

    while ((match = regexWithMs.exec(text)) !== null) {
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const startMs = parseInt(match[3]);
        const endMin = parseInt(match[4]);
        const endSec = parseInt(match[5]);
        const endMs = parseInt(match[6]);

        const startTime = startMin * 60 + startSec + startMs / 1000;
        const endTime = endMin * 60 + endSec + endMs / 1000;

        let subtitleText = match[7].trim();

        subtitles.push({
            id: subtitles.length + 1,
            start: startTime,
            end: endTime,
            text: subtitleText
        });
    }

    return subtitles;
};

const parseSingleTimestampFormat = (text) => {
    const subtitles = [];
    const regexSingleTimestamp = /\[(\d+)m(\d+)s\]\s*([^[\n]*?)(?=\n*\[|$)/gs;
    const matches = [];
    let match;

    while ((match = regexSingleTimestamp.exec(text)) !== null) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const content = match[3].trim();

        if (content && !content.match(/^\d+\.\d+s$/)) {
            matches.push({
                startTime: min * 60 + sec,
                text: content
            });
        }
    }

    if (matches.length > 0) {
        matches.forEach((curr, index) => {
            const next = matches[index + 1];
            const endTime = next ? next.startTime : curr.startTime + 4;

            subtitles.push({
                id: subtitles.length + 1,
                start: curr.startTime,
                end: endTime,
                text: curr.text
            });
        });
    }

    return subtitles;
};

/**
 * Parse the new bracket format with spaces and optional milliseconds: [ 0m0s000ms - 0m1s500ms ] Text
 * @param {string} text - The text to parse
 * @returns {Array} - Array of subtitle objects
 */
const parseBracketSpaceFormat = (text) => {
    const subtitles = [];

    // First try the format with both start and end times including milliseconds
    const regexWithMs = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*-\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|$)/g;
    let match;

    while ((match = regexWithMs.exec(text)) !== null) {
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const startMs = match[3] ? parseInt(match[3]) / 1000 : 0;
        const endMin = parseInt(match[4]);
        const endSec = parseInt(match[5]);
        const endMs = match[6] ? parseInt(match[6]) / 1000 : 0;
        const content = match[7].trim();

        if (content) {
            subtitles.push({
                id: subtitles.length + 1,
                start: startMin * 60 + startSec + startMs,
                end: endMin * 60 + endSec + endMs,
                text: content
            });
        }
    }

    // If no matches, try the format without milliseconds
    if (subtitles.length === 0) {
        const regexWithoutMs = /\[\s*(\d+)m(\d+)s\s*-\s*(\d+)m(\d+)s\s*\]\s*(.+?)(?=\[\s*\d+m\d+s|$)/gs;

        while ((match = regexWithoutMs.exec(text)) !== null) {
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const endMin = parseInt(match[3]);
            const endSec = parseInt(match[4]);
            const content = match[5].trim();

            if (content) {
                subtitles.push({
                    id: subtitles.length + 1,
                    start: startMin * 60 + startSec,
                    end: endMin * 60 + endSec,
                    text: content
                });
            }
        }
    }

    // If still no matches, try the single timestamp format
    if (subtitles.length === 0) {
        const singleTimestampRegex = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|$)/g;

        while ((match = singleTimestampRegex.exec(text)) !== null) {
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const startMs = match[3] ? parseInt(match[3]) / 1000 : 0;
            const content = match[4].trim();

            const start = startMin * 60 + startSec + startMs;

            // If this is not the first subtitle, set the end time of the previous subtitle
            if (subtitles.length > 0) {
                subtitles[subtitles.length - 1].end = start;
            }

            // For the current subtitle, set the end time to start + 5 seconds (temporary)
            const end = start + 5;

            if (content) {
                subtitles.push({
                    id: subtitles.length + 1,
                    start: start,
                    end: end,
                    text: content
                });
            }
        }

        // Adjust the end time of the last subtitle if needed
        if (subtitles.length > 0) {
            const lastSubtitle = subtitles[subtitles.length - 1];
            if (lastSubtitle.end > lastSubtitle.start + 10) {
                lastSubtitle.end = lastSubtitle.start + 5; // Limit to 5 seconds if it's too long
            }
        }
    }

    return subtitles;
};

const deduplicateAndSortSubtitles = (subtitles) => {
    // Filter out invalid subtitles
    const validSubtitles = subtitles.filter(sub => {
        // Skip subtitles with identical start and end times
        if (sub.start === sub.end) {
            console.log(`Skipping subtitle with identical start and end time: ${sub.start}s, text: "${sub.text}"`);
            return false;
        }

        // Adjust subtitles with very short duration (less than 0.3 seconds)
        if (sub.end - sub.start < 0.3) {
            console.log(`Adjusting very short subtitle: ${sub.start}s - ${sub.end}s (${(sub.end - sub.start).toFixed(3)}s), text: "${sub.text}"`);
            sub.end = sub.start + 0.5; // Set minimum duration to 0.5 seconds
        }

        // Skip subtitles with empty text
        if (!sub.text || sub.text.trim() === '') {
            console.log(`Skipping subtitle with empty text at time: ${sub.start}s - ${sub.end}s`);
            return false;
        }

        return true;
    });

    const uniqueSubtitles = [];
    const seen = new Set();

    // Sort by start time
    validSubtitles.sort((a, b) => a.start - b.start);

    // First pass: Handle overlapping subtitles and small gaps
    for (let i = 0; i < validSubtitles.length - 1; i++) {
        const current = validSubtitles[i];
        const next = validSubtitles[i + 1];

        // Handle overlapping subtitles
        if (next.start < current.end) {
            console.log(`Fixing overlapping subtitles: "${current.text}" (${current.start}s-${current.end}s) and "${next.text}" (${next.start}s-${next.end}s)`);

            // If they have the same text, merge them
            if (next.text === current.text) {
                current.end = Math.max(current.end, next.end);
                next.start = current.end;
                next.end = Math.max(next.end, next.start + 0.5); // Ensure minimum duration
            } else {
                // Otherwise, adjust the boundary
                const midpoint = (current.end + next.start) / 2;
                current.end = midpoint;
                next.start = midpoint;
            }
        }
        // If there's a very small gap between subtitles (less than 0.1 seconds)
        else if (next.start - current.end > 0 && next.start - current.end < 0.1) {
            console.log(`Adjusting small gap between subtitles: ${current.end}s to ${next.start}s (${(next.start - current.end).toFixed(3)}s)`);
            // Either extend the current subtitle or move the next one back
            if (next.text === current.text) {
                // If they have the same text, extend the current one
                current.end = next.start;
            } else {
                // Otherwise, just close the gap by moving the next one back
                next.start = current.end;
            }
        }
    }

    // Second pass: Merge consecutive subtitles with the same text if they're close together
    for (let i = 0; i < validSubtitles.length; i++) {
        const current = validSubtitles[i];
        const key = `${current.start}-${current.end}-${current.text}`;

        // Skip if we've already seen this exact subtitle
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        // Look ahead to see if there are consecutive identical texts
        let j = i + 1;
        while (j < validSubtitles.length &&
               validSubtitles[j].text === current.text &&
               validSubtitles[j].start - current.end < 0.3) {

            // Merge this subtitle with the current one
            console.log(`Merging consecutive identical subtitles: "${current.text}" at ${current.start}s-${current.end}s with ${validSubtitles[j].start}s-${validSubtitles[j].end}s`);
            current.end = validSubtitles[j].end;

            // Mark this key as seen
            seen.add(`${validSubtitles[j].start}-${validSubtitles[j].end}-${validSubtitles[j].text}`);

            j++;
        }

        // Skip all the merged subtitles
        i = j - 1;

        uniqueSubtitles.push(current);
    }

    console.log(`Extracted ${uniqueSubtitles.length} unique subtitles from ${subtitles.length} total`);
    return uniqueSubtitles;
};

/**
 * Parse structured JSON response from Gemini
 * @param {Object} response - The response from Gemini API
 * @returns {Array} - Array of subtitle objects
 */
const parseStructuredJsonResponse = (response) => {
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
            while (startIndex < structuredJson.length &&
                   structuredJson[startIndex].startTime === '00m00s000ms' &&
                   structuredJson[startIndex].endTime === '00m00s000ms' &&
                   (!structuredJson[startIndex].text || structuredJson[startIndex].text.trim() === '')) {
                console.log(`Skipping empty subtitle at index ${startIndex}`);
                startIndex++;
            }

            for (let i = startIndex; i < structuredJson.length; i++) {
                const item = structuredJson[i];

                // Handle subtitle format
                if (item.startTime && item.endTime) {
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

            // Parse the text directly to avoid infinite recursion
            const subtitles = [];
            let hasTimestamps = false;

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

/**
 * Convert time string in format MMmSSsNNNms or HH:MM:SS.mmm to seconds
 * @param {string} timeString - Time string in format MMmSSsNNNms or HH:MM:SS.mmm
 * @returns {number} - Time in seconds
 */
const convertTimeStringToSeconds = (timeString) => {
    console.log('Converting time string:', timeString);

    // Handle empty or invalid time strings
    if (!timeString || typeof timeString !== 'string') {
        console.warn('Empty or invalid time string:', timeString);
        return 0;
    }

    // Handle 00m00s000ms as a special case (start of video)
    if (timeString === '00m00s000ms') {
        return 0;
    }

    // First, try to match the exact format MMmSSsNNNms (e.g., 00m30s500ms)
    const exactFormatMatch = timeString.match(/^(\d+)m(\d+)s(\d+)ms$/);
    if (exactFormatMatch && exactFormatMatch[1] !== undefined && exactFormatMatch[2] !== undefined && exactFormatMatch[3] !== undefined) {
        const minutes = parseInt(exactFormatMatch[1]);
        const seconds = parseInt(exactFormatMatch[2]);
        const milliseconds = parseInt(exactFormatMatch[3]) / 1000;

        const result = minutes * 60 + seconds + milliseconds;
        console.log(`Parsed ${timeString} as ${minutes}m ${seconds}s ${milliseconds}ms = ${result}s`);
        return result;
    }

    // Try a more flexible pattern if the exact format doesn't match
    const flexibleFormatMatch = timeString.match(/(\d+)m(\d+)s(\d+)ms/);
    if (flexibleFormatMatch) {
        const minutes = parseInt(flexibleFormatMatch[1]);
        const seconds = parseInt(flexibleFormatMatch[2]);
        const milliseconds = parseInt(flexibleFormatMatch[3]) / 1000;

        const result = minutes * 60 + seconds + milliseconds;
        console.log(`Parsed ${timeString} with flexible pattern as ${minutes}m ${seconds}s ${milliseconds}ms = ${result}s`);
        return result;
    }

    // Try an even more flexible pattern that extracts any numbers
    const looseFormatMatch = timeString.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
    if (looseFormatMatch) {
        // Assume the format is minutes, seconds, milliseconds in that order
        const minutes = parseInt(looseFormatMatch[1]);
        const seconds = parseInt(looseFormatMatch[2]);
        const milliseconds = parseInt(looseFormatMatch[3]) / 1000;

        const result = minutes * 60 + seconds + milliseconds;
        console.log(`Parsed ${timeString} with loose pattern as ${minutes}m ${seconds}s ${milliseconds}ms = ${result}s`);
        return result;
    }

    // Try to match HH:MM:SS.mmm format
    const timeMatch = timeString.match(/(\d+):(\d+):(\d+)(?:\.(\d+))?/);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        const milliseconds = timeMatch[4] ? parseInt(timeMatch[4]) / 1000 : 0;

        return hours * 3600 + minutes * 60 + seconds + milliseconds;
    }

    // Try to match MM:SS.mmm format
    const shortTimeMatch = timeString.match(/(\d+):(\d+)(?:\.(\d+))?/);
    if (shortTimeMatch) {
        const minutes = parseInt(shortTimeMatch[1]);
        const seconds = parseInt(shortTimeMatch[2]);
        const milliseconds = shortTimeMatch[3] ? parseInt(shortTimeMatch[3]) / 1000 : 0;

        return minutes * 60 + seconds + milliseconds;
    }

    console.warn('Could not parse time string:', timeString);
    return 0;
};

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
                            const startHours = Math.floor(sub.start / 3600);
                            const startMinutes = Math.floor((sub.start % 3600) / 60);
                            const startSeconds = Math.floor(sub.start % 60);
                            const startMs = Math.floor((sub.start % 1) * 1000);
                            sub.startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:${String(startSeconds).padStart(2, '0')},${String(startMs).padStart(3, '0')}`;
                        }

                        if (sub.end !== undefined) {
                            const endHours = Math.floor(sub.end / 3600);
                            const endMinutes = Math.floor((sub.end % 3600) / 60);
                            const endSeconds = Math.floor(sub.end % 60);
                            const endMs = Math.floor((sub.end % 1) * 1000);
                            sub.endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:${String(endSeconds).padStart(2, '0')},${String(endMs).padStart(3, '0')}`;
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
                        const startHours = Math.floor(sub.start / 3600);
                        const startMinutes = Math.floor((sub.start % 3600) / 60);
                        const startSeconds = Math.floor(sub.start % 60);
                        const startMs = Math.floor((sub.start % 1) * 1000);
                        sub.startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:${String(startSeconds).padStart(2, '0')},${String(startMs).padStart(3, '0')}`;
                    }

                    if (sub.end !== undefined) {
                        const endHours = Math.floor(sub.end / 3600);
                        const endMinutes = Math.floor((sub.end % 3600) / 60);
                        const endSeconds = Math.floor(sub.end % 60);
                        const endMs = Math.floor((sub.end % 1) * 1000);
                        sub.endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:${String(endSeconds).padStart(2, '0')},${String(endMs).padStart(3, '0')}`;
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