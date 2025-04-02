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
    const regexSingleTimestamp = /\[(\d+)m(\d+)s\]\s*([^\[\n]*?)(?=\n*\[|$)/gs;
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