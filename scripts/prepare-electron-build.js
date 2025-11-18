#!/usr/bin/env node
/**
 * Prepare the Electron build by copying the working .venv to bin/python-wheelhouse
 * This ensures the packaged app has all Python dependencies properly installed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logger = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    warning: (msg) => console.warn(`⚠️  ${msg}`),
};

const VENV_SOURCE = path.join(__dirname, '../.venv');
const WHEELHOUSE_TARGET = path.join(__dirname, '../bin/python-wheelhouse');

async function copyVenv() {
    logger.info('Preparing Python environment for Electron build...');

    // Check if source .venv exists
    if (!fs.existsSync(VENV_SOURCE)) {
        logger.error(`.venv not found at ${VENV_SOURCE}`);
        logger.info('Please run: npm run setup:narration:uv');
        process.exit(1);
    }

    logger.info(`Source .venv found at ${VENV_SOURCE}`);

    // Ensure wheelhouse directory exists
    if (!fs.existsSync(WHEELHOUSE_TARGET)) {
        fs.mkdirSync(WHEELHOUSE_TARGET, { recursive: true });
    }

    // Check if venv already exists in wheelhouse
    const wheelhouseVenv = path.join(WHEELHOUSE_TARGET, 'venv');
    if (fs.existsSync(wheelhouseVenv)) {
        logger.info('Removing old wheelhouse venv...');
        try {
            fs.rmSync(wheelhouseVenv, { recursive: true, force: true });
        } catch (error) {
            logger.warning(`Could not remove old venv: ${error.message}`);
        }
    }

    // Copy .venv to bin/python-wheelhouse/venv
    logger.info(`Copying .venv to ${wheelhouseVenv}...`);
    try {
        // Use a simple copy approach with progress
        fs.cpSync(VENV_SOURCE, wheelhouseVenv, { 
            recursive: true,
            force: true,
        });
        logger.success('Python environment copied successfully');
    } catch (error) {
        logger.error(`Failed to copy venv: ${error.message}`);
        process.exit(1);
    }

    // Verify the copy
    const pythonExe = path.join(wheelhouseVenv, 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExe)) {
        logger.error(`Verification failed: ${pythonExe} not found`);
        process.exit(1);
    }

    logger.success('Verification passed: python.exe found in wheelhouse');

    // Verify key packages are available
    logger.info('Verifying critical packages...');
    try {
        const verifyCmd = `"${pythonExe}" -c "import flask; import uvicorn; import torch; print('All packages verified')"`;
        execSync(verifyCmd, { stdio: 'inherit' });
        logger.success('All packages verified');
    } catch (error) {
        logger.error('Package verification failed');
        logger.info('Required packages: flask, uvicorn, torch');
        logger.info('Run: npm run setup:narration:uv');
        process.exit(1);
    }

    logger.success('Electron build preparation completed successfully!');
}

copyVenv().catch((error) => {
    logger.error(`Setup failed: ${error.message}`);
    process.exit(1);
});
