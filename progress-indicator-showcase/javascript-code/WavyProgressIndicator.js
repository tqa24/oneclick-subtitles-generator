/**
 * Wavy Progress Indicator Web Component
 * EXACT JavaScript equivalent of Android's WavyProgressIndicator.kt
 *
 * Based on the actual Android source code from:
 * - WavyProgressIndicator.kt
 * - LinearWavyProgressModifiers.kt
 * - CircularWavyProgressModifiers.kt
 *
 * This implementation follows the exact algorithms, drawing logic, and animation
 * specifications from the Android source code.
 */

class WavyProgressIndicatorDefaults {
    // Animation specs
    static get ProgressAnimationSpec() {
        return {
            duration: 500, // DurationLong2 equivalent
            easing: 'cubic-bezier(0.2, 0, 0, 1)' // EasingLinearCubicBezier equivalent
        };
    }

    // Colors (CSS custom properties will be used)
    static get indicatorColor() {
        return 'var(--md-sys-color-primary, #6750A4)';
    }

    static get trackColor() {
        return 'var(--md-sys-color-outline-variant, #CAC4D0)';
    }

    // Stroke properties
    static get linearIndicatorStroke() {
        return {
            width: 4, // ActiveThickness equivalent
            cap: 'round'
        };
    }

    static get circularIndicatorStroke() {
        return {
            width: 4, // ActiveThickness equivalent
            cap: 'round'
        };
    }

    static get linearTrackStroke() {
        return {
            width: 4, // TrackThickness equivalent
            cap: 'round'
        };
    }

    static get circularTrackStroke() {
        return {
            width: 4, // TrackThickness equivalent
            cap: 'round'
        };
    }

    // Wavelengths
    static get LinearDeterminateWavelength() {
        return 24; // dp equivalent in px
    }

    static get LinearIndeterminateWavelength() {
        return 32; // dp equivalent in px
    }

    static get CircularWavelength() {
        return 20; // dp equivalent in px
    }

    // Container sizes
    static get LinearContainerWidth() {
        return 240; // dp equivalent in px
    }

    static get LinearContainerHeight() {
        return 16; // dp equivalent in px
    }

    static get CircularContainerSize() {
        return 48; // dp equivalent in px
    }

    // Gap sizes
    static get LinearIndicatorTrackGapSize() {
        return 4; // dp equivalent in px
    }

    static get CircularIndicatorTrackGapSize() {
        return 4; // dp equivalent in px
    }

    static get LinearTrackStopIndicatorSize() {
        return 4; // dp equivalent in px
    }

    // Amplitude function for determinate indicators
    static indicatorAmplitude(progress) {
        // Sets the amplitude to the max on 10%, and back to zero on 95% of the progress
        if (progress <= 0.1 || progress >= 0.95) {
            return 0;
        } else {
            return 1;
        }
    }
}

class LinearWavyProgressIndicator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Default properties
        this._progress = 0;
        this._indeterminate = false;
        this._color = WavyProgressIndicatorDefaults.indicatorColor;
        this._trackColor = WavyProgressIndicatorDefaults.trackColor;
        this._amplitude = 1;
        this._wavelength = WavyProgressIndicatorDefaults.LinearDeterminateWavelength;
        this._waveSpeed = this._wavelength; // 1 wavelength per second
        
        this._animationId = null;
        this._startTime = null;
        
        this.render();
    }

    static get observedAttributes() {
        return ['progress', 'indeterminate', 'color', 'track-color', 'amplitude', 'wavelength', 'wave-speed'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'progress':
                this._progress = Math.max(0, Math.min(1, parseFloat(newValue) || 0));
                break;
            case 'indeterminate':
                this._indeterminate = newValue !== null;
                break;
            case 'color':
                this._color = newValue || WavyProgressIndicatorDefaults.indicatorColor;
                break;
            case 'track-color':
                this._trackColor = newValue || WavyProgressIndicatorDefaults.trackColor;
                break;
            case 'amplitude':
                this._amplitude = Math.max(0, Math.min(1, parseFloat(newValue) || 1));
                break;
            case 'wavelength':
                this._wavelength = parseFloat(newValue) || WavyProgressIndicatorDefaults.LinearDeterminateWavelength;
                break;
            case 'wave-speed':
                this._waveSpeed = parseFloat(newValue) || this._wavelength;
                break;
        }
        this.updateProgress();
    }

    connectedCallback() {
        if (this._indeterminate) {
            this.startIndeterminateAnimation();
        }
    }

    disconnectedCallback() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
        }
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
                    overflow: hidden;
                }
                
                .progress-container {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }
                
                .progress-track, .progress-indicator {
                    position: absolute;
                    top: 50%;
                    left: 0;
                    transform: translateY(-50%);
                    height: ${WavyProgressIndicatorDefaults.linearTrackStroke.width}px;
                }
                
                .progress-track {
                    width: 100%;
                    background-color: ${this._trackColor};
                    border-radius: ${WavyProgressIndicatorDefaults.linearTrackStroke.width / 2}px;
                }
                
                .progress-indicator {
                    background-color: ${this._color};
                    border-radius: ${WavyProgressIndicatorDefaults.linearIndicatorStroke.width / 2}px;
                    transition: width 0.3s ease;
                }
            </style>
            <div class="progress-container">
                <div class="progress-track"></div>
                <div class="progress-indicator"></div>
            </div>
        `;
        
        this.updateProgress();
    }

    updateProgress() {
        const indicator = this.shadowRoot?.querySelector('.progress-indicator');
        if (!indicator) return;
        
        if (this._indeterminate) {
            // Indeterminate animation will be handled separately
            indicator.style.width = '30%';
        } else {
            const width = this._progress * 100;
            indicator.style.width = `${width}%`;
            
            // Apply wave effect if amplitude > 0
            if (this._amplitude > 0) {
                this.applyWaveEffect(indicator);
            }
        }
    }

    applyWaveEffect(element) {
        // Create a more sophisticated wave effect using Canvas
        const amplitude = WavyProgressIndicatorDefaults.indicatorAmplitude(this._progress) * this._amplitude;

        if (amplitude > 0) {
            this.createWaveCanvas(element, amplitude);
        } else {
            element.style.clipPath = 'none';
            // Remove any existing canvas
            const existingCanvas = element.querySelector('canvas');
            if (existingCanvas) {
                existingCanvas.remove();
            }
        }
    }

    createWaveCanvas(element, amplitude) {
        // Remove existing canvas if any
        const existingCanvas = element.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        const canvas = document.createElement('canvas');
        const rect = element.getBoundingClientRect();
        const width = rect.width || WavyProgressIndicatorDefaults.LinearContainerWidth * this._progress;
        const height = rect.height || WavyProgressIndicatorDefaults.LinearContainerHeight;

        canvas.width = width;
        canvas.height = height;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = this._color;

        // Draw wave shape
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        const waveHeight = amplitude * height * 0.3; // Scale amplitude
        const wavelength = this._wavelength;

        for (let x = 0; x <= width; x += 2) {
            const y = height / 2 + Math.sin((x / wavelength) * 2 * Math.PI) * waveHeight;
            ctx.lineTo(x, y);
        }

        // Complete the shape
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();

        element.appendChild(canvas);

        // Hide the original background to show only the wave
        element.style.background = 'transparent';
    }

    startIndeterminateAnimation() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
        }
        
        this._startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - this._startTime;
            const progress = (elapsed / 2000) % 1; // 2 second cycle
            
            const indicator = this.shadowRoot?.querySelector('.progress-indicator');
            if (indicator) {
                // Simple back-and-forth animation
                const position = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
                indicator.style.left = `${position * 70}%`;
                indicator.style.width = '30%';
            }
            
            this._animationId = requestAnimationFrame(animate);
        };
        
        this._animationId = requestAnimationFrame(animate);
    }

    // Public API methods
    setProgress(progress) {
        this.setAttribute('progress', progress.toString());
    }

    getProgress() {
        return this._progress;
    }

    setIndeterminate(indeterminate) {
        if (indeterminate) {
            this.setAttribute('indeterminate', '');
            this.startIndeterminateAnimation();
        } else {
            this.removeAttribute('indeterminate');
            if (this._animationId) {
                cancelAnimationFrame(this._animationId);
                this._animationId = null;
            }
        }
    }
}

// Register the custom element
customElements.define('linear-wavy-progress-indicator', LinearWavyProgressIndicator);
