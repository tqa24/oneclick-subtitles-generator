# Subtitles Generator

A web application for generating timed subtitles for videos using AI.

## Features

- Upload video files or provide YouTube URLs
- Generate accurate, timed subtitles
- Edit subtitle timings with a visual interface
- Download subtitles in SRT or JSON format
- Multi-language support

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- npm (comes with Node.js)

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

To start the development server:

```bash
npm start
```

This will launch the application on [http://localhost:3005](http://localhost:3005) in your default web browser.

To start both the frontend and backend servers:

```bash
npm run dev
```

This will start the React application on port 3005 and the server on port 3004.

## Building for Production

To create a production build:

```bash
npm run build
```

This generates optimized files in the `build` directory that you can deploy to a web server.

## How to Use

1. **Select a Video Source**:
   - Upload a video file
   - Provide a YouTube URL
   - Search for a YouTube video

2. **Generate Subtitles**:
   - Click the "Generate timed subtitles" button
   - Wait for the AI to process the audio

3. **Edit Timings** (if needed):
   - Click the "Edit Timings" button
   - Drag the timestamps to adjust timing
   - Use "Sticky Timings" to adjust all following subtitles
   - Click "Undo" to revert changes

4. **Download Subtitles**:
   - Click "Download SRT" for standard subtitle format
   - Click "Download JSON" for raw data

## Configuration

Adjust settings via the gear icon in the top-right corner:
- Change language
- Adjust AI settings
- Configure video player options

## License

[Include your license information here]

## Acknowledgements

- Built with React
- Internationalization with i18next
- [List any other libraries or resources used]