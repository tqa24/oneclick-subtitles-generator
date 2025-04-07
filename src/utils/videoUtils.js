/**
 * Utility functions for video processing and subtitle rendering
 */

/**
 * Renders subtitles onto a video and returns a downloadable URL
 * @param {string} videoSrc - Source URL of the video
 * @param {Array} subtitles - Array of subtitle objects
 * @param {Object} subtitleSettings - Settings for subtitle appearance
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - URL of the video with subtitles
 */
export const renderSubtitlesToVideo = async (videoSrc, subtitles, subtitleSettings, onProgress = () => {}) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a video element to load the source video
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoSrc;

      // Wait for video metadata to load
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Create a MediaRecorder to capture the canvas
        const stream = canvas.captureStream();
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 5000000 // 5 Mbps
        });

        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          resolve(url);
        };

        // Start recording
        mediaRecorder.start(1000); // Collect data in 1-second chunks

        // Parse subtitle settings
        const {
          fontFamily = 'Arial, sans-serif',
          fontSize = '24',
          fontWeight = '400',
          position = 'bottom',
          boxWidth = '80',
          backgroundColor = '#000000',
          opacity = '0.7',
          textColor = '#ffffff'
        } = subtitleSettings;

        // Calculate position based on percentage value
        const getSubtitleY = () => {
          // Convert position from percentage (0-100) to canvas position
          return (parseInt(position) / 100) * canvas.height;
        };

        // Function to draw subtitles on canvas
        const drawSubtitles = (time) => {
          // Find current subtitle
          const currentSubtitles = subtitles.filter(sub => {
            const start = sub.start !== undefined ? sub.start : parseTimeString(sub.startTime);
            const end = sub.end !== undefined ? sub.end : parseTimeString(sub.endTime);
            return time >= start && time <= end;
          });

          if (currentSubtitles.length > 0) {
            const text = currentSubtitles[0].text;
            const boxWidthPx = (canvas.width * parseInt(boxWidth)) / 100;
            const subtitleY = getSubtitleY();

            // Draw subtitle background
            ctx.fillStyle = hexToRgba(backgroundColor, opacity);

            // Measure text to create appropriate background
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';

            // Split text into lines if it's too long
            const words = text.split(' ');
            const lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
              const testLine = currentLine + ' ' + words[i];
              const metrics = ctx.measureText(testLine);
              if (metrics.width > boxWidthPx) {
                lines.push(currentLine);
                currentLine = words[i];
              } else {
                currentLine = testLine;
              }
            }
            lines.push(currentLine);

            // Calculate background height based on number of lines
            const lineHeight = parseInt(fontSize) * 1.2;
            const totalHeight = lineHeight * lines.length + 20; // Add padding

            // Draw background
            const bgX = (canvas.width - boxWidthPx) / 2;
            const bgY = position === 'top' ? subtitleY : subtitleY - totalHeight;

            ctx.fillRect(bgX, bgY, boxWidthPx, totalHeight);

            // Draw text
            ctx.fillStyle = textColor;
            lines.forEach((line, index) => {
              const y = bgY + 15 + (index * lineHeight);
              ctx.fillText(line, canvas.width / 2, y);
            });
          }
        };

        // Function to render each frame
        const render = () => {
          if (video.ended || video.paused) {
            mediaRecorder.stop();
            return;
          }

          // Draw video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Draw subtitles
          drawSubtitles(video.currentTime);

          // Report progress
          onProgress(video.currentTime / video.duration);

          // Request next frame
          requestAnimationFrame(render);
        };

        // Start playback and rendering
        video.play().then(() => {
          render();
        }).catch(err => {
          reject(new Error('Failed to play video: ' + err.message));
        });
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Parse time string (00:00:00,000) to seconds
 * @param {string} timeString - Time string in format 00:00:00,000 or 00m00s000ms
 * @returns {number} - Time in seconds
 */
const parseTimeString = (timeString) => {
  if (!timeString) return 0;

  // Handle SRT format (00:00:00,000)
  if (timeString.includes(':')) {
    const [hours, minutes, secondsMs] = timeString.split(':');
    const [seconds, ms] = secondsMs.includes(',')
      ? secondsMs.split(',')
      : secondsMs.split('.');

    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(ms) / 1000;
  }

  // Handle custom format (00m00s000ms)
  if (timeString.includes('m') && timeString.includes('s')) {
    const minutesMatch = timeString.match(/(\\d+)m/);
    const secondsMatch = timeString.match(/(\\d+)s/);
    const msMatch = timeString.match(/(\\d+)ms/);

    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;
    const ms = msMatch ? parseInt(msMatch[1]) : 0;

    return minutes * 60 + seconds + ms / 1000;
  }

  return 0;
};

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color code
 * @param {string|number} opacity - Opacity value (0-1)
 * @returns {string} - RGBA color string
 */
const hexToRgba = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Download a video from a URL
 * @param {string} url - URL of the video
 * @param {string} filename - Name of the file to download
 */
export const downloadVideo = (url, filename) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'video-with-subtitles.webm';
  document.body.appendChild(a);
  a.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};
