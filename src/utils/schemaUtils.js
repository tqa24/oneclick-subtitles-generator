/**
 * Utility functions for creating response schemas for Gemini API
 */

import { createVideoAnalysisSchema } from './videoAnalysisSchema';

/**
 * Creates a schema for subtitle transcription
 * @param {boolean} isUserProvided - Whether the subtitles are user-provided
 * @returns {Object} Schema for subtitle transcription
 */
export const createSubtitleSchema = (isUserProvided = false) => {
    if (isUserProvided) {
        // For user-provided subtitles, we only need timing information
        // This simplifies the task for the model and ensures it doesn't modify the text
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
                    index: {
                        type: "integer",
                        description: "Index of the subtitle in the provided list (starting from 0). MUST be a valid index from the provided list."
                    }
                },
                required: ["startTime", "endTime", "index"],
                propertyOrdering: ["index", "startTime", "endTime"]
            }
        };
    } else {
        // For normal transcription, we need the full schema
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
    }
};

/**
 * Creates a schema for subtitle translation
 * @param {boolean} multiLanguage - Whether multiple languages are being translated
 * @returns {Object} Schema for subtitle translation
 */
export const createTranslationSchema = (multiLanguage = false) => {
    if (multiLanguage) {
        return {
            type: "object",
            properties: {
                translations: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            language: {
                                type: "string",
                                description: "Target language for this translation"
                            },
                            texts: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        original: {
                                            type: "string",
                                            description: "Original text of the subtitle"
                                        },
                                        translated: {
                                            type: "string",
                                            description: "Translated text for the subtitle"
                                        }
                                    },
                                    required: ["original", "translated"],
                                    propertyOrdering: ["original", "translated"]
                                }
                            }
                        },
                        required: ["language", "texts"],
                        propertyOrdering: ["language", "texts"]
                    }
                }
            },
            required: ["translations"],
            propertyOrdering: ["translations"]
        };
    } else {
        // Updated schema for single language translation to include original text
        return {
            type: "array",
            items: {
                type: "object",
                properties: {
                    original: {
                        type: "string",
                        description: "Original text of the subtitle"
                    },
                    translated: {
                        type: "string",
                        description: "Translated text for the subtitle"
                    }
                },
                required: ["original", "translated"],
                propertyOrdering: ["original", "translated"]
            }
        };
    }
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
export const addResponseSchema = (requestData, schema, isUserProvided = false) => {
    return {
        ...requestData,
        generationConfig: {
            ...(requestData.generationConfig || {}),
            // Use a lower temperature for user-provided subtitles to make the model more deterministic
            temperature: isUserProvided ? 0.01 : 0.2,
            topK: isUserProvided ? 1 : 32,
            topP: isUserProvided ? 0.5 : 0.95,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    };
};

// Export the video analysis schema
export { createVideoAnalysisSchema };