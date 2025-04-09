# One-Click Subtitles Generator

## Screenshots

Here are some screenshots showcasing the application:

<div align="center">
  <table>
    <tr>
      <td><img src="readme_assets/Screenshot%202025-04-08%20195440.png" width="100%"></td>
      <td><img src="readme_assets/Screenshot%202025-04-08%20195622.png" width="100%"></td>
      <td><img src="readme_assets/Screenshot%202025-04-08%20195917.png" width="100%"></td>
    </tr>
    <tr>
      <td align="center"><strong>Light/dark theme with EN, VI, KO interface</strong></td>
      <td align="center"><strong>Upload long video, audio, or YouTube source</strong></td>
      <td align="center"><strong>Parallel processing with model selection for retries</strong></td>
    </tr>
    <tr>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200056.png" width="100%"></td>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200132.png" width="100%"></td>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200147.png" width="100%"></td>
    </tr>
    <tr>
      <td align="center"><strong>Editing interface with timing controls, text editing, and visualization</strong></td>
      <td align="center"><strong>Customize subtitle style and render video with subtitles</strong></td>
      <td align="center"><strong>Subtitle settings with transparency mode and fullscreen support</strong></td>
    </tr>
    <tr>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200309.png" width="100%"></td>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200333.png" width="100%"></td>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200340.png" width="100%"></td>
    </tr>
    <tr>
      <td align="center"><strong>Translate subtitles to any language while preserving timings</strong></td>
      <td align="center"><strong>API setup, OAuth integration, update app, and factory reset</strong></td>
      <td align="center"><strong>Configure segment duration, model selection, and time format</strong></td>
    </tr>
    <tr>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200351.png" width="100%"></td>
      <td><img src="readme_assets/Screenshot%202025-04-08%20200358.png" width="100%"></td>
      <td></td>
    </tr>
    <tr>
      <td align="center"><strong>Prompt presets and customization options</strong></td>
      <td align="center"><strong>Cache management and storage information</strong></td>
      <td></td>
    </tr>
  </table>
</div>

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

### Windows Installation

#### Easy Installation (using winget)

##### Install FFmpeg:
```powershell
winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements
```

Verify installation: Open a NEW PowerShell or Command Prompt window and run:
```powershell
ffmpeg -version
```

##### Install Node.js:
```powershell
winget install --id OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements
```

IMPORTANT: Close the current PowerShell window.
Open a NEW PowerShell or Command Prompt window and verify installation:
```powershell
node -v
npm -v
```

### macOS Installation

#### Using Homebrew (Recommended)

Homebrew is a package manager for macOS that makes it easy to install software.

##### Install Homebrew (if not already installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

##### Install Node.js:
```bash
brew install node
```

Verify installation:
```bash
node -v
npm -v
```

##### Install FFmpeg:
```bash
brew install ffmpeg
```

Verify installation:
```bash
ffmpeg -version
```

#### Manual Installation

##### Install Node.js:
1. Download the macOS installer from [Node.js website](https://nodejs.org/)
2. Choose the LTS (Long Term Support) version
3. Run the installer and follow the instructions
4. Verify installation by opening Terminal and running:
   ```bash
   node -v
   npm -v
   ```

##### Install FFmpeg:
1. Download FFmpeg from [FFmpeg website](https://ffmpeg.org/download.html)
2. Extract the downloaded file
3. Move the FFmpeg binary to a directory in your PATH, for example:
   ```bash
   sudo mv ffmpeg /usr/local/bin/
   ```
4. Verify installation:
   ```bash
   ffmpeg -version
   ```

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

### On Windows and macOS

To start the frontend + server concurrently:

```bash
npm run dev
```

This will launch the application in your default web browser.

### Troubleshooting

#### Common Issues on macOS

- **Permission Issues**: If you encounter permission errors with node_modules, run:
  ```bash
  chmod -R 755 ./node_modules
  ```

- **Node.js Errors**: If you get errors related to Node.js versions, try using nvm (Node Version Manager) to install and use the correct version:
  ```bash
  nvm install 14
  nvm use 14
  ```

- **FFmpeg Not Found**: Ensure FFmpeg is properly installed and in your PATH:
  ```bash
  which ffmpeg
  ```
  If not found, reinstall using Homebrew: `brew reinstall ffmpeg`


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
