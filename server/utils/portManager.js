/**
 * Port Management System
 * Tracks and manages processes running on application ports
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PORTS } = require('../config');

// File to store process tracking information
const PROCESS_TRACKING_FILE = path.join(__dirname, '..', '..', '.port_processes.json');

/**
 * Get all application ports
 */
function getAllPorts() {
  return Object.values(PORTS);
}

/**
 * Load process tracking data
 */
function loadProcessTracking() {
  try {
    if (fs.existsSync(PROCESS_TRACKING_FILE)) {
      const data = fs.readFileSync(PROCESS_TRACKING_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Warning: Could not load process tracking data:', error.message);
  }
  return {};
}

/**
 * Save process tracking data
 */
function saveProcessTracking(data) {
  try {
    fs.writeFileSync(PROCESS_TRACKING_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving process tracking data:', error.message);
  }
}

/**
 * Track a process for a specific port
 */
function trackProcess(port, pid, processName, startTime = Date.now()) {
  const tracking = loadProcessTracking();
  tracking[port] = {
    pid,
    processName,
    startTime,
    lastSeen: Date.now()
  };
  saveProcessTracking(tracking);
  console.log(`📝 Tracking process ${processName} (PID: ${pid}) on port ${port}`);
}

/**
 * Remove tracking for a port
 */
function untrackProcess(port) {
  const tracking = loadProcessTracking();
  if (tracking[port]) {
    console.log(`🗑️  Untracking process on port ${port}`);
    delete tracking[port];
    saveProcessTracking(tracking);
  }
}

/**
 * Find processes using specific ports (Windows)
 */
function findProcessesOnPortsWindows(ports) {
  return new Promise((resolve) => {
    const portList = ports.join(' ');
    exec(`netstat -ano | findstr "LISTENING" | findstr "${portList.replace(/ /g, ' ')}"`, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const processes = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const address = parts[1];
          const pid = parts[4];
          
          // Extract port from address (format: IP:PORT)
          const portMatch = address.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1]);
            if (ports.includes(port)) {
              processes.push({ port, pid: parseInt(pid) });
            }
          }
        }
      }
      
      resolve(processes);
    });
  });
}

/**
 * Find processes using specific ports (Unix/Linux/Mac)
 */
function findProcessesOnPortsUnix(ports) {
  return new Promise((resolve) => {
    const promises = ports.map(port => {
      return new Promise((portResolve) => {
        exec(`lsof -ti:${port}`, (error, stdout) => {
          if (error) {
            portResolve([]);
            return;
          }
          
          const pids = stdout.trim().split('\n').filter(pid => pid).map(pid => parseInt(pid));
          const processes = pids.map(pid => ({ port, pid }));
          portResolve(processes);
        });
      });
    });

    Promise.all(promises).then(results => {
      const allProcesses = results.flat();
      resolve(allProcesses);
    });
  });
}

/**
 * Find processes using application ports
 */
async function findProcessesOnPorts() {
  const ports = getAllPorts();
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    return await findProcessesOnPortsWindows(ports);
  } else {
    return await findProcessesOnPortsUnix(ports);
  }
}

/**
 * Kill a process by PID
 */
function killProcess(pid, processName = 'Unknown') {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const killCommand = isWindows ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
    
    console.log(`🔪 Killing process ${processName} (PID: ${pid})`);
    
    exec(killCommand, (error) => {
      if (error) {
        console.warn(`⚠️  Could not kill process ${pid}: ${error.message}`);
        resolve(false);
      } else {
        console.log(`✅ Successfully killed process ${processName} (PID: ${pid})`);
        resolve(true);
      }
    });
  });
}

/**
 * Kill all processes on application ports
 */
async function killProcessesOnPorts() {
  console.log('🔍 Scanning for processes on application ports...');
  
  const processes = await findProcessesOnPorts();
  const tracking = loadProcessTracking();
  
  if (processes.length === 0) {
    console.log('✅ No processes found on application ports');
    return;
  }

  console.log(`🎯 Found ${processes.length} process(es) on application ports`);
  
  for (const { port, pid } of processes) {
    const trackedProcess = tracking[port];
    const processName = trackedProcess ? trackedProcess.processName : `Port ${port}`;
    
    await killProcess(pid, processName);
    untrackProcess(port);
  }
  
  // Wait a moment for processes to fully terminate
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('🧹 Port cleanup completed');
}

/**
 * Clean up tracking file on startup
 */
function cleanupTrackingFile() {
  try {
    if (fs.existsSync(PROCESS_TRACKING_FILE)) {
      fs.unlinkSync(PROCESS_TRACKING_FILE);
      console.log('🧹 Cleaned up old process tracking file');
    }
  } catch (error) {
    console.warn('Warning: Could not clean up tracking file:', error.message);
  }
}

module.exports = {
  getAllPorts,
  trackProcess,
  untrackProcess,
  findProcessesOnPorts,
  killProcessesOnPorts,
  cleanupTrackingFile,
  PROCESS_TRACKING_FILE
};
