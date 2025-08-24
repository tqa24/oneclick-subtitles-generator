/**
 * Progress Indicator Utilities
 * Common functions and constants for progress indicators
 */

// Animation specifications equivalent to Android's MotionTokens
export const AnimationSpecs = {
    // Linear indeterminate animation specs (converted from Kotlin)
    linearIndeterminateFirstLineHead: {
        duration: 1800,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        delay: 0
    },
    linearIndeterminateFirstLineTail: {
        duration: 1800,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        delay: 333
    },
    linearIndeterminateSecondLineHead: {
        duration: 1800,
        easing: 'cubic-bezier(0, 0, 0.65, 1)',
        delay: 1000
    },
    linearIndeterminateSecondLineTail: {
        duration: 1800,
        easing: 'cubic-bezier(0.1, 0, 0.45, 1)',
        delay: 1267
    },
    
    // Amplitude animation specs
    increasingAmplitude: {
        duration: 500,
        easing: 'cubic-bezier(0.2, 0, 0, 1)'
    },
    decreasingAmplitude: {
        duration: 500,
        easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)'
    }
};

// Color utilities
export class ColorUtils {
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    static interpolateColor(color1, color2, factor) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        
        if (!c1 || !c2) return color1;
        
        const r = Math.round(c1.r + (c2.r - c1.r) * factor);
        const g = Math.round(c1.g + (c2.g - c1.g) * factor);
        const b = Math.round(c1.b + (c2.b - c1.b) * factor);
        
        return this.rgbToHex(r, g, b);
    }
}

// Wave generation utilities
export class WaveUtils {
    static generateWavePath(width, height, wavelength, amplitude, phase = 0) {
        const points = [];
        const steps = Math.max(width / 2, 50); // Ensure smooth curve
        
        for (let i = 0; i <= steps; i++) {
            const x = (i / steps) * width;
            const waveX = (x / wavelength) * 2 * Math.PI + phase;
            const y = height / 2 + Math.sin(waveX) * amplitude * height * 0.4;
            points.push({ x, y });
        }
        
        return points;
    }
    
    static createSVGWavePath(points, width, height) {
        if (points.length === 0) return '';
        
        let path = `M 0,${height / 2}`;
        
        // Create smooth curve through points
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (i === 0) {
                path += ` L ${point.x},${point.y}`;
            } else {
                // Use quadratic curves for smoother waves
                const prevPoint = points[i - 1];
                const controlX = (prevPoint.x + point.x) / 2;
                const controlY = (prevPoint.y + point.y) / 2;
                path += ` Q ${controlX},${controlY} ${point.x},${point.y}`;
            }
        }
        
        // Close the path
        path += ` L ${width},${height} L 0,${height} Z`;
        
        return path;
    }
    
    static createCanvasWave(ctx, points, width, height, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        
        if (points.length === 0) {
            // Fallback to rectangle
            ctx.rect(0, 0, width, height);
        } else {
            ctx.moveTo(0, height / 2);
            
            // Draw wave curve
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                if (i === 0) {
                    ctx.lineTo(point.x, point.y);
                } else {
                    // Use quadratic curves
                    const prevPoint = points[i - 1];
                    const controlX = (prevPoint.x + point.x) / 2;
                    const controlY = (prevPoint.y + point.y) / 2;
                    ctx.quadraticCurveTo(controlX, controlY, point.x, point.y);
                }
            }
            
            // Close the shape
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
        }
        
        ctx.fill();
    }
}

// Animation utilities
export class AnimationUtils {
    static easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    static easeOut(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    static easeIn(t) {
        return t * t * t;
    }
    
    static linear(t) {
        return t;
    }
    
    static createAnimator(duration, easing = 'linear', onUpdate, onComplete) {
        const startTime = performance.now();
        const easingFn = typeof easing === 'string' ? this[easing] : easing;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easingFn(progress);
            
            onUpdate(easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (onComplete) {
                onComplete();
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// Semantic utilities for accessibility
export class SemanticUtils {
    static setProgressSemantics(element, progress, isIndeterminate = false) {
        element.setAttribute('role', 'progressbar');
        
        if (isIndeterminate) {
            element.removeAttribute('aria-valuenow');
            element.removeAttribute('aria-valuetext');
        } else {
            const percentage = Math.round(progress * 100);
            element.setAttribute('aria-valuenow', percentage);
            element.setAttribute('aria-valuetext', `${percentage}%`);
        }
        
        element.setAttribute('aria-valuemin', '0');
        element.setAttribute('aria-valuemax', '100');
    }
    
    static announceProgress(progress) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        
        const percentage = Math.round(progress * 100);
        announcement.textContent = `Progress: ${percentage}%`;
        
        document.body.appendChild(announcement);
        
        // Remove after announcement
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
}

// Performance utilities
export class PerformanceUtils {
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    static debounce(func, delay) {
        let timeoutId;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    static requestIdleCallback(callback) {
        if (window.requestIdleCallback) {
            return window.requestIdleCallback(callback);
        } else {
            return setTimeout(callback, 1);
        }
    }
}
