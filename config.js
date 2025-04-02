// Configuration for the Subtitles Generator app

// Make API keys globally accessible so they can be updated without refresh
window.API_KEY = localStorage.getItem('gemini_api_key') || '';
window.YOUTUBE_API_KEY = localStorage.getItem('youtube_api_key') || '';

// Check if API keys are set
window.API_KEYS_SET = {
    gemini: !!window.API_KEY,
    youtube: !!window.YOUTUBE_API_KEY
};

// Gemini model configuration
const MODEL_CONFIG = {
    model: "gemini-2.5-pro-exp-03-25", // Using the specified model
    maxOutputTokens: 8192,   // Adjust as needed for longer transcriptions
};

// File upload configuration
const MAX_FILE_SIZE_MB = 200; // Maximum file size in MB for inline uploads

// Supported file formats
const SUPPORTED_VIDEO_FORMATS = ["video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv", "video/mpg", "video/webm", "video/wmv", "video/3gpp"];
const SUPPORTED_AUDIO_FORMATS = ["audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac", "audio/mpeg"];

// Debug mode - set to true to save Gemini's raw response to a file
const DEBUG_MODE = true;