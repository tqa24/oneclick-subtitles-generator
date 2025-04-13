/**
 * Utility for immediately converting audio files to video files
 */

/**
 * Convert an audio file to video by sending it to the server for conversion
 * @param {File} audioFile - The audio file to convert
 * @param {Function} onStatusUpdate - Optional callback for status updates
 * @returns {Promise<File>} - A new File object with the converted video
 */
export const convertAudioToVideo = async (audioFile, onStatusUpdate = null) => {
    // Check if this is an audio file
    if (!audioFile.type.startsWith('audio/')) {
        console.log('Not an audio file, no conversion needed');
        return audioFile;
    }

    if (onStatusUpdate) {
        onStatusUpdate({
            message: 'Processing audio...',
            type: 'loading'
        });
    }

    try {
        console.log(`Converting audio file to video: ${audioFile.name}`);
        console.log(`Audio file type: ${audioFile.type}, size: ${audioFile.size} bytes`);

        // Call the server endpoint to convert audio to video
        const response = await fetch('http://localhost:3004/api/convert-audio-to-video', {
            method: 'POST',
            body: audioFile,
            headers: {
                'Content-Type': audioFile.type
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to convert audio to video: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Audio conversion result:', result);

        // Fetch the converted video as a blob
        const videoUrl = `http://localhost:3004${result.video}`;
        const videoResponse = await fetch(videoUrl);
        const videoBlob = await videoResponse.blob();

        // Original audio filename for reference
        const originalAudioName = audioFile.name;

        // Create a File object from the blob
        // We'll use a video extension internally, but keep the original name for display
        const videoFile = new File(
            [videoBlob],
            audioFile.name.replace(/\.(mp3|wav|ogg|aac)$/i, '.mp4'),
            { type: 'video/mp4' }
        );

        console.log(`Audio successfully converted to video: ${originalAudioName} → ${videoFile.name}`);
        console.log(`Video file type: ${videoFile.type}, size: ${videoFile.size} bytes`);

        return videoFile;
    } catch (error) {
        console.error('Error converting audio to video:', error);
        throw error;
    }
};
