/**
 * Controller for narration generation and status
 */

// Import narration service client
const narrationServiceClient = require('../../services/narrationServiceClient');

// Import directory manager
const { clearNarrationOutputFiles } = require('./directoryManager');

/**
 * Generate narration
 */
const generateNarration = async (req, res) => {
  console.log('Received generate request');

  // Check if we should skip clearing the output directory
  // This is used for retrying a single narration to avoid deleting all other narrations
  const skipClearOutput = req.body.settings && req.body.settings.skipClearOutput === true;

  if (!skipClearOutput) {
    // Clear all existing narration output files for fresh generation
    console.log('Clearing all narration output files for fresh generation');
    clearNarrationOutputFiles();
  } else {
    console.log('CRITICAL FIX: Skipping clearing narration output files for retry');
  }

  try {
    const { reference_audio, reference_text, subtitles, settings } = req.body;

    console.log(`Generating narration for ${subtitles.length} subtitles`);
    console.log(`Reference audio: ${reference_audio}`);
    console.log(`Reference text: ${reference_text}`);

    // Check if the narration service is available
    const serviceStatus = await narrationServiceClient.checkService(20, 10000);

    if (!serviceStatus.available) {
      console.log('Narration service is required but not available');
      return res.status(503).json({
        success: false,
        error: 'Narration service is not available. Please use npm run dev:cuda to start with Python narration service.'
      });
    }

    // Generate narration using the service client
    try {
      const result = await narrationServiceClient.generateNarration(
        reference_audio,
        reference_text,
        subtitles,
        settings || {},
        res // Pass response object for streaming support
      );

      // If the result is null, it means we're handling streaming in the client
      if (result !== null) {
        return res.json(result);
      }
      // Otherwise, the response is being handled by the streaming logic
    } catch (error) {
      console.error(`Error using narration service: ${error.message}`);
      return res.status(503).json({
        success: false,
        error: `Error connecting to narration service: ${error.message}. Please restart the application with npm run dev:cuda.`
      });
    }
  } catch (error) {
    console.error('Error generating narration:', error);
    res.status(500).json({ error: `Error generating narration: ${error.message}` });
  }
};

/**
 * Get narration service status
 */
const getNarrationStatus = async (req, res) => {
  // Check the narration service with multiple attempts
  const serviceStatus = await narrationServiceClient.checkService(20, 10000);

  // Store the status for other parts of the application
  req.app.set('narrationServiceRunning', serviceStatus.available);
  req.app.set('narrationServiceDevice', serviceStatus.device);
  req.app.set('narrationServiceGpuInfo', serviceStatus.gpu_info);

  res.json({
    available: serviceStatus.available,
    device: serviceStatus.device,
    source: serviceStatus.available ? 'actual' : 'none',
    actualPort: narrationServiceClient.getNarrationPort(),
    gpu_info: serviceStatus.gpu_info
  });
};

module.exports = {
  generateNarration,
  getNarrationStatus
};
