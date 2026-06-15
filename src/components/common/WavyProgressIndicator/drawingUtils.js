// Pure easing helpers for the Wavy Progress Indicator entrance/disappearance
// animations. These take a normalized time `t` (0..1) and return an eased
// value — no component state, no `this`.
//
// Note: drawStopIndicator, drawLowProgressDot, and shouldShowStopIndicator are
// intentionally NOT here. They read component instance state (this._color,
// this.getAttribute, this.shouldShowStopIndicator), so they remain methods on
// LinearWavyProgressIndicator to preserve behavior.

export function easeOutCubic(t) {
    return (--t) * t * t + 1;
}

export function easeInCubic(t) {
    return t * t * t;
}
