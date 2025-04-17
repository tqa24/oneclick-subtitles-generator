/**
 * Frontend configuration
 */

// API base URL for server requests
export const API_BASE_URL = 'http://localhost:3007/api'; // Changed from 3004 to match server port

// Server URL for direct server requests (without /api)
export const SERVER_URL = 'http://localhost:3007'; // Changed from 3004 to match server port

// Gemini API key for direct API calls
// This should be loaded from environment variables in production
export const GEMINI_API_KEY = localStorage.getItem('gemini_api_key') || '';

// Default Gemini model for transcription
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-lite';
