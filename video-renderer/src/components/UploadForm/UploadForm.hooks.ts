import { useState, useRef, useCallback } from 'react';
import { analyzeAudio } from '../../utils/audioAnalyzer';
import { LyricEntry } from '../../types';
import { parseSRT, isSRTContent } from '../../utils/srtParser';
import {
  AudioFiles,
  VideoMetadata
} from './UploadForm.types';

export const useUploadFormHandlers = (
  initialValues: any,
  onFilesChange: any,
  onVideoPathChange: any
) => {
  const [mainAudioFile, setMainAudioFile] = useState<File | null>(initialValues?.audioFiles.main || null);
  const [narrationFile, setNarrationFile] = useState<File | null>(initialValues?.audioFiles.narration || null);
  const [lyrics, setLyrics] = useState<LyricEntry[] | null>(initialValues?.lyrics || null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(initialValues?.lyricsFile || null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<{[key: string]: boolean}>({});
  const [videoPath, setVideoPath] = useState<string | null>(null);

  const mainAudioInputRef = useRef<HTMLInputElement>(null);
  const narrationInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  const debounce = <T extends (...args: any[]) => void>(fn: T, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return function (...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
  };

  const analyzeAudioFile = async (file: File): Promise<void> => {
    if (!file) return;

    const url = URL.createObjectURL(file);

    try {
      await analyzeAudio(url);
      console.log(`Analysis complete for ${file.name}`);
    } catch (err) {
      console.error(`Error analyzing audio file ${file.name}:`, err);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const updateFiles = () => {
    const audioFiles: AudioFiles = {
      main: mainAudioFile,
      narration: narrationFile
    };

    const metadata = {
      videoType: 'Subtitled Video',
      subtitleLineThreshold: 41,
      resolution: initialValues?.metadata?.resolution || '1080p',
      frameRate: initialValues?.metadata?.frameRate || 60,
      originalAudioVolume: (initialValues?.metadata as any)?.originalAudioVolume || 100,
      narrationVolume: (initialValues?.metadata as any)?.narrationVolume || 100
    } as VideoMetadata;

    onFilesChange(audioFiles, lyrics, metadata, lyricsFile);
  };



  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'narration') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        setError('Please upload a valid audio or video file');
        return;
      }

      switch(type) {
        case 'main':
          setMainAudioFile(file);
          break;
        case 'narration':
          setNarrationFile(file);
          break;
      }

      setError(null);
      await analyzeAudioFile(file);
      updateFiles();
    }
  };

  const handleLyricsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Check if it's a valid file type
      if (!file.name.endsWith('.json') && !file.name.endsWith('.srt')) {
        setError('Please upload a valid JSON or SRT file');
        return;
      }

      setLyricsFile(file);

      try {
        const text = await file.text();
        let parsedLyrics: LyricEntry[] = [];

        // Check if it's an SRT file
        if (file.name.endsWith('.srt') || isSRTContent(text)) {
          parsedLyrics = parseSRT(text);
          if (parsedLyrics.length === 0) {
            throw new Error('No valid subtitles found in SRT file');
          }
        } else {
          // Assume it's JSON
          const jsonData = JSON.parse(text);
          if (!Array.isArray(jsonData)) {
            throw new Error('Subtitles must be an array');
          }
          parsedLyrics = jsonData;
        }

        setLyrics(parsedLyrics);
        setError(null);
        onFilesChange(
          {
            main: mainAudioFile,
            narration: narrationFile
          },
          parsedLyrics,
          {
            videoType: 'Subtitled Video',
            resolution: initialValues?.metadata?.resolution || '1080p',
            frameRate: initialValues?.metadata?.frameRate || 60,
            originalAudioVolume: initialValues?.metadata?.originalAudioVolume || 100,
            narrationVolume: initialValues?.metadata?.narrationVolume || 100
          },
          file
        );
      } catch (err) {
        setError(`Invalid subtitles file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLyrics(null);
      }
    }
  };



  const handleDragEnter = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [type]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [type]: false }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (
    e: React.DragEvent,
    type: 'main' | 'narration' | 'lyrics'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [type]: false }));

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];

      switch (type) {
        case 'main':
          if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
            setError('Please upload a valid audio or video file');
            return;
          }
          setMainAudioFile(file);
          await analyzeAudioFile(file);
          break;
        case 'narration':
          if (!file.type.startsWith('audio/')) {
            setError('Please upload a valid audio file');
            return;
          }
          setNarrationFile(file);
          await analyzeAudioFile(file);
          break;
        case 'lyrics':
          if (!file.name.endsWith('.json') && !file.name.endsWith('.srt')) {
            setError('Please upload a valid JSON or SRT file');
            return;
          }
          setLyricsFile(file);
          try {
            const text = await file.text();
            let parsedLyrics: LyricEntry[] = [];

            // Check if it's an SRT file
            if (file.name.endsWith('.srt') || isSRTContent(text)) {
              parsedLyrics = parseSRT(text);
              if (parsedLyrics.length === 0) {
                throw new Error('No valid subtitles found in SRT file');
              }
            } else {
              // Assume it's JSON
              const jsonData = JSON.parse(text);
              if (!Array.isArray(jsonData)) {
                throw new Error('Subtitles must be an array');
              }
              parsedLyrics = jsonData;
            }

            setLyrics(parsedLyrics);
            onFilesChange(
              {
                main: mainAudioFile,
                narration: narrationFile
              },
              parsedLyrics,
              {
                videoType: 'Subtitled Video',
                resolution: initialValues?.metadata?.resolution || '1080p',
                frameRate: initialValues?.metadata?.frameRate || 60,
                originalAudioVolume: (initialValues?.metadata as any)?.originalAudioVolume || 100,
                narrationVolume: (initialValues?.metadata as any)?.narrationVolume || 100
              } as VideoMetadata,
              file
            );
            setError(null);
          } catch (err) {
            setError('Invalid subtitles file format');
            setLyrics(null);
            return;
          }
          break;
      }
      setError(null);
      updateFiles();
    }
  };

  const handleBulkDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, bulk: false }));

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    setError(null);

    let detectedMain: File | null = null;
    let detectedNarration: File | null = null;
    let detectedLyrics: File | null = null;
    let parsedLyrics: LyricEntry[] | null = null;

    for (const file of files) {
      // Check for subtitle files (JSON or SRT)
      if (file.name.endsWith('.json') || file.name.endsWith('.srt')) {
        try {
          const text = await file.text();

          // Check if it's an SRT file
          if (file.name.endsWith('.srt') || isSRTContent(text)) {
            const srtLyrics = parseSRT(text);
            if (srtLyrics.length > 0) {
              parsedLyrics = srtLyrics;
              detectedLyrics = file;
              continue;
            }
          } else {
            // Assume it's JSON
            const jsonData = JSON.parse(text);
            if (Array.isArray(jsonData)) {
              parsedLyrics = jsonData;
              detectedLyrics = file;
              continue;
            }
          }
        } catch (err) {
          // Just skip invalid files in bulk upload
          console.error('Error parsing subtitle file:', err);
        }
      }

      // Check for audio/video files
      if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        const nameLower = file.name.toLowerCase();
        if (nameLower.includes('narration') || nameLower.includes('voice')) {
          detectedNarration = file;
          await analyzeAudioFile(file);
        } else {
          detectedMain = file;
          await analyzeAudioFile(file);
        }
        continue;
      }
    }

    if (detectedMain) setMainAudioFile(detectedMain);
    if (detectedNarration) setNarrationFile(detectedNarration);
    if (detectedLyrics) setLyricsFile(detectedLyrics);
    if (parsedLyrics) setLyrics(parsedLyrics);

    setTimeout(() => {
      const audioFiles: AudioFiles = {
        main: detectedMain,
        narration: detectedNarration
      };

      const metadata = {
        videoType: 'Subtitled Video',
        resolution: initialValues?.metadata?.resolution || '1080p',
        frameRate: initialValues?.metadata?.frameRate || 60,
        originalAudioVolume: (initialValues?.metadata as any)?.originalAudioVolume || 100,
        narrationVolume: (initialValues?.metadata as any)?.narrationVolume || 100
      } as VideoMetadata;

      onFilesChange(audioFiles, parsedLyrics, metadata, detectedLyrics);
    }, 0);
  };

  const resetForm = () => {
    setMainAudioFile(null);
    setNarrationFile(null);
    setLyricsFile(null);
    setLyrics(null);
    setError(null);
    setVideoPath(null);
    onFilesChange(
      { main: null, narration: null },
      null,
      {
        videoType: 'Subtitled Video',
        subtitleLineThreshold: 41,
        resolution: '1080p',
        frameRate: 60,
        originalAudioVolume: 100,
        narrationVolume: 100
      } as VideoMetadata,
      null
    );

    if (mainAudioInputRef.current) mainAudioInputRef.current.value = '';
    if (narrationInputRef.current) narrationInputRef.current.value = '';
    if (lyricsInputRef.current) lyricsInputRef.current.value = '';
  };

  return {
    mainAudioFile,
    narrationFile,
    lyrics,
    lyricsFile,
    error,
    isDragging,
    videoPath,
    mainAudioInputRef,
    narrationInputRef,
    lyricsInputRef,
    handleAudioChange,
    handleLyricsChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleBulkDrop,
    resetForm
  };
};
