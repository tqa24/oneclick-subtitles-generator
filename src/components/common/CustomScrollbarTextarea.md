# CustomScrollbarTextarea Component

A beautiful, reusable textarea component with a custom scrollbar that replaces the ugly native scrollbar with a modern, pill-shaped design.

## Features

- ✅ **Hidden native scrollbar** - Completely removes the ugly native scrollbar
- ✅ **Beautiful custom scrollbar** - Pill-shaped, animated scrollbar with primary colors
- ✅ **Real-time dragging** - Smooth, responsive drag functionality
- ✅ **Auto-hide behavior** - Only appears when content overflows and on hover/focus
- ✅ **Stable focus animation** - Blue highlight without layout shifts or flickering
- ✅ **Fully accessible** - Supports all standard textarea functionality
- ✅ **Responsive design** - Adapts to container size changes
- ✅ **Theme support** - Works with light and dark themes
- ✅ **Performance optimized** - Efficient event handling and DOM updates

## Basic Usage

```jsx
import CustomScrollbarTextarea from './common/CustomScrollbarTextarea';

function MyComponent() {
  const [text, setText] = useState('');

  return (
    <CustomScrollbarTextarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Enter your text here..."
      rows={5}
    />
  );
}
```

## Props

All standard textarea props are supported, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `containerClassName` | `string` | `''` | Additional CSS class for the container |
| `containerStyle` | `object` | `{}` | Inline styles for the container |
| `value` | `string` | `''` | Textarea value |
| `onChange` | `function` | - | Change event handler |
| `placeholder` | `string` | `''` | Placeholder text |
| `rows` | `number` | `3` | Number of visible rows |
| `disabled` | `boolean` | `false` | Disable the textarea |
| `readOnly` | `boolean` | `false` | Make textarea read-only |

## Variants

### Default
```jsx
<CustomScrollbarTextarea
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder="Default textarea..."
/>
```

### Compact
```jsx
<CustomScrollbarTextarea
  containerClassName="compact"
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder="Compact textarea..."
  rows={2}
/>
```

### Large
```jsx
<CustomScrollbarTextarea
  containerClassName="large"
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder="Large textarea..."
  rows={8}
/>
```

### Minimal
```jsx
<CustomScrollbarTextarea
  containerClassName="minimal"
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder="Minimal textarea..."
/>
```

## Advanced Usage

### With Ref
```jsx
import { useRef } from 'react';

function MyComponent() {
  const textareaRef = useRef(null);

  const focusTextarea = () => {
    textareaRef.current?.focus();
  };

  const getScrollPosition = () => {
    console.log('Scroll top:', textareaRef.current?.scrollTop);
  };

  return (
    <CustomScrollbarTextarea
      ref={textareaRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Textarea with ref..."
    />
  );
}
```

### With Custom Styling
```jsx
<CustomScrollbarTextarea
  containerClassName="my-custom-container"
  className="my-custom-textarea"
  containerStyle={{
    borderRadius: '12px',
    maxHeight: '300px'
  }}
  style={{
    fontSize: '16px',
    lineHeight: '1.6'
  }}
  value={text}
  onChange={(e) => setText(e.target.value)}
/>
```

## Replacing Existing Textareas

### Before (Standard textarea)
```jsx
<textarea
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder="Enter text..."
  rows={5}
  className="my-textarea"
/>
```

### After (CustomScrollbarTextarea)
```jsx
<CustomScrollbarTextarea
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder="Enter text..."
  rows={5}
  className="my-textarea"
/>
```

## CSS Customization

The component uses CSS custom properties that you can override:

```css
.my-custom-container {
  --md-primary-rgb: 255, 0, 0; /* Red scrollbar */
  --md-surface-2: #f5f5f5; /* Light gray background */
}
```

## Examples in the Codebase

### Reference Text (F5-TTS)
```jsx
// src/components/narration/components/ReferenceAudioSection.js
<CustomScrollbarTextarea
  value={referenceText}
  onChange={(e) => setReferenceText(e.target.value)}
  placeholder={t('narration.referenceTextPlaceholder')}
  rows={2}
  disabled={isRecognizing}
/>
```

### Subtitles Input Modal
```jsx
// src/components/SubtitlesInputModal.js
<CustomScrollbarTextarea
  ref={textareaRef}
  value={text}
  onChange={handleTextChange}
  onKeyDown={handleKeyDown}
  onPaste={handlePaste}
  placeholder={t('subtitlesInput.placeholder')}
  rows={10}
  containerClassName="large"
/>
```

### Prompt Editor (Settings)
```jsx
// src/components/settings/tabs/PromptsTab.js
// Note: Uses monospace font and special settings styling
<div className="prompt-editor-container transcription-prompt-setting">
  <CustomScrollbarTextarea
    id="transcription-prompt"
    ref={textareaRef}
    value={transcriptionPrompt}
    onChange={(e) => setTranscriptionPrompt(e.target.value)}
    onKeyDown={handleKeyDown}
    rows={8}
    className="transcription-prompt-textarea"
  />
</div>
```

### Modal Prompt Editor
```jsx
// src/components/PromptEditor.js
// Note: Uses monospace font, beautiful rounded container, and blue focus highlight (same as reference text)
<div className="prompt-editor-container">
  <CustomScrollbarTextarea
    id="custom-instructions"
    ref={textareaRef}
    className="prompt-editor-textarea"
    value={customInstructions}
    onChange={handleChange}
    rows={8}
    placeholder={t('promptEditor.enterPrompt')}
  />
</div>
```

## Browser Support

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## Performance Notes

- Uses efficient event delegation
- Debounced resize handling
- Automatic cleanup on unmount
- Hardware-accelerated animations
- Minimal DOM updates

## Accessibility

- Full keyboard navigation support
- Screen reader compatible
- Focus management
- ARIA attributes preserved
- All standard textarea accessibility features

## Migration Guide

1. Import the component: `import CustomScrollbarTextarea from './common/CustomScrollbarTextarea';`
2. Replace `<textarea>` with `<CustomScrollbarTextarea>`
3. Move any container-specific styling to `containerClassName` or `containerStyle`
4. Test functionality and adjust styling as needed

The component is a drop-in replacement for standard textareas with enhanced visual design!
