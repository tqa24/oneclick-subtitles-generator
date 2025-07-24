# LiquidGlass Usage Guide

This guide shows how to replace regular divs with the LiquidGlass component throughout your application.

## Quick Replacement Examples

### 1. Replace Basic Containers

**Before:**
```jsx
<div className="control-panel">
  <span>Control Content</span>
</div>
```

**After:**
```jsx
<LiquidGlass
  width={150}
  height={60}
  className="content-center"
>
  <span>Control Content</span>
</LiquidGlass>
```

### 2. Replace Floating Elements

**Before:**
```jsx
<div className="floating-controls" style={{
  position: 'absolute',
  top: '10px',
  right: '10px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '8px'
}}>
  <button>Action</button>
</div>
```

**After:**
```jsx
<LiquidGlass
  width={120}
  height={50}
  position="absolute"
  top="10px"
  right="10px"
  borderRadius="8px"
  className="content-center interactive theme-primary"
>
  <button>Action</button>
</LiquidGlass>
```

### 3. Replace Card Components

**Before:**
```jsx
<div className="card" style={{
  background: 'var(--card-background)',
  borderRadius: '12px',
  padding: '16px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
}}>
  <h3>Card Title</h3>
  <p>Card content</p>
</div>
```

**After:**
```jsx
<LiquidGlass
  width={300}
  height={200}
  borderRadius="12px"
  className="content-start theme-secondary"
  style={{ padding: '16px' }}
>
  <div>
    <h3>Card Title</h3>
    <p>Card content</p>
  </div>
</LiquidGlass>
```

### 4. Replace Modal Overlays

**Before:**
```jsx
<div className="modal-overlay" style={{
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(255,255,255,0.9)',
  borderRadius: '16px',
  padding: '24px'
}}>
  <div>Modal Content</div>
</div>
```

**After:**
```jsx
<LiquidGlass
  width={400}
  height={300}
  position="fixed"
  top="50%"
  left="50%"
  transform="translate(-50%, -50%)"
  borderRadius="16px"
  className="content-center theme-primary animate-glow"
  style={{ padding: '24px' }}
>
  <div>Modal Content</div>
</LiquidGlass>
```

### 5. Replace Status Indicators

**Before:**
```jsx
<div className="status-indicator" style={{
  display: 'inline-flex',
  alignItems: 'center',
  background: '#28a745',
  color: 'white',
  borderRadius: '20px',
  padding: '4px 12px',
  fontSize: '12px'
}}>
  ✓ Success
</div>
```

**After:**
```jsx
<LiquidGlass
  width={80}
  height={28}
  borderRadius="20px"
  className="content-center theme-success size-small"
>
  <span style={{ color: 'white', fontSize: '12px' }}>
    ✓ Success
  </span>
</LiquidGlass>
```

## Common Patterns

### Interactive Buttons
```jsx
<LiquidGlass
  width={120}
  height={40}
  className="content-center interactive theme-primary"
  onClick={handleClick}
  animateOnHover={true}
>
  <span>Click Me</span>
</LiquidGlass>
```

### Draggable Panels
```jsx
<LiquidGlass
  width={200}
  height={150}
  draggable={true}
  constrainToViewport={true}
  className="content-start theme-secondary"
  style={{ padding: '12px' }}
>
  <div>Draggable Content</div>
</LiquidGlass>
```

### Notification Toasts
```jsx
<LiquidGlass
  width={300}
  height={80}
  position="fixed"
  top="20px"
  right="20px"
  className="content-center theme-warning animate-float"
  style={{ zIndex: 1000 }}
>
  <div>Notification Message</div>
</LiquidGlass>
```

### Loading Indicators
```jsx
<LiquidGlass
  width={100}
  height={100}
  className="content-center shape-circle animate-pulse theme-primary"
>
  <div className="spinner">Loading...</div>
</LiquidGlass>
```

## Styling Tips

### 1. Use CSS Classes for Consistency
```jsx
// Define custom classes in your CSS
.glass-button {
  /* Custom button styles */
}

<LiquidGlass className="glass-button content-center interactive">
  Button Text
</LiquidGlass>
```

### 2. Combine with Existing Styles
```jsx
<LiquidGlass
  className="existing-class content-center theme-primary"
  style={{ 
    ...existingStyles,
    // Additional inline styles
  }}
>
  Content
</LiquidGlass>
```

### 3. Responsive Design
```jsx
<LiquidGlass
  width={window.innerWidth < 768 ? 100 : 150}
  height={window.innerWidth < 768 ? 60 : 80}
  className="responsive content-center"
>
  Responsive Content
</LiquidGlass>
```

## Performance Considerations

### 1. Limit High-Intensity Effects
```jsx
// Good for performance
<LiquidGlass className="intensity-subtle">
  Content
</LiquidGlass>

// Use sparingly
<LiquidGlass 
  effectIntensity={3.0}
  updateOnMouseMove={true}
>
  Content
</LiquidGlass>
```

### 2. Batch Similar Elements
```jsx
// Instead of many small glass elements, use fewer larger ones
<LiquidGlass width={300} height={100} className="content-start">
  <div className="button-group">
    <button>Action 1</button>
    <button>Action 2</button>
    <button>Action 3</button>
  </div>
</LiquidGlass>
```

## Migration Checklist

When replacing existing divs:

1. **Identify the purpose**: Button, panel, overlay, indicator?
2. **Choose appropriate size**: Use size classes or custom width/height
3. **Select theme**: Match your app's color scheme
4. **Add interactivity**: Use `interactive` class for clickable elements
5. **Consider animation**: Add subtle animations for better UX
6. **Test accessibility**: Ensure proper ARIA labels and focus states
7. **Optimize performance**: Use appropriate effect intensity

## Common Gotchas

1. **Z-index conflicts**: LiquidGlass uses SVG filters that may affect stacking
2. **Content overflow**: Ensure content fits within the glass boundaries
3. **Event handling**: Some events may need to be handled on the glass container
4. **CSS specificity**: Glass styles may override existing styles

## Best Practices

1. **Start simple**: Begin with basic configurations and add complexity gradually
2. **Use themes**: Leverage built-in theme classes for consistency
3. **Test on mobile**: Glass effects may perform differently on mobile devices
4. **Provide fallbacks**: Consider users with reduced motion preferences
5. **Document usage**: Keep track of where you use LiquidGlass for maintenance
