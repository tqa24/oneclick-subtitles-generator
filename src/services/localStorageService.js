/**
 * Service for syncing localStorage with the server
 */

import { API_BASE_URL } from '../config';

/**
 * Save localStorage data to the server
 * This allows the server to access client-side settings like API keys
 * @returns {Promise<Object>} - Response from the server
 */
export const syncLocalStorageToServer = async () => {
  try {

    
    // Get all localStorage data
    const localStorageData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        localStorageData[key] = localStorage.getItem(key);
      } catch (e) {
        console.error(`Error reading localStorage key ${key}:`, e);
      }
    }
    
    // Send to server
    const response = await fetch(`${API_BASE_URL}/save-local-storage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(localStorageData)
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();

    return result;
  } catch (error) {
    console.error('Error syncing localStorage to server:', error);
    throw error;
  }
};
