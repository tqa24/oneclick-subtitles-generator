import { useRef, useEffect, useState } from 'react';

// Enhanced cache structure to store analysis results permanently
interface AnalyzerCache {
  audioUrl: string;
  volumeData: number[];
  timestamp: number;
}

// Global cache that persists across component renders
const globalAnalyzerCache: Record<string, AnalyzerCache> = {};

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private disposed = false;

  constructor() {
    // Nothing needed in constructor
  }

  private async initializeAudioContext() {
    if (!this.audioContext && !this.disposed) {
      this.audioContext = new AudioContext();
    }
  }

  async loadAudio(url: string): Promise<void> {
    try {
      await this.initializeAudioContext();
      if (!this.audioContext) return;

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  }

  private getAverageVolume(startTime: number, duration: number = 1.0): number {
    if (!this.audioBuffer) return 0;

    const sampleRate = this.audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const numSamples = Math.floor(duration * sampleRate);
    const channelData = this.audioBuffer.getChannelData(0);

    let sum = 0;
    let count = 0;

    for (let i = 0; i < numSamples; i++) {
      const sampleIndex = startSample + i;
      if (sampleIndex >= 0 && sampleIndex < channelData.length) {
        sum += Math.abs(channelData[sampleIndex]);
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  async analyzeFullAudio(): Promise<number[]> {
    if (!this.audioBuffer) return [];

    const duration = Math.ceil(this.audioBuffer.duration);
    const volumeData: number[] = [];

    // Instead of gradual increase, add padding with actual audio data
    // For leading padding, repeat the first few seconds of audio (or silence if very quiet)
    const firstFewSeconds: number[] = [];
    for (let second = 0; second < Math.min(5, duration); second++) {
      const volume = this.getAverageVolume(second, 1.0);
      firstFewSeconds.push(volume);
    }

    // Calculate average of first few seconds to use as padding
    const avgFirstFewSeconds = firstFewSeconds.length > 0
      ? firstFewSeconds.reduce((a, b) => a + b, 0) / firstFewSeconds.length
      : 0;

    // Add consistent padding at beginning
    const paddingSize = 40;
    for (let i = 0; i < paddingSize; i++) {
      // For initial padding, use the actual audio data or a consistent low value
      volumeData.push(avgFirstFewSeconds || 0.05);
    }

    // Calculate average volume for each second of actual audio
    for (let second = 0; second < duration; second++) {
      const volume = this.getAverageVolume(second, 1.0);
      volumeData.push(volume);
    }

    // Calculate average of last few seconds for trailing padding
    const lastFewSeconds: number[] = [];
    for (let second = Math.max(0, duration - 5); second < duration; second++) {
      const volume = this.getAverageVolume(second, 1.0);
      lastFewSeconds.push(volume);
    }

    const avgLastFewSeconds = lastFewSeconds.length > 0
      ? lastFewSeconds.reduce((a, b) => a + b, 0) / lastFewSeconds.length
      : 0;

    // Add trailing padding - match the audio's actual ending
    for (let i = 0; i < paddingSize; i++) {
      volumeData.push(avgLastFewSeconds || 0.05);
    }

    return volumeData;
  }

  dispose() {
    this.disposed = true;
    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close();
    }
    this.audioContext = null;
    this.audioBuffer = null;
  }
}

// Function to manually analyze audio
export const analyzeAudio = async (audioUrl: string): Promise<number[]> => {
  if (!audioUrl) return [];

  // Return cached results if available
  if (globalAnalyzerCache[audioUrl]) {
    console.log(`Using cached analysis for ${audioUrl}`);
    return globalAnalyzerCache[audioUrl].volumeData;
  }

  console.log(`Analyzing new audio file: ${audioUrl}`);
  // Otherwise perform analysis
  const analyzer = new AudioAnalyzer();
  try {
    await analyzer.loadAudio(audioUrl);
    const volumeData = await analyzer.analyzeFullAudio();

    // Cache the results globally with a timestamp
    globalAnalyzerCache[audioUrl] = {
      audioUrl,
      volumeData,
      timestamp: Date.now()
    };

    return volumeData;
  } catch (err) {
    console.error('Error analyzing audio:', err);
    return Array(300).fill(0.1); // Return consistent low-level dummy data on error
  } finally {
    analyzer.dispose();
  }
};

// Function to get the correct URL for server-side analysis (simplified for subtitled videos)
export const getAnalysisUrl = (mainUrl: string): string => {
  return mainUrl;
}

// Hook for components that need volume data
export const useAudioAnalyzer = (audioUrl: string | undefined) => {
  const [volumeData, setVolumeData] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!audioUrl) {
      setVolumeData([]);
      return;
    }

    const createDummyData = () => {
      // Use consistent low values for placeholder data
      return Array(280).fill(0.1);
    };

    const fetchData = async () => {
      setIsAnalyzing(true);

      try {
        // Use cached data if available
        if (globalAnalyzerCache[audioUrl]) {
          setVolumeData(globalAnalyzerCache[audioUrl].volumeData);
          setIsAnalyzing(false);
          return;
        }

        // If no cache, use consistent dummy data during analysis
        const dummyData = createDummyData();
        setVolumeData(dummyData);

        // Try to perform analysis in the background
        try {
          const data = await analyzeAudio(audioUrl);
          if (data.length > 0) {
            setVolumeData(data);
          }
        } catch (err) {
          console.error("Background analysis failed:", err);
          // Keep using dummy data if analysis fails
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to dummy data
        setVolumeData(createDummyData());
      } finally {
        setIsAnalyzing(false);
      }
    };

    fetchData();
  }, [audioUrl]);

  return {
    isAnalyzing: false,
    error,
    volumeData,
    getVolumeAtTime: (timeInSeconds: number) => {
      // Ensure timeInSeconds is non-negative
      const second = Math.max(0, Math.floor(timeInSeconds));
      // Add padding offset and return volume data or fallback value
      const paddedIndex = second + 40;
      return paddedIndex >= 0 && paddedIndex < volumeData.length
        ? volumeData[paddedIndex]
        : 0.05;
    }
  };
};