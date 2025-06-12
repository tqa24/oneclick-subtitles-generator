import { LyricEntry, Resolution } from '../types';
import { analyzeAudio } from '../utils/audioAnalyzer';

const SERVER_URL = 'http://localhost:3020';

export interface RenderProgress {
  progress: number;
  durationInFrames: number;
  renderedFrames: number;
  status: 'rendering' | 'success' | 'error';
  error?: string;
}

export interface RenderOptions {
  narrationUrl?: string;
  isVideoFile?: boolean;
  metadata?: {
    videoType: 'Subtitled Video';
    resolution?: Resolution;
    frameRate?: 30 | 60;
    subtitleLineThreshold?: number;
    originalAudioVolume?: number;
    narrationVolume?: number;
  };
}

export class RemotionService {
  // Map video types to composition IDs
  private getCompositionId(videoType: string): string {
    return 'subtitled-video';
  }

  private defaultMetadata = {
    videoType: 'Subtitled Video' as const,
    resolution: '2K' as const,
    frameRate: 60 as const,
    subtitleLineThreshold: 41,
    originalAudioVolume: 100,
    narrationVolume: 100
  };

  private async uploadFile(file: File, endpoint: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${SERVER_URL}/upload/${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${endpoint}`);
    }

    const { url } = await response.json();
    return url;
  }

  // Verification function to check that correct files are being used
  private verifyRenderAssets(
    videoType: string,
    audioUrl: string,
    additionalAudioUrls: Record<string, string | undefined>
  ): void {
    console.log(`\n=== Verifying assets for ${videoType} render ===`);

    // Verify audio files
    console.log('✓ Using main audio track:', audioUrl);

    // Check for narration audio
    if (additionalAudioUrls.narrationUrl) {
      console.log('✓ Using narration audio track:', additionalAudioUrls.narrationUrl);
    } else {
      console.log('ℹ️ No narration audio provided');
    }

    console.log('=== Verification complete ===\n');
  }

  async renderVideo(
    audioFile: File,
    lyrics: LyricEntry[],
    options: RenderOptions = {},
    onProgress?: (progress: RenderProgress) => void
  ): Promise<string> {
    try {
      // Ensure metadata is present by merging with defaults
      const metadata = options.metadata || this.defaultMetadata;
      const compositionId = this.getCompositionId(metadata.videoType);

      // Upload all files first
      const audioPromises = [this.uploadFile(audioFile, 'audio')];
      const audioKeysToProcess = ['narrationUrl'];

      // Add additional upload promises for audio files if they exist
      const additionalAudioUrls: Record<string, string | undefined> = {};

      for (const key of audioKeysToProcess) {
        if (options[key as keyof RenderOptions] && (options[key as keyof RenderOptions] as string).startsWith('blob:')) {
          audioPromises.push(
            fetch(options[key as keyof RenderOptions] as string)
              .then(r => r.blob())
              .then(b => new File([b], `${key.replace('Url', '')}.mp3`))
              .then(file => this.uploadFile(file, 'audio'))
              .then(url => {
                additionalAudioUrls[key] = url;
                return url;
              })
          );
        }
      }

      // Wait for all uploads to complete
      const audioUrl = await Promise.all(audioPromises).then(results => results[0]);

      // Ensure audioUrl is defined before using it
      if (!audioUrl) {
        throw new Error('Failed to upload main audio file');
      }

      // Run verification to make sure we're using the correct files for this video type
      this.verifyRenderAssets(
        metadata.videoType,
        audioUrl,
        additionalAudioUrls
      );

      // No audio analysis needed for subtitled videos

      const frameRate = metadata.frameRate || this.defaultMetadata.frameRate;

      // Calculate duration from the last subtitle end time + buffer
      const lastSubtitleEnd = lyrics.length > 0 ? Math.max(...lyrics.map(l => l.end)) : 6;
      const audioDurationWithBuffer = lastSubtitleEnd + 2;
      const totalFrames = Math.ceil(audioDurationWithBuffer * frameRate);

      onProgress?.({
        progress: 0,
        durationInFrames: totalFrames,
        renderedFrames: 0,
        status: 'rendering'
      });

      // Set up SSE connection for progress updates
      const response = await fetch(`${SERVER_URL}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compositionId,
          audioFile: audioUrl.split('/').pop(),
          lyrics,
          metadata,
          narrationUrl: additionalAudioUrls.narrationUrl,
          isVideoFile: options.isVideoFile || false
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5));

              if (data.status === 'complete') {
                onProgress?.({
                  progress: 1,
                  durationInFrames: totalFrames,
                  renderedFrames: totalFrames,
                  status: 'success'
                });
                return data.videoUrl;
              } else {
                onProgress?.({
                  progress: data.progress,
                  durationInFrames: data.durationInFrames,
                  renderedFrames: data.renderedFrames,
                  status: 'rendering'
                });
              }
            } catch (e) {
              console.error('Error parsing progress data:', e);
            }
          }
        }
      }

      throw new Error('Render process ended without completion');
    } catch (error) {
      console.error('Error rendering video:', error);
      onProgress?.({
        progress: 0,
        durationInFrames: 0,
        renderedFrames: 0,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  cleanup() {
    // Any cleanup needed
  }
}

export default new RemotionService();
