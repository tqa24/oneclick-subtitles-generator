# Large File Handling Improvements

## Overview

This document describes the improvements made to handle large video files (2GB+) more efficiently in the oneclick-subtitles-generator application.

## Problem

Previously, when users uploaded large video files:
- Files were processed entirely in memory using `URL.createObjectURL()`
- The entire file was sent to the server synchronously
- No progress feedback during upload
- High memory consumption
- Blocking operations that could freeze the UI

## Solution

### 1. Copy Operation for Large Files (>500MB)

For files larger than 500MB, the system now:
- Copies the file to the videos directory on the server
- Shows upload progress with a progress bar
- Uses chunked upload with XMLHttpRequest for better control
- Provides visual feedback during the copy operation

### 2. Server-Side File Management

New server endpoints:
- `POST /api/copy-large-file` - Copies large files to the videos directory
- `POST /api/split-existing-file` - Splits files that are already on the server

### 3. Improved User Experience

- Progress indicators for large file operations
- Non-blocking file operations
- Better error handling and recovery
- Consistent UI feedback

## Implementation Details

### Client-Side Changes

**FileUploadInput.js**:
- Added `copyFileToVideosDirectory()` function for large file handling
- Enhanced `processFile()` to detect large files and use copy operation
- Added progress tracking for copy operations
- Updated UI to show copy progress

**videoSplitter.js**:
- Added `splitFileOnServer()` function for server-side file splitting
- Enhanced `splitVideoOnServer()` to handle pre-copied files
- Improved error handling and progress reporting

### Server-Side Changes

**videoRoutes.js**:
- Added multer configuration for large file uploads
- New `/api/copy-large-file` endpoint with progress tracking
- New `/api/split-existing-file` endpoint for server-side splitting
- Enhanced error handling and file management

### Translation Support

Added new translation keys in `fileUpload.json`:
- `copying`: "Copying large file..."
- `copyError`: "Failed to copy large file. Please try again."

## Usage

### For Users

1. **Small Files (<500MB)**: Work exactly as before with no changes
2. **Large Files (>500MB)**: 
   - Upload shows "Copying large file..." with progress percentage
   - File is copied to server before processing
   - Better performance and reliability

### For Developers

The system automatically detects file size and chooses the appropriate handling method:

```javascript
// Large files are automatically detected and copied
const fileSizeMB = processedFile.size / (1024 * 1024);
if (fileSizeMB > 500) {
  // Use copy operation with progress tracking
  const copiedFile = await copyFileToVideosDirectory(processedFile, onProgress);
}
```

## Benefits

1. **Better Performance**: Large files don't consume excessive memory
2. **Progress Feedback**: Users see upload progress for large files
3. **Reliability**: Reduced chance of timeouts or memory issues
4. **Scalability**: Can handle very large files (up to 2GB limit)
5. **User Experience**: Non-blocking operations with clear feedback

## Configuration

The 500MB threshold can be adjusted in `FileUploadInput.js`:

```javascript
// Current threshold: 500MB
if (fileSizeMB > 500) {
  // Use copy operation
}
```

## Future Enhancements

Potential improvements for the future:
1. **Resumable Uploads**: Allow interrupted uploads to resume
2. **Background Processing**: Use Web Workers for file operations
3. **Streaming Uploads**: Implement streaming for even better memory efficiency
4. **Compression**: Optional file compression before upload
5. **Batch Processing**: Handle multiple large files simultaneously

## Testing

To test the large file handling:
1. Upload a file larger than 500MB
2. Observe the "Copying large file..." progress indicator
3. Verify the file is processed correctly after copying
4. Test with various file formats (MP4, MOV, AVI, etc.)

## Troubleshooting

Common issues and solutions:

1. **Copy Progress Stuck**: Check server logs for disk space or permissions
2. **Upload Fails**: Verify the 2GB limit isn't exceeded
3. **Server Errors**: Check multer configuration and VIDEOS_DIR permissions
4. **Memory Issues**: Ensure the 500MB threshold is appropriate for your system
