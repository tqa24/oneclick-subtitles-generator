# Individual Cache Clear Implementation

This document describes the implementation of individual cache clearing functionality for the OneClick Subtitles Generator application.

## Overview

The implementation adds the ability to clear specific cache types individually instead of only being able to clear all cache at once. Each cache category now has its own clear button that appears only when there are files to clear.

## Backend Changes

### New API Endpoint

**Endpoint**: `DELETE /api/clear-cache/:type`

**Supported Cache Types**:
- `videos` - Video files
- `subtitles` - Generated subtitle files  
- `userSubtitles` - User-provided subtitle files
- `rules` - Transcription rules
- `narrationReference` - Reference narration audio files
- `narrationOutput` - Generated narration audio files
- `lyrics` - Lyrics files
- `albumArt` - Album art images
- `uploads` - Uploaded files
- `output` - Generated video output files
- `videoRendered` - Rendered video files
- `videoTemp` - Temporary video files
- `videoAlbumArt` - Video album art files
- `videoRendererUploads` - Video renderer upload files
- `videoRendererOutput` - Video renderer output files

**Response Format**:
```json
{
  "success": true,
  "message": "videos cache cleared successfully",
  "details": {
    "videos": {
      "count": 5,
      "size": 1048576,
      "formattedSize": "1.0 MB",
      "files": [...]
    }
  }
}
```

### Implementation Details

1. **Route Handler**: Added new route handler in `server/routes/cacheRoutes.js`
2. **Cache Type Validation**: Validates cache type against allowed types
3. **Specialized Clearing Logic**: 
   - Handles recursive directories for `uploads` and `videoRendererUploads`
   - Uses safe batch deletion for video files
   - Includes temp directory cleanup for narration output
4. **Error Handling**: Proper error responses for invalid cache types

## Frontend Changes

### UI Components

**File**: `src/components/settings/tabs/CacheTab.js`

**New Features**:
1. **Individual Clear Buttons**: Small "×" buttons next to each cache category
2. **Conditional Display**: Buttons only appear when cache count > 0
3. **Loading States**: Buttons are disabled during clearing operations
4. **Success Messages**: Specific success messages for each cache type

**New Function**: `handleClearIndividualCache(cacheType, displayName)`
- Calls the new API endpoint
- Handles localStorage cleanup for specific cache types
- Shows appropriate success/error messages
- Refreshes cache info after clearing

### CSS Styling

**File**: `src/styles/settings/cache.css`

**New Styles**:
1. **`.cache-item-header`**: Flexbox container for title and clear button
2. **Uses existing `.remove-key` class**: Reuses the same styling as API key removal buttons
   - 22px diameter circular button
   - Material Design 3 surface colors with error hover state
   - Consistent with existing UI patterns
   - Proper disabled state styling

**Responsive Design**:
- Mobile-friendly layout adjustments
- Proper button positioning on small screens

## User Experience

### Visual Design
- **Clear Buttons**: Small, unobtrusive "×" buttons using the same style as API key removal buttons
- **Hover Effects**: Buttons change to error container color on hover (consistent with existing patterns)
- **Conditional Display**: Only shown when there are files to clear
- **Consistent Styling**: Reuses existing `.remove-key` class for perfect UI consistency

### Interaction Flow
1. User sees cache information with individual clear buttons
2. Clicks on a specific clear button (e.g., for Videos)
3. System clears only that cache type
4. Success message shows what was cleared
5. Cache information refreshes to show updated counts
6. Clear button disappears if no files remain in that category

### Error Handling
- Invalid cache types return 400 error
- Network errors show appropriate error messages
- Server errors are logged and reported to user

## Testing

A test script `test-individual-cache-clear.js` is provided to verify:
- All cache types can be cleared individually
- Invalid cache types are properly rejected
- API responses are correctly formatted
- Error handling works as expected

**Run Tests**:
```bash
node test-individual-cache-clear.js
```

## Benefits

1. **Granular Control**: Users can clear specific cache types without affecting others
2. **Storage Management**: More precise control over disk space usage
3. **Workflow Optimization**: Clear only what's needed for specific tasks
4. **User-Friendly**: Intuitive UI with clear visual feedback
5. **Performance**: Faster clearing of specific cache types vs. full cache clear

## Backward Compatibility

- Existing "Clear All Cache" functionality remains unchanged
- All existing API endpoints continue to work
- No breaking changes to existing functionality

## Future Enhancements

Potential improvements that could be added:
1. **Confirmation Dialogs**: Optional confirmation for large cache clears
2. **Batch Selection**: Select multiple cache types to clear together
3. **Cache Statistics**: More detailed information about cache usage over time
4. **Automatic Cleanup**: Scheduled cleanup of old cache files
