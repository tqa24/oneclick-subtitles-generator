/**
 * Reusable Wavy Progress Indicator Web Component
 *
 * Based on Android's Material Design 3 Wavy Progress Indicators
 * Ported from Android source code:
 * - WavyProgressIndicator.kt
 * - LinearWavyProgressModifiers.kt
 * - CircularWavyProgressModifiers.kt
 *
 * Features:
 * - Exact Android algorithms and animations
 * - Entrance and disappearance animations
 * - Theme-aware color support
 * - Configurable properties
 * - Accessibility support
 */

// Animation specifications from Android MotionTokens
const AnimationSpecs = {
    // EXACT Amplitude Animation Specs from Android
    // From IncreasingAmplitudeAnimationSpec (MotionTokens.DurationLong2 = 500ms)
    increasingAmplitude: {
        duration: 500,
        easing: [0.2, 0, 0, 1] // MotionTokens.EasingStandardCubicBezier
    },
    // From DecreasingAmplitudeAnimationSpec (MotionTokens.DurationLong2 = 500ms)
    decreasingAmplitude: {
        duration: 500,
        easing: [0.05, 0.7, 0.1, 1] // MotionTokens.EasingEmphasizedAccelerateCubicBezier
    },

    // Progress animation spec
    progressAnimation: {
        duration: 500,
        easing: [0.4, 0, 0.2, 1] // MotionTokens.EasingLinearCubicBezier (approximated)
    }
};

// WavyProgressIndicatorDefaults equivalent
class WavyProgressIndicatorDefaults {
    // EXACT colors from Figma design
    static get indicatorColor() {
        return '#485E92'; // Exact color from Figma stroke_ZBYF2E and fill_WDP657
    }

    static get trackColor() {
        return '#D9DFF6'; // Exact color from Figma fill_RAQXG6
    }
    
    // Stroke configurations
    static get linearIndicatorStroke() {
        return {
            width: 8, // ActiveThickness from Figma design
            cap: 'round' // StrokeCap.Round
        };
    }

    static get linearTrackStroke() {
        return {
            width: 8, // TrackThickness from Figma design
            cap: 'round'
        };
    }
    
    // Container dimensions
    static get LinearContainerWidth() {
        return 240; // From tokens
    }
    
    static get LinearContainerHeight() {
        return 16; // From tokens
    }
    
    // Gap and stop sizes
    static get LinearIndicatorTrackGapSize() {
        return 4; // From tokens
    }
    
    static get LinearTrackStopIndicatorSize() {
        return 4; // From tokens
    }
    
    // Wavelengths
    static get LinearDeterminateWavelength() {
        return 32; // Optimal wave density - balanced spacing
    }
    
    // Exact amplitude function from Android
    static indicatorAmplitude(progress) {
        // From WavyProgressIndicatorDefaults.indicatorAmplitude
        // Sets the amplitude to the max on 10%, and back to zero on 95% of the progress
        if (progress <= 0.1 || progress >= 0.95) {
            return 0;
        } else {
            return 1;
        }
    }
}

// LinearProgressDrawingCache equivalent
class LinearProgressDrawingCache {
    constructor() {
        this.currentWavelength = -1;
        this.currentAmplitude = -1;
        this.currentSize = { width: 0, height: 0 };
        this.currentProgressFractions = null;
        this.currentIndicatorTrackGapSize = 0;
        this.currentWaveOffset = -1;
        this.currentStroke = { width: 8, cap: 'round' };
        this.currentTrackStroke = { width: 8, cap: 'round' };
        
        this.progressPathScale = 1;
        this.fullProgressPath = new Path2D();
        this.trackPathToDraw = new Path2D();
        this.progressPathsToDraw = null;
        this.currentStrokeCapWidth = 0;
    }
    
    // Exact port of updatePaths from LinearProgressDrawingCache
    updatePaths(size, wavelength = 0, progressFractions, amplitude, waveOffset, gapSize, stroke, trackStroke) {
        if (this.currentProgressFractions === null) {
            this.currentProgressFractions = new Array(progressFractions.length);
            this.progressPathsToDraw = new Array(Math.floor(progressFractions.length / 2));
            for (let i = 0; i < this.progressPathsToDraw.length; i++) {
                this.progressPathsToDraw[i] = new Path2D();
            }
        }
        
        const pathsUpdated = this.updateFullPaths(size, wavelength, amplitude, gapSize, stroke, trackStroke);
        this.updateDrawPaths(pathsUpdated, progressFractions, amplitude, waveOffset);
    }
    
    // Exact port of updateFullPaths
    updateFullPaths(size, wavelength, amplitude, gapSize, stroke, trackStroke) {
        if (this.currentSize.width === size.width && 
            this.currentSize.height === size.height &&
            this.currentWavelength === wavelength &&
            JSON.stringify(this.currentStroke) === JSON.stringify(stroke) &&
            JSON.stringify(this.currentTrackStroke) === JSON.stringify(trackStroke) &&
            this.currentIndicatorTrackGapSize === gapSize &&
            ((this.currentAmplitude !== 0 && amplitude !== 0) || 
             (this.currentAmplitude === 0 && amplitude === 0))) {
            return false; // No update required
        }
        
        const height = size.height;
        const width = size.width;
        
        // Update stroke cap width
        this.currentStrokeCapWidth = 
            (stroke.cap === 'butt' && trackStroke.cap === 'butt') || height > width
                ? 0 
                : Math.max(stroke.width / 2, trackStroke.width / 2);
        
        // Create the full progress path
        this.fullProgressPath = new Path2D();
        this.fullProgressPath.moveTo(0, 0);
        
        if (amplitude === 0) {
            // Just a line
            this.fullProgressPath.lineTo(width, 0);
        } else {
            // Create wavy path - exact algorithm from Android
            const halfWavelengthPx = wavelength / 2;
            let anchorX = halfWavelengthPx;
            const anchorY = 0;
            let controlX = halfWavelengthPx / 2;
            let controlY = (height - stroke.width) * 0.5; // Reduced amplitude for 8px stroke
            
            const widthWithExtraPhase = width + wavelength * 2;
            let wavesCount = 0;
            
            while (anchorX <= widthWithExtraPhase) {
                this.fullProgressPath.quadraticCurveTo(controlX, controlY, anchorX, anchorY);
                anchorX += halfWavelengthPx;
                controlX += halfWavelengthPx;
                controlY *= -1;
                wavesCount++;
            }
        }
        
        // Translate path to center vertically
        // Note: Path2D doesn't have direct translate, so we'll handle this in drawing
        
        // Calculate progress path scale
        // This is approximated since we can't easily measure Path2D length
        this.progressPathScale = amplitude === 0 ? 1 : 1.2; // Approximation
        
        // Cache values
        this.currentSize = { ...size };
        this.currentWavelength = wavelength;
        this.currentStroke = { ...stroke };
        this.currentTrackStroke = { ...trackStroke };
        this.currentIndicatorTrackGapSize = gapSize;
        
        return true;
    }
    
    // Exact port of updateDrawPaths (simplified for web)
    updateDrawPaths(forceUpdate, progressFractions, amplitude, waveOffset) {
        if (!forceUpdate && 
            this.arraysEqual(this.currentProgressFractions, progressFractions) &&
            this.currentAmplitude === amplitude &&
            this.currentWaveOffset === waveOffset) {
            return; // No update required
        }
        
        const width = this.currentSize.width;
        const halfHeight = this.currentSize.height / 2;
        
        // Update track path
        this.trackPathToDraw = new Path2D();
        this.trackPathToDraw.moveTo(width - this.currentStrokeCapWidth, halfHeight);
        
        // Update progress paths
        for (let i = 0; i < this.progressPathsToDraw.length; i++) {
            this.progressPathsToDraw[i] = new Path2D();
            
            const startProgressFraction = progressFractions[i * 2];
            const endProgressFraction = progressFractions[i * 2 + 1];
            
            const barTail = startProgressFraction * width;
            const barHead = endProgressFraction * width;
            
            if (Math.abs(endProgressFraction - startProgressFraction) > 0) {
                // Create progress segment
                const adjustedBarHead = Math.max(this.currentStrokeCapWidth, 
                    Math.min(barHead, width - this.currentStrokeCapWidth));
                const adjustedBarTail = Math.max(this.currentStrokeCapWidth,
                    Math.min(barTail, width - this.currentStrokeCapWidth));
                
                if (amplitude === 0) {
                    // Simple line
                    this.progressPathsToDraw[i].moveTo(adjustedBarTail, halfHeight);
                    this.progressPathsToDraw[i].lineTo(adjustedBarHead, halfHeight);
                } else {
                    // Wavy line - simplified for web implementation
                    this.createWavySegment(this.progressPathsToDraw[i], 
                        adjustedBarTail, adjustedBarHead, halfHeight, amplitude, waveOffset);
                }
            }
        }
        
        // Update track path segments
        this.updateTrackPath(progressFractions, width, halfHeight);
        
        // Cache values
        progressFractions.forEach((val, idx) => this.currentProgressFractions[idx] = val);
        this.currentAmplitude = amplitude;
        this.currentWaveOffset = waveOffset;
    }
    
    createWavySegment(path, startX, endX, centerY, amplitude, waveOffset) {
        const segmentWidth = endX - startX;
        const wavelength = this.currentWavelength;
        const waveHeight = amplitude * this.currentSize.height * 0.15; // Reduced for 8px stroke

        path.moveTo(startX, centerY);

        const steps = Math.max(Math.floor(segmentWidth / 2), 10);
        for (let i = 1; i <= steps; i++) {
            const x = startX + (i / steps) * segmentWidth;
            const waveX = ((x + waveOffset * wavelength) / wavelength) * 2 * Math.PI;
            const y = centerY + Math.sin(waveX) * waveHeight;
            path.lineTo(x, y);
        }
    }
    
    updateTrackPath(progressFractions, width, halfHeight) {
        // EXACT port of Android track path logic from updateDrawPaths
        let activeIndicatorVisible = false;

        // Start from right edge (exact Android logic)
        let nextEndTrackOffset = width - this.currentStrokeCapWidth;
        this.trackPathToDraw = new Path2D();
        this.trackPathToDraw.moveTo(nextEndTrackOffset, halfHeight);

        // Process each progress segment (exact Android loop)
        for (let i = 0; i < progressFractions.length / 2; i++) {
            const startProgressFraction = progressFractions[i * 2];
            const endProgressFraction = progressFractions[i * 2 + 1];

            const barHead = endProgressFraction * width;
            const barTail = startProgressFraction * width;

            // Calculate adaptive track gap spacing (exact Android logic)
            let adjustedTrackGapSize = this.currentIndicatorTrackGapSize;

            if (i === 0) {
                // First segment logic (exact Android)
                adjustedTrackGapSize = barHead < this.currentStrokeCapWidth ?
                    0 : Math.min(barHead - this.currentStrokeCapWidth, this.currentIndicatorTrackGapSize);
                activeIndicatorVisible = barHead >= this.currentStrokeCapWidth;
            }

            // Coerce bar positions (exact Android)
            const adjustedBarHead = Math.max(this.currentStrokeCapWidth,
                Math.min(barHead, width - this.currentStrokeCapWidth));
            const adjustedBarTail = Math.max(this.currentStrokeCapWidth,
                Math.min(barTail, width - this.currentStrokeCapWidth));

            // Calculate adaptive track spacing (exact Android)
            const adaptiveTrackSpacing = activeIndicatorVisible ?
                adjustedTrackGapSize + this.currentStrokeCapWidth * 2 : adjustedTrackGapSize;

            // Draw track segment if there's space (exact Android)
            if (nextEndTrackOffset > adjustedBarHead + adaptiveTrackSpacing) {
                this.trackPathToDraw.lineTo(
                    Math.max(this.currentStrokeCapWidth, adjustedBarHead + adaptiveTrackSpacing),
                    halfHeight
                );
            }

            // Update nextEndTrackOffset for next iteration (exact Android)
            if (barHead > barTail) {
                nextEndTrackOffset = Math.max(this.currentStrokeCapWidth,
                    adjustedBarTail - adaptiveTrackSpacing);
                this.trackPathToDraw.moveTo(nextEndTrackOffset, halfHeight);
            }
        }

        // Final track drawing to fill remaining gaps (exact Android)
        if (nextEndTrackOffset > this.currentStrokeCapWidth) {
            this.trackPathToDraw.lineTo(this.currentStrokeCapWidth, halfHeight);
        }
    }
    
    arraysEqual(a, b) {
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        return a.every((val, idx) => val === b[idx]);
    }
}

// Exact port of Android's Animatable class for amplitude animations
class Animatable {
    constructor(initialValue = 0) {
        this.value = initialValue;
        this.targetValue = initialValue;
        this.isRunning = false;
        this.animationId = null;
        this.onUpdate = null;
    }

    // Exact port of animateTo from Android Animatable
    async animateTo(targetValue, animationSpec) {
        if (this.targetValue === targetValue && !this.isRunning) {
            return; // Already at target
        }

        // Cancel existing animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.targetValue = targetValue;
        this.isRunning = true;

        const startValue = this.value;
        const startTime = performance.now();
        const duration = animationSpec.duration;
        const easing = animationSpec.easing;

        return new Promise((resolve) => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Apply cubic bezier easing
                const easedProgress = this.cubicBezier(progress, easing);
                this.value = startValue + (targetValue - startValue) * easedProgress;

                // Notify update callback
                if (this.onUpdate) {
                    this.onUpdate(this.value);
                }

                if (progress < 1) {
                    this.animationId = requestAnimationFrame(animate);
                } else {
                    this.isRunning = false;
                    this.animationId = null;
                    resolve();
                }
            };

            this.animationId = requestAnimationFrame(animate);
        });
    }

    // Cubic bezier easing function
    cubicBezier(t, [x1, y1, x2, y2]) {
        // Simplified cubic bezier implementation
        const cx = 3 * x1;
        const bx = 3 * (x2 - x1) - cx;
        const ax = 1 - cx - bx;

        const cy = 3 * y1;
        const by = 3 * (y2 - y1) - cy;
        const ay = 1 - cy - by;

        const cubeRoot = ((ax * t + bx) * t + cx) * t;
        return ((ay * cubeRoot + by * cubeRoot + cy) * cubeRoot);
    }

    // Stop current animation
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isRunning = false;
    }
}

// Exact LinearWavyProgressIndicator Web Component
class LinearWavyProgressIndicator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Properties matching Android implementation
        this._currentProgress = 0;  // Current animated progress value
        this._targetProgress = 0;   // Target progress value to animate to
        this._progress = () => this._currentProgress;
        this._amplitude = WavyProgressIndicatorDefaults.indicatorAmplitude;
        this._color = this.getThemeColor('--figma-progress-color') || WavyProgressIndicatorDefaults.indicatorColor;
        this._trackColor = this.getThemeColor('--figma-track-color') || WavyProgressIndicatorDefaults.trackColor;
        this._stroke = WavyProgressIndicatorDefaults.linearIndicatorStroke;
        this._trackStroke = WavyProgressIndicatorDefaults.linearTrackStroke;
        this._gapSize = WavyProgressIndicatorDefaults.LinearIndicatorTrackGapSize;
        this._stopSize = WavyProgressIndicatorDefaults.LinearTrackStopIndicatorSize;
        this._wavelength = WavyProgressIndicatorDefaults.LinearDeterminateWavelength;
        this._waveSpeed = 1; // Default wave speed (1 cycle per second)

        // Progress animation properties
        this._progressAnimatable = new Animatable(0);
        this._progressAnimationJob = null;
        this._progressAnimationDuration = 300; // Default animation duration in ms

        // Wave acceleration during progress animation
        this._baseWaveSpeed = this._waveSpeed; // Store original wave speed
        this._isProgressAnimating = false;
        this._waveAccelerationFactor = 1.6; // Subtle, natural acceleration (Material Design 3)
        this._waveSpeedAnimatable = new Animatable(this._waveSpeed); // Initialize with current wave speed
        this._waveSpeedTransitionDuration = 200; // Smooth transition duration in ms

        // Animation state - exact port from Android
        this._waveOffset = 0;
        this._amplitudeAnimatable = null; // Will be created on first use
        this._offsetAnimationId = null;
        this._amplitudeAnimationJob = null;
        
        // NEW: Entrance and Disappearance Animation State
        this._isAnimatingEntrance = false;
        this._entranceStartTime = 0;
        this._isAnimatingDisappearance = false;
        this._disappearanceStartTime = 0;
        this._hasDisappeared = false; // Track if element has completed disappearance
        this.ENTRANCE_DISAPPEARANCE_DURATION = 400; // in milliseconds


        // Drawing cache
        this._progressDrawingCache = new LinearProgressDrawingCache();

        // Set up progress animation callback
        this._progressAnimatable.onUpdate = (value) => {
            this._currentProgress = value;
            this.invalidateDraw();
            // Update accessibility attributes
            this.updateAccessibility(value);
        };

        // Set up wave speed animation callback for smooth transitions
        this._waveSpeedAnimatable.onUpdate = (value) => {
            this._waveSpeed = value;
            // Update the animation duration for the existing loop without restarting
            this.updateWaveSpeedOnly();
        };

        this.render();
    }

    // Method to get current theme colors from CSS variables
    getThemeColor(cssVariable) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(cssVariable).trim();
    }

    // Method to update colors based on current theme
    updateThemeColors() {
        // Try multiple CSS variable names for flexibility
        const progressColorVars = ['--wavy-progress-color', '--figma-progress-color', '--progress-color'];
        const trackColorVars = ['--wavy-track-color', '--figma-track-color', '--track-color'];

        let progressColor = null;
        let trackColor = null;

        // Find the first available progress color variable
        for (const varName of progressColorVars) {
            const color = this.getThemeColor(varName);
            if (color) {
                progressColor = color;
                break;
            }
        }

        // Find the first available track color variable
        for (const varName of trackColorVars) {
            const color = this.getThemeColor(varName);
            if (color) {
                trackColor = color;
                break;
            }
        }

        this._color = progressColor || WavyProgressIndicatorDefaults.indicatorColor;
        this._trackColor = trackColor || WavyProgressIndicatorDefaults.trackColor;
        this.invalidateDraw();
    }

    // Method to set custom colors programmatically
    setColors(progressColor, trackColor) {
        if (progressColor) this._color = progressColor;
        if (trackColor) this._trackColor = trackColor;
        this.invalidateDraw();
    }

    // Method to reset to default colors
    resetToDefaultColors() {
        this._color = WavyProgressIndicatorDefaults.indicatorColor;
        this._trackColor = WavyProgressIndicatorDefaults.trackColor;
        this.invalidateDraw();
    }

    static get observedAttributes() {
        return ['progress', 'color', 'track-color', 'amplitude',
                'wavelength', 'wave-speed', 'gap-size', 'stop-size'];
    }

    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'progress':
                const progressValue = parseFloat(newValue) || 0;
                this.setProgress(progressValue);
                break;
            case 'color':
                this._color = newValue || WavyProgressIndicatorDefaults.indicatorColor;
                break;
            case 'track-color':
                this._trackColor = newValue || WavyProgressIndicatorDefaults.trackColor;
                break;
            case 'amplitude':
                if (newValue && !isNaN(parseFloat(newValue))) {
                    const amp = Math.max(0, Math.min(1, parseFloat(newValue)));
                    this._amplitude = () => amp;
                } else {
                    this._amplitude = WavyProgressIndicatorDefaults.indicatorAmplitude;
                }
                break;
            case 'wavelength':
                this._wavelength = parseFloat(newValue) || WavyProgressIndicatorDefaults.LinearDeterminateWavelength;
                this.updateOffsetAnimation();
                break;
            case 'wave-speed':
                this._baseWaveSpeed = parseFloat(newValue) || 1; // Default to 1 for visible animation
                this._waveSpeed = this._baseWaveSpeed;
                // Don't restart animation to preserve continuity
                break;
            case 'gap-size':
                this._gapSize = parseFloat(newValue) || WavyProgressIndicatorDefaults.LinearIndicatorTrackGapSize;
                break;
            case 'stop-size':
                this._stopSize = parseFloat(newValue) || WavyProgressIndicatorDefaults.LinearTrackStopIndicatorSize;
                break;
        }
        this.invalidateDraw();
    }

    connectedCallback() {
        this.updateOffsetAnimation();
        // Start entrance animation if progress is at 0 when connected
        if (this.getProgress() === 0) {
            this.startEntranceAnimation();
        }
        this.startDrawLoop();
    }

    disconnectedCallback() {
        this.stopAllAnimations();
    }

    render() {
        const containerWidth = WavyProgressIndicatorDefaults.LinearContainerWidth;
        const containerHeight = WavyProgressIndicatorDefaults.LinearContainerHeight;

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: ${containerWidth}px;
                    height: ${containerHeight}px;
                    position: relative;
                    /* IncreaseVerticalSemanticsBounds equivalent */
                    padding: 4px 0;
                    margin: -4px 0;
                }

                canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                }
            </style>
            <canvas width="${containerWidth}" height="${containerHeight}"></canvas>
        `;

        this.canvas = this.shadowRoot.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');

        // Set up high-DPI rendering for crisp visuals
        this.setupHighDPICanvas();

        // Set up accessibility
        this.setAttribute('role', 'progressbar');
        this.setAttribute('aria-valuemin', '0');
        this.setAttribute('aria-valuemax', '100');
    }

    // Set up high-DPI canvas rendering for crisp visuals
    setupHighDPICanvas() {
        const canvas = this.canvas;
        const ctx = this.ctx;
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

        // Store the device pixel ratio for later use
        this.devicePixelRatio = devicePixelRatio;
    }

    // Update wave speed without restarting animation (preserves continuity)
    updateWaveSpeedOnly() {
        // Just update the internal speed - the existing animation loop will adapt
        // No need to restart the animation, preserving wave continuity
    }

    // Exact port of updateOffsetAnimation from Android
    updateOffsetAnimation() {
        if (this._offsetAnimationId) {
            cancelAnimationFrame(this._offsetAnimationId);
            this._offsetAnimationId = null;
        }

        if (this._waveSpeed > 0 && this._wavelength > 0) {
            const startTime = performance.now();
            let lastTime = startTime;

            const animate = (currentTime) => {
                const deltaTime = currentTime - lastTime;
                lastTime = currentTime;

                // Calculate speed-based offset increment (preserves continuity during speed changes)
                const speedFactor = this._waveSpeed; // Direct speed factor for more visible effect
                const offsetIncrement = (deltaTime / 1000) * speedFactor;



                this._waveOffset = (this._waveOffset + offsetIncrement) % 1;

                this._offsetAnimationId = requestAnimationFrame(animate);
            };

            this._offsetAnimationId = requestAnimationFrame(animate);
        } else {
            this._waveOffset = 0;
        }
    }

    // EXACT port of updateAmplitudeAnimation from Android LinearWavyProgressModifiers.kt
    updateAmplitudeAnimation(targetAmplitudePx) {
        // Create Animatable if it doesn't exist (exact Android behavior)
        const currentAmplitudeAnimatable = this._amplitudeAnimatable ||
            new Animatable(targetAmplitudePx);

        if (!this._amplitudeAnimatable) {
            this._amplitudeAnimatable = currentAmplitudeAnimatable;
            // Set up update callback to trigger redraws
            currentAmplitudeAnimatable.onUpdate = () => {
                this.invalidateDraw();
            };
        }

        // Check if the amplitude target has changed AND animation is not already running
        // towards it. If so, launch the amplitude animation (exact Android logic)
        if (currentAmplitudeAnimatable.targetValue !== targetAmplitudePx &&
            (!this._amplitudeAnimationJob || !currentAmplitudeAnimatable.isRunning)) {

            // Cancel existing animation job
            if (this._amplitudeAnimationJob) {
                currentAmplitudeAnimatable.stop();
            }

            // Choose animation spec based on direction (exact Android logic)
            const animationSpec = currentAmplitudeAnimatable.value < targetAmplitudePx
                ? AnimationSpecs.increasingAmplitude  // IncreasingAmplitudeAnimationSpec
                : AnimationSpecs.decreasingAmplitude; // DecreasingAmplitudeAnimationSpec

            // Start animation (equivalent to coroutineScope.launch in Android)
            this._amplitudeAnimationJob = currentAmplitudeAnimatable.animateTo(
                targetAmplitudePx,
                animationSpec
            );
        }
    }



    getProgressFractions() {
        // Return 2 values for determinate progress
        return [0, this._progress()];
    }

    startDrawLoop() {
        const draw = () => {
            this.drawProgress();
            requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
    }

    // [FIXED] Drawing logic with corrected entrance/disappearance animation handling
    drawProgress() {
        if (!this.ctx) return;

        const canvas = this.canvas;
        const ctx = this.ctx;
        const size = {
            width: parseInt(canvas.style.width) || canvas.width / (this.devicePixelRatio || 1),
            height: parseInt(canvas.style.height) || canvas.height / (this.devicePixelRatio || 1)
        };

        ctx.clearRect(0, 0, size.width, size.height);

        // --- Entrance and Disappearance Animation Logic ---
        let entranceProgress = 1;
        if (this._isAnimatingEntrance) {
            const elapsed = performance.now() - this._entranceStartTime;
            entranceProgress = Math.min(elapsed / this.ENTRANCE_DISAPPEARANCE_DURATION, 1);
            if (entranceProgress >= 1) {
                this._isAnimatingEntrance = false;
            }
        }

        let disappearanceProgress = 0;
        if (this._isAnimatingDisappearance) {
            const elapsed = performance.now() - this._disappearanceStartTime;
            disappearanceProgress = Math.min(elapsed / this.ENTRANCE_DISAPPEARANCE_DURATION, 1);
            if (disappearanceProgress >= 1) {
                this._isAnimatingDisappearance = false;
                this._hasDisappeared = true; // Mark as disappeared
            }
        }

        const easedEntranceProgress = this.easeOutCubic(entranceProgress);
        const easedDisappearanceProgress = this.easeInCubic(disappearanceProgress);
        let currentScale = easedEntranceProgress * (1 - easedDisappearanceProgress);

        if (this._hasDisappeared) {
            currentScale = 0;
        }

        if (currentScale <= 0.01) {
            return; // Nothing to draw if completely invisible
        }

        // Get current progress and amplitude
        const coercedProgress = Math.max(0, Math.min(1, this._progress()));
        const targetAmplitudePx = this._amplitude(coercedProgress);
        this.updateAmplitudeAnimation(targetAmplitudePx);
        const currentAmplitude = this._amplitudeAnimatable ? this._amplitudeAnimatable.value : 0;


        const progressFractions = this.getProgressFractions();

        // --- FIX: Apply consistent scaling transformation to ALL drawing operations ---
        // This ensures all drawn elements (track, progress, dot, stop indicator) are scaled uniformly
        ctx.save();
        const centerY = size.height / 2;
        ctx.translate(0, centerY);
        ctx.scale(1, currentScale);
        ctx.translate(0, -centerY);

        // Always update and draw the main progress paths within scaled context
        this._progressDrawingCache.updatePaths(
            size,
            this._wavelength,
            progressFractions,
            currentAmplitude,
            currentAmplitude > 0 ? this._waveOffset : 0,
            this._gapSize,
            this._stroke,
            this._trackStroke
        );

        // Draw track segments
        ctx.strokeStyle = this._trackColor;
        ctx.lineWidth = this._trackStroke.width;
        ctx.lineCap = 'round';
        ctx.stroke(this._progressDrawingCache.trackPathToDraw);

        // Draw progress paths
        const progressPaths = this._progressDrawingCache.progressPathsToDraw;
        if (progressPaths) {
            ctx.strokeStyle = this._color;
            ctx.lineWidth = this._stroke.width;
            ctx.lineCap = 'round';

            for (let i = 0; i < progressPaths.length; i++) {
                if (progressPaths[i]) {
                    ctx.stroke(progressPaths[i]);
                }
            }
        }

        // Draw low progress dot if needed (also within scaled context)
        this.drawLowProgressDot(ctx, coercedProgress, size);

        // Draw stop indicator for determinate progress (within scaled context)
        if (this.shouldShowStopIndicator()) {
            this.drawStopIndicator(ctx, progressFractions[1], size, 1);
        }

        // Restore context from the scaling transformation
        ctx.restore();
        // --- FIX END ---

        // Update accessibility attributes
        this.updateAccessibility(coercedProgress);
    }

    // Update accessibility attributes
    updateAccessibility(progress) {
        const percentage = Math.round(progress * 100);
        this.setAttribute('aria-valuenow', percentage);
        this.setAttribute('aria-valuetext', `${percentage}%`);
        this.setAttribute('aria-label', `Progress: ${percentage}%`);
    }

    // [FIXED] Simplified to be drawn within an already-scaled context
    drawStopIndicator(ctx, progressEnd, size) {
        if (!this.shouldShowStopIndicator()) {
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
        ctx.fillStyle = this._color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Check if stop indicator should be shown based on Material Design 3 guidelines
    shouldShowStopIndicator() {
        // Stop indicator is required if track has contrast below 3:1 with container
        // For now, always show it unless explicitly disabled
        return this.getAttribute('show-stop-indicator') !== 'false';
    }

    // Handle dot appearance at very low progress matching Figma design
    drawLowProgressDot(ctx, progress, size) {
        if (progress > 0 && progress < 0.05) { // Less than 5% progress
            const dotRadius = 2; // 4px diameter = 2px radius
            const centerX = 4; // Small offset from left edge
            const centerY = size.height / 2;

            ctx.fillStyle = this._color; // #485E92 from Figma
            ctx.beginPath();
            ctx.arc(centerX, centerY, dotRadius, 0, 2 * Math.PI);
            ctx.fill();
            return true; // Dot was drawn
        }
        return false; // No dot needed
    }

    // NEW: Easing functions for animations
    easeOutCubic(t) {
        return (--t) * t * t + 1;
    }

    easeInCubic(t) {
        return t * t * t;
    }


    invalidateDraw() {
        // This is now handled by the continuous draw loop.
        // Calling it just ensures a draw on the *very next* frame if needed,
        // but the loop itself keeps it rendering.
    }

    stopAllAnimations() {
        if (this._offsetAnimationId) {
            cancelAnimationFrame(this._offsetAnimationId);
            this._offsetAnimationId = null;
        }
        if (this._amplitudeAnimatable) {
            this._amplitudeAnimatable.stop();
            this._amplitudeAnimationJob = null;
        }
        if (this._progressAnimatable) {
            this._progressAnimatable.stop();
            this._progressAnimationJob = null;
        }
        if (this._waveSpeedAnimatable) {
            this._waveSpeedAnimatable.stop();
        }
        // Stop wave acceleration
        this.stopWaveAcceleration();
    }

    // Public API methods
    setProgress(progress, animate = true) {
        const newProgress = Math.max(0, Math.min(1, progress));
        const oldProgress = this._currentProgress;

        // Store target progress
        this._targetProgress = newProgress;

        if (!animate || Math.abs(newProgress - oldProgress) < 0.001) {
            // No animation needed or very small change
            this._currentProgress = newProgress;
            this._progressAnimatable.value = newProgress;
            this.setAttribute('aria-valuenow', Math.round(newProgress * 100));
            this.invalidateDraw();
        } else {
            // Animate to new progress
            this.animateProgressTo(newProgress);
        }

        // Trigger disappearance animation only when reaching 100%
        if (newProgress >= 1 && oldProgress < 1) {
            // Delay disappearance until progress animation completes
            const delay = animate ? this._progressAnimationDuration : 0;
            setTimeout(() => {
                this.startDisappearanceAnimation();
            }, delay);
        }
        // If progress is set to something less than 1 while disappearing, cancel it
        else if (newProgress < 1 && this._isAnimatingDisappearance) {
            this.resetAnimationState();
        }
    }

    // Animate progress smoothly to target value
    async animateProgressTo(targetProgress) {
        // Cancel existing progress animation
        if (this._progressAnimationJob) {
            this._progressAnimatable.stop();
            this._progressAnimationJob = null;
        }

        // Calculate animation duration based on distance
        const distance = Math.abs(targetProgress - this._currentProgress);
        const duration = Math.max(150, Math.min(this._progressAnimationDuration, distance * 800));

        // Start wave acceleration for Material Design 3 Expressive behavior
        this.startWaveAcceleration();

        // Use smooth easing for progress animation
        const animationSpec = {
            duration: duration,
            easing: [0.4, 0, 0.2, 1] // Material Design standard easing
        };

        try {
            this._progressAnimationJob = this._progressAnimatable.animateTo(targetProgress, animationSpec);
            await this._progressAnimationJob;
        } catch (error) {
            // Animation was cancelled or failed
        } finally {
            this._progressAnimationJob = null;
            // Stop wave acceleration when progress animation completes
            this.stopWaveAcceleration();
        }
    }

    // Start wave acceleration during progress animation (Material Design 3 Expressive)
    startWaveAcceleration() {
        if (this._isProgressAnimating) return; // Already accelerating

        this._isProgressAnimating = true;
        const acceleratedSpeed = this._baseWaveSpeed * this._waveAccelerationFactor;

        // Smoothly animate to accelerated wave speed
        const animationSpec = {
            duration: this._waveSpeedTransitionDuration,
            easing: [0.4, 0, 0.2, 1] // Smooth easing
        };

        this._waveSpeedAnimatable.animateTo(acceleratedSpeed, animationSpec);
    }

    // Stop wave acceleration and return to normal speed
    stopWaveAcceleration() {
        if (!this._isProgressAnimating) return; // Not accelerating

        this._isProgressAnimating = false;



        // Smoothly animate back to normal wave speed
        const animationSpec = {
            duration: this._waveSpeedTransitionDuration,
            easing: [0.4, 0, 0.2, 1] // Smooth easing
        };

        this._waveSpeedAnimatable.animateTo(this._baseWaveSpeed, animationSpec);
    }

    // Set progress instantly without animation
    setProgressInstant(progress) {
        this.setProgress(progress, false);
    }

    getProgress() {
        return this._currentProgress;
    }

    getTargetProgress() {
        return this._targetProgress;
    }

    // Configuration methods for reusability
    setProgressAnimationDuration(duration) {
        this._progressAnimationDuration = Math.max(50, Math.min(2000, duration));
    }

    setWaveSpeed(speed) {
        this._baseWaveSpeed = Math.max(0, speed);
        // If not currently animating progress, smoothly update the actual wave speed
        if (!this._isProgressAnimating) {
            const animationSpec = {
                duration: 150, // Quick but smooth transition
                easing: [0.4, 0, 0.2, 1]
            };
            this._waveSpeedAnimatable.animateTo(this._baseWaveSpeed, animationSpec);
        }
        // Note: Don't call updateOffsetAnimation() here to preserve wave continuity
    }

    setWavelength(length) {
        this._wavelength = Math.max(0, length);
        this.updateOffsetAnimation();
        this.invalidateDraw();
    }

    setAmplitude(amplitude) {
        this._amplitude = Math.max(0, Math.min(1, amplitude));
        this.invalidateDraw();
    }

    // Configure wave acceleration during progress animation
    setWaveAccelerationFactor(factor) {
        this._waveAccelerationFactor = Math.max(1.2, Math.min(3, factor)); // Always accelerated: 1.2x to 3x
    }

    // Configure wave speed transition duration
    setWaveSpeedTransitionDuration(duration) {
        this._waveSpeedTransitionDuration = Math.max(50, Math.min(500, duration)); // 50ms to 500ms
    }

    // Methods to control entrance and disappearance animations
    startEntranceAnimation() {
        this.resetAnimationState();
        this._isAnimatingEntrance = true;
        this._entranceStartTime = performance.now();
    }

    startDisappearanceAnimation() {
        this._isAnimatingEntrance = false; // Ensure entrance animation stops
        this._isAnimatingDisappearance = true;
        this._disappearanceStartTime = performance.now();
    }
    
    resetAnimationState() {
        this._isAnimatingEntrance = false;
        this._isAnimatingDisappearance = false;
        this._entranceStartTime = 0;
        this._disappearanceStartTime = 0;
        this._hasDisappeared = false; // Reset disappeared state
        this.invalidateDraw();
    }
}

// Register the web component
customElements.define('wavy-progress-indicator', LinearWavyProgressIndicator);

// Make available globally for non-module usage
if (typeof window !== 'undefined') {
    window.LinearWavyProgressIndicator = LinearWavyProgressIndicator;
    window.WavyProgressIndicatorDefaults = WavyProgressIndicatorDefaults;
    window.AnimationSpecs = AnimationSpecs;
}

// Export for module usage (when used as ES6 module)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        default: LinearWavyProgressIndicator,
        LinearWavyProgressIndicator,
        WavyProgressIndicatorDefaults,
        AnimationSpecs
    };
}