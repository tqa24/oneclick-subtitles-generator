/**
 * Controller for reference audio recording and uploading
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeMoveFileSync } = require('../../utils/fileOperations');

// Import directory paths
const { REFERENCE_AUDIO_DIR } = require('./directoryManager');

/**
 * Record reference audio
 */
const recordReference = (req, res) => {
  console.log('Received record-reference request');

  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No audio data' });
  }

  console.log('File uploaded successfully:', req.file);

  try {
    // Generate a unique filename
    const unique_id = uuidv4();
    const filename = `recorded_${unique_id}.wav`;
    const filepath = path.join(REFERENCE_AUDIO_DIR, filename);

    // Copy the file instead of renaming to avoid EPERM errors on Windows
    safeMoveFileSync(req.file.path, filepath);

    // Get reference text if provided
    const reference_text = req.body.reference_text || '';

    // We're now handling transcription directly in the frontend
    console.log('Transcription is handled in frontend');

    // Return success response
    res.json({
      success: true,
      filepath: filepath,
      filename: filename,
      reference_text: reference_text,
      transcribe: false // Indicate that transcription is handled in the frontend
    });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    res.status(500).json({ error: 'Error processing uploaded file' });
  }
};

/**
 * Upload reference audio
 */
const uploadReference = (req, res) => {
  console.log('Received upload-reference request');

  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file part' });
  }

  console.log('File uploaded successfully:', req.file);

  try {
    // Generate a unique filename
    const unique_id = uuidv4();
    const filename = `uploaded_${unique_id}.wav`;
    const filepath = path.join(REFERENCE_AUDIO_DIR, filename);

    // Copy the file instead of renaming to avoid EPERM errors on Windows
    safeMoveFileSync(req.file.path, filepath);

    // Get reference text if provided
    const reference_text = req.body.reference_text || '';

    // We're now handling transcription directly in the frontend
    console.log('Transcription is handled in frontend');

    // Return success response
    res.json({
      success: true,
      filepath: filepath,
      filename: filename,
      reference_text: reference_text,
      transcribe: false // Indicate that transcription is handled in the frontend
    });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    res.status(500).json({ error: 'Error processing uploaded file' });
  }
};

module.exports = {
  recordReference,
  uploadReference
};
