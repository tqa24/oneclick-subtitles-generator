/**
 * Unified CORS Configuration for Video Renderer Service
 * This ensures consistent CORS settings with the main application
 */

// Unified Port Configuration - matches main server/config.js
const PORTS = {
  FRONTEND: parseInt(process.env.FRONTEND_PORT as string) || 3030,
  BACKEND: parseInt(process.env.BACKEND_PORT as string) || 3031,
  WEBSOCKET: parseInt(process.env.WEBSOCKET_PORT as string) || 3032,
  VIDEO_RENDERER: parseInt(process.env.VIDEO_RENDERER_PORT as string) || 3033,
  VIDEO_RENDERER_FRONTEND: parseInt(process.env.VIDEO_RENDERER_FRONTEND_PORT as string) || 3034,
  NARRATION: parseInt(process.env.NARRATION_PORT as string) || 3035,
  CHATTERBOX: parseInt(process.env.CHATTERBOX_PORT as string) || 3036
};

/**
 * Generate allowed origins for CORS based on unified port configuration
 * Includes both localhost and 127.0.0.1 for maximum compatibility
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  
  // Add all service ports with both localhost and 127.0.0.1
  Object.values(PORTS).forEach(port => {
    origins.push(`http://localhost:${port}`);
    origins.push(`http://127.0.0.1:${port}`);
  });
  
  return origins;
}

/**
 * Standard CORS configuration for Express.js services
 */
export const EXPRESS_CORS_CONFIG = {
  origin: getAllowedOrigins(),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: true,
  exposedHeaders: ['X-Render-ID']
};

export { getAllowedOrigins, PORTS };
