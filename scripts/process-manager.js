/**
 * Shared child-process tracking, tree-killing shutdown, and readiness gating
 * for the OSG launchers (scripts/start-all.js for `dev:cuda`, dev-server.js for `dev`).
 *
 * WHY: both launchers spawn services with shell:true. On Windows the immediate child
 * is cmd.exe/npm.cmd; the things that actually hold ports 3030-3038 and GPU VRAM are
 * grandchildren (node/uv/python/uvicorn/vite). A plain child.kill() or process.exit()
 * orphans them -> EADDRINUSE + CUDA-OOM on next launch. This module records every child
 * PID and, on shutdown, runs `taskkill /F /T /PID <pid>` (Windows) or kills the POSIX
 * process group, so the whole tree dies. It also probes each port before the launcher
 * announces "ready", so the UI never points users at a service that 404/503s.
 */

const { exec } = require('child_process');
const http = require('http');
const net = require('net');

const isWindows = process.platform === 'win32';

/** @type {Array<{pid:number,name:string,child:import('child_process').ChildProcess}>} */
const children = [];
let shuttingDown = false;

/** Record a spawned child so it gets tree-killed on shutdown. */
function trackChild(child, name) {
  if (child && typeof child.pid === 'number') {
    children.push({ pid: child.pid, name, child });
  }
  return child;
}

/** Kill one child and its entire descendant tree. Returns a Promise that always resolves. */
function killTree(entry) {
  return new Promise((resolve) => {
    const { pid } = entry;
    if (!pid) return resolve();
    if (isWindows) {
      // /T = whole tree, /F = force. This is the only reliable way to reap the
      // cmd.exe -> npm.cmd -> node/uv -> python/uvicorn chain on Windows.
      exec(`taskkill /F /T /PID ${pid}`, () => resolve());
    } else {
      // Children are spawned detached, so each is a process-group leader at -pid.
      try { process.kill(-pid, 'SIGTERM'); } catch (_) {}
      // SIGKILL the group shortly after in case something ignored SIGTERM.
      setTimeout(() => { try { process.kill(-pid, 'SIGKILL'); } catch (_) {} resolve(); }, 1500);
    }
  });
}

let shutdownPromise = null;
/** Tree-kill every tracked child, then exit. Idempotent. */
function shutdownAll(signal, exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  console.log(`\n🛑 (${signal || 'exit'}) Stopping all services...`);
  shutdownPromise = Promise.all(children.map(killTree)).then(() => {
    console.log('✅ All child processes stopped.');
    process.exit(exitCode);
  });
  // Hard safety net: never hang the terminal if a taskkill stalls.
  setTimeout(() => process.exit(exitCode), 8000).unref();
  return shutdownPromise;
}

/** Install signal/exit handlers exactly once. */
let installed = false;
function installShutdown() {
  if (installed) return;
  installed = true;
  process.on('SIGINT', () => shutdownAll('SIGINT', 0));
  process.on('SIGTERM', () => shutdownAll('SIGTERM', 0));
  // Windows console-close / Ctrl-Break.
  process.on('SIGHUP', () => shutdownAll('SIGHUP', 0));
  process.on('SIGBREAK', () => shutdownAll('SIGBREAK', 0));
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught exception in launcher:', err);
    shutdownAll('uncaughtException', 1);
  });
  // If we exit for any other reason while children are alive, best-effort sync reap on Windows.
  process.on('exit', () => {
    if (isWindows && !shuttingDown) {
      const { execSync } = require('child_process');
      for (const { pid } of children) {
        try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' }); } catch (_) {}
      }
    }
  });
}

/** HTTP GET probe: resolves true on any HTTP response (<500). */
function httpOk(port, path) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: path || '/', timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/** TCP connect probe: resolves true once the port accepts a connection. */
function tcpOk(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port, timeout: 2000 }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

function probe(target) {
  return target.path ? httpOk(target.port, target.path) : tcpOk(target.port);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait until every target port is ready (or timeout). Logs each transition to ready
 * exactly once. Returns true if all became ready, false on timeout.
 * targets: [{ name, port, path? }]  (path present => HTTP probe, else TCP)
 */
async function waitForPorts(targets, { timeoutMs = 120000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const ready = new Set();
  console.log('⏳ Waiting for services to become ready...');
  while (Date.now() < deadline && ready.size < targets.length) {
    if (shuttingDown) return false;
    await Promise.all(targets.map(async (t) => {
      if (ready.has(t.name)) return;
      if (await probe(t)) {
        ready.add(t.name);
        console.log(`   ✅ ${t.name} ready on port ${t.port}`);
      }
    }));
    if (ready.size < targets.length) await sleep(intervalMs);
  }
  const missing = targets.filter((t) => !ready.has(t.name)).map((t) => `${t.name}(:${t.port})`);
  if (missing.length) console.log(`   ⚠️  Not ready after ${Math.round(timeoutMs / 1000)}s: ${missing.join(', ')}`);
  return missing.length === 0;
}

module.exports = { trackChild, installShutdown, shutdownAll, waitForPorts, httpOk, tcpOk };
