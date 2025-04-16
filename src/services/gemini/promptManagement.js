/**
 * Prompt management for Gemini API
 * Handles prompt presets and custom prompts
 */

import i18n from '../../i18n/i18n';
import { getTranscriptionRules } from '../../utils/transcriptionRulesStore';

// Default transcription prompts
export const PROMPT_PRESETS = [
    {
        id: 'general',
        title: 'General purpose',
        prompt: `You are an expert transcriber. Your task is to transcribe the primary spoken content in this ${'{contentType}'}. Ignore non-essential background noise and periods of silence. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed text (1-2 sentences max). For example: [00m30s000ms - 00m35s500ms] This is the transcribed speech. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted transcript lines. Do not include any headers, summaries, introductions, or any other text whatsoever.

IMPORTANT: If there is no speech or spoken content in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'extract-text',
        title: 'Extract text',
        prompt: `Your task is to extract only the visible text and/or hardcoded subtitles appearing on screen within this ${'{contentType}'}. Completely ignore all audio content. Format the output as a sequential transcript showing exactly when the text appears and disappears. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Extracted on-screen text (1-2 lines/sentences max). For example: [00m30s000ms - 00m35s500ms] This text appeared on screen. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted text entries with their timestamps. Provide absolutely no other text, headers, or explanations.

IMPORTANT: If there is no visible text in the video, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'focus-spoken-words',
        title: 'Focus on Spoken Words',
        prompt: `Focus exclusively on the spoken words (dialogue, narration) in this ${'{contentType}'}. Transcribe ONLY the audible speech. Explicitly ignore any song lyrics, background music, on-screen text, and non-speech sounds. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed spoken words (1-2 sentences max). For example: [00m30s000ms - 00m35s500ms] This is the spoken dialogue. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted transcript lines of spoken words, with no extra text, headers, or explanations.

IMPORTANT: If there is no spoken dialogue in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'focus-lyrics',
        title: 'Focus on Lyrics',
        prompt: `Focus exclusively on the song lyrics sung in this ${'{contentType}'}. Transcribe ONLY the audible lyrics. Explicitly ignore any spoken words (dialogue, narration), background music without vocals, on-screen text, and non-lyrical sounds. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed lyrics (1-2 lines/sentences max). For example: [00m45s100ms - 00m50s250ms] These are the lyrics being sung. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted transcript lines of lyrics, with no extra text, headers, or explanations.

IMPORTANT: If there are no sung lyrics in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'describe-video',
        title: 'Describe video',
        prompt: `Describe the significant visual events, actions, and scene changes occurring in this ${'{contentType}'} in chronological order. Focus solely on what is visually happening on screen. Format the output as a descriptive log. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Visual description (1-2 sentences max). For example: [00m30s000ms - 00m35s500ms] A person walks across the screen. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted descriptions with their timestamps. Do not include any audio transcription, headers, or other commentary.

IMPORTANT: If the video is blank or has no significant visual content, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
        id: 'translate-vietnamese',
        title: 'Translate directly',
        prompt: `Identify the spoken language(s) in this ${'{contentType}'} and translate the speech directly into TARGET_LANGUAGE. If multiple languages are spoken, translate all spoken segments into TARGET_LANGUAGE. Format the output as a sequential transcript of the translation. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] translated text (1-2 translated sentences max). For example: [00m30s000ms - 00m35s500ms] This is the translated text. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). Return ONLY the formatted translation lines with timestamps. Do not include the original language transcription, headers, or any other text.

IMPORTANT: If there is no speech in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
    },
    {
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
        prompt: `You are an expert transcriber capable of speaker identification (diarization). Your task is to transcribe the spoken content in this ${'{contentType}'} AND identify who is speaking for each segment. Assign generic labels like 'Speaker 1', 'Speaker 2', etc., consistently throughout the transcript if specific names are not clearly identifiable or mentioned. Format the output as a sequential transcript. Each line MUST strictly follow the format: Speaker Label [MMmSSsNNNms - MMmSSsNNNms] Transcribed text. Example: Speaker 1 [0m5s123ms - 0m10s456ms] This is what the first speaker said. Each entry must represent a continuous segment from a single speaker. Return ONLY the formatted speaker transcript lines following this exact structure. Do not include headers, speaker inventories, introductions, summaries, or any other text or formatting.`
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
    // Get custom prompt from localStorage or use default
    const customPrompt = localStorage.getItem('transcription_prompt');

    // Get the transcription rules if available
    const transcriptionRules = getTranscriptionRules();

    // Base prompt (either custom or default)
    let basePrompt;
    if (customPrompt && customPrompt.trim() !== '') {
        basePrompt = customPrompt.replace('{contentType}', contentType);
    } else {
        basePrompt = PROMPT_PRESETS[0].prompt.replace('{contentType}', contentType);
    }

    // If we have user-provided subtitles, replace the entire prompt with a simplified version
    if (userProvidedSubtitles && userProvidedSubtitles.trim() !== '') {
        // Use a very simple prompt that only focuses on timing the provided subtitles
        // No preset information, no transcription rules, just the core task
        console.log('SIMPLIFIED PROMPT: Using simplified prompt for user-provided subtitles');
        console.log('USER SUBTITLES:', userProvidedSubtitles);
        console.log('CALLER INFO:', new Error().stack);

        // Split the subtitles into an array and count them
        const subtitleLines = userProvidedSubtitles.trim().split('\n').filter(line => line.trim() !== '');
        const subtitleCount = subtitleLines.length;
        console.log(`Found ${subtitleCount} subtitle lines to time`);

        // Create a numbered list of subtitles for the prompt
        const numberedSubtitles = subtitleLines.map((line, index) => `[${index}] ${line}`).join('\n');

        // Get segment information if available
        const segmentInfo = options?.segmentInfo || {};
        const isSegment = segmentInfo.isSegment || false;
        const segmentIndex = segmentInfo.segmentIndex !== undefined ? segmentInfo.segmentIndex : null;
        const segmentStartTime = segmentInfo.startTime !== undefined ? segmentInfo.startTime : 0;
        const segmentDuration = segmentInfo.duration !== undefined ? segmentInfo.duration : null;
        const totalDuration = segmentInfo.totalDuration !== undefined ? segmentInfo.totalDuration : null;

        let segmentInfoText = '';
        if (isSegment && segmentIndex !== null && segmentDuration !== null && totalDuration !== null) {
            segmentInfoText = `\nIMPORTANT SEGMENT INFORMATION:\n- This is segment #${segmentIndex + 1} of a longer video\n- This segment starts at ${segmentStartTime.toFixed(2)} seconds in the original video\n- This segment is ${segmentDuration.toFixed(2)} seconds long\n- The total video duration is ${totalDuration.toFixed(2)} seconds\n\nNOTE: Even though this is a segment of a longer video, please provide timestamps starting from 0:00 for this segment. We will adjust the timestamps later.`;
        }

        let simplifiedPrompt;
        if (isSegment) {
            // For segments, we need a more flexible approach
            simplifiedPrompt = `CRITICAL INSTRUCTION: I have a segment of a video and a list of all possible subtitles for the entire video. Your task is to:

1. IDENTIFY which of the numbered subtitles below appear in this specific video segment
2. Provide ACCURATE TIMESTAMPS for ONLY those subtitles that appear in this segment

DO NOT transcribe or generate any new text content. DO NOT translate or modify the provided subtitles in any way.${segmentInfoText}

You MUST return timing entries ONLY for subtitles that appear in this segment, in the following JSON format:
[
  { "index": 3, "startTime": "00m00s500ms", "endTime": "00m01s000ms" },
  { "index": 4, "startTime": "00m01s100ms", "endTime": "00m02s000ms" },
  ...
]

IMPORTANT RULES:
1. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms)
2. The index must match the subtitle number in brackets from the list below
3. Only include subtitles that actually appear in this segment
4. DO NOT include the subtitle text in your response, ONLY the timing information and index
5. If you hear something different in the audio, use the EXACT text from the numbered list below
6. Timestamps should be relative to the START of this segment (start at 0:00)
7. CRITICAL: ONLY use index numbers that exist in the list below (0 to ${subtitleCount - 1}). DO NOT make up new indices.
8. If you're not 100% certain a subtitle appears in this segment, DO NOT include it.

Here are ALL possible subtitles for the entire video (with index numbers from 0 to ${subtitleCount - 1}):\n\n${numberedSubtitles}`;
        } else {
            // For full video processing, we can use the original approach
            simplifiedPrompt = `CRITICAL INSTRUCTION: Your ONLY task is to provide accurate timestamps for the subtitles below.

DO NOT transcribe or generate any new text content. DO NOT translate or modify the provided subtitles in any way.

You MUST return timing entries in the following JSON format:
[
  { "index": 0, "startTime": "00m00s500ms", "endTime": "00m01s000ms" },
  { "index": 1, "startTime": "00m01s100ms", "endTime": "00m02s000ms" },
  ...
]

IMPORTANT RULES:
1. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms)
2. The index must match the subtitle number in brackets below
3. Only include subtitles that actually appear in the video
4. DO NOT include the subtitle text in your response, ONLY the timing information
5. If you hear something different in the audio, use the EXACT text from the numbered list below
6. CRITICAL: ONLY use index numbers that exist in the list below (0 to ${subtitleCount - 1}). DO NOT make up new indices.
7. If you're not 100% certain a subtitle appears in the video, DO NOT include it.

Here are the subtitles to time (with index numbers from 0 to ${subtitleCount - 1}):\n\n${numberedSubtitles}`;
        }

        console.log('SIMPLIFIED PROMPT CONTENT:', simplifiedPrompt);
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
            for (let i = 0; i < Math.min(3, subtitleLines.length); i++) {
                exampleJson += '\n        { "original": "' + subtitleLines[i].replace(/"/g, '\"') + '", "translated": "[Translation in ' + lang + ']" }' + (i < Math.min(3, subtitleLines.length) - 1 ? ',' : '');
            }

            // If there are more lines, add ellipsis
            if (subtitleLines.length > 3) {
                exampleJson += ',\n        ...';
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
            exampleJson += `  { "original": "${subtitleLines[i].replace(/"/g, '\\"')}", "translated": "[Translation of this line in ${targetLanguage}]" }${i < subtitleLines.length - 1 ? ',' : ''}\n`;
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

IMPORTANT: Your response should ONLY contain the consolidated document text as plain text.
DO NOT include any explanations, comments, headers, JSON formatting, or additional text in your response.
DO NOT structure your response as JSON with title and content fields.
DO NOT use markdown formatting.
Just return the plain text of the consolidated document.

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

IMPORTANT: Your response should ONLY contain the summary text as plain text.
DO NOT include any explanations, comments, headers, JSON formatting, or additional text in your response.
DO NOT structure your response as JSON with title and content fields.
DO NOT use markdown formatting.
Just return the plain text of the summary.

IMPORTANT: Your response should ONLY contain the summary text.
DO NOT include any explanations, comments, headers, or additional text in your response.
DO NOT include phrases like "Here's a summary" or "In summary" at the beginning.

Here are the subtitles:\n\n${subtitlesText}

${languageInstruction}`;
};

// Export all functions at the module level
export const getUserPromptPresets = getUserPromptPresetsImpl;
export const saveUserPromptPresets = saveUserPromptPresetsImpl;
export const getTranscriptionPrompt = getTranscriptionPromptImpl;
export const getDefaultTranslationPrompt = getDefaultTranslationPromptImpl;
export const getDefaultConsolidatePrompt = getDefaultConsolidatePromptImpl;
export const getDefaultSummarizePrompt = getDefaultSummarizePromptImpl;
