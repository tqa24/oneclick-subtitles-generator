# Individual Cache Clear - Visual Example

## Before (Clear All Only)
```
Cache Information
Total Cache: 77 files (650.55 KB)

┌─────────────────────────────────────────────────────────────┐
│ Videos: 18 files (18.88 MB)                                │
│ Subtitles: 1 file (1.83 KB)                               │
│ User Subtitles: 0 files (0 Bytes)                         │
│ Transcription Rules: 0 files (0 Bytes)                    │
└─────────────────────────────────────────────────────────────┘

[Clear Cache] [Refresh]
```

## After (Individual Clear Buttons)
```
Cache Information
Total Cache: 77 files (650.55 KB)

┌─────────────────────────────────────────────────────────────┐
│ Videos: 18 files (18.88 MB)                           [×]  │
│ Subtitles: 1 file (1.83 KB)                          [×]  │
│ User Subtitles: 0 files (0 Bytes)                         │
│ Transcription Rules: 0 files (0 Bytes)                    │
│ Lyrics: 0 files (0 Bytes)                                 │
│ Album Art: 0 files (0 Bytes)                              │
│ Uploaded Files: 0 files (0 Bytes)                         │
│ Generated Videos: 0 files (0 Bytes)                       │
│ Narration Reference Audio: 0 files (0 Bytes)              │
│ Narration Output Audio: 59 files (647.72 KB)         [×]  │
│ Rendered Videos: 0 files (0 Bytes)                        │
│ Temporary Videos: 0 files (0 Bytes)                       │
│ Video Album Art: 0 files (0 Bytes)                        │
│ Video Renderer Uploads: 0 files (0 Bytes)                 │
│ Video Renderer Output: 0 files (0 Bytes)                  │
└─────────────────────────────────────────────────────────────┘

[Clear Cache] [Refresh]
```

## Button Behavior

### Normal State
- **Appearance**: Small circular button with "×" symbol
- **Color**: Light gray background with darker text
- **Size**: 22px diameter
- **Visibility**: Only appears when cache count > 0

### Hover State
- **Background**: Changes to error container color (light red)
- **Text**: Changes to error container text color (dark red)
- **Border**: Matches the error container theme

### Disabled State (during clearing)
- **Opacity**: Reduced to 38%
- **Cursor**: Shows "not-allowed" cursor
- **Interaction**: No hover effects

### Click Action
1. User clicks individual clear button (e.g., for Videos)
2. Button becomes disabled
3. API call to `DELETE /api/clear-cache/videos`
4. Success message: "Videos cleared: 18 files (18.88 MB)"
5. Cache info refreshes automatically
6. Button disappears if no files remain

## User Benefits

✅ **Granular Control**: Clear only what you need
✅ **Visual Feedback**: Clear buttons only show when needed
✅ **Consistent UI**: Matches existing button styles
✅ **Fast Operation**: Clear specific cache types quickly
✅ **Space Efficient**: Small, unobtrusive buttons
✅ **Accessible**: Proper tooltips and keyboard support

## Technical Implementation

- **Frontend**: React component with conditional rendering
- **Backend**: New API endpoint with type validation
- **Styling**: Reuses existing `.remove-key` CSS class
- **Responsive**: Works on mobile and desktop
- **Error Handling**: Proper validation and user feedback
