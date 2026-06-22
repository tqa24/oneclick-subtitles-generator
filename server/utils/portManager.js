/**
 * Port Management System
 * Tracks and manages processes running on application ports
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { PORTS } = require('../config');

const isWindows = process.platform === 'win32';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
async function findProcessesOnPorts(portsOverride) {
  const ports = portsOverride || getAllPorts();
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
    // /T kills the whole process tree (the uv -> python -> uvicorn grandchildren that actually hold
    // the ports), not just the launcher.
    const killCommand = isWindows ? `taskkill /F /T /PID ${pid}` : `kill -9 ${pid}`;

    console.log(`🔪 Killing process ${processName} (PID: ${pid})`);

    exec(killCommand, (error) => {
      if (error) {
        // A process that is already gone ("not found"/"not running") is a no-op, not a real failure,
        // so don't print an alarming warning during routine port cleanup.
        const benign = /not found|not running|no (running )?task|128/i.test(error.message || '');
        if (!benign) console.warn(`⚠️  Could not kill process ${pid}: ${error.message}`);
        resolve(false);
      } else {
        console.log(`✅ Successfully killed process ${processName} (PID: ${pid})`);
        resolve(true);
      }
    });
  });
}

/**
 * Authoritative "is this port actually free to bind?" check. We attempt the SAME thing the Python
 * services do — bind 0.0.0.0:port — and report success/failure. A client-connect probe is not enough:
 * it can't distinguish "free" from "bound but not accepting", and a TIME_WAIT/leftover socket can still
 * block a real bind. On Windows, Node (libuv) does not set SO_REUSEADDR for servers, so this mirrors an
 * exclusive bind closely.
 */
function tryBind(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err) => resolve(err && err.code ? err.code : 'ERR'));
    tester.once('listening', () => tester.close(() => resolve(null)));
    try {
      tester.listen(port, host);
    } catch (err) {
      resolve(err && err.code ? err.code : 'ERR');
    }
  });
}

/**
 * A port is only truly free if it's bindable on BOTH IPv4 (0.0.0.0) and IPv6 (::).
 *
 * Windows sockets are IPv6-only by default, so a stale server sitting on [::]:port leaves
 * 0.0.0.0:port bindable (and vice-versa). Our dev servers bind `::` (Node's default with no host),
 * so checking only 0.0.0.0 — as this used to — reports "free" while an IPv6 holder is still there,
 * the cleanup skips killing it, and the next bind hits EADDRINUSE. That family mismatch is the
 * long-standing "ports already free" → EADDRINUSE bug. A family that's merely unavailable on this
 * host (no IPv6 stack → EADDRNOTAVAIL / EAFNOSUPPORT) is NOT a conflict and is ignored.
 */
async function canBindPort(port) {
  for (const host of ['0.0.0.0', '::']) {
    if ((await tryBind(port, host)) === 'EADDRINUSE') return false;
  }
  return true;
}

/**
 * Snapshot of every live process as {pid, ppid}. Used to walk a process tree when the PID that
 * netstat blames for a port is a DEAD parent whose live child still holds the inherited socket.
 * `wmic` is gone on Windows 11, so use Get-CimInstance (works without admin). Returns null if the
 * snapshot can't be produced, so callers fall back to killing just the netstat PID.
 */
function getProcessSnapshotWindows() {
  return new Promise((resolve) => {
    const cmd =
      'powershell -NoProfile -NonInteractive -Command ' +
      '"Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Csv -NoTypeInformation"';
    exec(cmd, { windowsHide: true, timeout: 8000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
        return;
      }
      const rows = [];
      for (const line of stdout.split(/\r?\n/)) {
        // Rows are CSV like "1234","5678"; the "ProcessId","ParentProcessId" header has no digits and is skipped.
        const m = line.match(/^"?(\d+)"?\s*,\s*"?(\d+)"?/);
        if (m) rows.push({ pid: parseInt(m[1], 10), ppid: parseInt(m[2], 10) });
      }
      resolve(rows.length ? rows : null);
    });
  });
}

/**
 * Given root PID(s) and a live-process snapshot, return the set of those PIDs plus all their live
 * descendants. KEY Windows fact (verified): when a parent dies, Windows does NOT reparent its children
 * — each child keeps the dead parent's PID in ParentProcessId. So walking children-of-deadPid still
 * finds the live grandchild that inherited the listening socket (the exact 3036 zombie we hit).
 */
function collectDescendantPids(rootPids, snapshot) {
  const childrenByPpid = new Map();
  for (const { pid, ppid } of snapshot) {
    let arr = childrenByPpid.get(ppid);
    if (!arr) { arr = []; childrenByPpid.set(ppid, arr); }
    arr.push(pid);
  }
  const result = new Set();
  const queue = [...rootPids];
  while (queue.length) {
    const pid = queue.shift();
    if (result.has(pid)) continue;
    result.add(pid); // root PIDs are included even if already dead — taskkill on them is a harmless no-op
    const kids = childrenByPpid.get(pid);
    if (kids) for (const k of kids) if (!result.has(k)) queue.push(k);
  }
  return result;
}

/**
 * Guarantee a single port is free to bind, then return true. Handles the case that broke Chatterbox on
 * port 3036: netstat reports the socket against a DEAD parent PID, `taskkill /PID <deadpid>` reaps
 * nothing, and the live child that inherited the socket keeps the port. We resolve the holder, kill its
 * whole live descendant tree (not just the netstat PID), then VERIFY with a real bind — retrying a few
 * times — instead of sleeping once and hoping. Never throws; returns false if the port stays stuck.
 */
async function ensurePortFree(port, options = {}) {
  const { label = `port ${port}`, attempts = 6, intervalMs = 500 } = options;

  // Fast path: nothing holding it (also the success exit of the loop below) — no PowerShell spawned.
  if (await canBindPort(port)) return true;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const holders = await findProcessesOnPorts([port]);
    const rootPids = [...new Set(holders.map((h) => h.pid))].filter((pid) => pid && pid !== process.pid);

    if (rootPids.length > 0) {
      let targets = new Set(rootPids);
      if (isWindows) {
        // The netstat PID may be a dead parent — expand to its live descendants so the real
        // socket-holder (e.g. a uvicorn reload/multiprocessing child) is the one we kill.
        const snapshot = await getProcessSnapshotWindows();
        if (snapshot) {
          targets = collectDescendantPids(rootPids, snapshot);
          targets.delete(process.pid);
        }
      }
      for (const pid of targets) {
        await killProcess(pid, label);
      }
    }

    await sleep(intervalMs);
    if (await canBindPort(port)) return true;
  }

  console.warn(`⚠️  Port ${port} (${label}) is STILL in use after ${attempts} cleanup attempts.`);
  console.warn('   A process from a previous run may be stuck — close other app windows or reboot.');
  console.warn('   If it persists, the holder may be owned by another user / elevated and need admin rights.');
  return false;
}

/**
 * Kill all processes on application ports
 */
async function killProcessesOnPorts(portsOverride) {
  console.log('🔍 Ensuring application ports are free...');

  const ports = portsOverride || getAllPorts();
  const tracking = loadProcessTracking();

  // Verify-and-free EVERY target port via ensurePortFree (its canBindPort fast-path makes an
  // already-free port a cheap no-op). Crucially we do NOT gate this on a netstat scan first: an
  // orphaned process from a previous run — especially a grandchild that inherited the listening
  // socket from a now-dead parent — can hold a port without being reliably reported by netstat, so
  // the only trustworthy signal is whether the port actually binds. ensurePortFree kills the holder's
  // whole live tree (the dead-parent / inherited-socket zombie case) and verifies with a real bind.
  let stuck = 0;
  let freedCount = 0;
  for (const port of ports) {
    const wasFree = await canBindPort(port);
    if (wasFree) {
      untrackProcess(port);
      continue;
    }

    const trackedProcess = tracking[port];
    const processName = trackedProcess ? trackedProcess.processName : `Port ${port}`;
    const freed = await ensurePortFree(port, { label: processName });
    if (freed) {
      freedCount++;
      untrackProcess(port);
    } else {
      stuck++;
    }
  }

  if (stuck > 0) {
    console.warn(`⚠️  Port cleanup finished, but ${stuck} port(s) could not be freed (see warnings above).`);
  } else if (freedCount > 0) {
    console.log(`🧹 Port cleanup completed (freed ${freedCount} stale port${freedCount === 1 ? '' : 's'})`);
  } else {
    console.log('✅ Application ports already free');
  }
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
  ensurePortFree,
  canBindPort,
  collectDescendantPids,
  getProcessSnapshotWindows,
  cleanupTrackingFile,
  PROCESS_TRACKING_FILE
};
