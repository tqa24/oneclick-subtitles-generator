import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../styles/VideoProcessingOptionsModal.css';
import { getNextAvailableKey } from '../services/gemini/keyManager';
import { PROMPT_PRESETS, getUserPromptPresets, DEFAULT_TRANSCRIPTION_PROMPT } from '../services/gemini';
import CloseButton from './common/CloseButton';
import MaterialSwitch from './common/MaterialSwitch';
import StandardSlider from './common/StandardSlider';
import CustomDropdown from './common/CustomDropdown';

/**
 * Modal for selecting video processing options after timeline segment selection
 */
const VideoProcessingOptionsModal = ({
  isOpen,
  onClose,
  onProcess,
  selectedSegment, // { start: number, end: number } in seconds
  isUploading = false,
  videoFile = null, // Optional video file for real token counting
  userProvidedSubtitles = '', // User-provided subtitles text
  useUserProvidedSubtitles = false, // Whether user-provided subtitles are enabled
  subtitlesData = null // Current subtitles on the timeline
}) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);

  // Processing options state with localStorage persistence
  const [fps, setFps] = useState(() => {
    const saved = localStorage.getItem('video_processing_fps');
    return saved ? parseFloat(saved) : 1;
  });
  const [mediaResolution, setMediaResolution] = useState(() => {
    const saved = localStorage.getItem('video_processing_media_resolution');
    return saved || 'medium';
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem('video_processing_model');
    return saved || 'gemini-2.5-flash';
  });
  const [selectedPromptPreset, setSelectedPromptPreset] = useState(() => {
    // Check if there's a recommended preset from analysis
    const recommendedPresetId = sessionStorage.getItem('current_session_preset_id');
    if (recommendedPresetId) {
      return recommendedPresetId;
    }

    const saved = localStorage.getItem('video_processing_prompt_preset');
    return saved || 'settings'; // Default to "Prompt from Settings"
  });

  // Check if user has provided subtitles
  const hasUserProvidedSubtitles = useUserProvidedSubtitles && userProvidedSubtitles && userProvidedSubtitles.trim() !== '';

  // Auto-select timing generation preset when subtitles are added
  useEffect(() => {
    if (isOpen && hasUserProvidedSubtitles) {
      setSelectedPromptPreset('timing-generation');
    }
  }, [isOpen, hasUserProvidedSubtitles]);

  // If timing-generation is selected but unavailable, fall back to 'settings'
  useEffect(() => {
    if (isOpen && !hasUserProvidedSubtitles && selectedPromptPreset === 'timing-generation') {
      setSelectedPromptPreset('settings');
    }
  }, [isOpen, hasUserProvidedSubtitles, selectedPromptPreset]);

  const [customLanguage, setCustomLanguage] = useState(() => {
    const saved = localStorage.getItem('video_processing_custom_language');
    return saved || '';
  });
  const [useTranscriptionRules, setUseTranscriptionRules] = useState(() => {
    const saved = localStorage.getItem('video_processing_use_transcription_rules');
    return saved !== 'false'; // Default to true, only false if explicitly set to 'false'
  });
  const [transcriptionRulesAvailable, setTranscriptionRulesAvailable] = useState(false);

  // New: Outside results context toggle state (default ON unless explicitly disabled)
  const [useOutsideResultsContext, setUseOutsideResultsContext] = useState(() => {
    const saved = localStorage.getItem('video_processing_use_outside_context');
    return saved !== 'false';
  });
  const [outsideContextAvailable, setOutsideContextAvailable] = useState(false);

  // Outside context range (1-20, 21 = Unlimited)
  const [outsideContextRange, setOutsideContextRange] = useState(() => {
    const saved = localStorage.getItem('video_processing_outside_context_range');
    const num = saved ? parseInt(saved, 10) : 5;
    return Number.isFinite(num) ? num : 5;
  });

  // Maximum duration per request (in minutes) for parallel processing
  const [maxDurationPerRequest, setMaxDurationPerRequest] = useState(() => {
    const saved = localStorage.getItem('video_processing_max_duration');
    return saved ? parseInt(saved, 10) : 10; // Default to 10 minutes
  });

  // Auto-split subtitles settings
  const [autoSplitSubtitles, setAutoSplitSubtitles] = useState(() => {
    const saved = localStorage.getItem('video_processing_auto_split');
    // Default to true (enabled) if not previously saved
    return saved !== null ? saved === 'true' : true;
  });
  const [maxWordsPerSubtitle, setMaxWordsPerSubtitle] = useState(() => {
    const saved = localStorage.getItem('video_processing_max_words');
    return saved ? parseInt(saved, 10) : 8;
  });

  const [customGeminiModels, setCustomGeminiModels] = useState([]);
  const [isCountingTokens, setIsCountingTokens] = useState(false);
  const [realTokenCount, setRealTokenCount] = useState(null);
  const [tokenCountError, setTokenCountError] = useState(null);

  // Compute outside-range subtitles context (limited to nearby lines)
  const outsideContext = useMemo(() => {
    if (!Array.isArray(subtitlesData) || !selectedSegment) return { available: false, before: [], after: [] };
    const { start, end } = selectedSegment;

    const overlapsStart = (s) => (typeof s.start === 'number' && typeof s.end === 'number' && s.start < start && s.end > start);
    const overlapsEnd = (s) => (typeof s.start === 'number' && typeof s.end === 'number' && s.start < end && s.end > end);

    const beforeAll = subtitlesData.filter(s => {
      const sStart = (typeof s.start === 'number') ? s.start : 0;
      const sEnd = (typeof s.end === 'number') ? s.end : sStart;
      return (sEnd <= start) || overlapsStart(s);
    });

    const afterAll = subtitlesData.filter(s => {
      const sStart = (typeof s.start === 'number') ? s.start : 0;
      return (sStart >= end) || overlapsEnd(s);
    });

    const limit = outsideContextRange === 21 ? Infinity : Math.max(1, Math.min(20, outsideContextRange || 5));
    const before = beforeAll.slice(-limit);
    const after = afterAll.slice(0, limit);
    const available = before.length > 0 || after.length > 0;
    return { available, before, after };
  }, [subtitlesData, selectedSegment, outsideContextRange]);
  // Persist range changes
  useEffect(() => {
    const val = outsideContextRange === 21 ? 21 : Math.max(1, Math.min(20, Number(outsideContextRange) || 5));
    localStorage.setItem('video_processing_outside_context_range', String(val));
  }, [outsideContextRange]);

  // Persist max duration per request
  useEffect(() => {
    localStorage.setItem('video_processing_max_duration', maxDurationPerRequest.toString());
  }, [maxDurationPerRequest]);

  // Persist auto-split settings
  useEffect(() => {
    localStorage.setItem('video_processing_auto_split', autoSplitSubtitles.toString());
  }, [autoSplitSubtitles]);

  useEffect(() => {
    localStorage.setItem('video_processing_max_words', maxWordsPerSubtitle.toString());
  }, [maxWordsPerSubtitle]);


  // Keep availability and persisted toggle in sync
  useEffect(() => {
    setOutsideContextAvailable(outsideContext.available);
    if (!outsideContext.available && useOutsideResultsContext) {
      setUseOutsideResultsContext(false);
    }
  }, [outsideContext.available]);

  useEffect(() => {
    localStorage.setItem('video_processing_use_outside_context', useOutsideResultsContext ? 'true' : 'false');
  }, [useOutsideResultsContext]);

  // Available options - filter based on selected model
  const getFpsOptions = () => {
    const allOptions = [
      { value: 0.25, label: '0.25 FPS (4s intervals)', minModel: null },
      { value: 0.5, label: '0.5 FPS (2s intervals)', minModel: null },
      { value: 1, label: '1 FPS (1s intervals)', minModel: null },
      { value: 2, label: '2 FPS (0.5s intervals)', minModel: null },
      { value: 5, label: '5 FPS (0.2s intervals)', minModel: null }
    ];

    // For Gemini 2.5 Pro, filter out options below 1 FPS
    if (selectedModel === 'gemini-2.5-pro') {
      return allOptions.filter(option => option.value >= 1);
    }

    return allOptions;
  };

  const fpsOptions = getFpsOptions();

  const resolutionOptions = [
    { value: 'low', label: t('processing.lowRes', 'Low (64 tokens/frame)'), tokens: 64 },
    { value: 'medium', label: t('processing.mediumRes', 'Medium (256 tokens/frame)'), tokens: 256 },
  ];

  // Helper function to get FPS label for slider
  const getFpsLabel = (value) => {
    const option = fpsOptions.find(opt => opt.value === value);
    return option ? option.label : `${value} FPS`;
  };

  // Helper function to get all available models (built-in + custom)
  const getAllAvailableModels = () => {
    const builtInModels = [
      { value: 'gemini-2.5-pro', label: t('settings.modelBestAccuracy', 'Gemini 2.5 Pro - Nghe lời nhất, dễ ra sub ngắn, dễ bị quá tải'), maxTokens: 2000000 },
      { value: 'gemini-2.5-flash', label: t('settings.modelSmartFast', 'Gemini 2.5 Flash (Độ chính xác thứ hai)'), maxTokens: 1048575 },
      { value: 'gemini-2.5-flash-lite', label: t('settings.modelFlash25Lite', 'Gemini 2.5 Flash Lite (Mô hình 2.5 nhanh nhất, độ chính xác tốt)'), maxTokens: 1048575 }
      // Note: Gemini 2.0 models removed as they don't support offset-style requests for timeline segments
    ];

    const customModels = customGeminiModels.map(model => ({
      value: model.id,
      label: `${model.name} (Custom)`,
      maxTokens: 1048575, // Default token limit for custom models
      isCustom: true
    }));

    return [...builtInModels, ...customModels];
  };

  const modelOptions = getAllAvailableModels();

  // Load custom models on component mount
  useEffect(() => {
    const loadCustomModels = () => {
      try {
        const savedCustomModels = localStorage.getItem('custom_gemini_models');
        if (savedCustomModels) {
          setCustomGeminiModels(JSON.parse(savedCustomModels));
        }
      } catch (error) {
        console.error('Error loading custom models:', error);
      }
    };

    loadCustomModels();
  }, []);

  // Auto-adjust FPS when Gemini 2.5 Pro is selected
  useEffect(() => {
    // Check if Gemini 2.5 Pro is selected and FPS is less than 1
    if (selectedModel === 'gemini-2.5-pro' && fps < 1) {
      console.log('[VideoProcessingModal] Gemini 2.5 Pro selected with low FPS, adjusting to 1 FPS for compatibility');
      setFps(1); // Set to minimum 1 FPS for Gemini 2.5 Pro
    }
  }, [selectedModel]); // Only run when model changes

  // Persist processing options to localStorage
  useEffect(() => {
    localStorage.setItem('video_processing_fps', fps.toString());
  }, [fps]);

  useEffect(() => {
    localStorage.setItem('video_processing_media_resolution', mediaResolution);
  }, [mediaResolution]);

  useEffect(() => {
    localStorage.setItem('video_processing_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('video_processing_prompt_preset', selectedPromptPreset);
  }, [selectedPromptPreset]);

  useEffect(() => {
    localStorage.setItem('video_processing_custom_language', customLanguage);
  }, [customLanguage]);

  useEffect(() => {
    localStorage.setItem('video_processing_use_transcription_rules', useTranscriptionRules.toString());
  }, [useTranscriptionRules]);

  // Check transcription rules availability
  useEffect(() => {
    const checkRulesAvailability = () => {
      const transcriptionRules = localStorage.getItem('transcription_rules');
      const hasRules = transcriptionRules && transcriptionRules.trim() !== '' && transcriptionRules !== 'null';
      setTranscriptionRulesAvailable(hasRules);

      // If rules are not available, disable the switch
      if (!hasRules && useTranscriptionRules) {
        setUseTranscriptionRules(false);
      }

      console.log('[VideoProcessingModal] Transcription rules availability:', hasRules ? 'Available' : 'Not available');
    };

    // Initial check
    checkRulesAvailability();

    // Listen for transcription rules changes
    const handleRulesUpdate = () => {
      console.log('[VideoProcessingModal] Transcription rules updated, re-checking availability');
      checkRulesAvailability();
    };

    // Listen for storage changes (when rules are cleared from other components)
    const handleStorageChange = (event) => {
      if (event.key === 'transcription_rules') {
        console.log('[VideoProcessingModal] Transcription rules changed in localStorage');
        checkRulesAvailability();
      }
    };

    // Add event listeners
    window.addEventListener('transcriptionRulesUpdated', handleRulesUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('transcriptionRulesUpdated', handleRulesUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [useTranscriptionRules]);

  // Automatic token counting when modal opens or settings change
  useEffect(() => {
    if (isOpen && videoFile && selectedSegment) {
      console.log('[TokenCounting] Auto-counting tokens due to modal open or settings change');
      const performTokenCount = async () => {
        const count = await countTokensWithGeminiAPI(videoFile);
        if (count !== null) {
          setRealTokenCount(count);
        }
      };
      performTokenCount();
    }
  }, [isOpen, videoFile, selectedSegment, fps, mediaResolution, selectedModel, selectedPromptPreset, customLanguage, useTranscriptionRules]);

  // Get all available prompt presets
  const getPromptPresetOptions = () => {
    const userPresets = getUserPromptPresets();
    const recommendedPresetId = sessionStorage.getItem('current_session_preset_id');

    const options = [
      {
        id: 'settings',
        title: t('processing.promptFromSettings', 'Prompt from Settings'),
        description: t('processing.promptFromSettingsDesc', 'Use the prompt configured in Settings > Prompts'),
        isDefault: true
      }
    ];

    // Add timing generation option (always shown; disabled if no user-provided subtitles)
    options.push({
      id: 'timing-generation',
      title: t('processing.timingGeneration', 'Timing generation (Subtitles added)'),
      description: hasUserProvidedSubtitles
        ? t('processing.timingGenerationDesc', 'Generate timing for your provided subtitles')
        : t('processing.timingGenerationDescDisabled', 'Add subtitles to enable timing generation'),
      isTimingGeneration: true,
      disabled: !hasUserProvidedSubtitles
    });

    // Add regular presets
    options.push(
      ...PROMPT_PRESETS.map(preset => {
        const baseTitle = preset.id === 'general' ? t('settings.presetGeneralPurpose', 'General purpose') :
                         preset.id === 'extract-text' ? t('settings.presetExtractText', 'Extract text') :
                         preset.id === 'focus-lyrics' ? t('settings.presetFocusLyrics', 'Focus on Lyrics') :
                         preset.id === 'describe-video' ? t('settings.presetDescribeVideo', 'Describe video') :
                         preset.id === 'translate-directly' ? t('settings.presetTranslateDirectly', 'Translate directly') :
                         preset.id === 'chaptering' ? t('settings.presetChaptering', 'Chaptering') :
                         preset.id === 'diarize-speakers' ? t('settings.presetIdentifySpeakers', 'Identify Speakers') :
                         preset.title;

        // Add "(Recommended by analysis)" if this is the recommended preset
        const title = preset.id === recommendedPresetId
          ? `${baseTitle} ${t('processing.recommendedByAnalysis', '(Recommended by analysis)')}`
          : baseTitle;

        return {
          id: preset.id,
          title,
          description: preset.prompt.substring(0, 80) + '...',
          needsLanguage: preset.id === 'translate-directly'
        };
      }),
      ...userPresets.map(preset => ({
        id: preset.id,
        title: preset.title,
        description: preset.prompt.substring(0, 80) + '...',
        isUserPreset: true
      }))
    );

    return options;
  };

  // Build outside-range context text (without heading), to reuse for prompt/session
  const buildOutsideContextText = () => {
    if (!useOutsideResultsContext || !outsideContext?.available) return '';
    const fmt = (s) => {
      const st = typeof s.start === 'number' ? s.start : 0;
      const en = typeof s.end === 'number' ? s.end : st;
      return `[${formatTime(st)} - ${formatTime(en)}] ${s.text}`;
    };
    let ctxText = '';
    if (outsideContext.before.length > 0) {
      ctxText += '\n- Context before selected range:\n';
      outsideContext.before.forEach(s => { ctxText += `  * ${fmt(s)}\n`; });
    }
    if (outsideContext.after.length > 0) {
      ctxText += '\n- Context after selected range:\n';
      outsideContext.after.forEach(s => { ctxText += `  * ${fmt(s)}\n`; });
    }
    return ctxText.trim() ? ctxText : '';
  };

  // Get the selected prompt text for processing
  const getSelectedPromptText = () => {
    let basePrompt = '';

    if (selectedPromptPreset === 'settings') {
      // Use prompt from settings
      basePrompt = localStorage.getItem('transcription_prompt') || DEFAULT_TRANSCRIPTION_PROMPT;
    } else if (selectedPromptPreset === 'timing-generation') {
      // Handle timing generation preset (special case for user-provided subtitles)
      // Return a placeholder - the actual prompt will be generated in promptManagement.js
      // when userProvidedSubtitles is detected
      basePrompt = DEFAULT_TRANSCRIPTION_PROMPT;
    } else {
      // Find the preset
      const allPresets = [...PROMPT_PRESETS, ...getUserPromptPresets()];
      const preset = allPresets.find(p => p.id === selectedPromptPreset);

      if (!preset) {
        // Fallback to settings prompt
        basePrompt = localStorage.getItem('transcription_prompt') || DEFAULT_TRANSCRIPTION_PROMPT;
      } else {
        // Handle translate-directly preset with custom language
        if (preset.id === 'translate-directly' && customLanguage.trim()) {
          basePrompt = preset.prompt.replace(/TARGET_LANGUAGE/g, customLanguage.trim());
        } else {
          basePrompt = preset.prompt;
        }
      }
    }

    // Add transcription rules if enabled
    if (useTranscriptionRules) {
      const transcriptionRules = localStorage.getItem('transcription_rules');
      if (transcriptionRules) {
        try {
          const rules = JSON.parse(transcriptionRules);
          let rulesText = '';

          // Add atmosphere if available
          if (rules.atmosphere) {
            rulesText += `\n- Atmosphere: ${rules.atmosphere}\n`;
          }

          // Add terminology if available
          if (rules.terminology && rules.terminology.length > 0) {
            rulesText += '\n- Terminology and Proper Nouns:\n';
            rules.terminology.forEach(term => {
              rulesText += `  * ${term.term}: ${term.definition}\n`;
            });
          }

          // Add speaker identification if available
          if (rules.speakerIdentification && rules.speakerIdentification.length > 0) {
            rulesText += '\n- Speaker Identification:\n';
            rules.speakerIdentification.forEach(speaker => {
              rulesText += `  * ${speaker.speakerId}: ${speaker.description}\n`;
            });
          }

          // Add formatting conventions if available
          if (rules.formattingConventions && rules.formattingConventions.length > 0) {
            rulesText += '\n- Formatting and Style Conventions:\n';
            rules.formattingConventions.forEach(convention => {
              rulesText += `  * ${convention}\n`;
            });
          }

          // Add spelling and grammar rules if available
          if (rules.spellingAndGrammar && rules.spellingAndGrammar.length > 0) {
            rulesText += '\n- Spelling, Grammar, and Punctuation:\n';
            rules.spellingAndGrammar.forEach(rule => {
              rulesText += `  * ${rule}\n`;
            });
          }

          // Add relationships if available
          if (rules.relationships && rules.relationships.length > 0) {
            rulesText += '\n- Relationships and Social Hierarchy:\n';
            rules.relationships.forEach(relationship => {
              rulesText += `  * ${relationship}\n`;
            });
          }

          // Add additional notes if available
          if (rules.additionalNotes && rules.additionalNotes.length > 0) {
            rulesText += '\n- Additional Notes:\n';
            rules.additionalNotes.forEach(note => {
              rulesText += `  * ${note}\n`;
            });
          }

          if (rulesText.trim()) {
            basePrompt += '\n\nAdditional transcription rules to follow:' + rulesText;
          }
        } catch (error) {
          console.warn('[VideoProcessingModal] Error parsing transcription rules:', error);
        }
      }
    }

    // New: Add outside-range subtitles context if enabled and available
    const ctxText = buildOutsideContextText();
    if (ctxText) {
      basePrompt += '\n\nContextual subtitles outside the selected range (for consistency):' + ctxText;
    }

    return basePrompt;
  };

  // Real token counting using Gemini API with Files API (only if file already uploaded)
  const countTokensWithGeminiAPI = async (videoFile) => {
    if (!videoFile || !selectedSegment) return null;

    const geminiApiKey = getNextAvailableKey();
    if (!geminiApiKey) {
      console.warn('No Gemini API key available for token counting');
      return null;
    }

    try {
      setIsCountingTokens(true);
      setTokenCountError(null);

      // Check if we already have an uploaded file URI for this file
      // Use different caching strategies for uploaded vs downloaded videos
      let fileKey;
      const currentVideoUrl = localStorage.getItem('current_video_url');

      if (currentVideoUrl) {
        // This is a downloaded video - use URL-based caching for consistency
        const { generateUrlBasedCacheId } = await import('../hooks/useSubtitles');
        const urlBasedId = await generateUrlBasedCacheId(currentVideoUrl);
        fileKey = `gemini_file_url_${urlBasedId}`;
        console.log('[TokenCounting] Using URL-based cache key for downloaded video:', fileKey);
      } else {
        // This is an uploaded file - use file-based caching
        const lastModified = videoFile.lastModified || Date.now();
        fileKey = `gemini_file_${videoFile.name}_${videoFile.size}_${lastModified}`;
        console.log('[TokenCounting] Using file-based cache key for uploaded file:', fileKey);
      }

      let uploadedFile = JSON.parse(localStorage.getItem(fileKey) || 'null');

      // Only use real token counting if file is already uploaded, otherwise use estimation
      if (!uploadedFile || !uploadedFile.uri) {
        console.log('[TokenCounting] No cached file found, using estimation instead of uploading');
        return null; // This will cause the UI to show estimation
      } else {
        console.log('[TokenCounting] Using cached uploaded file for real token counting:', uploadedFile.uri);
      }

      // Create the request data using the uploaded file URI (matching countTokens API format)
      // Note: countTokens API doesn't support offset parameters, so we count the whole video
      const filePart = {
        file_data: {
          file_uri: uploadedFile.uri,
          mime_type: uploadedFile.mimeType || videoFile.type || "video/mp4"
        }
      };

      // If user-provided subtitles mode is active, append outside-context directly to the prompt
      const ctxText = buildOutsideContextText();
      const promptWithCtx = ctxText
        ? `${getSelectedPromptText()}\n\nContextual subtitles outside the selected range (for consistency):${ctxText}`
        : getSelectedPromptText();

      const requestData = {
        contents: [{
          role: "user",
          parts: [
            { text: promptWithCtx },
            filePart
          ]
        }]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:countTokens?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token counting API error:', errorData);
        return null;
      }

      const data = await response.json();
      console.log('[TokenCounting] Whole video token count:', data.totalTokens);

      // Since countTokens API doesn't support offset, it returns tokens for the entire video.
      // We need to calculate the proportion for the selected segment.
      const wholeVideoTokens = data.totalTokens;

      // Calculate segment proportion based on duration
      const segmentDuration = selectedSegment.end - selectedSegment.start;

      // Account for parallel processing splitting
      const numRequests = Math.ceil(segmentDuration / (maxDurationPerRequest * 60));
      
      // Try to get total duration from video file or use segment duration as fallback
      let totalDuration = segmentDuration; // Conservative fallback

      if (videoFile) {
        try {
          // Try to get duration from video file metadata
          const videoDuration = await new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => resolve(video.duration || 0);
            video.onerror = () => resolve(0);
            setTimeout(() => resolve(0), 2000); // 2 second timeout
            video.src = URL.createObjectURL(videoFile);
          });

          if (videoDuration > 0) {
            totalDuration = videoDuration;
          }
        } catch (error) {
          console.warn('[TokenCounting] Could not get video duration, using segment duration as fallback');
        }
      }

      const segmentProportion = segmentDuration / totalDuration;

      console.log('[TokenCounting] Segment duration:', segmentDuration, 'Total duration:', totalDuration, 'Proportion:', segmentProportion);

      // Calculate base tokens for the selected segment
      const baseSegmentTokens = Math.round(wholeVideoTokens * segmentProportion);

      // Apply FPS and resolution adjustments to the segment tokens
      // The API returns tokens for default FPS (likely 1 FPS) and default resolution (likely medium)
      const baseFps = 1; // Assumed baseline FPS used by the API
      const fpsAdjustmentFactor = fps / baseFps;

      // Adjust for media resolution based on official token counts
      let resolutionAdjustmentFactor = 1;
      if (mediaResolution === 'low') {
        resolutionAdjustmentFactor = 64 / 256; // low vs medium ratio
      } else if (mediaResolution === 'high') {
        resolutionAdjustmentFactor = 256 / 256; // high vs medium ratio (same)
      }

      // Apply all adjustments to the segment tokens
      const segmentTokensAdjusted = Math.round(baseSegmentTokens * fpsAdjustmentFactor * resolutionAdjustmentFactor);
      
      // For display, show the maximum tokens per request when splitting
      const tokensPerRequest = numRequests > 1 
        ? Math.round(segmentTokensAdjusted / numRequests)
        : segmentTokensAdjusted;

      console.log('[TokenCounting] Final calculation:');
      console.log('  - Whole video tokens:', wholeVideoTokens);
      console.log('  - Segment proportion:', segmentProportion.toFixed(3));
      console.log('  - Base segment tokens:', baseSegmentTokens);
      console.log('  - FPS adjustment (', fps, 'fps):', fpsAdjustmentFactor);
      console.log('  - Resolution adjustment (', mediaResolution, '):', resolutionAdjustmentFactor);
      console.log('  - Total segment tokens:', segmentTokensAdjusted);
      if (numRequests > 1) {
        console.log('  - Will split into', numRequests, 'requests');
        console.log('  - Tokens per request:', tokensPerRequest);
      }

      return tokensPerRequest;
    } catch (error) {
      console.error('Error counting tokens with Gemini API:', error);
      setTokenCountError(error.message);
      return null;
    } finally {
      setIsCountingTokens(false);
    }
  };

  // Calculate estimated token usage based on official Gemini API documentation
  const calculateEstimatedTokens = () => {
    if (!selectedSegment) return 0;

    const segmentDuration = selectedSegment.end - selectedSegment.start;
    const resolution = resolutionOptions.find(r => r.value === mediaResolution);
    const frameTokens = resolution ? resolution.tokens : 256; // Default to medium resolution
    const audioTokens = 32; // tokens per second for audio (official documentation)

    return Math.round(segmentDuration * (fps * frameTokens + audioTokens));
  };

  const estimatedTokens = calculateEstimatedTokens();
  const selectedModelData = modelOptions.find(m => m.value === selectedModel);
  const displayTokens = realTokenCount !== null ? realTokenCount : estimatedTokens;
  const isWithinLimit = displayTokens <= (selectedModelData?.maxTokens || 1048575);

  // Format time for display
    // Persist outside context text for user-provided mode (consumed by promptManagement)
    try {
      const ctxText = buildOutsideContextText();
      if (useOutsideResultsContext && ctxText) {
        localStorage.setItem('video_processing_outside_context_text', ctxText);
      } else {
        localStorage.removeItem('video_processing_outside_context_text');
      }
    } catch (e) {
      // ignore localStorage failures
    }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  // Handle form submission
  const handleProcess = () => {
    if (!selectedSegment || isUploading) return;

    // Persist outside-context text just before processing (user-provided flow reads it in promptManagement)
    try {
      const ctxText = buildOutsideContextText();
      if (useOutsideResultsContext && ctxText) {
        localStorage.setItem('video_processing_outside_context_text', ctxText);
        localStorage.setItem('video_processing_use_outside_context', 'true');
      } else {
        localStorage.removeItem('video_processing_outside_context_text');
        // keep the toggle key accurate
        localStorage.setItem('video_processing_use_outside_context', 'false');
      }
    } catch {}

    const options = {
      fps,
      mediaResolution,
      model: selectedModel,
      segment: selectedSegment,
      estimatedTokens: displayTokens,
      realTokenCount,
      customPrompt: getSelectedPromptText(), // Include the selected prompt
      promptPreset: selectedPromptPreset,
      customLanguage: selectedPromptPreset === 'translate-directly' ? customLanguage : undefined,
      useTranscriptionRules, // Include the transcription rules setting
      maxDurationPerRequest: maxDurationPerRequest * 60, // Convert to seconds
      autoSplitSubtitles,
      maxWordsPerSubtitle
    };
    
    onProcess(options);
  };

  // Handle escape key and outside clicks
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="video-processing-modal-overlay">
      <div
        className="video-processing-modal"
        ref={modalRef}
      >
        <div className="modal-header">
          <div className="header-content">
            <h3>
              {t('processing.generateForRange', 'Generate/update subtitles for range:')}
              <span className="segment-time">
                {formatTime(selectedSegment?.start || 0)} - {formatTime(selectedSegment?.end || 0)}
                {' '}({Math.round((selectedSegment?.end || 0) - (selectedSegment?.start || 0))}s)
              </span>
            </h3>
          </div>
          <CloseButton onClick={onClose} variant="modal" size="medium" />
        </div>

        <div className="modal-content">

          {/* Two-column grid for options */}
          <div className="modal-content-grid">
            {/* Frame Rate and Media Resolution Combined */}
            <div className="option-group">
              <div className="combined-options-row">
                {/* Frame Rate Slider */}
                <div className="combined-option-half">
                  <div className="label-with-help">
                    <label>{t('processing.frameRate', 'Frame Rate')}</label>
                    {selectedModel === 'gemini-2.5-pro' && (
                      <div
                        className="help-icon-container"
                        title={t('processing.gemini25ProFpsNote', 'Note: Gemini 2.5 Pro requires FPS ≥ 1 for compatibility')}
                      >
                        <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="slider-control">
                    <StandardSlider
                      value={fps}
                      onChange={(value) => setFps(parseFloat(value))}
                      min={selectedModel === 'gemini-2.5-pro' ? 1 : 0.25}
                      max={5}
                      step={0.25}
                      orientation="Horizontal"
                      size="XSmall"
                      state="Enabled"
                      showValueIndicator={false}
                      showIcon={false}
                      showStops={false}
                      className="fps-slider"
                      id="fps-slider"
                      ariaLabel={t('processing.frameRate', 'Frame Rate')}
                    />
                    <div className="slider-value-display">
                      {getFpsLabel(fps)}
                    </div>
                  </div>
                </div>

                {/* Media Resolution */}
                <div className="combined-option-half">
                  <div className="label-with-help">
                    <label>{t('processing.mediaResolution', 'Media Resolution')}</label>
                    <div
                      className="help-icon-container"
                      title={t('processing.mediaResolutionHelp', "64 or 256 tokens cannot be mapped to an exact resolution; this reflects Gemini's proprietary video information extraction method.")}
                    >
                      <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </div>
                  </div>
                  <CustomDropdown
                    value={mediaResolution}
                    onChange={(value) => setMediaResolution(value)}
                    options={resolutionOptions.map(option => ({
                      value: option.value,
                      label: option.label
                    }))}
                    placeholder={t('processing.selectResolution', 'Select Resolution')}
                  />
                </div>
              </div>
            </div>

            {/* Model Selection */}
            <div className="option-group">
              <label>{t('processing.model', 'Model')}</label>
              <CustomDropdown
                value={selectedModel}
                onChange={(value) => setSelectedModel(value)}
                options={modelOptions.map(option => ({
                  value: option.value,
                  label: option.label
                }))}
                placeholder={t('processing.selectModel', 'Select Model')}
              />
            </div>

            {/* Prompt Preset and Settings Row */}
            <div className="option-group" style={{ gridColumn: '1 / -1' }}>
              <div className="prompt-settings-row">
                {/* Left: Prompt Preset Selection */}
                <div className="prompt-preset-section">
                  <label>{t('processing.promptPreset', 'Prompt Preset')}</label>
                  <CustomDropdown
                    value={selectedPromptPreset}
                    onChange={(value) => setSelectedPromptPreset(value)}
                    options={getPromptPresetOptions().map(option => ({
                      value: option.id,
                      label: option.title,
                      disabled: option.disabled
                    }))}
                    placeholder={t('processing.selectPreset', 'Select Preset')}
                  />
                  <p className="option-description">
                    {(() => {
                      const selectedOption = getPromptPresetOptions().find(opt => opt.id === selectedPromptPreset);
                      return selectedOption?.description || '';
                    })()}
                  </p>
                </div>

                {/* Right: Target Language and Analysis Switch Group */}
                <div className="settings-group">
                  <div className="settings-row">
                    {/* Target Language (only when translate-directly is selected) */}
                    {selectedPromptPreset === 'translate-directly' && (
                      <div className="setting-item">
                        <label>{t('processing.targetLanguage', 'Target Language')}</label>
                        <input
                          type="text"
                          value={customLanguage}
                          onChange={(e) => setCustomLanguage(e.target.value)}
                          placeholder={t('processing.targetLanguagePlaceholder', 'Enter target language (e.g., Vietnamese, Spanish)')}
                          className="language-input"
                        />
                      </div>
                    )}

                    {/* Transcription Rules Toggle */}
                    <div className="setting-item">
                      <div className="label-with-help">
                        <label>{t('processing.analysisRules', 'Analysis Rules')}</label>
                        <div
                          className="help-icon-container"
                          title={transcriptionRulesAvailable
                            ? t('processing.useTranscriptionRulesDesc', 'Include context, terminology, and formatting rules from video analysis in the prompt')
                            : t('processing.noAnalysisAvailable', 'Please create analysis by pressing "Add analysis" button')
                          }
                        >
                          <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                        </div>
                      </div>
                      <div className="material-switch-container">
                        <MaterialSwitch
                          id="use-transcription-rules"
                          checked={useTranscriptionRules && transcriptionRulesAvailable}
                          onChange={(e) => setUseTranscriptionRules(e.target.checked)}
                          disabled={!transcriptionRulesAvailable}
                          ariaLabel={t('processing.useTranscriptionRules', 'Use transcription rules from analysis')}
                          icons={true}
                        />
                        <label htmlFor="use-transcription-rules" className="material-switch-label">
                          {t('processing.useTranscriptionRules', 'Use transcription rules from analysis')}
                        </label>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Surrounding context and Context coverage in left column */}
            <div className="option-group">
              <div className="combined-options-row">
                {/* Left half: Outside context switch */}
                <div className="combined-option-half">
                  <div className="label-with-help">
                    <label>{t('processing.notifyOutsideResults', 'Surrounding context')}</label>
                    <div
                      className="help-icon-container"
                      title={outsideContextAvailable
                        ? t('processing.notifyOutsideResultsDesc', 'Include immediately-before/after subtitles outside the selected range to improve consistency')
                        : t('processing.noOutsideContext', 'No outside subtitles available (switch disabled)')
                      }
                    >
                      <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </div>
                  </div>
                  <div className="material-switch-container">
                    <MaterialSwitch
                      id="use-outside-context"
                      checked={useOutsideResultsContext && outsideContextAvailable}
                      onChange={(e) => setUseOutsideResultsContext(e.target.checked)}
                      disabled={!outsideContextAvailable}
                      ariaLabel={t('processing.notifyOutsideResults', 'Include surrounding subtitles as context')}
                      icons={true}
                    />
                    <label htmlFor="use-outside-context" className="material-switch-label">
                      {t('processing.notifyOutsideResults', 'Include surrounding subtitles as context')}
                    </label>
                  </div>
                </div>

                {/* Right half: Context range slider (1-20, last = Unlimited) */}
                <div className="combined-option-half">
                  <div className="label-with-help">
                    <label>{t('processing.outsideContextRange', 'Context coverage')}</label>
                    <div
                      className="help-icon-container"
                      title={t('processing.outsideContextRangeDesc', 'How many subtitles before/after to include as context. The last value is Unlimited.')}
                    >
                      <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </div>
                  </div>
                  <div className="slider-control">
                    <StandardSlider
                      value={outsideContextRange}
                      onChange={(value) => setOutsideContextRange(Number(value))}
                      min={1}
                      max={21}
                      step={1}
                      orientation="Horizontal"
                      size="XSmall"
                      state={outsideContextAvailable && useOutsideResultsContext ? 'Enabled' : 'Disabled'}
                      showValueIndicator={false}
                      showIcon={false}
                      showStops={false}
                      id="outside-context-range"
                      ariaLabel={t('processing.outsideContextRange', 'Context coverage')}
                      disabled={!outsideContextAvailable || !useOutsideResultsContext}
                      showValueBadge={true}
                      valueBadgeFormatter={(v) => (Math.round(Number(v)) >= 21 ? t('processing.unlimited', 'Unlimited') : Math.round(Number(v)))}
                    />
                    <div className="slider-value-display">
                      {outsideContextRange === 21
                        ? t('processing.unlimited', 'Unlimited')
                        : t('processing.linesCount', '{{count}} lines', { count: outsideContextRange })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Maximum duration per request in right column */}
            <div className="option-group">
              <div className="label-with-help">
                <label>{t('processing.maxDurationPerRequest', 'Max duration per request')}</label>
                <div
                  className="help-icon-container"
                  title={t('processing.maxDurationPerRequestDesc', 'Maximum duration for each Gemini request. Longer segments will be split into parallel requests.')}
                >
                  <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
              </div>
              <div className="slider-control">
                <StandardSlider
                  value={maxDurationPerRequest}
                  onChange={(value) => setMaxDurationPerRequest(parseInt(value))}
                  min={1}
                  max={20}
                  step={1}
                  orientation="Horizontal"
                  size="XSmall"
                  state="Enabled"
                  showValueIndicator={false}
                  showIcon={false}
                  showStops={false}
                  id="max-duration-slider"
                  ariaLabel={t('processing.maxDurationPerRequest', 'Max duration per request')}
                />
                <div className="slider-value-display">
                  {t('processing.minutesValue', '{{value}} minutes', { value: maxDurationPerRequest })}
                  {selectedSegment && (() => {
                    const segmentDuration = (selectedSegment.end - selectedSegment.start) / 60; // Convert to minutes
                    const numRequests = Math.ceil(segmentDuration / maxDurationPerRequest);
                    if (numRequests > 1) {
                      return (
                        <span className="parallel-info">
                          {' '}({t('processing.parallelRequestsInfo', 'Will split into {{count}} parallel requests', { count: numRequests })})
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Auto-split subtitles and Max words per subtitle - 4th row */}
            <div className="option-group">
              <div className="combined-options-row">
                {/* Left half: Auto-split switch */}
                <div className="combined-option-half">
                  <div className="label-with-help">
                    <label>{t('processing.autoSplitSubtitles', 'Auto-split subtitles')}</label>
                    <div
                      className="help-icon-container"
                      title={t('processing.autoSplitHelp', 'Automatically split long subtitles into smaller segments for better readability. The splitting happens in real-time during streaming.')}
                    >
                      <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </div>
                  </div>
                  <div className="material-switch-container">
                    <MaterialSwitch
                      id="auto-split-subtitles"
                      checked={autoSplitSubtitles}
                      onChange={(e) => setAutoSplitSubtitles(e.target.checked)}
                      ariaLabel={t('processing.autoSplitSubtitles', 'Auto-split subtitles')}
                      icons={true}
                    />
                    <label htmlFor="auto-split-subtitles" className="material-switch-label">
                      {t('processing.enableAutoSplit', 'Enable auto-splitting')}
                    </label>
                  </div>
                </div>

                {/* Right half: Max words slider (always visible, disabled when switch is off) */}
                <div className="combined-option-half">
                  <div className="label-with-help">
                    <label>{t('processing.maxWordsPerSubtitle', 'Max words per subtitle')}</label>
                    <div
                      className="help-icon-container"
                      title={t('processing.maxWordsHelp', 'Maximum number of words allowed per subtitle. Longer subtitles will be split evenly.')}
                    >
                      <svg className="help-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </div>
                  </div>
                  <div className="slider-control">
                    <StandardSlider
                      value={maxWordsPerSubtitle}
                      onChange={(value) => setMaxWordsPerSubtitle(parseInt(value))}
                      min={1}
                      max={30}
                      step={1}
                      orientation="Horizontal"
                      size="XSmall"
                      state={autoSplitSubtitles ? 'Enabled' : 'Disabled'}
                      showValueIndicator={false}
                      showIcon={false}
                      showStops={false}
                      className="max-words-slider"
                      id="max-words-slider"
                      ariaLabel={t('processing.maxWordsPerSubtitle', 'Maximum words per subtitle')}
                      disabled={!autoSplitSubtitles}
                      showValueBadge={true}
                      valueBadgeFormatter={(v) => Math.round(Number(v))}
                    />
                    <div className="slider-value-display">
                      {t('processing.wordsLimit', '{{count}} {{unit}}', {
                        count: maxWordsPerSubtitle,
                        unit: maxWordsPerSubtitle === 1 ? t('processing.word', 'word') : t('processing.words', 'words')
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

	          </div>


          {/* Upload Status */}
          {isUploading && (
            <div className="upload-status">
              <div className="loading-spinner"></div>
              <span>{t('processing.uploading', 'Uploading video...')}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-content">
            {/* Token Usage Info */}
            <div className="footer-token-info">
              <div className="token-usage">
                <span className="token-label">
                  {isCountingTokens
                    ? t('processing.countingTokens', 'Counting Tokens...')
                    : realTokenCount !== null
                      ? t('processing.actualTokens', 'Actual Token Usage')
                      : t('processing.estimatedTokens', 'Estimated Token Usage')
                  }:
                </span>
                <span className={`token-count ${isWithinLimit ? 'within-limit' : 'exceeds-limit'}`}>
                  {displayTokens.toLocaleString()} / {selectedModelData?.maxTokens.toLocaleString()} tokens
                </span>
              </div>
              {realTokenCount !== null && (
                <div className="token-note">
                  {t('processing.adjustedNote', 'Real count from Gemini API, adjusted for selected media resolution.')}
                </div>
              )}
              {tokenCountError && (
                <div className="token-error">
                  {t('processing.tokenCountError', 'Error counting tokens')}: {tokenCountError}
                </div>
              )}
            </div>

            <div className="footer-buttons">
              <button
                className="process-btn"
                onClick={handleProcess}
                disabled={isUploading || !isWithinLimit}
              >
                {isUploading
                  ? t('processing.waitingForUpload', 'Waiting for upload...')
                  : t('processing.startProcessing', 'Start Processing')
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VideoProcessingOptionsModal;
