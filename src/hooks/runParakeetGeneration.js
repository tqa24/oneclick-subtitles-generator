import { mergeSegmentSubtitles } from '../utils/subtitle/subtitleMerger';
import { publishProcessingRanges, publishStreamingUpdate, publishStreamingComplete } from '../events/bus';
import { processParakeetSegment } from '../services/engines/ParakeetAdapter';

/**
 * Parakeet (NVIDIA) processing branch extracted from generateSubtitles.
 *
 * Owns the full nvidia-parakeet path: checkpoint before processing, delegate to
 * the Parakeet adapter with progressive onMergeSegment merging, read the final
 * subtitles back from state, dispatch streaming-complete, and auto-save.
 *
 * Behavior is byte-for-byte identical to the original inline branch; all side
 * effects (status, state setters, debug logging) are threaded in via params.
 *
 * @returns {Promise<boolean>} true on success, false on invalid segment selection
 */
export const runParakeetGeneration = async ({
    input,
    options,
    runId,
    debugLog,
    setStatus,
    setIsGenerating,
    setSubtitlesData,
    t
}) => {
    const seg = options.segment;
    if (!seg || typeof seg.start !== 'number' || typeof seg.end !== 'number') {
        setStatus({ message: t('errors.invalidSegmentSelection', 'Invalid segment selection'), type: 'error' });
        setIsGenerating(false);
        return false;
    }

    // Before processing, checkpoint current edits to align with Gemini segment flow
    debugLog(`[Run ${runId}] Parakeet: checkpoint before segment processing`, { seg });
    {
        const { checkpointBeforeUpdate } = await import('../services/lifecycleOrchestrator');
        await checkpointBeforeUpdate({ source: 'segment-processing-start', segment: seg }, 2000);
    }

    // Delegate to Parakeet adapter (chunking + API); merge through callback
    await processParakeetSegment(
        input,
        seg,
        {
            maxDurationPerRequest: options.maxDurationPerRequest,
            parakeetStrategy: options.parakeetStrategy,
            parakeetMaxChars: options.parakeetMaxChars,
            parakeetMaxWords: options.parakeetMaxWords
        },
        {
            onStatus: setStatus,
            onRanges: (ranges) => publishProcessingRanges({ ranges }),
            onStreamingUpdate: (subs, part) => publishStreamingUpdate({ subtitles: subs, segment: part, runId }),
            onMergeSegment: async (part, newSegmentSubs) => {
                await new Promise((resolve) => {
                    setSubtitlesData(current => {
                        const existing = current || [];
                        const merged = mergeSegmentSubtitles(existing, newSegmentSubs, part);
                        resolve();
                        return merged;
                    });
                });
            },
            t
        }
    );

    // Read final subtitles from state
    let finalSubs = [];
    await new Promise((resolve) => {
        setSubtitlesData(current => {
            finalSubs = current || [];
            resolve();
            return current; // no-op
        });
    });

    // Filter final subtitles to the processed segment range for event payload
    const filteredForSeg = (finalSubs || []).filter(s => (s.start < seg.end && s.end > seg.start)).map(s => ({
        ...s,
        start: Math.max(s.start, seg.start),
        end: Math.min(s.end, seg.end)
    }));

    // Dispatch streaming-complete to signal UI that processing has concluded
    try {
        publishStreamingComplete({ subtitles: filteredForSeg, segment: seg, runId });
    } catch {}

    // Trigger auto-save after streaming completion (same as Gemini path)
    try {
        const { autoSaveAfterStreaming } = await import('../services/lifecycleOrchestrator');
        debugLog(`[Run ${runId}] Parakeet: streaming complete, triggering auto-save`);
        autoSaveAfterStreaming({ subtitles: finalSubs, segment: seg, delayMs: 500 });
    } catch {}

    setStatus({ message: t('output.parakeetTranscriptionComplete', 'Parakeet transcription complete'), type: 'success' });
    setIsGenerating(false);
    return true;
};
