// Animation specs and default constants for the Wavy Progress Indicator.
// Ported verbatim from Android MotionTokens / WavyProgressIndicatorDefaults.

// Animation specifications from Android MotionTokens
export const AnimationSpecs = {
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
export class WavyProgressIndicatorDefaults {
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
