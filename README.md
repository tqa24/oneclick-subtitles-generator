# Subtitles Generator

## Screenshots

Here are some screenshots showcasing the application:

| ![Screenshot 1](readme_assets/Screenshot%202025-04-03%20184013.png) | ![Screenshot 2](readme_assets/Screenshot%202025-04-03%20184027.png) |
|:-------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| **Upload Video Interface**                                         | **Generated Subtitles Preview**                                    |

| ![Screenshot 3](readme_assets/Screenshot%202025-04-03%20184200.png) | ![Screenshot 4](readme_assets/Screenshot%202025-04-03%20184306.png) |
|:-------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| **Timeline Visualization**                                         | **Settings Panel**                                                 |

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

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- npm (comes with Node.js)
- Google Gemini API key

## Installation

1. Clone this repository or download the source code
2. Navigate to the project directory:

```bash
cd subtitles-generator
```

3. Install the dependencies:

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

3. **Edit Timings** (if needed):
   - Use the timeline visualization for precise adjustments
   - Drag subtitle timing handles to adjust start/end times
   - Enable "Sticky Timings" to adjust all following subtitles
   - Use "Undo" to revert changes or "Reset" to start over
   - Click on any lyric to jump to that timestamp in the video

4. **Download Subtitles**:
   - Click "Download SRT" for standard subtitle format
   - Click "Download JSON" for raw data format

## Configuration

Adjust settings via the gear icon in the top-right corner:
- Change interface language (English, Korean, Vietnamese)
- Manage API settings
- Clearing caches

## Technical Details

- Built with React for the frontend
- Uses Google's Gemini AI for subtitle generation
- Timeline visualization with HTML5 Canvas
- Efficient caching system for generated subtitles
- Real-time subtitle synchronization with video playback

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
- YouTube integration with youtube-dl
- SRT subtitle format parsing and generation
- Icons from [Heroicons](https://heroicons.com/)