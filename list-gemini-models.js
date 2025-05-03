/**
 * Script to list available Gemini models and their capabilities
 * Run with: node list-gemini-models.js YOUR_API_KEY
 */

const https = require('https');

// Get API key from command line argument
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('Please provide your Gemini API key as a command line argument');
  console.error('Usage: node list-gemini-models.js YOUR_API_KEY');
  process.exit(1);
}

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

// Main function to list models
async function listModels() {
  try {
    console.log('Fetching Gemini models...');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const data = await httpsRequest(url);
    
    if (data.error) {
      console.error(`Error: ${data.error.message}`);
      return;
    }
    
    if (!data.models || data.models.length === 0) {
      console.log('No models found.');
      return;
    }
    
    // Sort models by name
    data.models.sort((a, b) => a.name.localeCompare(b.name));
    
    // Count WebSocket compatible models
    const compatibleModels = data.models.filter(model => 
      model.supportedGenerationMethods && 
      model.supportedGenerationMethods.includes('generateContent') && 
      model.supportedGenerationMethods.includes('streamGenerateContent')
    );
    
    console.log(`Found ${data.models.length} models, ${compatibleModels.length} compatible with WebSocket API.`);
    console.log('');
    
    // Display models
    data.models.forEach(model => {
      const modelName = model.name.split('/').pop();
      const isWebSocketCompatible = 
        model.supportedGenerationMethods && 
        model.supportedGenerationMethods.includes('generateContent') && 
        model.supportedGenerationMethods.includes('streamGenerateContent');
      
      console.log(`Model: ${modelName}`);
      console.log(`Display Name: ${model.displayName || 'N/A'}`);
      console.log(`Version: ${model.version || 'N/A'}`);
      console.log(`WebSocket Compatible: ${isWebSocketCompatible ? 'Yes' : 'No'}`);
      
      if (model.supportedGenerationMethods && model.supportedGenerationMethods.length > 0) {
        console.log('Supported Generation Methods:');
        model.supportedGenerationMethods.forEach(method => {
          console.log(`  - ${method}`);
        });
      } else {
        console.log('No generation methods specified');
      }
      
      console.log(''); // Empty line for separation
    });
    
    // List WebSocket compatible models
    console.log('WebSocket Compatible Models:');
    compatibleModels.forEach(model => {
      const modelName = model.name.split('/').pop();
      console.log(`  - ${modelName}`);
    });
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Run the main function
listModels();
