/**
 * Prompt management for Gemini API
 * Handles prompt presets and custom prompts
 */

import { getTranscriptionRules } from '../../utils/transcriptionRulesStore';

// Default transcription prompts
export const PROMPT_PRESETS = [
{
id: 'general',
title: 'General purpose',
prompt: `You are an expert transcriber. Your task is to transcribe every possible spoken content in this ${'{contentType}'}. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed text. For example: [00m30s000ms - 00m35s500ms] This is the transcribed speech. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). **CRITICAL: Break the transcription into VERY SHORT segments. Focus on natural pauses, breath breaks, and short phrases. Aim for segments that are typically only a few words long. Do NOT create long segments covering multiple sentences.** Return ONLY the formatted transcript lines. Do not include any headers, summaries, introductions, or any other text whatsoever.
IMPORTANT: If there is no speech or spoken content in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
},
{
id: 'extract-text',
title: 'Extract text',
prompt: `Your task is to extract only the visible text and/or hardcoded subtitles appearing on screen within this ${'{contentType}'}. Completely ignore all audio content. Format the output as a sequential transcript showing exactly when the text appears and disappears. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Extracted on-screen text. For example: [00m30s000ms - 00m35s500ms] This text appeared on screen. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). **CRITICAL: Each entry MUST represent a single, distinct piece of text that appears/disappears. Keep the text per entry AS SHORT AS POSSIBLE, reflecting only what appears at that specific moment. If text elements change or update, create a new entry.** Return ONLY the formatted text entries with their timestamps. Provide absolutely no other text, headers, or explanations.
IMPORTANT: If there is no visible text in the video, return an empty array []. Do not return timestamps with empty text or placeholder text.`
},
{
id: 'focus-lyrics',
title: 'Focus on Lyrics',
prompt: `Focus exclusively on the song lyrics sung in this ${'{contentType}'}. Transcribe ONLY the audible lyrics. Explicitly ignore any spoken words (dialogue, narration), background music without vocals, on-screen text, and non-lyrical sounds. Format the output as a sequential transcript. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Transcribed lyrics. For example: [00m45s100ms - 00m50s250ms] These are the lyrics being sung. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). **CRITICAL: Break lyrics into VERY SHORT segments, ideally reflecting individual sung phrases or even sub-phrases. Aim for segments of only a few words based on musical phrasing and pauses. Do not transcribe long lines.** Return ONLY the formatted transcript lines of lyrics, with no extra text, headers, or explanations.
IMPORTANT: If there are no sung lyrics in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
},
{
id: 'describe-video',
title: 'Describe video',
prompt: `Describe the significant visual events, actions, and scene changes occurring in this ${'{contentType}'} in chronological order. Focus solely on what is visually happening on screen. Format the output as a descriptive log. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] Visual description. For example: [00m30s000ms - 00m35s500ms] A person walks across the screen. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). **CRITICAL: Descriptions MUST be VERY concise and tied to specific, brief visual moments or changes. Break down actions into their smallest distinct parts. For example, instead of 'Man walks to the door and opens it', use two lines: '[...] Man walks to door.' and '[...] Man opens door.' Aim for minimal words per entry.** Return ONLY the formatted descriptions with their timestamps. Do not include any audio transcription, headers, or other commentary.
IMPORTANT: If the video is blank or has no significant visual content, return an empty array []. Do not return timestamps with empty text or placeholder text.`
},
{
id: 'translate-directly',
title: 'Translate directly',
prompt: `Identify the spoken language(s) in this ${'{contentType}'} and translate the speech directly into TARGET_LANGUAGE. If multiple languages are spoken, translate all spoken segments into TARGET_LANGUAGE. Format the output as a sequential transcript of the translation. Each line MUST strictly follow the format: [MMmSSsNNNms - MMmSSsNNNms] translated text. For example: [00m30s000ms - 00m35s500ms] This is the translated text. Always use leading zeros for minutes and seconds (e.g., 00m05s100ms, not 0m5s100ms). **CRITICAL: Break the translation into VERY SHORT segments. Aim for translated segments that reflect natural, short spoken phrases, ideally only a few words long. Do NOT create long segments covering multiple original sentences or ideas.** Return ONLY the formatted translation lines with timestamps. Do not include the original language transcription, headers, or any other text.
IMPORTANT: If there is no speech in the audio, return an empty array []. Do not return timestamps with empty text or placeholder text.`
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
prompt: `You are an expert transcriber capable of speaker identification (diarization). Your task is to transcribe the spoken content in this ${'{contentType}'} AND identify who is speaking for each segment. Assign generic labels like 'Speaker 1', 'Speaker 2', etc., consistently throughout the transcript if specific names are not clearly identifiable or mentioned. Format the output as a sequential transcript. Each line MUST strictly follow the format: Speaker Label [MMmSSsNNNms - MMmSSsNNNms] Transcribed text. Example: Speaker 1 [0m5s123ms - 0m10s456ms] This is what the first speaker said. Each entry must represent a continuous segment from a single speaker. **CRITICAL: Within each speaker's turn, break the transcription into VERY SHORT segments. Focus intensely on natural pauses, breath breaks, and short phrases. Aim for segments containing only a few words each. Do NOT combine multiple phrases or sentences into one long segment.** Return ONLY the formatted speaker transcript lines following this exact structure. Do not include headers, speaker inventories, introductions, summaries, or any other text or formatting.`
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

    // Get the transcription rules if available
    const transcriptionRules = getTranscriptionRules();

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
        const isSegment = segmentInfo.isSegment || false;
        const segmentIndex = segmentInfo.segmentIndex !== undefined ? segmentInfo.segmentIndex : null;
        const segmentStartTime = segmentInfo.startTime !== undefined ? segmentInfo.startTime : 0;
        const segmentDuration = segmentInfo.duration !== undefined ? segmentInfo.duration : null;
        const totalDuration = segmentInfo.totalDuration !== undefined ? segmentInfo.totalDuration : null;

        let segmentInfoText = '';
        if (isSegment && segmentIndex !== null && segmentDuration !== null && totalDuration !== null) {
            segmentInfoText = `\nIMPORTANT SEGMENT INFORMATION:\n- This is segment #${segmentIndex + 1} of a longer video\n- This segment starts at ${segmentStartTime.toFixed(2)} seconds in the original video\n- This segment is ${segmentDuration.toFixed(2)} seconds long\n- The total video duration is ${totalDuration.toFixed(2)} seconds\n\nNOTE: Even though this is a segment of a longer video, please provide timestamps starting from 0:00 for this segment. We will adjust the timestamps later.`;
        }

        // Build example JSON with ALL subtitle lines (exactly like translation prompt)
        let exampleJson = '[\n';

        // Add ALL subtitle lines as examples (not just a few)
        for (let i = 0; i < subtitleLines.length; i++) {
            const escapedLine = subtitleLines[i].replace(/"/g, "'");
            exampleJson += `  { "index": ${i}, "startTime": "00m00s500ms", "endTime": "00m01s000ms", "text": "${escapedLine}" }${i < subtitleLines.length - 1 ? ',' : ''}\n`;
        }

        exampleJson += ']';

        let simplifiedPrompt;
        if (isSegment) {
            // For segments, we need a more flexible approach
            simplifiedPrompt = `🚨 CRITICAL INSTRUCTION: I have a segment of a video and a list of all possible subtitles for the entire video.

YOUR TASKS:
1. IDENTIFY which numbered subtitles appear in this specific video segment
2. Provide ACCURATE TIMESTAMPS for those subtitles
3. Each numbered line that appears gets exactly ONE separate entry

⚠️ ABSOLUTE PROHIBITION:
- DO NOT combine multiple subtitle lines into one entry
- DO NOT merge similar or repetitive lines
- DO NOT modify or paraphrase any text
- DO NOT transcribe new content${segmentInfoText}

✅ MANDATORY FORMAT: Return timing entries for subtitles in this segment using this JSON format:
${exampleJson}

🔒 STRICT RULES - VIOLATION WILL RESULT IN FAILURE:
1. ✅ Each numbered subtitle that appears = exactly ONE separate entry (1:1 mapping)
2. ✅ DO NOT combine lines, even if they seem identical like "나가 나가"
3. ✅ Use EXACT text from numbered list, including parentheses like "(나 는 여 기 에 있 어)"
4. ✅ Include ALL instances of repetitive content as separate entries
5. ✅ Use leading zeros for time format (00m05s100ms, not 0m5s100ms)
6. ✅ Index must match the subtitle number in brackets from list below
7. ✅ If audio differs from text, still use EXACT text from numbered list
8. ✅ Timestamps relative to START of this segment (start at 0:00)
9. ✅ ONLY use index numbers that exist in list below (0 to ${subtitleCount - 1})
10. ✅ Include BOTH index AND exact text to prevent mismatches
11. ✅ Even very short or repetitive lines get separate entries

🎯 EXAMPLE VERIFICATION:
If you hear "[5] 나가" in this segment, output: {"index": 5, "startTime": "...", "endTime": "...", "text": "나가"}
If you hear "[10] 나가" in this segment, output: {"index": 10, "startTime": "...", "endTime": "...", "text": "나가"}
These are TWO SEPARATE entries, never combine them.

Here are ALL possible subtitles for the entire video (each numbered line that appears in this segment gets its own separate entry):\n\n${numberedSubtitles}`;
        } else {
            // For full video processing, enforce absolute strict one-to-one correspondence
            simplifiedPrompt = `🚨 CRITICAL INSTRUCTION: You MUST provide timing for ALL ${subtitleCount} subtitles below. NO EXCEPTIONS. NO COMBINING. NO MERGING.

⚠️ ABSOLUTE PROHIBITION:
- DO NOT combine multiple lines into one entry
- DO NOT merge similar or repetitive lines
- DO NOT skip any lines
- DO NOT paraphrase or modify any text
- DO NOT transcribe or generate new content

✅ MANDATORY REQUIREMENT: Return exactly ${subtitleCount} separate timing entries in this JSON format:
${exampleJson}

🔒 STRICT RULES - VIOLATION WILL RESULT IN FAILURE:
1. ✅ MANDATORY: Return exactly ${subtitleCount} entries, no more, no less
2. ✅ MANDATORY: Each entry = exactly ONE line from the numbered list (1:1 mapping)
3. ✅ MANDATORY: Use EXACT text from each numbered line (copy-paste accuracy)
4. ✅ MANDATORY: Include ALL lines, even repetitive ones like "나가 나가" or "(나 는 여 기 에 있 어)"
5. ✅ MANDATORY: Each line [0] through [${subtitleCount - 1}] gets its own separate entry
6. ✅ MANDATORY: Preserve ALL parentheses, spaces, and punctuation exactly
7. ✅ MANDATORY: Use leading zeros for time format (00m05s100ms, not 0m5s100ms)
8. ✅ MANDATORY: Index must match the line number in brackets [0] to [${subtitleCount - 1}]
9. ✅ MANDATORY: Even if lines seem identical or very short, each gets separate entry
10. ✅ MANDATORY: If audio differs from text, still use EXACT text from numbered list

🎯 SUCCESS CRITERIA:
- Input: ${subtitleCount} numbered lines
- Output: ${subtitleCount} JSON entries
- Mapping: Line [0] → Entry with index 0, Line [1] → Entry with index 1, etc.

📝 EXAMPLE VERIFICATION:
If you see "[5] 나가" in the list, your response must include: {"index": 5, "startTime": "...", "endTime": "...", "text": "나가"}
If you see "[10] 나가" in the list, your response must include: {"index": 10, "startTime": "...", "endTime": "...", "text": "나가"}
These are TWO SEPARATE entries, not one combined entry.

Here are ALL ${subtitleCount} subtitles to time (each numbered line = one separate entry):\n\n${numberedSubtitles}`;
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
