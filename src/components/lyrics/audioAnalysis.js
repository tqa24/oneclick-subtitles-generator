// Pure volume analysis helpers: channelData + config -> normalized volumeData.

export const analyzeVolume = async (channelData, sampleSize = 1000, audioDuration = null, videoDuration = null) => {
    // Calculate how many samples to process based on video duration vs audio buffer duration
    const effectiveDuration = videoDuration && audioDuration ?
        Math.min(videoDuration, audioDuration) : (audioDuration || videoDuration || 1);
    const durationRatio = audioDuration ? effectiveDuration / audioDuration : 1;
    const samplesToProcess = Math.floor(channelData.length * durationRatio);

    const samplesPerSegment = Math.floor(samplesToProcess / sampleSize);
    const volumeData = new Float32Array(sampleSize);
    let maxVolume = 0;

    // First pass: calculate RMS and find max
    for (let i = 0; i < sampleSize; i++) {
        const startSample = i * samplesPerSegment;
        const endSample = Math.min(startSample + samplesPerSegment, samplesToProcess);
        let sum = 0;
        let count = 0;
        for (let j = startSample; j < endSample; j++) {
            sum += channelData[j] * channelData[j];
            count++;
        }
        const rms = count > 0 ? Math.sqrt(sum / count) : 0;
        volumeData[i] = rms;
        if (rms > maxVolume) maxVolume = rms;

        if (i % 50 === 0) { // More frequent yielding for better UI responsiveness
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Second pass: normalize and apply curve
    if (maxVolume > 0) {
        for (let i = 0; i < volumeData.length; i++) {
            // Normalize to 0-1
            let normalized = volumeData[i] / maxVolume;

            // Apply gentle curve
            normalized = Math.pow(normalized, 0.75);

            // Add small floor to ensure visibility of quiet sections
            volumeData[i] = Math.max(normalized, 0.01);
        }
    } else {
        // If no volume detected, set minimum values
        for (let i = 0; i < volumeData.length; i++) {
            volumeData[i] = 0.01;
        }
    }

    return volumeData;
};

export const analyzeVolumeSync = (channelData, sampleSize = 1000, audioDuration = null, videoDuration = null) => {
    // Calculate how many samples to process based on video duration vs audio buffer duration
    const effectiveDuration = videoDuration && audioDuration ?
        Math.min(videoDuration, audioDuration) : (audioDuration || videoDuration || 1);
    const durationRatio = audioDuration ? effectiveDuration / audioDuration : 1;
    const samplesToProcess = Math.floor(channelData.length * durationRatio);

    const samplesPerSegment = Math.floor(samplesToProcess / sampleSize);
    const volumeData = new Float32Array(sampleSize);
    let maxVolume = 0;

    // Calculate RMS and find max - synchronous for better performance
    for (let i = 0; i < sampleSize; i++) {
        const startSample = i * samplesPerSegment;
        const endSample = Math.min(startSample + samplesPerSegment, samplesToProcess);
        let sum = 0;
        let count = 0;
        for (let j = startSample; j < endSample; j++) {
            sum += channelData[j] * channelData[j];
            count++;
        }
        const rms = count > 0 ? Math.sqrt(sum / count) : 0;
        volumeData[i] = rms;
        if (rms > maxVolume) maxVolume = rms;
    }

    // Normalize and apply curve
    if (maxVolume > 0) {
        for (let i = 0; i < volumeData.length; i++) {
            // Normalize to 0-1
            let normalized = volumeData[i] / maxVolume;

            // Apply gentle curve
            normalized = Math.pow(normalized, 0.75);

            // Add small floor to ensure visibility of quiet sections
            volumeData[i] = Math.max(normalized, 0.01);
        }
    } else {
        // If no volume detected, set minimum values
        for (let i = 0; i < volumeData.length; i++) {
            volumeData[i] = 0.01;
        }
    }

    return volumeData;
};
