/**
 * Circular Wavy Progress Indicator Web Component
 * JavaScript equivalent of Android's CircularWavyProgressIndicator
 */

class CircularWavyProgressIndicator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Default properties
        this._progress = 0;
        this._indeterminate = false;
        this._color = WavyProgressIndicatorDefaults.indicatorColor;
        this._trackColor = WavyProgressIndicatorDefaults.trackColor;
        this._amplitude = 1;
        this._wavelength = WavyProgressIndicatorDefaults.CircularWavelength;
        this._waveSpeed = this._wavelength;
        
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
                this._wavelength = parseFloat(newValue) || WavyProgressIndicatorDefaults.CircularWavelength;
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
        const size = WavyProgressIndicatorDefaults.CircularContainerSize;
        const strokeWidth = WavyProgressIndicatorDefaults.circularIndicatorStroke.width;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: ${size}px;
                    height: ${size}px;
                    position: relative;
                }
                
                .progress-container {
                    width: 100%;
                    height: 100%;
                    transform: rotate(-90deg);
                }
                
                .progress-svg {
                    width: 100%;
                    height: 100%;
                }
                
                .progress-track {
                    fill: none;
                    stroke: ${this._trackColor};
                    stroke-width: ${strokeWidth};
                    stroke-linecap: round;
                }
                
                .progress-indicator {
                    fill: none;
                    stroke: ${this._color};
                    stroke-width: ${strokeWidth};
                    stroke-linecap: round;
                    stroke-dasharray: ${circumference};
                    stroke-dashoffset: ${circumference};
                    transition: stroke-dashoffset 0.3s ease;
                }
                
                @keyframes spin {
                    from { transform: rotate(-90deg); }
                    to { transform: rotate(270deg); }
                }
                
                .indeterminate {
                    animation: spin 2s linear infinite;
                }
            </style>
            <div class="progress-container">
                <svg class="progress-svg" viewBox="0 0 ${size} ${size}">
                    <circle class="progress-track" 
                            cx="${size / 2}" 
                            cy="${size / 2}" 
                            r="${radius}">
                    </circle>
                    <circle class="progress-indicator" 
                            cx="${size / 2}" 
                            cy="${size / 2}" 
                            r="${radius}">
                    </circle>
                </svg>
            </div>
        `;
        
        this.updateProgress();
    }

    updateProgress() {
        const indicator = this.shadowRoot?.querySelector('.progress-indicator');
        const container = this.shadowRoot?.querySelector('.progress-container');
        
        if (!indicator || !container) return;
        
        const size = WavyProgressIndicatorDefaults.CircularContainerSize;
        const strokeWidth = WavyProgressIndicatorDefaults.circularIndicatorStroke.width;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        
        if (this._indeterminate) {
            // For indeterminate, show partial arc
            const dashLength = circumference * 0.25; // 25% of circle
            indicator.style.strokeDasharray = `${dashLength} ${circumference - dashLength}`;
            indicator.style.strokeDashoffset = '0';
            container.classList.add('indeterminate');
        } else {
            container.classList.remove('indeterminate');
            const offset = circumference - (this._progress * circumference);
            indicator.style.strokeDashoffset = offset.toString();
            
            // Apply wave effect if amplitude > 0
            if (this._amplitude > 0) {
                this.applyWaveEffect(indicator, circumference);
            }
        }
    }

    applyWaveEffect(element, circumference) {
        // This is a simplified wave effect for circular progress
        const amplitude = WavyProgressIndicatorDefaults.indicatorAmplitude(this._progress) * this._amplitude;
        
        if (amplitude > 0) {
            // Create a wavy stroke pattern
            const waveCount = Math.floor(circumference / this._wavelength);
            const waveLength = circumference / waveCount;
            
            // Simple wave pattern using stroke-dasharray
            const dashPattern = [];
            for (let i = 0; i < waveCount; i++) {
                const waveAmplitude = amplitude * 2; // Scale for visibility
                dashPattern.push(waveLength * (1 + waveAmplitude * Math.sin(i * Math.PI / 2)));
                dashPattern.push(2); // Small gap
            }
            
            element.style.strokeDasharray = dashPattern.join(' ');
        }
    }

    startIndeterminateAnimation() {
        // The CSS animation handles the spinning for indeterminate state
        this.updateProgress();
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
        } else {
            this.removeAttribute('indeterminate');
        }
    }
}

// Register the custom element
customElements.define('circular-wavy-progress-indicator', CircularWavyProgressIndicator);
