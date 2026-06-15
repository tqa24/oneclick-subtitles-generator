/**
 * Segment overlap analysis/adjustment for the aligned-audio pipeline (split from batchProcessor.js).
 */
const { enrichSegmentsWithDurations, getKnownSegmentDuration } = require('./durationProber');

const MAX_VERBOSE_ADJUSTMENT_LOGS = 25;
const MIN_GAP_DURATION = 0.005;

const findBlankSpaces = (segments) => {
  const blankSpaces = [];

  // Sort segments by start time
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const currentSegment = sortedSegments[i];
    const nextSegment = sortedSegments[i + 1];

    // Calculate the effective end time (allowing 0.3s overlap at the end)
    const currentEffectiveEnd = currentSegment.naturalEnd - 0.3;

    // Check if there's a gap between current segment's effective end and next segment's start
    if (nextSegment.start > currentEffectiveEnd) {
      const gapStart = currentEffectiveEnd;
      const gapEnd = nextSegment.start;
      const gapDuration = gapEnd - gapStart;

      if (gapDuration > 0.1) { // Only consider gaps larger than 0.1s
        blankSpaces.push({
          start: gapStart,
          end: gapEnd,
          duration: gapDuration,
          afterSegmentId: currentSegment.subtitle_id,
          beforeSegmentId: nextSegment.subtitle_id
        });
      }
    }
  }

  return blankSpaces;
};

/**
 * Calculate distributed shifting across multiple blank spaces with gradual decrease
 * @param {Array} segmentsToShift - The segments that need to be shifted (current and following)
 * @param {Array} blankSpaces - Available blank spaces to the left
 * @param {number} requiredShift - How much shift is needed to avoid overlap
 * @returns {Object} - Object with distributed shift amounts and strategy info
 */
const calculateDistributedGroupShift = (segmentsToShift, blankSpaces, requiredShift) => {
  if (blankSpaces.length === 0) {
    return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
  }

  // Find up to 5 blank spaces to the left, sorted by distance from the first segment (nearest first)
  const usableBlankSpaces = blankSpaces
    .filter(space => space.end <= segmentsToShift[0].start)
    .map(space => ({
      ...space,
      distanceFromSegment: segmentsToShift[0].start - space.end,
      maxUsableSpace: Math.min(space.duration - 0.1, segmentsToShift[0].start - space.start)
    }))
    .sort((a, b) => a.distanceFromSegment - b.distanceFromSegment) // Nearest first
    .slice(0, 5); // Take up to 5 blank spaces

  if (usableBlankSpaces.length === 0) {
    return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
  }

  // Calculate total available space across all usable blank spaces
  const totalAvailableSpace = usableBlankSpaces.reduce((sum, space) => sum + space.maxUsableSpace, 0);

  if (totalAvailableSpace < 0.1) {
    return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
  }

  // Calculate how much we can actually shift (limited by available space and required shift)
  const actualShiftAmount = Math.min(requiredShift, totalAvailableSpace);

  // Distribute the shift across blank spaces with gradual decrease (giảm dần)
  // Nearest space gets the most shift, furthest gets the least
  const distributedShifts = [];
  let remainingShift = actualShiftAmount;

  // Create a decreasing weight system: nearest = 1.0, next = 0.8, next = 0.6, etc.
  const weights = usableBlankSpaces.map((_, index) => Math.max(0.2, 1.0 - (index * 0.2)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  for (let i = 0; i < usableBlankSpaces.length && remainingShift > 0.05; i++) {
    const space = usableBlankSpaces[i];
    const weight = weights[i];

    // Calculate this space's share of the total shift (proportional to weight)
    const proposedShift = (actualShiftAmount * weight) / totalWeight;

    // Limit by space availability and remaining shift
    const actualSpaceShift = Math.min(
      proposedShift,
      space.maxUsableSpace,
      remainingShift
    );

    if (actualSpaceShift > 0.05) { // Only use shifts larger than 0.05s
      distributedShifts.push({
        blankSpace: space,
        shiftAmount: actualSpaceShift,
        weight: weight,
        segmentRange: i === 0 ? 'all' : `from-${i}`
      });
      remainingShift -= actualSpaceShift;
    }
  }

  const totalShiftAchieved = distributedShifts.reduce((sum, shift) => sum + shift.shiftAmount, 0);

  if (totalShiftAchieved > 0.1) {
    return {
      totalShiftAmount: totalShiftAchieved,
      strategy: `distributed-shift-across-${distributedShifts.length}-spaces`,
      canUseBlankSpaces: true,
      distributedShifts: distributedShifts,
      totalAvailableSpace: totalAvailableSpace
    };
  }

  return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
};

/**
 * Analyze audio segments and adjust their timing to avoid overlaps
 * This creates a more natural narration by ensuring segments don't talk over each other
 *
 * Improvements:
 * 1. Allows 0.3s overlap at the end of each segment (more natural)
 * 2. When large adjustments (>0.5s) are needed, tries to find blank spaces to the left
 *    to move segments into, reducing the overall audio length
 *
 * @param {Array} audioSegments - Array of audio segments to analyze
 * @returns {Promise<Array>} - Array of adjusted audio segments
 */
const analyzeAndAdjustSegments = async (audioSegments, options = {}) => {
  const { onProgress } = options;
  if (!audioSegments || audioSegments.length <= 1) {
    return audioSegments; // No adjustment needed for 0 or 1 segments
  }

  console.log(`Analyzing ${audioSegments.length} audio segments for smart overlap resolution...`);

  // Sort segments by start time (should already be sorted, but ensure it)
  audioSegments.sort((a, b) => a.start - b.start);

  // First pass: get actual durations in parallel
  const segmentsWithDuration = await enrichSegmentsWithDurations(
    audioSegments,
    onProgress,
  );

  // Second pass: Detect and resolve overlaps naturally (like in Premiere Pro)
  const adjustedSegments = [];
  let detailedLogs = 0;
  let suppressedLogs = 0;

  const logAdjustmentDetail = (...args) => {
    if (detailedLogs < MAX_VERBOSE_ADJUSTMENT_LOGS) {
      console.log(...args);
      detailedLogs += 1;
    } else {
      suppressedLogs += 1;
    }
  };

  for (let i = 0; i < segmentsWithDuration.length; i++) {
    const segment = segmentsWithDuration[i];

    if (i === 0) {
      // First segment doesn't need adjustment
      adjustedSegments.push(segment);
      continue;
    }

    const previousSegment = adjustedSegments[i - 1];

    // Check if this segment would overlap with the previous one
    // Allow 0.3s overlap at the end of the previous segment
    const previousEffectiveEnd = previousSegment.naturalEnd - 0.3;
    const wouldOverlap = segment.start < previousEffectiveEnd;

    if (wouldOverlap) {
      // Calculate how much overlap would occur
      const overlapAmount = previousEffectiveEnd - segment.start;

      // Log the overlap detection
      const prevIsGrouped = previousSegment.isGrouped ? ` (grouped with ${previousSegment.original_ids?.length || 0} original IDs)` : '';
      const currIsGrouped = segment.isGrouped ? ` (grouped with ${segment.original_ids?.length || 0} original IDs)` : '';

      logAdjustmentDetail(`Detected overlap of ${overlapAmount.toFixed(2)}s between segments:
        - Previous: ID ${previousSegment.subtitle_id}${prevIsGrouped}, Start: ${previousSegment.start.toFixed(2)}, Effective End: ${previousEffectiveEnd.toFixed(2)}
        - Current: ID ${segment.subtitle_id}${currIsGrouped}, Start: ${segment.start.toFixed(2)}, End: ${segment.end.toFixed(2)}`);

      // Calculate the basic adjustment (push to the right)
      const basicAdjustedStart = previousEffectiveEnd + 0.1;
      const basicShiftAmount = basicAdjustedStart - segment.start;

      let finalAdjustedStart = basicAdjustedStart;
      let finalShiftAmount = basicShiftAmount;
      let adjustmentStrategy = 'push-right';

      // If the adjustment is significant (>0.5s), try to shift THIS segment left into blank spaces
      if (basicShiftAmount > 0.5) {
        logAdjustmentDetail(`Adjustment needed (${basicShiftAmount.toFixed(2)}s), looking for blank spaces to minimize duration extension...`);

        // Find all blank spaces in the current adjusted segments
        const blankSpaces = findBlankSpaces(adjustedSegments);

        if (blankSpaces.length > 0) {
          logAdjustmentDetail(`Found ${blankSpaces.length} blank spaces:`,
            blankSpaces.map(space => `${space.duration.toFixed(2)}s gap after segment ${space.afterSegmentId}`));

          // Calculate distributed shift for this segment across multiple blank spaces
          const distributedShiftResult = calculateDistributedGroupShift([segment], blankSpaces, basicShiftAmount);

          if (distributedShiftResult.canUseBlankSpaces && distributedShiftResult.totalShiftAmount > 0) {
            // Apply the distributed shift to reduce the rightward push
            const totalLeftShift = Math.min(distributedShiftResult.totalShiftAmount, basicShiftAmount);

            logAdjustmentDetail(`Using distributed shift across ${distributedShiftResult.distributedShifts.length} blank spaces`);
            
            // Reduce the rightward push by the amount we can shift left
            finalAdjustedStart = basicAdjustedStart - totalLeftShift;
            const maxAllowedOverlapStart = previousSegment.naturalEnd - 0.3;
            if (finalAdjustedStart < maxAllowedOverlapStart) {
              finalAdjustedStart = maxAllowedOverlapStart;
            }
            finalShiftAmount = finalAdjustedStart - segment.start;
            adjustmentStrategy = `hybrid-shift-${distributedShiftResult.distributedShifts.length}-spaces`;
            
            logAdjustmentDetail(`Net adjustment: ${finalShiftAmount.toFixed(2)}s for segment ${segment.subtitle_id}`);
          } else {
            // No usable blank spaces, accept the full rightward push
            logAdjustmentDetail(`No usable blank spaces. Accepting full rightward push of ${basicShiftAmount.toFixed(2)}s`);
          }
        } else {
          logAdjustmentDetail(`No blank spaces found. Accepting full rightward push of ${basicShiftAmount.toFixed(2)}s`);
        }
      }

      // Create adjusted segment
      const adjustedSegment = {
        ...segment,
        start: finalAdjustedStart,
        // Update the natural end based on the new start time
        naturalEnd: finalAdjustedStart + segment.actualDuration,
        // Keep track of the original timing for reference
        originalStart: segment.start,
        // Note how much we shifted this segment
        shiftAmount: finalShiftAmount,
        adjustmentStrategy
      };

      // Log the adjustment
      const direction = finalShiftAmount > 0 ? 'right' : 'left';
      logAdjustmentDetail(`Adjusted segment ${segment.subtitle_id}: ${adjustmentStrategy}, shifted by ${Math.abs(finalShiftAmount).toFixed(2)}s ${direction} to start at ${finalAdjustedStart.toFixed(2)}s`);

      adjustedSegments.push(adjustedSegment);
    } else {
      // No overlap detected, add segment as-is
      adjustedSegments.push(segment);
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'overlaps',
        completed: i + 1,
        total: segmentsWithDuration.length,
        percent:
          segmentsWithDuration.length > 0
            ? (i + 1) / segmentsWithDuration.length
            : 1,
        message: `Analyzing overlap ${i + 1}/${segmentsWithDuration.length}`,
        currentIndex: i,
      });
    }
  }

  // Log summary of adjustments and calculate statistics
  const adjustedCount = adjustedSegments.filter(s => s.shiftAmount).length;
  const leftMoves = adjustedSegments.filter(s => s.shiftAmount && s.shiftAmount < 0).length;
  const rightMoves = adjustedSegments.filter(s => s.shiftAmount && s.shiftAmount > 0).length;

  // Find the segment with the maximum adjustment (rightward push)
  let maxAdjustmentSegment = null;
  let maxAdjustmentAmount = 0;

  adjustedSegments.forEach(segment => {
    if (segment.shiftAmount && segment.shiftAmount > maxAdjustmentAmount) {
      maxAdjustmentAmount = segment.shiftAmount;
      maxAdjustmentSegment = {
        segmentId: segment.subtitle_id,
        adjustmentAmount: segment.shiftAmount,
        strategy: segment.adjustmentStrategy
      };
    }
  });

  // Skip the final 0.5s earlier adjustment to avoid creating new overlaps
  // Since we're strictly avoiding overlaps, we don't want to risk creating new ones
  console.log(`Skipping final timing adjustment to maintain strict overlap prevention.`);
  const finalAdjustedSegments = adjustedSegments;

  if (adjustedCount > 0) {
    console.log(`Smart overlap resolution complete: Adjusted ${adjustedCount} of ${audioSegments.length} segments (${leftMoves} moved left, ${rightMoves} moved right) for optimized narration flow.`);
    if (maxAdjustmentSegment) {
      console.log(`Maximum adjustment: Segment ${maxAdjustmentSegment.segmentId} pushed ${maxAdjustmentSegment.adjustmentAmount.toFixed(2)}s right via ${maxAdjustmentSegment.strategy}`);
    }
    if (suppressedLogs > 0) {
      console.log(`Suppressed ${suppressedLogs} verbose overlap-resolution log lines.`);
    }
    
    // Calculate total duration extension
    const originalLastEnd = audioSegments[audioSegments.length - 1].end;
    const adjustedLastEnd = finalAdjustedSegments[finalAdjustedSegments.length - 1].naturalEnd;
    const durationExtension = adjustedLastEnd - originalLastEnd;
    if (durationExtension > 0) {
      console.log(`  - Total duration extended by ${durationExtension.toFixed(2)}s to prevent overlaps`);
    }
  } else {
    console.log(`No overlaps detected among ${audioSegments.length} segments. No adjustments needed.`);
  }
  
  // Verify overlaps don't exceed the allowed 0.3s
  let hasExcessiveOverlaps = false;
  let allowedOverlapCount = 0;
  for (let i = 1; i < finalAdjustedSegments.length; i++) {
    const prev = finalAdjustedSegments[i - 1];
    const curr = finalAdjustedSegments[i];
    const overlapAmount = prev.naturalEnd - curr.start;
    
    if (overlapAmount > 0.3) {
      // This is more than the allowed 0.3s overlap
      hasExcessiveOverlaps = true;
      console.error(`ERROR: Excessive overlap detected between segments ${prev.subtitle_id} and ${curr.subtitle_id}`);
      console.error(`  Overlap: ${overlapAmount.toFixed(2)}s (max allowed: 0.3s)`);
      console.error(`  Previous ends at ${prev.naturalEnd.toFixed(2)}s, Current starts at ${curr.start.toFixed(2)}s`);
    } else if (overlapAmount > 0) {
      // This is within the allowed 0.3s overlap
      allowedOverlapCount++;
    }
  }
  
  if (!hasExcessiveOverlaps) {
    console.log(`✅ Verification complete: All overlaps within allowed 0.3s threshold.`);
    if (allowedOverlapCount > 0) {
      console.log(`  - ${allowedOverlapCount} segments have natural overlaps (≤0.3s) for smooth transitions`);
    }
  } else {
    console.error(`❌ Some segments have excessive overlaps exceeding the 0.3s threshold!`);
  }

  // Return both adjusted segments and adjustment statistics
  return {
    adjustedSegments: finalAdjustedSegments,
    adjustmentStats: {
      adjustedCount,
      leftMoves,
      rightMoves,
      maxAdjustment: maxAdjustmentSegment
    }
  };
};


module.exports = { findBlankSpaces, calculateDistributedGroupShift, analyzeAndAdjustSegments };
