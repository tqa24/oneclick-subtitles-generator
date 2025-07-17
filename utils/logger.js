/**
 * Centralized logging utility for OneClick Subtitles Generator
 * Provides consistent, colorful, and user-friendly logging across all scripts
 */

const os = require('os');

// ANSI color codes for cross-platform color support
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Text colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
};

// Icons for different log levels
const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    progress: '🔄',
    search: '🔍',
    install: '🔧',
    rocket: '🚀',
    package: '📦',
    folder: '📁',
    file: '📄',
    gear: '⚙️',
    checkmark: '✓',
    cross: '✗',
    arrow: '→',
    bullet: '•'
};

// Fallback icons for systems that don't support Unicode
const fallbackIcons = {
    success: '[OK]',
    error: '[ERROR]',
    warning: '[WARN]',
    info: '[INFO]',
    progress: '[...]',
    search: '[?]',
    install: '[SETUP]',
    rocket: '[START]',
    package: '[PKG]',
    folder: '[DIR]',
    file: '[FILE]',
    gear: '[CFG]',
    checkmark: '[+]',
    cross: '[-]',
    arrow: '->',
    bullet: '*'
};

class Logger {
    constructor(options = {}) {
        this.verboseMode = options.verbose || process.env.VERBOSE === 'true';
        this.quietMode = options.quiet || process.env.QUIET === 'true';
        this.useColors = options.colors !== false && this.supportsColor();
        this.useUnicode = options.unicode !== false && this.supportsUnicode();
        this.prefix = options.prefix || '';
    }

    supportsColor() {
        // Check if terminal supports colors
        if (process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS) {
            return false;
        }
        
        if (process.env.FORCE_COLOR) {
            return true;
        }
        
        if (process.platform === 'win32') {
            // Windows 10 and later support ANSI colors
            const version = os.release().split('.');
            return parseInt(version[0]) >= 10;
        }
        
        return process.stdout.isTTY;
    }

    supportsUnicode() {
        // Check if terminal supports Unicode
        if (process.env.NO_UNICODE) {
            return false;
        }
        
        if (process.platform === 'win32') {
            // Windows Command Prompt has limited Unicode support
            return process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode';
        }
        
        return true;
    }

    colorize(text, color) {
        if (!this.useColors) return text;
        return `${colors[color] || ''}${text}${colors.reset}`;
    }

    getIcon(iconName) {
        const iconSet = this.useUnicode ? icons : fallbackIcons;
        return iconSet[iconName] || iconSet.bullet;
    }

    formatMessage(level, message, icon = null) {
        const timestamp = new Date().toLocaleTimeString();
        const iconStr = icon ? `${this.getIcon(icon)} ` : '';
        const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
        
        if (this.verboseMode) {
            return `${this.colorize(timestamp, 'dim')} ${prefixStr}${iconStr}${message}`;
        } else {
            return `${prefixStr}${iconStr}${message}`;
        }
    }

    // Main logging methods
    success(message, details = null) {
        if (this.quietMode) return;
        console.log(this.colorize(this.formatMessage('success', message, 'success'), 'green'));
        if (details && this.verboseMode) {
            console.log(this.colorize(`   ${details}`, 'dim'));
        }
    }

    error(message, details = null) {
        console.error(this.colorize(this.formatMessage('error', message, 'error'), 'red'));
        if (details) {
            console.error(this.colorize(`   ${details}`, 'dim'));
        }
    }

    warning(message, details = null) {
        if (this.quietMode) return;
        console.warn(this.colorize(this.formatMessage('warning', message, 'warning'), 'yellow'));
        if (details && this.verboseMode) {
            console.warn(this.colorize(`   ${details}`, 'dim'));
        }
    }

    info(message, details = null) {
        if (this.quietMode) return;
        console.log(this.colorize(this.formatMessage('info', message, 'info'), 'cyan'));
        if (details && this.verboseMode) {
            console.log(this.colorize(`   ${details}`, 'dim'));
        }
    }

    progress(message, details = null) {
        if (this.quietMode) return;
        console.log(this.colorize(this.formatMessage('progress', message, 'progress'), 'blue'));
        if (details && this.verboseMode) {
            console.log(this.colorize(`   ${details}`, 'dim'));
        }
    }

    // Specialized logging methods
    step(stepNumber, totalSteps, message) {
        if (this.quietMode) return;
        const stepInfo = totalSteps ? `[${stepNumber}/${totalSteps}]` : `[${stepNumber}]`;
        console.log(this.colorize(`${stepInfo} ${this.getIcon('arrow')} ${message}`, 'cyan'));
    }

    section(title) {
        if (this.quietMode) return;
        const separator = '='.repeat(Math.min(title.length + 4, 60));
        console.log(this.colorize(`\n${separator}`, 'magenta'));
        console.log(this.colorize(`  ${title}`, 'magenta'));
        console.log(this.colorize(`${separator}`, 'magenta'));
    }

    subsection(title) {
        if (this.quietMode) return;
        console.log(this.colorize(`\n--- ${title} ---`, 'blue'));
    }

    command(command, description = null) {
        if (this.verboseMode) {
            console.log(this.colorize(`${this.getIcon('gear')} Running: ${command}`, 'dim'));
            if (description) {
                console.log(this.colorize(`   ${description}`, 'dim'));
            }
        }
    }

    // Installation-specific methods
    checking(what) {
        if (this.quietMode) return;
        console.log(this.formatMessage('checking', `Checking ${what}...`, 'search'));
    }

    installing(what) {
        if (this.quietMode) return;
        console.log(this.colorize(this.formatMessage('installing', `Installing ${what}...`, 'install'), 'blue'));
    }

    found(what, version = null) {
        if (this.quietMode) return;
        const versionStr = version ? ` (${version})` : '';
        console.log(this.colorize(this.formatMessage('found', `${what} found${versionStr}`, 'checkmark'), 'green'));
    }

    notFound(what) {
        console.log(this.colorize(this.formatMessage('notFound', `${what} not found`, 'cross'), 'yellow'));
    }

    // Utility methods
    newLine() {
        if (!this.quietMode) console.log('');
    }

    raw(message) {
        console.log(message);
    }

    // Create a child logger with a prefix
    child(prefix) {
        return new Logger({
            verbose: this.verboseMode,
            quiet: this.quietMode,
            colors: this.useColors,
            unicode: this.useUnicode,
            prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix
        });
    }

    // Progress tracking methods
    startProgress(message) {
        if (this.quietMode) return;
        process.stdout.write(this.colorize(`${this.getIcon('progress')} ${message}`, 'blue'));
    }

    updateProgress(char = '.') {
        if (this.quietMode) return;
        process.stdout.write(this.colorize(char, 'blue'));
    }

    endProgress(result = 'done') {
        if (this.quietMode) return;
        console.log(this.colorize(` ${result}`, 'green'));
    }

    // Summary methods
    summary(title, items) {
        if (this.quietMode) return;
        this.newLine();
        console.log(this.colorize(`${this.getIcon('checkmark')} ${title}:`, 'green'));
        items.forEach(item => {
            console.log(this.colorize(`   ${this.getIcon('bullet')} ${item}`, 'dim'));
        });
    }

    // Error summary
    errorSummary(title, errors) {
        this.newLine();
        console.log(this.colorize(`${this.getIcon('error')} ${title}:`, 'red'));
        errors.forEach(error => {
            console.log(this.colorize(`   ${this.getIcon('bullet')} ${error}`, 'red'));
        });
    }

    // Table-like output for status
    status(items) {
        if (this.quietMode) return;
        const maxLength = Math.max(...items.map(item => item.name.length));
        items.forEach(item => {
            const padding = ' '.repeat(maxLength - item.name.length + 2);
            const statusIcon = item.status === 'ok' ? this.getIcon('success') :
                              item.status === 'error' ? this.getIcon('error') :
                              this.getIcon('warning');
            const statusColor = item.status === 'ok' ? 'green' :
                               item.status === 'error' ? 'red' : 'yellow';

            console.log(`${item.name}${padding}${this.colorize(statusIcon, statusColor)} ${item.message || ''}`);
        });
    }

    // Spinner-like progress (for long operations)
    spinner(message, promise) {
        if (this.quietMode) {
            return promise;
        }

        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        const fallbackFrames = ['|', '/', '-', '\\'];
        const spinnerFrames = this.useUnicode ? frames : fallbackFrames;

        let i = 0;
        process.stdout.write(`${message} `);

        const interval = setInterval(() => {
            process.stdout.write(`\r${message} ${this.colorize(spinnerFrames[i], 'blue')}`);
            i = (i + 1) % spinnerFrames.length;
        }, 100);

        return promise.finally(() => {
            clearInterval(interval);
            process.stdout.write(`\r${message} ${this.colorize(this.getIcon('success'), 'green')}\n`);
        });
    }
}

// Create default logger instance
const defaultLogger = new Logger();

// Export both the class and default instance
module.exports = {
    Logger,
    logger: defaultLogger,

    // Convenience methods for quick access
    success: (msg, details) => defaultLogger.success(msg, details),
    error: (msg, details) => defaultLogger.error(msg, details),
    warning: (msg, details) => defaultLogger.warning(msg, details),
    info: (msg, details) => defaultLogger.info(msg, details),
    progress: (msg, details) => defaultLogger.progress(msg, details),
    step: (num, total, msg) => defaultLogger.step(num, total, msg),
    section: (title) => defaultLogger.section(title),
    subsection: (title) => defaultLogger.subsection(title),
    checking: (what) => defaultLogger.checking(what),
    installing: (what) => defaultLogger.installing(what),
    found: (what, version) => defaultLogger.found(what, version),
    notFound: (what) => defaultLogger.notFound(what),
    command: (cmd, desc) => defaultLogger.command(cmd, desc),
    newLine: () => defaultLogger.newLine(),
    raw: (msg) => defaultLogger.raw(msg),
    startProgress: (msg) => defaultLogger.startProgress(msg),
    updateProgress: (char) => defaultLogger.updateProgress(char),
    endProgress: (result) => defaultLogger.endProgress(result),
    summary: (title, items) => defaultLogger.summary(title, items),
    errorSummary: (title, errors) => defaultLogger.errorSummary(title, errors),
    status: (items) => defaultLogger.status(items),
    spinner: (msg, promise) => defaultLogger.spinner(msg, promise)
};
