/**
 * Prompt management for Gemini API
 * Handles prompt presets and custom prompts
 */

import { getTranscriptionRulesSync } from '../../utils/transcriptionRulesStore';

// Default transcription prompts
export const PROMPT_PRESETS = [
{
id: 'general',
title: 'General purpose',
prompt: `Transcribe all spoken content in this ${'{contentType}'}. Include the exact start and end times for each segment of speech.`
},
{
id: 'extract-text',
title: 'Extract text',
prompt: `Extract only visible text and hardcoded subtitles from this ${'{contentType}'}. Ignore all audio. Include the exact start and end times for each text appearance.`
},
{
id: 'focus-lyrics',
title: 'Focus on Lyrics',
prompt: `Extract only sung lyrics from this ${'{contentType}'}. Ignore spoken words, dialogue, narration, and instrumental music. Include the exact start and end times for each lyrical segment.`
},
{
id: 'describe-video',
title: 'Describe video',
prompt: `Describe significant visual events and scene changes in this ${'{contentType}'}. Focus only on what is visually happening. Include the exact start and end times for each visual event.`
},
{
id: 'translate-directly',
title: 'Translate directly',
prompt: `Identify the spoken language(s) and translate all speech directly into TARGET_LANGUAGE. Include the exact start and end times for each translated segment.`
},
{
// Chaptering prompt remains unchanged as requested
id: 'chaptering',
title: 'Chaptering',
prompt: `You are an expert content analyst. Your task is to analyze this ${'{contentType}'} and identify distinct chapters or thematic segments based on major topic shifts or significant changes in activity/scene. Format the output as a sequential list, with each chapter on a new line. Each line MUST strictly follow the format: [HH:MM:SS] Chapter Title (5-7 words max) :: Chapter Summary (1-2 sentences). Use the specific timestamp format [HH:MM:SS] (hours, minutes, seconds) representing the chapter's start time. Use ' :: ' (space, two colons, space) as the separator between the title and the summary.
Example of two chapter lines:
[00:05:15] Introduction to Topic :: This chapter introduces the main subject discussed and sets the stage for later details.
[00:15:30] Exploring Detail A :: The speaker dives into the first major detail, providing supporting examples.
Ensure titles are concise (5-7 words max) and summaries are brief (1-2 sentences). Focus on major segmentation points. Return ONLY the formatted chapter lines following this exact single-line structure. Do not include any introductory text, concluding remarks, blank lines, lists, or any other text or formatting.`
},
{
id: 'diarize-speakers',
title: 'Identify Speakers',
prompt: `Transcribe speech and identify speakers in this ${'{contentType}'}. Use consistent labels (Speaker 1, Speaker 2, etc.) throughout. Include the exact start and end times for each speaker's segment. Each entry should represent one speaker's continuous segment.`
}
];

// Default transcription prompt that will be used if no custom prompt is set
export const DEFAULT_TRANSCRIPTION_PROMPT = PROMPT_PRESETS[0].prompt;

// Function declarations first
const getUserPromptPresetsImpl = () => {
    try {
        const savedPresets = localStorage.getItem('user_prompt_presets');
        return savedPresets ? JSON.parse(savedPresets) : [];
    } catch (error) {
        console.error('Error loading user prompt presets:', error);
        return [];
    }
};

const saveUserPromptPresetsImpl = (presets) => {
    try {
        localStorage.setItem('user_prompt_presets', JSON.stringify(presets));
    } catch (error) {
        console.error('Error saving user prompt presets:', error);
    }
};

const getTranscriptionPromptImpl = (contentType, userProvidedSubtitles = null, options = {}) => {
    // First check if there's a session-specific prompt (from video analysis)
    // This allows using the recommended preset for the current session only
    const sessionPrompt = sessionStorage.getItem('current_session_prompt');

    // If no session prompt, get custom prompt from localStorage or use default
    const customPrompt = sessionPrompt || localStorage.getItem('transcription_prompt');

    // Get the transcription rules if available and enabled (using sync version)
    const useTranscriptionRules = localStorage.getItem('video_processing_use_transcription_rules') !== 'false';
    const transcriptionRules = useTranscriptionRules ? getTranscriptionRulesSync() : null;

    // Base prompt (either session-specific, custom, or default)
    let basePrompt;
    if (customPrompt && customPrompt.trim() !== '') {
        basePrompt = customPrompt.replace('{contentType}', contentType);
    } else {
        basePrompt = PROMPT_PRESETS[0].prompt.replace('{contentType}', contentType);
    }

    // Log which prompt is being used
    if (sessionPrompt) {

    }

    // If we have user-provided subtitles, replace the entire prompt with a simplified version
    if (userProvidedSubtitles && userProvidedSubtitles.trim() !== '') {
        // Use a very simple prompt that only focuses on timing the provided subtitles
        // No preset information, no transcription rules, just the core task




        // Split the subtitles into an array and count them
        const subtitleLines = userProvidedSubtitles.trim().split('\n').filter(line => line.trim() !== '');
        const subtitleCount = subtitleLines.length;

        // Create a numbered list of subtitles for the prompt
        const numberedSubtitles = subtitleLines.map((line, index) => `[${index}] ${line}`).join('\n');

        // Get segment information if available
        const segmentInfo = options?.segmentInfo || {};
        const hasSegmentTimes = typeof segmentInfo.start === 'number' && typeof segmentInfo.duration === 'number';
        const isSegment = !!segmentInfo.isSegment || hasSegmentTimes;
        const segmentIndex = segmentInfo.segmentIndex !== undefined ? segmentInfo.segmentIndex : null;
        const segmentStartTime = hasSegmentTimes ? segmentInfo.start : (segmentInfo.startTime !== undefined ? segmentInfo.startTime : 0);
        const segmentDuration = hasSegmentTimes ? segmentInfo.duration : (segmentInfo.duration !== undefined ? segmentInfo.duration : null);
        const totalDuration = segmentInfo.totalDuration !== undefined ? segmentInfo.totalDuration : null;

        let segmentInfoText = '';
        if (isSegment && segmentDuration !== null) {
            if (segmentIndex !== null && totalDuration !== null) {
                segmentInfoText = `\nSegment info: This is segment ${segmentIndex + 1} starting at ${Number(segmentStartTime).toFixed(2)}s (duration: ${Number(segmentDuration).toFixed(2)}s).\nProvide timestamps relative to this segment's start (beginning at 00m00s000ms).`;
            } else {
                segmentInfoText = `\nSegment info: This segment starts at ${Number(segmentStartTime).toFixed(2)}s (duration: ${Number(segmentDuration).toFixed(2)}s).\nProvide timestamps relative to this segment's start (beginning at 00m00s000ms).`;
            }
        }

        // Build a simpler example JSON (just show format, not all lines)
        const exampleJson = `[
  { "index": 0, "startTime": "00m00s500ms", "endTime": "00m02s000ms", "text": "First subtitle text" },
  { "index": 1, "startTime": "00m02s000ms", "endTime": "00m04s500ms", "text": "Second subtitle text" },
  { "index": 2, "startTime": "00m04s500ms", "endTime": "00m07s000ms", "text": "Third subtitle text" }
]`;

        let simplifiedPrompt;
        if (isSegment) {
            // For segments, use a clean prompt similar to normal presets
            simplifiedPrompt = `Time the provided subtitles for this video segment. Match each numbered subtitle from the list below to when it appears in the video.${segmentInfoText}

Format: Return a JSON array with timing for subtitles that appear in this segment:
${exampleJson}

Rules:
- Each numbered subtitle that appears gets one entry with its index, start time, end time, and exact text
- Use exact text from the numbered list (do not modify or combine)
- Use leading zeros in timestamps (00m05s100ms, not 0m5s100ms)
- Only include subtitles that actually appear in this segment
- Index must match the number in brackets from the list below

Numbered subtitle list:\n${numberedSubtitles}`;

            // Append outside-range context if the modal requested it (persisted in localStorage)
            try {
                const useOutside = localStorage.getItem('video_processing_use_outside_context') === 'true';
                const ocText = localStorage.getItem('video_processing_outside_context_text');
                if (useOutside && ocText && ocText.trim()) {
                    simplifiedPrompt += `\n\nContextual subtitles outside the selected range (for consistency):${ocText}`;
                }
            } catch (e) {
                // ignore localStorage access issues
            }
        } else {
            // For full video processing, use a clean prompt similar to segment processing
            simplifiedPrompt = `Time all ${subtitleCount} provided subtitles for this video. Match each numbered subtitle to when it appears in the video.

Format: Return a JSON array with exactly ${subtitleCount} entries:
${exampleJson}

Rules:
- Must return exactly ${subtitleCount} entries (one for each numbered subtitle)
- Each entry must have: index (matching the number in brackets), startTime, endTime, and exact text
- Use exact text from the numbered list (do not modify, combine, or skip any lines)
- Use leading zeros in timestamps (00m05s100ms, not 0m5s100ms)
- Even if lines are similar or repetitive, each gets its own separate entry
- Index must match: [0] to index 0, [1] to index 1, etc.

Numbered subtitle list (all ${subtitleCount} must be timed):\n${numberedSubtitles}`;

            // Append outside-range context in full-video path as well
            try {
                const useOutside = localStorage.getItem('video_processing_use_outside_context') === 'true';
                const ocText = localStorage.getItem('video_processing_outside_context_text');
                if (useOutside && ocText && ocText.trim()) {
                    simplifiedPrompt += `\n\nContextual subtitles outside the selected range (for consistency):${ocText}`;
                }
            } catch (e) {
                // ignore
            }
        }


        return simplifiedPrompt;
    }

    // If we have transcription rules, append them to the prompt
    if (transcriptionRules) {
        let rulesText = '\n\nAdditional transcription rules to follow:\n';

        // Add atmosphere if available
        if (transcriptionRules.atmosphere) {
            rulesText += `\n- Atmosphere: ${transcriptionRules.atmosphere}\n`;
        }

        // Add terminology if available
        if (transcriptionRules.terminology && transcriptionRules.terminology.length > 0) {
            rulesText += '\n- Terminology and Proper Nouns:\n';
            transcriptionRules.terminology.forEach(term => {
                rulesText += `  * ${term.term}: ${term.definition}\n`;
            });
        }

        // Add speaker identification if available
        if (transcriptionRules.speakerIdentification && transcriptionRules.speakerIdentification.length > 0) {
            rulesText += '\n- Speaker Identification:\n';
            transcriptionRules.speakerIdentification.forEach(speaker => {
                rulesText += `  * ${speaker.speakerId}: ${speaker.description}\n`;
            });
        }

        // Add formatting conventions if available
        if (transcriptionRules.formattingConventions && transcriptionRules.formattingConventions.length > 0) {
            rulesText += '\n- Formatting and Style Conventions:\n';
            transcriptionRules.formattingConventions.forEach(convention => {
                rulesText += `  * ${convention}\n`;
            });
        }

        // Add spelling and grammar rules if available
        if (transcriptionRules.spellingAndGrammar && transcriptionRules.spellingAndGrammar.length > 0) {
            rulesText += '\n- Spelling, Grammar, and Punctuation:\n';
            transcriptionRules.spellingAndGrammar.forEach(rule => {
                rulesText += `  * ${rule}\n`;
            });
        }

        // Add relationships if available
        if (transcriptionRules.relationships && transcriptionRules.relationships.length > 0) {
            rulesText += '\n- Relationships and Social Hierarchy:\n';
            transcriptionRules.relationships.forEach(relationship => {
                rulesText += `  * ${relationship}\n`;
            });
        }

        // Add additional notes if available
        if (transcriptionRules.additionalNotes && transcriptionRules.additionalNotes.length > 0) {
            rulesText += '\n- Additional Notes:\n';
            transcriptionRules.additionalNotes.forEach(note => {
                rulesText += `  * ${note}\n`;
            });
        }

        // Append the rules to the base prompt
        return basePrompt + rulesText;
    }

    // Return the base prompt if no rules are available
    return basePrompt;
};

const getDefaultTranslationPromptImpl = (subtitleText, targetLanguage, multiLanguage = false) => {
    // Count the number of subtitles by counting the lines
    const subtitleLines = subtitleText.split('\n').filter(line => line.trim());
    const subtitleCount = subtitleLines.length;

    if (multiLanguage && Array.isArray(targetLanguage)) {
        // For multiple languages
        const languageList = targetLanguage.join(', ');

        // Build example JSON with actual subtitle lines
        let exampleJson = '{\n  "translations": [';

        // Add examples for each language
        for (let langIndex = 0; langIndex < targetLanguage.length; langIndex++) {
            const lang = targetLanguage[langIndex];
            exampleJson += '\n    {\n      "language": "' + lang + '",\n      "texts": [';

            // Use all subtitle lines as examples
            for (let i = 0; i < subtitleLines.length; i++) {
                exampleJson += '\n        { "original": "' + subtitleLines[i].replace(/"/g, "'") + '", "translated": "[Translation in ' + lang + ']" }' + (i < subtitleLines.length - 1 ? ',' : '');
            }

            exampleJson += '\n      ]\n    }' + (langIndex < targetLanguage.length - 1 ? ',' : '');
        }

        exampleJson += '\n  ]\n}';

        return `Translate the following ${subtitleCount} subtitle texts to these languages: ${languageList}.

IMPORTANT INSTRUCTIONS:
1. Translate each line of text separately for EACH language.
2. DO NOT add any timestamps, SRT formatting, or other formatting.
3. DO NOT include any explanations, comments, or additional text in your response.
4. DO NOT include any SRT entry numbers, timestamps, or formatting in your translations.
5. DO NOT include quotes around your translations.
6. MAINTAIN exactly ${subtitleCount} lines in the same order for each language.
7. Each line in your response should correspond to the same line in the input.
8. If a line is empty, keep it empty in your response.
9. Return your response in a structured format with each language's translations grouped together.
10. For each subtitle, include BOTH the original text AND its translation to prevent mismatches.

Format your response as a JSON object with this structure:
${exampleJson}
`;
    } else {
        // Updated single language prompt to include original text
        // Build a JSON example with the actual subtitle lines
        let exampleJson = '[\n';

        // Add up to 5 example lines using the actual subtitle content
        // Use all subtitle lines as examples
        for (let i = 0; i < subtitleLines.length; i++) {
            // Use single quotes to avoid escaping issues
            const escapedLine = subtitleLines[i].replace(/"/g, "'");
            exampleJson += `  { "original": "${escapedLine}", "translated": "[Translation of this line in ${targetLanguage}]" }${i < subtitleLines.length - 1 ? ',' : ''}\n`;
        }

        exampleJson += ']';

        return `Translate the following ${subtitleCount} subtitle texts to ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1. Translate each line of text separately.
2. DO NOT add any timestamps, SRT formatting, or other formatting.
3. DO NOT include any explanations, comments, or additional text in your response.
4. DO NOT include any SRT entry numbers, timestamps, or formatting in your translations.
5. DO NOT include quotes around your translations.
6. MAINTAIN exactly ${subtitleCount} lines in the same order.
7. Each line in your response should correspond to the same line in the input.
8. If a line is empty, keep it empty in your response.
9. For each subtitle, include BOTH the original text AND its translation to prevent mismatches.

Format your response as a JSON array with objects containing both original and translated text:
${exampleJson}

`;
    }
};

const getDefaultConsolidatePromptImpl = (subtitlesText, language = null) => {
    const languageInstruction = language ?
        `CRITICAL INSTRUCTION: Your response MUST be in ${language} ONLY. DO NOT translate to English or any other language under any circumstances.` :
        `CRITICAL INSTRUCTION: You MUST maintain the EXACT SAME LANGUAGE as the original subtitles. DO NOT translate to English or any other language under any circumstances.`;

    return `${languageInstruction}

I have a collection of subtitles from a video or audio. Please convert these into a coherent document, organizing the content naturally based on the context. Maintain the original meaning but improve flow and readability.

${languageInstruction}

Provide a clear title and well-structured content for the document.

Here are the subtitles:\n\n${subtitlesText}

${languageInstruction}`;
};

const getDefaultSummarizePromptImpl = (subtitlesText, language = null) => {
    const languageInstruction = language ?
        `CRITICAL INSTRUCTION: Your response MUST be in ${language} ONLY. DO NOT translate to English or any other language under any circumstances.` :
        `CRITICAL INSTRUCTION: You MUST maintain the EXACT SAME LANGUAGE as the original subtitles. DO NOT translate to English or any other language under any circumstances.`;

    return `${languageInstruction}

I have a collection of subtitles from a video or audio. Please create a concise summary of the main points and key information. The summary should be about 1/3 the length of the original text but capture all essential information.

${languageInstruction}

Provide both a comprehensive summary and key points from the content.

Here are the subtitles:\n\n${subtitlesText}

${languageInstruction}`;
};

// Simple translation prompt for single subtitle retry
const getSimpleTranslationPromptImpl = (subtitleText, targetLanguage) => {
    if (Array.isArray(targetLanguage)) {
        const languageList = targetLanguage.join(', ');
        return `Translate the following text to ${languageList}. Return ONLY the translations, nothing else.

Text: ${subtitleText}`;
    } else {
        return `Translate the following text to ${targetLanguage}. Return ONLY the translation, nothing else.

Text: ${subtitleText}`;
    }
};

// Export all functions at the module level
export const getUserPromptPresets = getUserPromptPresetsImpl;
export const saveUserPromptPresets = saveUserPromptPresetsImpl;
export const getTranscriptionPrompt = getTranscriptionPromptImpl;
export const getDefaultTranslationPrompt = getDefaultTranslationPromptImpl;
export const getSimpleTranslationPrompt = getSimpleTranslationPromptImpl;
export const getDefaultConsolidatePrompt = getDefaultConsolidatePromptImpl;
export const getDefaultSummarizePrompt = getDefaultSummarizePromptImpl;
