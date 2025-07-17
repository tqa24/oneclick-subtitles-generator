/**
 * Progress indicator utility for long-running operations
 * Shows animated progress while hiding verbose output
 */

const { spawn } = require('child_process');
const { Logger } = require('./logger');

class ProgressIndicator {
    constructor(options = {}) {
        this.logger = new Logger(options);
        this.interval = null;
        this.startTime = null;
        this.dots = 0;
        this.maxDots = 3;
        this.message = '';
    }

    start(message) {
        this.message = message;
        this.startTime = Date.now();
        this.dots = 0;
        
        // Show initial message
        process.stdout.write(`${this.logger.getIcon('progress')} ${message}`);
        
        // Start animation
        this.interval = setInterval(() => {
            this.updateProgress();
        }, 500);
    }

    updateProgress() {
        // Clear current line and rewrite with updated dots
        process.stdout.write('\r');
        
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const dotString = '.'.repeat(this.dots + 1);
        const spaces = ' '.repeat(this.maxDots - this.dots);
        
        process.stdout.write(`${this.logger.getIcon('progress')} ${this.message}${dotString}${spaces} (${elapsed}s)`);
        
        this.dots = (this.dots + 1) % (this.maxDots + 1);
    }

    stop(success = true, finalMessage = null) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        // Clear the line
        process.stdout.write('\r');
        
        // Show final message
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const icon = success ? this.logger.getIcon('success') : this.logger.getIcon('error');
        const color = success ? 'green' : 'red';
        const message = finalMessage || (success ? `${this.message} completed` : `${this.message} failed`);
        
        console.log(this.logger.colorize(`${icon} ${message} (${elapsed}s)`, color));
    }
}

/**
 * Execute a command with progress indicator
 * @param {string} command - Command to execute
 * @param {string} message - Progress message to show
 * @param {object} options - Execution options
 * @returns {Promise} - Promise that resolves when command completes
 */
function executeWithProgress(command, message, options = {}) {
    return new Promise((resolve, reject) => {
        const logger = new Logger(options);
        const progress = new ProgressIndicator(options);
        
        // Start progress indicator
        progress.start(message);
        
        // Parse command
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        
        // Execute command
        const child = spawn(cmd, args, {
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: true,
            ...options
        });

        let stdout = '';
        let stderr = '';

        // Capture output but don't display it unless in verbose mode
        child.stdout.on('data', (data) => {
            stdout += data.toString();
            if (logger.verboseMode) {
                process.stdout.write(data);
            }
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
            if (logger.verboseMode) {
                process.stderr.write(data);
            }
        });

        child.on('close', (code) => {
            if (code === 0) {
                progress.stop(true);
                resolve({ stdout, stderr, code });
            } else {
                progress.stop(false);
                reject(new Error(`Command failed with code ${code}\nStderr: ${stderr}`));
            }
        });

        child.on('error', (error) => {
            progress.stop(false);
            reject(error);
        });
    });
}

/**
 * Execute multiple commands in sequence with progress
 * @param {Array} commands - Array of {command, message} objects
 * @param {object} options - Execution options
 * @returns {Promise} - Promise that resolves when all commands complete
 */
async function executeSequenceWithProgress(commands, options = {}) {
    const results = [];
    
    for (let i = 0; i < commands.length; i++) {
        const { command, message } = commands[i];
        try {
            const result = await executeWithProgress(command, message, options);
            results.push(result);
        } catch (error) {
            throw new Error(`Step ${i + 1} failed: ${error.message}`);
        }
    }
    
    return results;
}

/**
 * Show a spinner for async operations
 * @param {Promise} promise - Promise to wait for
 * @param {string} message - Message to show
 * @param {object} options - Options
 * @returns {Promise} - The original promise
 */
function withSpinner(promise, message, options = {}) {
    const progress = new ProgressIndicator(options);
    progress.start(message);
    
    return promise
        .then((result) => {
            progress.stop(true);
            return result;
        })
        .catch((error) => {
            progress.stop(false);
            throw error;
        });
}

module.exports = {
    ProgressIndicator,
    executeWithProgress,
    executeSequenceWithProgress,
    withSpinner
};
