/**
 * Wrapper script to run npm commands with reduced verbosity and cleaner output
 * Filters out common npm warnings and deprecation notices that are not actionable
 */

const { spawn } = require('child_process');
const { Logger } = require('./logger');

const logger = new Logger({ 
    verbose: process.env.VERBOSE === 'true',
    quiet: process.env.QUIET === 'true'
});

// Common npm warnings to filter out (these are typically not actionable for end users)
const FILTERED_WARNINGS = [
    'npm warn deprecated',
    'npm WARN deprecated',
    'npm warn EBADENGINE',
    'npm WARN EBADENGINE',
    'npm warn ERESOLVE',
    'npm WARN ERESOLVE',
    'npm warn audit',
    'npm WARN audit',
    'npm fund',
    'npm audit',
    'found 0 vulnerabilities',
    'packages are looking for funding',
    'run `npm fund` for details',
    'run `npm audit` for details',
    'To address all issues',
    'Run `npm audit` for details'
];

// Critical warnings that should always be shown
const CRITICAL_WARNINGS = [
    'ENOENT',
    'EACCES',
    'EPERM',
    'MODULE_NOT_FOUND',
    'Cannot resolve dependency',
    'peer dep missing',
    'UNMET DEPENDENCY'
];

function shouldFilterLine(line) {
    const lowerLine = line.toLowerCase();
    
    // Always show critical warnings
    if (CRITICAL_WARNINGS.some(critical => lowerLine.includes(critical.toLowerCase()))) {
        return false;
    }
    
    // Filter out common non-actionable warnings
    return FILTERED_WARNINGS.some(warning => lowerLine.includes(warning.toLowerCase()));
}

function filterNpmOutput(data) {
    const lines = data.toString().split('\n');
    const filteredLines = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !shouldFilterLine(trimmedLine)) {
            filteredLines.push(line);
        }
    }
    
    return filteredLines.join('\n');
}

function runNpmCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
        // Add --silent flag to reduce npm's own verbosity
        const npmArgs = ['--silent', ...args];
        
        logger.command(`npm ${args.join(' ')}`);
        
        const npmProcess = spawn('npm', npmArgs, {
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: true,
            ...options
        });

        let stdout = '';
        let stderr = '';

        npmProcess.stdout.on('data', (data) => {
            const filtered = filterNpmOutput(data);
            if (filtered.trim()) {
                stdout += filtered;
                if (!logger.quietMode) {
                    process.stdout.write(filtered);
                }
            }
        });

        npmProcess.stderr.on('data', (data) => {
            const filtered = filterNpmOutput(data);
            if (filtered.trim()) {
                stderr += filtered;
                if (!logger.quietMode) {
                    process.stderr.write(filtered);
                }
            }
        });

        npmProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr, code });
            } else {
                reject(new Error(`npm command failed with code ${code}`));
            }
        });

        npmProcess.on('error', (error) => {
            reject(error);
        });
    });
}

// If this script is run directly, execute the npm command with the provided arguments
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        logger.error('No npm command provided');
        logger.info('Usage: node npm-quiet.js <npm-command> [args...]');
        logger.info('Example: node npm-quiet.js install');
        process.exit(1);
    }

    // Show a nice progress message based on the command
    const command = args[0];
    let progressMessage = 'Running npm command';

    switch (command) {
        case 'install':
        case 'i':
            progressMessage = 'Installing Node.js dependencies';
            break;
        case 'update':
            progressMessage = 'Updating Node.js dependencies';
            break;
        case 'audit':
            progressMessage = 'Checking for security vulnerabilities';
            break;
        case 'run':
            progressMessage = `Running npm script: ${args[1] || 'unknown'}`;
            break;
        default:
            progressMessage = `Running npm ${command}`;
    }

    logger.progress(progressMessage);

    runNpmCommand(args)
        .then(() => {
            switch (command) {
                case 'install':
                case 'i':
                    logger.success('Node.js dependencies installed successfully');
                    break;
                case 'update':
                    logger.success('Node.js dependencies updated successfully');
                    break;
                case 'audit':
                    logger.success('Security check completed');
                    break;
                default:
                    logger.success('npm command completed successfully');
            }
        })
        .catch((error) => {
            logger.error(`npm command failed: ${error.message}`);
            process.exit(1);
        });
}

module.exports = {
    runNpmCommand,
    filterNpmOutput,
    shouldFilterLine
};
