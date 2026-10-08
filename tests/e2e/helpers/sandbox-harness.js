/**
 * Sandbox Test Harness & WebContainer Contract Emulator.
 * Complies with PROJECT.md and src/types/sandbox.ts interface contracts.
 * Enables opaque-box E2E testing of the Sandbox lifecycle, virtual FS,
 * process spawning, server-ready event capture, and HTTP payload verification.
 */
const http = require('node:http');
const { spawn: childSpawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

class VirtualFileSystem {
  constructor() {
    this.files = new Map();
  }

  normalizePath(p) {
    return p.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  async writeFile(filePath, content) {
    const key = this.normalizePath(filePath);
    this.files.set(key, typeof content === 'string' ? content : content.toString());
  }

  async readFile(filePath) {
    const key = this.normalizePath(filePath);
    if (!this.files.has(key)) {
      const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      err.code = 'ENOENT';
      throw err;
    }
    return this.files.get(key);
  }

  async rm(filePath, options = {}) {
    const key = this.normalizePath(filePath);
    if (options.recursive) {
      for (const k of Array.from(this.files.keys())) {
        if (k === key || k.startsWith(key + '/')) {
          this.files.delete(k);
        }
      }
    } else {
      if (!this.files.has(key) && !options.force) {
        const err = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`);
        err.code = 'ENOENT';
        throw err;
      }
      this.files.delete(key);
    }
  }

  async mkdir(dirPath) {
    // Virtual directory tracking
    return;
  }

  async readdir(dirPath) {
    const key = this.normalizePath(dirPath);
    const prefix = key ? key + '/' : '';
    const results = new Set();
    for (const k of this.files.keys()) {
      if (k.startsWith(prefix)) {
        const sub = k.slice(prefix.length).split('/')[0];
        results.add(sub);
      }
    }
    return Array.from(results);
  }
}

class SandboxProcess {
  constructor(options = {}) {
    this.outputCallbacks = [];
    this.exitCode = null;
    this.childProcess = null;
    this.isKilled = false;

    this.exit = new Promise((resolve) => {
      this._resolveExit = resolve;
    });

    // WebContainer-compliant ReadableStream for process.output
    const self = this;
    this.output = new ReadableStream({
      start(controller) {
        self.streamController = controller;
      },
      cancel() {
        self.isKilled = true;
      }
    });

    this.input = new WritableStream({
      write(chunk) {
        if (self.childProcess && self.childProcess.stdin && !self.childProcess.stdin.destroyed) {
          self.childProcess.stdin.write(chunk);
        }
      }
    });
  }

  emitOutput(text) {
    if (this.streamController) {
      try {
        this.streamController.enqueue(text);
      } catch {
        // Stream closed
      }
    }
    for (const cb of this.outputCallbacks) {
      try {
        cb(text);
      } catch {
        // Ignore callback error
      }
    }
  }

  onOutput(callback) {
    this.outputCallbacks.push(callback);
  }

  kill() {
    this.isKilled = true;
    if (this.childProcess) {
      try {
        if (!this.childProcess.killed && this.childProcess.exitCode === null) {
          this.childProcess.kill('SIGTERM');
        }
      } catch {
        // Process might already be dead
      }
    }
    if (this.streamController) {
      try {
        this.streamController.close();
      } catch {
        // Already closed
      }
    }
    if (this.exitCode === null) {
      this.exitCode = 0;
      this._resolveExit(0);
    }
  }
}

class SandboxHarness {
  constructor() {
    this.fs = new VirtualFileSystem();
    this.status = 'uninitialized'; // 'uninitialized' | 'booting' | 'ready' | 'error'
    this.bootPromise = null;
    this.serverReadyListeners = new Set();
    this.portChangeListeners = new Set();
    this.activeServers = new Map(); // port -> server
    this.activeProcesses = [];
    this.tempDirs = [];
  }

  getStatus() {
    return this.status;
  }

  async boot() {
    if (this.status === 'ready') {
      return this;
    }
    if (this.bootPromise) {
      return this.bootPromise;
    }

    this.status = 'booting';
    this.bootPromise = (async () => {
      // Simulate asynchronous container startup
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.status = 'ready';
      return this;
    })();

    return this.bootPromise;
  }

  async getInstance() {
    if (this.status !== 'ready') {
      return this.boot();
    }
    return this;
  }

  async writeFile(pathStr, content) {
    await this.fs.writeFile(pathStr, content);
  }

  async readFile(pathStr) {
    return this.fs.readFile(pathStr);
  }

  async rm(pathStr, options) {
    await this.fs.rm(pathStr, options);
  }

  async mkdir(pathStr, options) {
    await this.fs.mkdir(pathStr, options);
  }

  async readdir(pathStr, options) {
    return this.fs.readdir(pathStr, options);
  }

  onServerReady(callback) {
    this.serverReadyListeners.add(callback);
    return () => this.serverReadyListeners.delete(callback);
  }

  onPortChange(callback) {
    this.portChangeListeners.add(callback);
    return () => this.portChangeListeners.delete(callback);
  }

  emitServerReady(port, url) {
    for (const listener of this.serverReadyListeners) {
      try {
        listener(port, url);
      } catch (err) {
        console.error('Error in serverReady listener:', err);
      }
    }
  }

  emitPortChange(port, type, url) {
    for (const listener of this.portChangeListeners) {
      try {
        listener(port, type, url);
      } catch (err) {
        console.error('Error in portChange listener:', err);
      }
    }
  }

  /**
   * Spawns a command inside the sandbox runtime.
   * If running 'node <script>', writes virtual file to an isolated sandbox temp dir
   * and launches real child process with port forwarding and stdout/stderr interception.
   */
  async spawn(command, args = [], options = {}) {
    if (this.status !== 'ready') {
      throw new Error(`Cannot spawn process: WebContainer status is "${this.status}". Boot first.`);
    }

    const proc = new SandboxProcess(options);
    this.activeProcesses.push(proc);

    if (command === 'node' && args.length > 0) {
      const scriptName = args[0];
      let scriptContent = '';
      try {
        scriptContent = await this.fs.readFile(scriptName);
      } catch {
        // If not in virtual FS, check disk or handle ENOENT
      }

      if (!scriptContent) {
        // Script not found error
        setTimeout(() => {
          proc.emitOutput(`node: internal/modules/cjs/loader:1152\nCannot find module '${scriptName}'\n`);
          proc.exitCode = 1;
          proc._resolveExit(1);
        }, 20);
        return proc;
      }

      // Check if this script sets up an HTTP server
      const isHttpServer = scriptContent.includes('http.createServer') || scriptContent.includes('.listen(');

      // Create isolated temporary workspace
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-sandbox-'));
      this.tempDirs.push(tmpDir);

      // Write all virtual files to tmpDir so imports work
      for (const [vPath, vContent] of this.fs.files.entries()) {
        const targetPath = path.join(tmpDir, vPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, vContent, 'utf-8');
      }

      const scriptFullPath = path.join(tmpDir, scriptName);

      // Spawn real node child process
      const child = childSpawn(process.execPath, [scriptFullPath, ...args.slice(1)], {
        cwd: tmpDir,
        env: { ...process.env, PORT: '3000', ...options.env },
      });
      proc.childProcess = child;

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        proc.emitOutput(text);

        // Detect server ready from log or port binding
        if (isHttpServer) {
          const portMatch = text.match(/port\s+(\d+)/i) || text.match(/listening\s+on\s+(?:http:\/\/[^:]+:)?(\d+)/i);
          const port = portMatch ? parseInt(portMatch[1], 10) : 3000;
          const url = `http://127.0.0.1:${port}`;
          this.emitServerReady(port, url);
          this.emitPortChange(port, 'open', url);
        }
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        proc.emitOutput(text);
      });

      child.on('close', (code) => {
        proc.exitCode = code;
        proc._resolveExit(code);
        if (isHttpServer) {
          this.emitPortChange(3000, 'close');
        }
      });

      child.on('error', (err) => {
        proc.emitOutput(`Process error: ${err.message}\n`);
        proc.exitCode = 1;
        proc._resolveExit(1);
      });

      return proc;
    }

    // Generic simulated command (e.g. npm, echo, cat)
    setTimeout(() => {
      if (command === 'echo') {
        proc.emitOutput(args.join(' ') + '\n');
        proc.exitCode = 0;
        proc._resolveExit(0);
      } else {
        proc.emitOutput(`Command executed: ${command} ${args.join(' ')}\n`);
        proc.exitCode = 0;
        proc._resolveExit(0);
      }
    }, 10);

    return proc;
  }

  async cleanup() {
    const closePromises = [];
    for (const proc of this.activeProcesses) {
      if (proc.childProcess && !proc.childProcess.killed && proc.childProcess.exitCode === null) {
        closePromises.push(new Promise((resolve) => {
          proc.childProcess.once('close', () => resolve());
          proc.kill();
        }));
      } else {
        proc.kill();
      }
    }
    if (closePromises.length > 0) {
      await Promise.allSettled(closePromises);
    }
    // Allow Windows libuv event loop to complete handle closure
    await new Promise((resolve) => setTimeout(resolve, 60));

    for (const dir of this.tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore temp cleanup error
      }
    }
    this.tempDirs = [];
    this.activeProcesses = [];
  }
}

/**
 * Validates that next.config.ts has Cross-Origin Isolation headers properly configured.
 */
function verifyNextConfigHeaders(projectRoot) {
  const configPath = path.join(projectRoot, 'next.config.ts');
  if (!fs.existsSync(configPath)) {
    throw new Error(`next.config.ts not found at ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf-8');

  const hasCOEP = content.includes('Cross-Origin-Embedder-Policy') && 
                  (content.includes('require-corp') || content.includes('credentialless'));
  const hasCOOP = content.includes('Cross-Origin-Opener-Policy') && 
                  content.includes('same-origin');

  return {
    valid: hasCOEP && hasCOOP,
    hasCOEP,
    hasCOOP,
    coepValue: content.includes('require-corp') ? 'require-corp' : (content.includes('credentialless') ? 'credentialless' : 'missing'),
    coopValue: content.includes('same-origin') ? 'same-origin' : 'missing',
  };
}

module.exports = {
  SandboxHarness,
  SandboxProcess,
  VirtualFileSystem,
  verifyNextConfigHeaders,
};
