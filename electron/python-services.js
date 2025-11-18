const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Python service management for bundled Electron app
 */
class PythonServiceManager {
  constructor() {
    this.services = new Map();
    this.pythonPath = null;
    this.initPython();
  }

  async initPython() {
    try {
      // Try to find Python in bundled resources
      const possiblePythonPaths = [
        // Windows
        path.join(process.resourcesPath, 'bin', 'python.exe'),
        path.join(process.resourcesPath, 'python', 'python.exe'),
        // macOS
        path.join(process.resourcesPath, 'bin', 'python'),
        // Linux
        path.join(process.resourcesPath, 'bin', 'python3'),
        // Fallback to system Python
        'python',
        'python3'
      ];

      for (const pythonPath of possiblePythonPaths) {
        try {
          await this.checkPython(pythonPath);
          this.pythonPath = pythonPath;
          console.log('✅ Python found at:', pythonPath);
          break;
        } catch (error) {
          continue;
        }
      }

      if (!this.pythonPath) {
        throw new Error('Python not found in bundled resources or system');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Python:', error);
    }
  }

  async checkPython(pythonPath) {
    return new Promise((resolve, reject) => {
      const process = spawn(pythonPath, ['--version'], {
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('Python')) {
          resolve(output.trim());
        } else {
          reject(new Error(`Python check failed for ${pythonPath}`));
        }
      });

      process.on('error', reject);
      
      setTimeout(() => {
        process.kill();
        reject(new Error('Python check timeout'));
      }, 5000);
    });
  }

  async startService(serviceName, config) {
    if (!this.pythonPath) {
      throw new Error('Python not initialized');
    }

    const { script, port, args = [], env = {} } = config;
    
    // Ensure script path exists
    const scriptPath = path.join(process.resourcesPath, 'app', script);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Service script not found: ${scriptPath}`);
    }

    console.log(`🚀 Starting ${serviceName}...`);

    const fullEnv = {
      ...process.env,
      PYTHONPATH: path.join(process.resourcesPath, 'app'),
      PORT: port,
      NARRATION_PORT: port,
      CHATTERBOX_PORT: port,
      ...env
    };

    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [scriptPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: fullEnv,
        cwd: path.join(process.resourcesPath, 'app')
      });

      // Handle process output
      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[${serviceName}] ${output}`);
        this.emit('service-log', {
          service: serviceName,
          type: 'stdout',
          message: output,
          timestamp: Date.now()
        });
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`[${serviceName} ERROR] ${output}`);
        this.emit('service-log', {
          service: serviceName,
          type: 'stderr',
          message: output,
          timestamp: Date.now()
        });
      });

      process.on('error', (error) => {
        console.error(`Failed to start ${serviceName}:`, error);
        this.emit('service-status', {
          service: serviceName,
          status: 'error',
          error: error.message
        });
        reject(error);
      });

      process.on('close', (code) => {
        console.log(`${serviceName} exited with code ${code}`);
        this.emit('service-status', {
          service: serviceName,
          status: code === 0 ? 'stopped' : 'error',
          exitCode: code
        });
      });

      // Store process reference
      this.services.set(serviceName, process);

      // Check if service starts successfully
      setTimeout(() => {
        if (process.exitCode === null) {
          console.log(`✅ ${serviceName} started successfully`);
          this.emit('service-status', {
            service: serviceName,
            status: 'running',
            pid: process.pid
          });
          resolve(process);
        } else {
          reject(new Error(`${serviceName} failed to start (exit code: ${process.exitCode})`));
        }
      }, 5000);
    });
  }

  stopService(serviceName) {
    const process = this.services.get(serviceName);
    if (process && !process.killed) {
      console.log(`🛑 Stopping ${serviceName}...`);
      process.kill('SIGTERM');
      
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 10000);
    }
  }

  stopAllServices() {
    console.log('🛑 Stopping all Python services...');
    this.services.forEach((process, serviceName) => {
      this.stopService(serviceName);
    });
    this.services.clear();
  }

  getServiceStatus() {
    const status = {};
    this.services.forEach((process, serviceName) => {
      status[serviceName] = {
        running: !!(process && !process.killed),
        pid: process?.pid
      };
    });
    return status;
  }

  // Event system for IPC communication
  on(event, callback) {
    // This would be connected to the main process IPC system
  }

  emit(event, data) {
    // This would emit to the main process for IPC forwarding
  }
}

module.exports = PythonServiceManager;