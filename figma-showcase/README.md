# Material Design 3 Shape Morphing Showcase

This showcase demonstrates Google's authentic Material Design 3 shape morphing algorithms, featuring the same implementation used in Android's androidx.graphics.shapes library.

## 🎯 Features

### Interactive Demos
- **Loading Animation Steps**: Experience the 7-step Material Design loading animation with smooth transitions
- **Real-time Shape Morphing**: Interactive morphing between different polygon shapes
- **Advanced Controls**: Sliders for morph progress, corner rounding, and animation speed
- **Performance Monitoring**: Real-time stats for curves, vertices, and render times

### Technical Implementation
- **Authentic Google Algorithms**: Direct port of androidx.graphics.shapes morphing system
- **Advanced Curve Matching**: Feature detection and proximity mapping for optimal morphing
- **Cubic Bézier Interpolation**: Smooth transitions using mathematical curve interpolation
- **Real-time Polygon Processing**: Dynamic cutting and shifting for perfect shape alignment
- **Hardware Acceleration**: Canvas-based rendering with optimized performance

## 📁 Files Overview

### Core JavaScript Modules
- `morph.js` - Main morphing engine with curve matching algorithms
- `roundedPolygon.js` - Polygon creation and manipulation with corner rounding
- `cubic.js` - Cubic Bézier curve mathematics and transformations
- `measuredPolygon.js` - Polygon measurement and feature detection
- `featureMapper.js` - Advanced feature mapping for shape correspondence
- `utils.js` - Utility functions for geometry and interpolation
- `floatMapping.js` - Float array mapping utilities

### SVG Assets
- `loading-shape-step1.svg` through `loading-shape-step7.svg` - Material Design loading animation frames

### Demo Pages
- `index.html` - Main showcase with loading animation and basic morphing
- `advanced-demo.html` - Advanced demo with full feature set and performance monitoring

## 🚀 Getting Started

### Option 1: Simple Local Server
```bash
# Navigate to the figma-showcase directory
cd figma-showcase

# Start a simple HTTP server (Python 3)
python -m http.server 8000

# Or using Node.js
npx serve .

# Open http://localhost:8000 in your browser
```

### Option 2: Live Server (VS Code)
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` or `advanced-demo.html`
3. Select "Open with Live Server"

## 🎮 Usage

### Basic Demo (index.html)
1. **Loading Animation**: 
   - Click "Start Animation" to see the 7-step morphing sequence
   - Use the slider to manually control animation steps
   - Adjust timing with Start/Stop/Reset controls

2. **Shape Morphing**:
   - Select different target shapes (Star, Heart, Circle, Square)
   - Use the morph slider to control transition progress
   - Watch real-time morphing between shapes

### Advanced Demo (advanced-demo.html)
1. **Interactive Morphing**:
   - Create polygons with different vertex counts (3-8 sides)
   - Generate star shapes and random polygons
   - Control corner rounding with the rounding slider
   - Enable automatic animation with the Animate button

2. **Loading Animation**:
   - Full control over the 7-step loading sequence
   - Adjustable animation speed (0.1x to 3.0x)
   - Performance monitoring with FPS counter
   - Step-by-step manual control

3. **Performance Monitoring**:
   - Real-time curve and vertex counting
   - Render time measurement
   - Morph calculation timing
   - Frame rate monitoring

## 🔧 Technical Details

### Morphing Algorithm
The morphing system uses Google's sophisticated curve matching algorithm:

1. **Feature Detection**: Identifies corners and edges in both shapes
2. **Proximity Mapping**: Maps features between shapes based on similarity
3. **Curve Cutting**: Splits curves to align start and end shapes optimally
4. **Interpolation**: Uses cubic Bézier interpolation for smooth transitions

### Key Classes
- `Morph`: Main morphing engine that handles shape-to-shape transitions
- `RoundedPolygon`: Creates polygons with configurable corner rounding
- `MeasuredPolygon`: Measures polygon features for morphing analysis
- `Cubic`: Handles cubic Bézier curve mathematics
- `FeatureMapper`: Maps corresponding features between different shapes

### Performance Optimizations
- Efficient curve reuse with `MutableCubic` for animation loops
- Hardware-accelerated canvas rendering
- Optimized polygon cutting algorithms
- Real-time bounds calculation for viewport optimization

## 🎨 Customization

### Adding New Shapes
To add custom shapes, create new `RoundedPolygon` instances:

```javascript
// Create a custom polygon
const vertices = [
    new Point(0, -1),
    new Point(1, 0),
    new Point(0, 1),
    new Point(-1, 0)
];
const customShape = new RoundedPolygon(vertices, cornerRounding);
```

### Styling
Both demo pages use CSS custom properties for easy theming:
- Modify color schemes in the CSS `:root` section
- Adjust animation timings and easing functions
- Customize canvas sizes and layouts

## 📱 Browser Compatibility
- **Modern Browsers**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **Required Features**: ES6 modules, Canvas 2D API, CSS Grid
- **Recommended**: Hardware acceleration enabled for optimal performance

## 🔗 Related Resources
- [Material Design 3 Shapes](https://m3.material.io/foundations/adaptive-design/large-screens)
- [androidx.graphics.shapes Documentation](https://developer.android.com/reference/androidx/graphics/shapes/package-summary)
- [Cubic Bézier Curves](https://en.wikipedia.org/wiki/B%C3%A9zier_curve)

## 📄 License
This implementation is based on the Android Open Source Project and follows the Apache License 2.0.

---

*This showcase demonstrates the power and sophistication of Google's Material Design shape morphing system, bringing Android's advanced graphics capabilities to the web.*
