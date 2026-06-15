// DOM / theme setup helpers for the LinearWavyProgressIndicator web component.
//
// Pure helpers: each takes all inputs as parameters and touches no component
// (`this`) state. The web component delegates to these from thin methods,
// preserving its exact runtime behavior. Only browser globals are used
// (document, getComputedStyle).

import { WavyProgressIndicatorDefaults } from './defaults';

// Read a CSS custom property value off the document root.
export function getThemeColor(cssVariable) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(cssVariable).trim();
}

// Resolve the active progress/track colors from theme CSS variables, falling
// back to the library defaults. Tries multiple variable names for flexibility.
export function resolveThemeColors() {
    // Try multiple CSS variable names for flexibility
    const progressColorVars = ['--wavy-progress-color', '--figma-progress-color', '--progress-color'];
    const trackColorVars = ['--wavy-track-color', '--figma-track-color', '--track-color'];

    let progressColor = null;
    let trackColor = null;

    // Find the first available progress color variable
    for (const varName of progressColorVars) {
        const color = getThemeColor(varName);
        if (color) {
            progressColor = color;
            break;
        }
    }

    // Find the first available track color variable
    for (const varName of trackColorVars) {
        const color = getThemeColor(varName);
        if (color) {
            trackColor = color;
            break;
        }
    }

    return {
        progressColor: progressColor || WavyProgressIndicatorDefaults.indicatorColor,
        trackColor: trackColor || WavyProgressIndicatorDefaults.trackColor
    };
}

// Build the shadow-root markup (style + canvas) for the given container size.
export function buildShadowMarkup(containerWidth, containerHeight) {
    return `
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
}
