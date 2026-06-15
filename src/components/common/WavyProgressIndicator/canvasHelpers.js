// Pure canvas / DOM helpers for the LinearWavyProgressIndicator web component.
//
// Every function here takes all of its inputs as parameters and touches no
// component (`this`) state, so they can be unit-tested and reused in isolation.
// The web component delegates to these from thin one-line methods, preserving
// its exact runtime behavior. Only browser globals are used (window, Math).

// Set up high-DPI canvas rendering for crisp visuals.
// Mutates the given canvas/ctx (size + CSS scaling) and returns the device
// pixel ratio the caller should store for later use.
export function setupHighDPICanvas(canvas, ctx) {
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Get the display size (CSS pixels)
    const displayWidth = canvas.width;
    const displayHeight = canvas.height;

    // Set the actual size in memory (scaled up for high-DPI)
    canvas.width = displayWidth * devicePixelRatio;
    canvas.height = displayHeight * devicePixelRatio;

    // Scale the canvas back down using CSS
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    // Scale the drawing context so everything draws at the correct size
    ctx.scale(devicePixelRatio, devicePixelRatio);

    return devicePixelRatio;
}

// Apply accessibility attributes for the current progress value to an element.
export function applyAccessibilityAttributes(el, progress) {
    const percentage = Math.round(progress * 100);
    el.setAttribute('aria-valuenow', percentage);
    el.setAttribute('aria-valuetext', `${percentage}%`);
    el.setAttribute('aria-label', `Progress: ${percentage}%`);
}

// Whether the stop indicator should be shown based on Material Design 3
// guidelines. Defaults to shown unless explicitly disabled via attribute.
export function computeShouldShowStopIndicator(el) {
    // Stop indicator is required if track has contrast below 3:1 with container
    // For now, always show it unless explicitly disabled
    return el.getAttribute('show-stop-indicator') !== 'false';
}

// Draw the determinate stop indicator. Drawn within an already-scaled context.
// `showStopIndicator` mirrors computeShouldShowStopIndicator(el).
export function drawStopIndicator(ctx, progressEnd, size, color, showStopIndicator) {
    if (!showStopIndicator) {
        return;
    }

    // Exact dimensions from Figma: 4px circle. Scaling is now handled by the context.
    const stopSize = 4;
    const radius = stopSize / 2;
    if (radius <= 0) return;

    // Position at the end of track with proper offset
    const centerX = size.width - 4;
    const centerY = size.height / 2;

    // Don't draw if progress has reached the stop indicator
    const progressX = size.width * progressEnd;
    if (progressX >= centerX - radius) {
        return;
    }

    // Draw the stop indicator as a circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
}

// Paint the full indicator (track, progress paths, low-progress dot, stop
// indicator) within a vertically-scaled context. Mutates `cache` via
// updatePaths and saves/restores the context, exactly as the original
// drawProgress body did. Every input is passed explicitly.
export function paintScaledIndicator(ctx, size, currentScale, params) {
    const {
        cache,
        wavelength,
        progressFractions,
        currentAmplitude,
        waveOffset,
        gapSize,
        stroke,
        trackStroke,
        trackColor,
        color,
        coercedProgress,
        showStopIndicator,
    } = params;

    // --- FIX: Apply consistent scaling transformation to ALL drawing operations ---
    // This ensures all drawn elements (track, progress, dot, stop indicator) are scaled uniformly
    ctx.save();
    const centerY = size.height / 2;
    ctx.translate(0, centerY);
    ctx.scale(1, currentScale);
    ctx.translate(0, -centerY);

    // Always update and draw the main progress paths within scaled context
    cache.updatePaths(
        size,
        wavelength,
        progressFractions,
        currentAmplitude,
        currentAmplitude > 0 ? waveOffset : 0,
        gapSize,
        stroke,
        trackStroke
    );

    // Draw track segments
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = trackStroke.width;
    ctx.lineCap = 'round';
    ctx.stroke(cache.trackPathToDraw);

    // Draw progress paths
    const progressPaths = cache.progressPathsToDraw;
    if (progressPaths) {
        ctx.strokeStyle = color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';

        for (let i = 0; i < progressPaths.length; i++) {
            if (progressPaths[i]) {
                ctx.stroke(progressPaths[i]);
            }
        }
    }

    // Draw low progress dot if needed (also within scaled context)
    drawLowProgressDot(ctx, coercedProgress, size, color);

    // Draw stop indicator for determinate progress (within scaled context)
    if (showStopIndicator) {
        drawStopIndicator(ctx, progressFractions[1], size, color, showStopIndicator);
    }

    // Restore context from the scaling transformation
    ctx.restore();
    // --- FIX END ---
}

// Handle dot appearance at very low progress matching the Figma design.
// Returns true when a dot was drawn, false otherwise.
export function drawLowProgressDot(ctx, progress, size, color) {
    if (progress > 0 && progress < 0.05) { // Less than 5% progress
        const dotRadius = 2; // 4px diameter = 2px radius
        const centerX = 4; // Small offset from left edge
        const centerY = size.height / 2;

        ctx.fillStyle = color; // #485E92 from Figma
        ctx.beginPath();
        ctx.arc(centerX, centerY, dotRadius, 0, 2 * Math.PI);
        ctx.fill();
        return true; // Dot was drawn
    }
    return false; // No dot needed
}
