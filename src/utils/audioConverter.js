/**
 * Utility for converting audio files to formats supported by Gemini API
 */

/**
 * Convert an audio file to a format supported by Gemini API
 * @param {File} audioFile - The audio file to convert
 * @returns {Promise<File>} - A new File object with the converted audio
 */
export const convertAudioForGemini = async (audioFile) => {
    // Check if this is an audio file
    if (!audioFile.type.startsWith('audio/')) {
        console.log('Not an audio file, no conversion needed');
        return audioFile;
    }

    console.log('Converting audio file for Gemini API:', audioFile.name);
    
    // For audio/mpeg files, we need to change the MIME type to audio/mp3
    if (audioFile.type === 'audio/mpeg') {
        console.log('Converting MIME type from audio/mpeg to audio/mp3');
        return new File([audioFile], audioFile.name.replace(/\.mp3$/, '.mp3'), {
            type: 'audio/mp3',
            lastModified: audioFile.lastModified
        });
    }
    
    // For other audio files, we'll just return the original file for now
    // In a more complete implementation, we could use Web Audio API or a server-side
    // conversion to convert to a supported format
    return audioFile;
};

/**
 * Check if an audio file format is supported by Gemini API
 * @param {File} audioFile - The audio file to check
 * @returns {boolean} - Whether the format is supported
 */
export const isAudioFormatSupportedByGemini = (audioFile) => {
    // Gemini supports: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg, audio/flac
    const supportedTypes = [
        'audio/wav',
        'audio/mp3',
        'audio/aiff',
        'audio/aac',
        'audio/ogg',
        'audio/flac'
    ];
    
    // Special case for audio/mpeg which is equivalent to audio/mp3
    if (audioFile.type === 'audio/mpeg') {
        return true;
    }
    
    return supportedTypes.includes(audioFile.type);
};
