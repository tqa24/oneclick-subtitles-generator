/**
 * Test route for serving audio files
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Test endpoint to serve a simple audio file
router.get('/test-audio', (req, res) => {
  // Create a simple WAV file with a sine wave
  const sampleRate = 44100;
  const duration = 2; // seconds
  const frequency = 440; // Hz (A4 note)
  
  const numSamples = sampleRate * duration;
  const buffer = Buffer.alloc(44 + numSamples * 2); // 44 bytes header + 2 bytes per sample
  
  // Write WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4); // File size - 8
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Format chunk size
  buffer.writeUInt16LE(1, 20); // Audio format (PCM)
  buffer.writeUInt16LE(1, 22); // Number of channels
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buffer.writeUInt16LE(2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40); // Data chunk size
  
  // Write audio data (sine wave)
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 32767;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }
  
  // Set the content type header
  res.setHeader('Content-Type', 'audio/wav');
  
  // Send the buffer
  res.send(buffer);
});

module.exports = router;
