const { spawn } = require('child_process');
const chalk = require('chalk');

// Colors for different services
const colors = {
  FRONTEND: chalk.cyan,
  SERVER: chalk.green,
  RENDERER: chalk.magenta
};

// Commands to run - cross-platform approach
const commands = [
  { name: 'FRONTEND', cmd: 'npm', args: ['run', 'start'], cwd: '.' },
  { name: 'SERVER', cmd: 'npm', args: ['run', 'server:start'], cwd: '.' },
  { name: 'RENDERER', cmd: 'npm', args: ['run', 'video-renderer:start'], cwd: '.' }
];

// Function to prefix output with colored service name (only the prefix is colored)
function prefixOutput(serviceName, data) {
  const color = colors[serviceName];
  const lines = data.toString().split('\n');
  return lines
    .filter(line => line.trim() !== '')
    .map(line => `${color(`[${serviceName}]`)} ${line}`)
    .join('\n');
}

// Start all services
console.log(chalk.bold('Starting development servers...\n'));

commands.forEach(({ name, cmd, args, cwd }) => {
  const process = spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true, // Use shell: true for cross-platform npm compatibility (works on Windows, Linux, macOS)
    cwd: cwd
  });

  process.stdout.on('data', (data) => {
    console.log(prefixOutput(name, data));
  });

  process.stderr.on('data', (data) => {
    console.log(prefixOutput(name, data));
  });

  process.on('close', (code) => {
    const color = colors[name];
    console.log(color(`[${name}] Process exited with code ${code}`));
  });

  process.on('error', (err) => {
    const color = colors[name];
    console.log(color(`[${name}] Error: ${err.message}`));
  });
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down development servers...'));
  process.exit(0);
});
