# JavaScript Wavy Progress Indicators

This directory contains JavaScript web components that replicate Android's Material Design 3 Wavy Progress Indicators.

## Files

- **`WavyProgressIndicator.js`** - Linear wavy progress indicator web component
- **`CircularWavyProgressIndicator.js`** - Circular wavy progress indicator web component  
- **`ProgressIndicatorUtils.js`** - Utility functions and constants
- **`README.md`** - This documentation file

## Features

### ✅ Implemented Features

- **Linear Wavy Progress Indicator**
  - Determinate and indeterminate states
  - Customizable wave amplitude and wavelength
  - Canvas-based wave rendering for smooth effects
  - Accessibility support with ARIA attributes

- **Circular Wavy Progress Indicator**
  - Determinate and indeterminate states
  - SVG-based rendering with smooth animations
  - Customizable wave parameters
  - Spinning animation for indeterminate state

- **Customization Options**
  - Custom colors for indicator and track
  - Adjustable wave amplitude (0.0 - 1.0)
  - Configurable wavelength and wave speed
  - Material Design 3 color token support

- **Web Standards Compliance**
  - Custom Elements API
  - Shadow DOM encapsulation
  - Responsive design
  - Cross-browser compatibility

### 🔄 Converted from Kotlin

The JavaScript implementation closely follows the Android Kotlin source:

| Kotlin Feature | JavaScript Equivalent |
|---|---|
| `WavyProgressIndicatorDefaults` | Static class with default values |
| `@Composable` functions | Web Component classes |
| `Modifier` extensions | CSS styling and Canvas/SVG rendering |
| Animation specs | CSS animations + requestAnimationFrame |
| Color tokens | CSS custom properties |
| Semantic properties | ARIA attributes |

## Usage

### Basic HTML

```html
<!-- Linear wavy progress indicator -->
<linear-wavy-progress-indicator 
    progress="0.6" 
    color="#6750A4" 
    amplitude="1">
</linear-wavy-progress-indicator>

<!-- Circular wavy progress indicator -->
<circular-wavy-progress-indicator 
    progress="0.75" 
    indeterminate>
</circular-wavy-progress-indicator>
```

### JavaScript API

```javascript
// Get reference to component
const indicator = document.querySelector('linear-wavy-progress-indicator');

// Set progress programmatically
indicator.setProgress(0.8);

// Toggle indeterminate state
indicator.setIndeterminate(true);

// Get current progress
const currentProgress = indicator.getProgress();
```

### Attributes

| Attribute | Type | Default | Description |
|---|---|---|---|
| `progress` | number (0-1) | 0 | Progress value for determinate indicators |
| `indeterminate` | boolean | false | Enable indeterminate animation |
| `color` | string | CSS variable | Indicator color |
| `track-color` | string | CSS variable | Track color |
| `amplitude` | number (0-1) | 1 | Wave amplitude |
| `wavelength` | number | 24/20 | Wave length in pixels |
| `wave-speed` | number | wavelength | Wave animation speed |

## Missing Features (Compared to Android)

### ❌ Not Yet Implemented

- **Internal Implementation Functions**
  - `linearWavyProgressIndicator` modifier equivalent
  - `circularWavyProgressIndicator` modifier equivalent
  - `IncreaseVerticalSemanticsBounds` modifier

- **Advanced Wave Effects**
  - Complex wave morphing algorithms
  - Precise amplitude transitions (10% to 95% range)
  - Wave phase synchronization

- **Animation Specifications**
  - Exact timing curves from MotionTokens
  - Multi-line indeterminate animations
  - Amplitude increase/decrease animations

- **Design Tokens**
  - Complete Material Design 3 token integration
  - Dynamic color scheme support
  - Responsive sizing based on density

## Browser Support

- **Modern Browsers**: Chrome 54+, Firefox 63+, Safari 10.1+, Edge 79+
- **Features Used**: Custom Elements, Shadow DOM, Canvas API, SVG
- **Fallbacks**: Graceful degradation to standard progress bars

## Performance Considerations

- Canvas rendering is optimized with requestAnimationFrame
- Wave calculations are throttled to prevent excessive redraws
- Shadow DOM provides style encapsulation without performance impact
- Animations use CSS transforms when possible for hardware acceleration

## Development Notes

### Architecture Decisions

1. **Web Components**: Chosen for encapsulation and reusability
2. **Canvas for Linear**: Better wave shape control than CSS clip-path
3. **SVG for Circular**: More suitable for circular wave patterns
4. **CSS Custom Properties**: Enable theming and Material Design integration

### Known Limitations

1. **Wave Accuracy**: Simplified wave algorithms compared to Android's complex path morphing
2. **Animation Timing**: Approximated timing curves, not exact Android specifications
3. **Accessibility**: Basic ARIA support, could be enhanced with more detailed announcements
4. **Performance**: Canvas redrawing on every frame, could be optimized with caching

## Future Improvements

- [ ] Implement exact Android animation specifications
- [ ] Add more sophisticated wave morphing algorithms
- [ ] Optimize Canvas rendering with caching
- [ ] Add TypeScript definitions
- [ ] Create React/Vue wrapper components
- [ ] Add unit tests and visual regression tests
