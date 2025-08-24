# Wavy Progress Indicator

Material Design 3 wavy progress indicator with smooth animations and wave acceleration.

## Usage

### HTML
```html
<wavy-progress-indicator progress="0.5" aria-label="Loading"></wavy-progress-indicator>
```

### JavaScript
```javascript
const indicator = document.querySelector('wavy-progress-indicator');
indicator.setProgress(0.75); // Smooth animation with wave acceleration
```

### ES6 Module
```javascript
import './WavyProgressIndicator.module.js';
```

## Configuration

### Progress
```javascript
indicator.setProgress(0.5);              // Animated progress (0-1)
indicator.setProgress(0.5, false);       // Instant progress
indicator.setProgressAnimationDuration(500); // Animation speed
```

### Wave Properties
```javascript
indicator.setWaveSpeed(2);               // Wave animation speed
indicator.setWaveAccelerationFactor(2.5); // Acceleration during progress (1.2-3x)
indicator.setWavelength(48);             // Wave density
```

### Colors
```javascript
indicator.setColors('#FF6B35', '#FFE5D9'); // Progress, track colors
indicator.updateThemeColors();             // Update from CSS variables
```

### HTML Attributes
```html
<wavy-progress-indicator
    progress="0.5"
    color="#FF6B35"
    track-color="#FFE5D9"
    wave-speed="2"
    wavelength="32"
    aria-label="Progress">
</wavy-progress-indicator>
```

## Theming

```css
:root {
    --wavy-progress-color: #485E92;
    --wavy-track-color: #D9DFF6;
}

[data-theme="dark"] {
    --wavy-progress-color: #B0C6FF;
    --wavy-track-color: #404659;
}
```

## Features

- ✅ Smooth progress transitions
- ✅ Wave acceleration during progress changes
- ✅ Light/dark theme support
- ✅ Accessibility compliant
- ✅ Material Design 3 Expressive
