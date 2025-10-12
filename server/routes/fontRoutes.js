/**
 * Google Fonts API routes
 * Provides dynamic font search and loading capabilities
 */

const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const router = express.Router();

// Cache for Google Fonts API results (24 hours)
const fontCache = new NodeCache({ stdTTL: 86400 });

// Google Fonts API key (optional - API works without key for basic usage)
const GOOGLE_FONTS_API_KEY = process.env.GOOGLE_FONTS_API_KEY || '';

/**
 * Search Google Fonts API
 * GET /api/fonts/search?q=query&limit=50
 */
router.get('/fonts/search', async (req, res) => {
  try {
    const { q: query = '', limit = 50 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    // Create cache key
    const cacheKey = `search_${query}_${limit}`;

    // Check cache first
    const cachedResult = fontCache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        fonts: cachedResult,
        cached: true
      });
    }

    // Build Google Fonts API URL
    const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`;

    // Fetch all fonts from Google Fonts API
    const response = await axios.get(apiUrl, { timeout: 10000 });

    if (!response.data || !response.data.items) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch fonts from Google Fonts API'
      });
    }

    const allFonts = response.data.items;

    // Filter fonts based on search query
    const filteredFonts = allFonts
      .filter(font => {
        const searchTerm = query.toLowerCase();
        const fontName = font.family.toLowerCase();
        const category = font.category?.toLowerCase() || '';

        return fontName.includes(searchTerm) ||
               category.includes(searchTerm) ||
               (font.variants && font.variants.some(v => v.includes(searchTerm)));
      })
      .slice(0, parseInt(limit))
      .map(font => ({
        family: font.family,
        category: font.category,
        variants: font.variants || [],
        subsets: font.subsets || [],
        version: font.version,
        lastModified: font.lastModified,
        files: font.files || {},
        // Generate Google Fonts CSS URL
        cssUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@${font.variants?.join(';') || '400'}&display=swap`
      }));

    // Cache the result
    fontCache.set(cacheKey, filteredFonts);

    res.json({
      success: true,
      fonts: filteredFonts,
      total: filteredFonts.length,
      cached: false
    });

  } catch (error) {
    console.error('Google Fonts API error:', error);

    // Return a fallback response with popular fonts if API fails
    const fallbackFonts = [
      { family: 'Roboto', category: 'sans-serif', variants: ['300', '400', '500', '700'] },
      { family: 'Open Sans', category: 'sans-serif', variants: ['300', '400', '600', '700'] },
      { family: 'Lato', category: 'sans-serif', variants: ['300', '400', '700', '900'] },
      { family: 'Montserrat', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
      { family: 'Poppins', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
      { family: 'Inter', category: 'sans-serif', variants: ['400', '500', '600', '700'] }
    ];

    res.json({
      success: true,
      fonts: fallbackFonts,
      total: fallbackFonts.length,
      cached: false,
      fallback: true,
      error: error.message
    });
  }
});

/**
 * Get font details by family name
 * GET /api/fonts/details?family=Font+Name
 */
router.get('/fonts/details', async (req, res) => {
  try {
    const { family } = req.query;

    if (!family) {
      return res.status(400).json({
        success: false,
        error: 'Font family name is required'
      });
    }

    // Create cache key
    const cacheKey = `details_${family}`;

    // Check cache first
    const cachedResult = fontCache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        font: cachedResult,
        cached: true
      });
    }

    // Build Google Fonts API URL
    const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}`;

    // Fetch all fonts
    const response = await axios.get(apiUrl, { timeout: 10000 });

    if (!response.data || !response.data.items) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch font details from Google Fonts API'
      });
    }

    // Find the specific font
    const font = response.data.items.find(f =>
      f.family.toLowerCase() === family.toLowerCase()
    );

    if (!font) {
      return res.status(404).json({
        success: false,
        error: `Font '${family}' not found`
      });
    }

    const fontDetails = {
      family: font.family,
      category: font.category,
      variants: font.variants || [],
      subsets: font.subsets || [],
      version: font.version,
      lastModified: font.lastModified,
      files: font.files || {},
      cssUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@${font.variants?.join(';') || '400'}&display=swap`
    };

    // Cache the result
    fontCache.set(cacheKey, fontDetails);

    res.json({
      success: true,
      font: fontDetails,
      cached: false
    });

  } catch (error) {
    console.error('Google Fonts API details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get popular/trending fonts
 * GET /api/fonts/popular?limit=20
 */
router.get('/fonts/popular', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Create cache key
    const cacheKey = `popular_${limit}`;

    // Check cache first
    const cachedResult = fontCache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        fonts: cachedResult,
        cached: true
      });
    }

    // Build Google Fonts API URL (sorted by popularity)
    const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`;

    // Fetch fonts sorted by popularity
    const response = await axios.get(apiUrl, { timeout: 10000 });

    if (!response.data || !response.data.items) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch popular fonts from Google Fonts API'
      });
    }

    const popularFonts = response.data.items
      .slice(0, parseInt(limit))
      .map(font => ({
        family: font.family,
        category: font.category,
        variants: font.variants || [],
        subsets: font.subsets || [],
        cssUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@${font.variants?.join(';') || '400'}&display=swap`
      }));

    // Cache the result
    fontCache.set(cacheKey, popularFonts);

    res.json({
      success: true,
      fonts: popularFonts,
      total: popularFonts.length,
      cached: false
    });

  } catch (error) {
    console.error('Google Fonts API popular error:', error);

    // Return fallback popular fonts
    const fallbackFonts = [
      { family: 'Roboto', category: 'sans-serif', variants: ['300', '400', '500', '700'] },
      { family: 'Open Sans', category: 'sans-serif', variants: ['300', '400', '600', '700'] },
      { family: 'Lato', category: 'sans-serif', variants: ['300', '400', '700', '900'] },
      { family: 'Montserrat', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
      { family: 'Poppins', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
      { family: 'Inter', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
      { family: 'Oswald', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
      { family: 'Raleway', category: 'sans-serif', variants: ['400', '500', '600', '700'] }
    ];

    res.json({
      success: true,
      fonts: fallbackFonts.slice(0, parseInt(limit)),
      total: Math.min(fallbackFonts.length, parseInt(limit)),
      cached: false,
      fallback: true,
      error: error.message
    });
  }
});

module.exports = router;