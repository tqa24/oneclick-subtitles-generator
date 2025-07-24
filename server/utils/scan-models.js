/**
 * Simple model scanner - scans models/f5_tts directory and updates registry
 * No Python, no Flask, no bullshit - just simple file operations
 */

const fs = require('fs');
const path = require('path');

// Paths (relative to project root)
const MODELS_DIR = path.join(__dirname, '..', '..', 'models', 'f5_tts');
const REGISTRY_FILE = path.join(MODELS_DIR, 'models_registry.json');

function scanModels() {
    try {
        // Check if models directory exists
        if (!fs.existsSync(MODELS_DIR)) {
            console.log('❌ Models directory not found:', MODELS_DIR);
            return false;
        }

        // Read current registry
        let registry = { models: [] };
        if (fs.existsSync(REGISTRY_FILE)) {
            try {
                const registryData = fs.readFileSync(REGISTRY_FILE, 'utf8');
                registry = JSON.parse(registryData);
            } catch (e) {
                console.log('⚠️ Error reading registry, starting fresh:', e.message);
            }
        } else {
            console.log('📋 No existing registry found, creating new one');
        }

        // Get existing model IDs
        const existingIds = new Set((registry.models || []).map(m => m.id));

        // Scan directory
        const items = fs.readdirSync(MODELS_DIR);

        let newModelsFound = 0;

        for (const item of items) {
            const itemPath = path.join(MODELS_DIR, item);
            
            // Skip files, only process directories
            if (!fs.statSync(itemPath).isDirectory()) {
                continue;
            }

            // Skip if already in registry
            if (existingIds.has(item)) {
                console.log(`⏭️ Skipping ${item} - already in registry`);
                continue;
            }

            console.log(`🔍 Checking directory: ${item}`);

            // Look for model and vocab files
            const files = fs.readdirSync(itemPath);
            console.log(`📋 Files in ${item}:`, files);

            let modelFile = null;
            let vocabFile = null;

            for (const file of files) {
                const filePath = path.join(itemPath, file);
                if (fs.statSync(filePath).isFile()) {
                    if (file.endsWith('.safetensors') || file.endsWith('.pt') || file.endsWith('.pth')) {
                        modelFile = filePath;
                        console.log(`🎯 Found model file: ${file}`);
                    } else if (file === 'vocab.txt') {
                        vocabFile = filePath;
                        console.log(`📝 Found vocab file: ${file}`);
                    }
                }
            }

            // Add model if both files found
            if (modelFile && vocabFile) {
                const modelInfo = {
                    id: item,
                    name: item.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    repo_id: `local/${item}`,
                    model_path: path.resolve(modelFile),
                    vocab_path: path.resolve(vocabFile),
                    config: {},
                    source: "local",
                    language: "en",
                    languages: ["en"],
                    is_symlink: false,
                    original_model_file: null,
                    original_vocab_file: null
                };

                registry.models = registry.models || [];
                registry.models.push(modelInfo);
                newModelsFound++;
                console.log(`✅ Added model: ${item}`);
            } else {
                console.log(`⚠️ Skipping ${item} - missing files (model: ${!!modelFile}, vocab: ${!!vocabFile})`);
            }
        }

        // Save registry if changes were made
        if (newModelsFound > 0) {
            // Create backup
            const backupFile = REGISTRY_FILE + '.backup';
            if (fs.existsSync(REGISTRY_FILE)) {
                fs.copyFileSync(REGISTRY_FILE, backupFile);
                console.log('📋 Created backup:', backupFile);
            }

            // Save updated registry
            fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
            console.log(`💾 Saved registry with ${newModelsFound} new models`);
            console.log(`🎉 Success! Found and added ${newModelsFound} new models`);
            
            // List all models
            console.log('\n📊 All models in registry:');
            registry.models.forEach((model, index) => {
                console.log(`   ${index + 1}. ${model.id} - ${model.name}`);
            });
            
            return true;
        } else {
            return true;
        }

    } catch (error) {
        console.error('💥 Error scanning models:', error.message);
        return false;
    }
}

module.exports = { scanModels };
