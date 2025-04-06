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
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from Gemini API');
    }

    const text = response.candidates[0].content.parts[0].text;
    console.log('Raw text from Gemini:', text);

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
    const uniqueSubtitles = [];
    const seen = new Set();

    subtitles.sort((a, b) => a.start - b.start).forEach(sub => {
        const key = `${sub.start}-${sub.end}-${sub.text}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueSubtitles.push(sub);
        }
    });

    console.log('Extracted subtitles:', uniqueSubtitles);
    return uniqueSubtitles;
};