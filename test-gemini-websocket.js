/**
 * Script to test WebSocket connection with Gemini models
 * Run with: node test-gemini-websocket.js YOUR_API_KEY MODEL_NAME
 */

const WebSocket = require('ws');
const https = require('https');

// Get API key and model name from command line arguments
const apiKey = process.argv[2];
const modelName = process.argv[3] || 'gemini-1.5-flash';

if (!apiKey) {
  console.error('Please provide your Gemini API key as a command line argument');
  console.error('Usage: node test-gemini-websocket.js YOUR_API_KEY [MODEL_NAME]');
  process.exit(1);
}

console.log(`Testing WebSocket connection with model: ${modelName}`);

// Function to make an HTTPS request
function httpsRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject(new Error(`Error parsing response: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Function to test WebSocket connection
async function testWebSocketConnection() {
  try {
    // First, check if the model exists
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}?key=${apiKey}`;
    
    try {
      const modelData = await httpsRequest(url);
      console.log('Model information:');
      console.log(`- Name: ${modelData.name}`);
      console.log(`- Display Name: ${modelData.displayName || 'N/A'}`);
      console.log(`- Supported Generation Methods: ${modelData.supportedGenerationMethods?.join(', ') || 'None'}`);
      
      const isWebSocketCompatible = 
        modelData.supportedGenerationMethods && 
        modelData.supportedGenerationMethods.includes('generateContent') && 
        modelData.supportedGenerationMethods.includes('streamGenerateContent');
      
      console.log(`- WebSocket Compatible: ${isWebSocketCompatible ? 'Yes' : 'No'}`);
      
      if (!isWebSocketCompatible) {
        console.warn('Warning: This model may not be compatible with WebSocket API');
      }
    } catch (error) {
      console.error(`Error fetching model information: ${error.message}`);
      console.log('Continuing with WebSocket test anyway...');
    }
    
    // Create WebSocket connection
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('WebSocket connection opened');
      
      // Send setup message
      const setupMessage = {
        setup: {
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 1024,
            responseModalities: "audio",
            speechConfig: {
              voiceConfig: { 
                prebuiltVoiceConfig: { 
                  voiceName: "Aoede"
                } 
              },
            }
          },
          systemInstruction: {
            parts: [
              { text: "you are a narrator, when user tells you to read something only read it, do not say anything else" }
            ]
          }
        }
      };
      
      console.log('Sending setup message...');
      ws.send(JSON.stringify(setupMessage));
    });
    
    ws.on('message', async (data) => {
      try {
        // Parse the message
        const message = JSON.parse(data);
        console.log('Received message:', JSON.stringify(message, null, 2));
        
        // Check for setup complete
        if (message.setupComplete) {
          console.log('Setup complete, sending test prompt...');
          
          // Send a test prompt
          const promptMessage = {
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [
                    { text: "Read this sentence in English: \"This is a test of the Gemini WebSocket API.\"" }
                  ]
                }
              ],
              turnComplete: true
            }
          };
          
          ws.send(JSON.stringify(promptMessage));
        }
        
        // Check for audio content
        if (message.serverContent && message.serverContent.modelTurn) {
          const parts = message.serverContent.modelTurn.parts;
          
          // Check for audio parts
          const audioParts = parts.filter(
            (p) => p.inlineData && p.inlineData.mimeType && p.inlineData.mimeType.startsWith('audio/')
          );
          
          if (audioParts.length > 0) {
            console.log(`Received ${audioParts.length} audio parts`);
            console.log('Audio generation successful!');
            
            // Close the connection after receiving audio
            setTimeout(() => {
              console.log('Test completed successfully');
              ws.close();
              process.exit(0);
            }, 1000);
          }
          
          // Check for text parts
          const textParts = parts.filter(p => p.text);
          if (textParts.length > 0) {
            console.log('Received text response:', textParts.map(p => p.text).join(' '));
          }
        }
        
        // Check for turn complete
        if (message.serverContent && message.serverContent.turnComplete) {
          console.log('Turn complete');
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed with code ${code}${reason ? ` and reason: ${reason}` : ''}`);
      process.exit(0);
    });
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the test
testWebSocketConnection();
