/**
 * Utility functions for subtitle processing
 */

/**
 * Deduplicate and sort subtitles, fixing overlaps and small gaps
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {Array} - Processed array of subtitle objects
 */
export const deduplicateAndSortSubtitles = (subtitles) => {
    // Filter out invalid subtitles
    const validSubtitles = subtitles.filter(sub => {
        // Skip subtitles with identical start and end times
        if (sub.start === sub.end) {

            return false;
        }

        // Adjust subtitles with very short duration (less than 0.3 seconds)
        if (sub.end - sub.start < 0.3) {

            sub.end = sub.start + 0.5; // Set minimum duration to 0.5 seconds
        }

        // Skip subtitles with empty text
        if (!sub.text || sub.text.trim() === '') {

            return false;
        }

        return true;
    });

    const uniqueSubtitles = [];
    const seen = new Set();

    // Sort by start time
    validSubtitles.sort((a, b) => a.start - b.start);

    // First pass: Handle overlapping subtitles and small gaps
    for (let i = 0; i < validSubtitles.length - 1; i++) {
        const current = validSubtitles[i];
        const next = validSubtitles[i + 1];

        // Handle overlapping subtitles
        if (next.start < current.end) {


            // If they have the same text, merge them
            if (next.text === current.text) {
                current.end = Math.max(current.end, next.end);
                next.start = current.end;
                next.end = Math.max(next.end, next.start + 0.5); // Ensure minimum duration
            } else {
                // Otherwise, adjust the boundary
                const midpoint = (current.end + next.start) / 2;
                current.end = midpoint;
                next.start = midpoint;
            }
        }
        // If there's a very small gap between subtitles (less than 0.1 seconds)
        else if (next.start - current.end > 0 && next.start - current.end < 0.1) {

            // Either extend the current subtitle or move the next one back
            if (next.text === current.text) {
                // If they have the same text, extend the current one
                current.end = next.start;
            } else {
                // Otherwise, just close the gap by moving the next one back
                next.start = current.end;
            }
        }
    }

    // Second pass: Merge consecutive subtitles with the same text if they're close together
    for (let i = 0; i < validSubtitles.length; i++) {
        const current = validSubtitles[i];
        const key = `${current.start}-${current.end}-${current.text}`;

        // Skip if we've already seen this exact subtitle
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        // Look ahead to see if there are consecutive identical texts
        let j = i + 1;
        while (j < validSubtitles.length &&
               validSubtitles[j].text === current.text &&
               validSubtitles[j].start - current.end < 0.3) {

            // Merge this subtitle with the current one

            current.end = validSubtitles[j].end;

            // Mark this key as seen
            seen.add(`${validSubtitles[j].start}-${validSubtitles[j].end}-${validSubtitles[j].text}`);

            j++;
        }

        // Skip all the merged subtitles
        i = j - 1;

        uniqueSubtitles.push(current);
    }


    return uniqueSubtitles;
};
