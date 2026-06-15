/**
 * Narration service availability checks.
 */

import { API_BASE_URL } from '../config';

/**
 * Check if the narration service is available - DRASTICALLY SIMPLIFIED VERSION
 * @returns {Promise<Object>} - Status response
 */
export const checkNarrationStatusWithRetry = async () => {
  // Completely simplified version with no retries to eliminate logs
  try {
    // First check if Express server is available
    try {
      const healthResponse = await fetch(`${API_BASE_URL}/health`, {
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!healthResponse.ok) {
        return {
          available: false,
          error: "Express server is not available",
          message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
        };
      }
    } catch (error) {
      return {
        available: false,
        error: "Express server is not available",
        message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
      };
    }

    // Single attempt to check narration service
    const response = await fetch(`${API_BASE_URL}/narration/status`, {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        available: false,
        error: `Server returned ${response.status}`,
        message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
      };
    }

    const data = await response.json();
    if (!data.available) {
      data.message = "SERVICE_UNAVAILABLE"; // Will be translated by frontend
    }
    return data;
  } catch (error) {
    return {
      available: false,
      error: error.message,
      message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
    };
  }
};

/**
 * Check if the narration service is available (simple version without retries)
 * @returns {Promise<Object>} - Status response
 */
export const checkNarrationStatus = async () => {
  // First, check if the Express server is available
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`, {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!healthResponse.ok) {
      // If the Express server is not available, don't even try to check narration service
      return {
        available: false,
        error: "Express server is not available",
        message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
      };
    }
  } catch (error) {
    // Express server is not available
    return {
      available: false,
      error: "Express server is not available",
      message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
    };
  }

  // Now check the narration service
  try {
    const response = await fetch(`${API_BASE_URL}/narration/status`, {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        available: false,
        error: `Server returned ${response.status}`,
        message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
      };
    }

    const data = await response.json();
    if (!data.available) {
      data.message = "SERVICE_UNAVAILABLE"; // Will be translated by frontend
    }
    return data;
  } catch (error) {
    return {
      available: false,
      error: error.message,
      message: "SERVICE_UNAVAILABLE" // Will be translated by frontend
    };
  }
};
