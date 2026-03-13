/**
 * Utility functions for managing thinking budgets for Gemini models
 *
 * Gemini 2.5 models → thinkingBudget (integer token count)
 * Gemini 3.x models → thinkingLevel (named string: "minimal" | "low" | "medium" | "high")
 */
import { GEMINI_MODELS, getModelById } from '../config/geminiModels';

// Derived from central config: models that use thinkingLevel instead of thinkingBudget
const THINKING_LEVEL_MODELS = GEMINI_MODELS
  .filter(m => m.thinking?.type === 'level')
  .map(m => m.id);

/**
 * Check if a model uses the thinkingLevel API (Gemini 3.x)
 */
export const isThinkingLevelModel = (modelId) => THINKING_LEVEL_MODELS.includes(modelId);

/**
 * Get the thinking budget/level for a specific model
 * @param {string} modelId
 * @returns {number|string|null}
 */
export const getThinkingBudget = (modelId) => {
  try {
    const thinkingBudgets = JSON.parse(localStorage.getItem('thinking_budgets') || '{}');

    if (!isThinkingSupported(modelId)) return null;

    const budget = thinkingBudgets[modelId];
    if (budget !== undefined) return budget;

    return getDefaultThinkingBudget(modelId);
  } catch (error) {
    console.error('Error getting thinking budget:', error);
    return getDefaultThinkingBudget(modelId);
  }
};

/**
 * Check if a model supports thinking configuration
 */
export const isThinkingSupported = (modelId) =>
  GEMINI_MODELS.some(m => m.id === modelId && m.thinking !== null);

/**
 * Get the default thinking budget/level for a model
 * @returns {number|string|null}
 */
export const getDefaultThinkingBudget = (modelId) =>
  getModelById(modelId)?.thinking?.default ?? null;

/**
 * Add thinking configuration to a Gemini API request
 */
export const addThinkingConfig = (requestData, modelId, options = {}) => {
  const { enableThinking = true } = options;

  if (!enableThinking) return requestData;
  if (!isThinkingSupported(modelId)) return requestData;

  // Gemini 3.x models use thinkingLevel (string)
  if (isThinkingLevelModel(modelId)) {
    const level = getThinkingBudget(modelId) || getDefaultThinkingBudget(modelId);
    if (!level) return requestData;
    return {
      ...requestData,
      generationConfig: {
        ...(requestData.generationConfig || {}),
        thinkingConfig: { thinkingLevel: level }
      }
    };
  }

  // Gemini 2.5 models use thinkingBudget (integer)
  const thinkingBudget = getThinkingBudget(modelId);
  if (thinkingBudget === null) return requestData;

  return {
    ...requestData,
    generationConfig: {
      ...(requestData.generationConfig || {}),
      thinkingConfig: { thinkingBudget }
    }
  };
};

/**
 * Validate a thinking budget value for a model
 */
export const validateThinkingBudget = (modelId, budget) => {
  const model = getModelById(modelId);
  if (!model?.thinking) return false;

  const { thinking } = model;

  // 3.x level models
  if (thinking.type === 'level') {
    return thinking.options.includes(budget);
  }

  // 2.5 token budget models
  if (budget === -1) return true;
  if (budget === 0) return thinking.allowDisable;
  return budget >= thinking.min && budget <= thinking.max;
};
