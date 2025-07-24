# LiquidGlass Component

A highly customizable React component that creates a liquid glass effect using SVG filters and canvas displacement mapping. This component converts the original vanilla JavaScript liquid glass effect into a reusable React component with extensive customization options.

## Features

- 🎨 **Highly Customizable**: Extensive props for size, position, styling, and effects
- 🖱️ **Interactive**: Support for dragging, clicking, and hover effects
- 🎭 **Multiple Themes**: Built-in theme variants (primary, secondary, success, warning, error)
- 📐 **Shape Variants**: Circle, pill, rounded, square shapes
- ✨ **Animations**: Pulse, float, glow, and rotation animations
- 🎚️ **Effect Intensity**: Subtle to extreme glass effect intensities
- ♿ **Accessible**: ARIA labels, focus states, and keyboard navigation support
- 📱 **Responsive**: Built-in responsive design support

## Basic Usage

```jsx
import LiquidGlass from '../common/LiquidGlass';

// Simple glass panel
<LiquidGlass width={150} height={80}>
  <span>Glass Content</span>
</LiquidGlass>

// Interactive button
<LiquidGlass
  width={120}
  height={50}
  className="content-center interactive theme-primary"
  onClick={() => console.log('Clicked!')}
>
  <span>Click Me</span>
</LiquidGlass>
```

## Props

### Size and Positioning
- `width` (number, default: 100): Width in pixels
- `height` (number, default: 100): Height in pixels
- `position` (string, default: 'relative'): CSS position ('relative', 'absolute', 'fixed')
- `top`, `left`, `right`, `bottom` (string): CSS positioning values
- `transform` (string): CSS transform value
- `zIndex` (number, default: 10): CSS z-index

### Visual Styling
- `borderRadius` (string, default: '150px'): CSS border-radius
- `boxShadow` (string): Custom box shadow
- `backdropFilter` (string): Custom backdrop filter effects
- `border` (string): CSS border
- `background` (string, default: 'transparent'): Background color/gradient

### Interaction
- `draggable` (boolean, default: false): Enable dragging
- `cursor` (string, default: 'default'): CSS cursor
- `onClick`, `onMouseEnter`, `onMouseLeave`: Event handlers

### Glass Effect Parameters
- `effectIntensity` (number, default: 1.0): Multiplier for displacement effect
- `effectRadius` (number, default: 0.6): Radius of the glass effect
- `effectWidth` (number, default: 0.3): Width of the effect area
- `effectHeight` (number, default: 0.2): Height of the effect area
- `effectOffset` (number, default: 0.15): Offset for the effect

### Animation
- `animateOnHover` (boolean, default: false): Enable hover animations
- `hoverScale` (number, default: 1.05): Scale factor on hover
- `transition` (string, default: 'all 0.3s ease'): CSS transition

### Advanced Options
- `canvasDPI` (number, default: 1): Canvas resolution multiplier
- `updateOnMouseMove` (boolean, default: false): Update effect on mouse movement
- `constrainToViewport` (boolean, default: false): Keep within viewport bounds
- `viewportOffset` (number, default: 10): Offset from viewport edges

## CSS Classes

### Size Variants
- `size-small`: 60x40px with 20px border-radius
- `size-medium`: 120x80px with 40px border-radius
- `size-large`: 200x130px with 65px border-radius
- `size-extra-large`: 300x200px with 100px border-radius

### Shape Variants
- `shape-circle`: Perfect circle
- `shape-rounded`: Rounded corners
- `shape-pill`: Pill-shaped (maximum border-radius)
- `shape-square`: Square corners

### Theme Variants
- `theme-primary`: Primary color theme
- `theme-secondary`: Secondary color theme
- `theme-success`: Success/green theme
- `theme-warning`: Warning/yellow theme
- `theme-error`: Error/red theme

### Animation Classes
- `animate-pulse`: Pulsing animation
- `animate-float`: Floating up/down animation
- `animate-glow`: Glowing effect animation
- `animate-rotate`: Continuous rotation

### Content Alignment
- `content-center`: Center content horizontally and vertically
- `content-start`: Align content to start with padding
- `content-end`: Align content to end with padding

### Interactive States
- `interactive`: Adds hover and active effects
- `disabled`: Disabled state with reduced opacity

### Effect Intensity
- `intensity-subtle`: Minimal glass effect
- `intensity-normal`: Standard glass effect
- `intensity-strong`: Enhanced glass effect
- `intensity-extreme`: Maximum glass effect

## Examples

### Zoom Control (Timeline Implementation)
```jsx
<LiquidGlass
  width={80}
  height={32}
  position="absolute"
  top="8px"
  right="8px"
  borderRadius="16px"
  className="content-center interactive theme-primary size-small"
  cursor="ew-resize"
  effectIntensity={0.8}
  updateOnMouseMove={true}
  onMouseDown={handleZoomDrag}
>
  <span style={{ fontSize: '12px', fontWeight: '600' }}>
    {Math.round(zoom * 100)}%
  </span>
</LiquidGlass>
```

### Draggable Panel
```jsx
<LiquidGlass
  width={200}
  height={120}
  draggable={true}
  constrainToViewport={true}
  className="content-center theme-success animate-float"
  onDragEnd={(e) => console.log('Drag ended')}
>
  <div>Draggable Content</div>
</LiquidGlass>
```

### Custom Effect Parameters
```jsx
<LiquidGlass
  width={150}
  height={80}
  effectIntensity={2.0}
  effectRadius={0.8}
  effectWidth={0.4}
  effectHeight={0.3}
  updateOnMouseMove={true}
  className="content-center theme-warning"
>
  <span>Mouse Reactive</span>
</LiquidGlass>
```

## Accessibility

The component supports accessibility features:
- `role`: ARIA role attribute
- `aria-label`: Accessible label
- `tabIndex`: Keyboard navigation support
- Focus states with visible outline
- High contrast mode support
- Reduced motion support

## Browser Support

- Modern browsers with SVG filter support
- Canvas 2D context support
- CSS backdrop-filter support (for enhanced effects)

## Performance Notes

- Use `canvasDPI` sparingly as higher values increase computation
- `updateOnMouseMove` can impact performance on slower devices
- Consider using `intensity-subtle` for better performance on mobile devices

## Migration from Original LIQUID_GLASS.js

The component maintains the core functionality while adding:
- React lifecycle management
- Extensive customization props
- CSS class-based styling system
- Accessibility features
- Responsive design support
- Better performance optimizations
