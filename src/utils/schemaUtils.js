/**
 * Utility functions for creating response schemas for Gemini API
 */

import { createVideoAnalysisSchema } from './videoAnalysisSchema';

/**
 * Creates a schema for subtitle transcription
 * @returns {Object} Schema for subtitle transcription
 */
export const createSubtitleSchema = () => {
    return {
        type: "array",
        items: {
            type: "object",
            properties: {
                startTime: {
                    type: "string",
                    description: "Start time in format MMmSSsNNNms (e.g., '00m00s500ms')"
                },
                endTime: {
                    type: "string",
                    description: "End time in format MMmSSsNNNms (e.g., '00m01s000ms')"
                },
                text: {
                    type: "string",
                    description: "Transcribed text content"
                }
            },
            required: ["startTime", "endTime", "text"],
            propertyOrdering: ["startTime", "endTime", "text"]
        }
    };
};

/**
 * Creates a schema for subtitle translation
 * @returns {Object} Schema for subtitle translation
 */
export const createTranslationSchema = () => {
    return {
        type: "array",
        items: {
            type: "string",
            description: "Translated text for a subtitle"
        }
    };
};

/**
 * Creates a schema for document consolidation
 * @returns {Object} Schema for document consolidation
 */
export const createConsolidationSchema = () => {
    return {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Document title"
            },
            content: {
                type: "string",
                description: "Consolidated document content"
            }
        },
        required: ["title", "content"],
        propertyOrdering: ["title", "content"]
    };
};

/**
 * Creates a schema for document summarization
 * @returns {Object} Schema for document summarization
 */
export const createSummarizationSchema = () => {
    return {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "Document summary"
            },
            keyPoints: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "Key points from the document"
            }
        },
        required: ["summary", "keyPoints"],
        propertyOrdering: ["summary", "keyPoints"]
    };
};

/**
 * Adds response schema configuration to a Gemini API request
 * @param {Object} requestData - The original request data
 * @param {Object} schema - The schema to apply
 * @returns {Object} Updated request data with schema
 */
export const addResponseSchema = (requestData, schema) => {
    return {
        ...requestData,
        generationConfig: {
            ...(requestData.generationConfig || {}),
            temperature: 0.2,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    };
};

// Export the video analysis schema
export { createVideoAnalysisSchema };