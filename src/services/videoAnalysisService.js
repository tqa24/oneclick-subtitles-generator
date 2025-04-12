/**
 * Service for analyzing videos with Gemini before splitting
 */

import { fileToBase64 } from '../utils/fileUtils';
import { createVideoAnalysisSchema, addResponseSchema } from '../utils/schemaUtils';

/**
 * Analyzes a video with Gemini to determine the best prompt preset and generate transcription rules
 * @param {File} videoFile - The video file to analyze
 * @param {Function} onStatusUpdate - Callback for status updates
 * @returns {Promise<Object>} - Analysis results
 */
export const analyzeVideoWithGemini = async (videoFile, onStatusUpdate) => {
  try {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not found');
    }

    // Get the selected model from localStorage or use the default
    const MODEL = localStorage.getItem('video_analysis_model') || "gemini-2.0-flash-lite";

    // Convert the video file to base64
    onStatusUpdate({ message: 'Preparing video for analysis...', type: 'loading' });
    const base64Data = await fileToBase64(videoFile);

    // Create the request data with the analysis prompt
    const analysisPrompt = `You are an expert video and audio content analyzer. Analyze this video and provide:

1. The most suitable transcription preset for this content from the following options:
   - general: General purpose transcription
   - focus-spoken-words: Focus on spoken words (for interviews, podcasts, etc.)
   - focus-lyrics: Focus on lyrics (for music videos, songs)
   - extract-text: Extract visible text (for presentations, tutorials with text)
   - describe-video: Describe video content (for visual content description)
   - diarize-speakers: Identify different speakers (for multi-person conversations)
   - chaptering: Create chapters based on content (for long-form content)

2. A detailed rule set for consistent transcription, including (only if applicable):
   - Atmosphere: Description of the setting or context
   - Terminology: List of specialized terms and proper nouns with definitions
   - Speaker Identification: Descriptions of different speakers
   - Formatting and Style Conventions: How to format specific content
   - Spelling, Grammar, and Punctuation: Special rules for this content
   - Relationships and Social Hierarchy: Information about relationships between people
   - Any other aspects that would help ensure consistent, high-quality transcription

Provide your analysis in a structured format that can be used to guide the transcription process.`;

    // Create the request data
    let requestData = {
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: analysisPrompt },
            {
              inlineData: {
                mimeType: videoFile.type,
                data: base64Data
              }
            }
          ]
        }
      ]
    };

    // Add response schema for structured output
    requestData = addResponseSchema(requestData, createVideoAnalysisSchema());

    onStatusUpdate({ message: 'Analyzing video content...', type: 'loading' });

    // Call the Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Check if this is a structured JSON response
    if (data.candidates[0]?.content?.parts[0]?.structuredJson) {
      console.log('Received structured JSON analysis response');
      return data.candidates[0].content.parts[0].structuredJson;
    }

    // If not structured, try to parse the text response
    const resultText = data.candidates[0]?.content?.parts[0]?.text;
    if (!resultText) {
      throw new Error('No analysis returned from Gemini');
    }

    // Try to parse the text as JSON
    try {
      return JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse analysis as JSON:', e);
      // Return a simplified object with the raw text
      return {
        rawResponse: resultText,
        recommendedPreset: {
          id: 'general',
          reason: 'Default preset selected due to parsing error'
        },
        transcriptionRules: {
          additionalNotes: [resultText]
        }
      };
    }
  } catch (error) {
    console.error('Error analyzing video:', error);
    throw error;
  }
};
