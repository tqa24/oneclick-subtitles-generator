# One-Click Subtitles Generator

## Screenshots

Here are some screenshots showcasing the application:

| ![Screenshot 1](readme_assets/Screenshot%202025-04-03%20184013.png) | ![Screenshot 2](readme_assets/Screenshot%202025-04-05%20001543.png) |
|:-------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| **KR/EN/VI Light/Dark Theme Support**                                         | **Can be use to just Download Video**                              |

| ![Screenshot 3](readme_assets/Screenshot%202025-04-05%20001838.png) | ![Screenshot 4](readme_assets/Screenshot%202025-04-05%20001444.png) |
|:-------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| **Parallel Processing Status/Retry**                       | **Timings Adjust/Add/Remove/Edit/Merge Texts**                           |

| ![Screenshot 5](readme_assets/Screenshot%202025-04-03%20184934.png) | ![Screenshot 6](readme_assets/Screenshot%202025-04-03%20184944.png) |
|:-------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| **API Instructions**                               | **Segmenting, Models, Format, Cache Settings**                                    |

A web application for generating timed subtitles for videos using Google's Gemini AI technology.

## Features

- Upload video files or provide YouTube URLs
- Generate accurate, timed subtitles using Gemini AI
- Edit subtitle timings with an intuitive visual interface
- Timeline visualization for precise timing adjustments
- Download subtitles in SRT or JSON format
- Real-time preview of subtitles on video
- Multi-language support (English, Korean, Vietnamese)
- Sticky timing adjustments for batch modifications
- Undo/Reset functionality for editing
- Parallel processing for long videos
- Merge adjacent subtitle lines with a single click
- Customizable time display format (seconds or HH:MM:SS)
- Optimized performance for long videos with many subtitles
- Smooth, continuous progress indicator for current subtitle
- Dark mode by default with support for light mode and system preference

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [FFmpeg](https://ffmpeg.org/) (required for video processing)
- Google Gemini API key
- Google YouTube API key (optional, for YouTube search functionality)

## Installation

1. Clone this repository or download the source code
2. Navigate to the project directory:

```bash
cd subtitles-generator
```

3. Install Node.js dependencies:
```bash
npm install
```

## Running the Application

To start the frontend + server concurrently:

```bash
npm run dev
```

This will launch the application in your default web browser.


## How to Use

1. **Select a Video Source**:
   - Upload a video file directly
   - Provide a YouTube URL
   - Search for a YouTube video by title

2. **Generate Subtitles**:
   - Click the "Generate timed subtitles" button
   - Wait for Gemini AI to process the video/audio
   - Review the generated subtitles

3. **Edit Timings and Text** (if needed):
   - Use the timeline visualization for precise adjustments
   - Drag subtitle timing handles to adjust start/end times
   - Enable "Sticky Timings" to adjust all following subtitles
   - Use "Undo" to revert changes or "Reset" to start over
   - Click on any subtitle text to jump to that timestamp in the video
   - Edit subtitle text directly with the edit button
   - Delete unwanted subtitles or add new empty ones
   - Merge adjacent subtitle lines with the merge button

4. **Download Subtitles**:
   - Click "Download SRT" for standard subtitle format
   - Click "Download JSON" for raw data format

## Configuration

Adjust settings via the gear icon in the top-right corner:
- Change interface language (Vietnamese is the default, also supports English and Korean)
- Manage API settings (Gemini and YouTube)
- Select Gemini model (Gemini 2.5 Pro is the default for best accuracy)
- Configure segment duration for long videos (20 minutes by default)
- Choose time display format (HH:MM:SS by default, or seconds)
- Clear caches and manage storage

## Technical Details

- Built with React for the frontend
- Uses Google's Gemini AI for subtitle generation
- Timeline visualization with HTML5 Canvas
- Efficient caching system for generated subtitles
- Real-time subtitle synchronization with video playback
- Virtualized rendering for optimal performance with long videos
- Parallel processing for handling videos longer than 15 minutes
- Responsive design that works on various screen sizes
- Hardware-accelerated animations for smooth user experience

## Performance Optimizations

- **Virtualized Rendering**: Only renders visible subtitle items, greatly improving performance for long videos
- **Limited Timeline Segments**: Intelligently limits the number of segments rendered in the timeline visualization
- **Throttled Drag Operations**: Reduces lag when adjusting subtitle timings through efficient event handling
- **Hardware Acceleration**: Uses GPU acceleration for smooth animations and transitions
- **Adaptive Time Markers**: Dynamically adjusts the number of time markers based on zoom level
- **Efficient DOM Updates**: Minimizes unnecessary re-renders through React memo and careful state management
- **Continuous Animation**: Uses requestAnimationFrame for smooth progress indicator animation

## License

MIT License

Copyright (c) 2024 Subtitles Generator

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Acknowledgements

- Built with [React](https://reactjs.org/)
- Powered by [Google Gemini AI](https://deepmind.google/technologies/gemini/)
- Internationalization with [i18next](https://www.i18next.com/)
- Video processing with [FFmpeg](https://ffmpeg.org/)
- Timeline visualization using HTML5 Canvas
- YouTube integration with [@distube/ytdl-core](https://github.com/distubejs/ytdl-core) for serverless video downloading
- SRT subtitle format parsing and generation
- Icons from [Heroicons](https://heroicons.com/)
- Virtualization with [react-window](https://github.com/bvaughn/react-window)
- Optimized animations with requestAnimationFrame
