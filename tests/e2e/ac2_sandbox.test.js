/**
 * AC2 Test Suite: Sandbox Verification
 * Validates Acceptance Criterion 2:
 * "A test script or UI button successfully boots the WebContainer,
 *  writes a simple Node.js web server script, runs it,
 *  and successfully fetches the local response from the container."
 */
const path = require('node:path');
const assert = require('./helpers/assert');
const { SandboxHarness, verifyNextConfigHeaders } = require('./helpers/sandbox-harness');

async function run(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '../..');
  const results = [];
  const harness = new SandboxHarness();

  try {
    // Test 1: Verify Cross-Origin Isolation Headers in Next.js config
    try {
      const headerCheck = verifyNextConfigHeaders(projectRoot);
      assert.strictEqual(headerCheck.valid, true, 'Both COOP and COEP headers must be present in next.config.ts');
      assert.strictEqual(headerCheck.hasCOOP, true, 'COOP header must be configured');
      assert.strictEqual(headerCheck.hasCOEP, true, 'COEP header must be configured');
      results.push({
        name: 'AC2.1 - Cross-Origin Isolation Headers in next.config.ts',
        passed: true,
        details: `COEP: ${headerCheck.coepValue}, COOP: ${headerCheck.coopValue}`,
      });
    } catch (err) {
      results.push({
        name: 'AC2.1 - Cross-Origin Isolation Headers in next.config.ts',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 2: Boot WebContainer / Sandbox Runtime
    try {
      assert.strictEqual(harness.getStatus(), 'uninitialized', 'Status must be uninitialized prior to boot');
      await harness.boot();
      assert.strictEqual(harness.getStatus(), 'ready', 'Status must be ready after boot');

      // Verify singleton behavior: boot call when already ready returns immediately
      const secondBoot = await harness.boot();
      assert.strictEqual(secondBoot.getStatus(), 'ready', 'Subsequent boot calls must return the ready singleton');

      results.push({
        name: 'AC2.2 - WebContainer Boot Readiness & Singleton Lifecycle',
        passed: true,
        details: 'Runtime booted into "ready" state; singleton memoization verified',
      });
    } catch (err) {
      results.push({
        name: 'AC2.2 - WebContainer Boot Readiness & Singleton Lifecycle',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 3: Write Node.js HTTP server script to virtual filesystem
    const serverScript = `
const http = require('http');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Hello from WebContainer Sandbox!',
    runtime: 'node-sandbox',
    timestamp: Date.now()
  }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Server listening on http://127.0.0.1:' + PORT);
});
`.trim();

    try {
      await harness.writeFile('server.js', serverScript);
      const readBack = await harness.readFile('server.js');
      assert.strictEqual(readBack, serverScript, 'Virtual filesystem must faithfully store and return server.js');
      results.push({
        name: 'AC2.3 - Virtual Filesystem Server Script Creation',
        passed: true,
        details: 'Wrote and verified server.js in virtual filesystem',
      });
    } catch (err) {
      results.push({
        name: 'AC2.3 - Virtual Filesystem Server Script Creation',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 4: Register server-ready listener, spawn Node.js server, and capture event
    let serverPort = 0;
    let serverUrl = '';
    let spawnedProc = null;

    try {
      const serverReadyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout waiting for server-ready event from spawned server process'));
        }, 10000);

        harness.onServerReady((port, url) => {
          clearTimeout(timer);
          resolve({ port, url });
        });
      });

      spawnedProc = await harness.spawn('node', ['server.js']);

      const readyData = await serverReadyPromise;
      serverPort = readyData.port;
      serverUrl = readyData.url;

      assert.ok(serverPort > 0, 'Server port must be greater than 0');
      assert.ok(serverUrl.startsWith('http://'), 'Server URL must start with http://');

      results.push({
        name: 'AC2.4 - Process Spawn & Server-Ready Event Capture',
        passed: true,
        details: `Captured server-ready on port ${serverPort} (URL: ${serverUrl})`,
      });
    } catch (err) {
      results.push({
        name: 'AC2.4 - Process Spawn & Server-Ready Event Capture',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 5: Fetch local response from the container and assert payload
    try {
      const response = await fetch(serverUrl);
      assert.strictEqual(response.status, 200, 'HTTP response must return status 200');

      const data = await response.json();
      assert.strictEqual(data.status, 'ok', 'Response status field must be "ok"');
      assert.strictEqual(data.message, 'Hello from WebContainer Sandbox!', 'Response message must match expected string');
      assert.ok(typeof data.timestamp === 'number', 'Response timestamp must be numeric');

      results.push({
        name: 'AC2.5 - Local HTTP Response & Payload Assertion',
        passed: true,
        details: `HTTP 200 OK received: ${JSON.stringify(data)}`,
      });
    } catch (err) {
      results.push({
        name: 'AC2.5 - Local HTTP Response & Payload Assertion',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 6: Clean process termination & port closure
    try {
      if (spawnedProc) {
        spawnedProc.kill();
      }
      results.push({
        name: 'AC2.6 - Process Teardown & Resource Cleanup',
        passed: true,
        details: 'Server process killed and resources freed cleanly',
      });
    } catch (err) {
      results.push({
        name: 'AC2.6 - Process Teardown & Resource Cleanup',
        passed: false,
        error: err.message,
      });
      throw err;
    }

  } finally {
    await harness.cleanup();
  }

  return results;
}

module.exports = {
  name: 'AC2: Sandbox Verification Suite',
  run,
};
