/**
 * Automated verification routine for Acceptance Criterion 2 (Sandbox Verification).
 * Tests browser Cross-Origin Isolation, WebContainer booting, virtual file writing,
 * Node.js HTTP server execution, server-ready event capture, and HTTP payload assertion.
 */

import type { SandboxVerificationResult } from '@/types/sandbox';
import { getWebContainer, writeFile, spawn, onServerReady } from './webcontainer';

export interface VerificationOptions {
  timeoutMs?: number;
  onLog?: (message: string) => void;
}

/**
 * Executes the complete automated WebContainer sandbox verification test.
 */
export async function runSandboxVerificationTest(
  options: VerificationOptions = {}
): Promise<SandboxVerificationResult> {
  const { timeoutMs = 20000, onLog } = options;
  const logs: string[] = [];
  const startTime = Date.now();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    const formatted = `[${timestamp}] ${message}`;
    logs.push(formatted);
    if (onLog) {
      try {
        onLog(formatted);
      } catch {
        // Ignore subscriber logger errors
      }
    }
  };

  let spawnedProcess: { kill: () => void } | null = null;
  let activeUrl = '';
  let activePort = 0;

  try {
    addLog('Step 1/6: Verifying Cross-Origin Isolation environment...');
    if (typeof window === 'undefined') {
      throw new Error(
        'WebContainer verification test must be executed inside a browser environment.'
      );
    }

    if (!window.crossOriginIsolated) {
      throw new Error(
        'Cross-Origin Isolation is NOT active (window.crossOriginIsolated is false). ' +
          'Verify that Cross-Origin-Opener-Policy: same-origin and ' +
          'Cross-Origin-Embedder-Policy: require-corp headers are set.'
      );
    }
    addLog('Cross-Origin Isolation confirmed (window.crossOriginIsolated === true).');

    addLog('Step 2/6: Booting WebContainer singleton instance...');
    await getWebContainer();
    addLog('WebContainer runtime booted successfully.');

    addLog('Step 3/6: Writing test server script (test-server.js)...');
    const serverScript = `
const http = require('http');

const PORT = 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Hello from in-browser WebContainer!',
    timestamp: Date.now()
  }));
});

server.listen(PORT, () => {
  console.log('Test server ready on port ' + PORT);
});
`.trim();

    await writeFile('test-server.js', serverScript);
    addLog('test-server.js written to virtual filesystem.');

    addLog('Step 4/6: Registering server-ready event listener...');
    const serverReadyPromise = new Promise<{ port: number; url: string }>(
      (resolve, reject) => {
        let cleanupListener: (() => void) | null = null;

        const timeoutId = setTimeout(() => {
          if (cleanupListener) cleanupListener();
          reject(
            new Error(
              `Timed out after ${timeoutMs}ms waiting for WebContainer server-ready event.`
            )
          );
        }, timeoutMs);

        cleanupListener = onServerReady((port, url) => {
          clearTimeout(timeoutId);
          if (cleanupListener) cleanupListener();
          resolve({ port, url });
        });
      }
    );

    addLog('Step 5/6: Spawning node process (node test-server.js)...');
    const proc = await spawn('node', ['test-server.js']);
    spawnedProcess = proc;

    // Stream process stdout/stderr into verification logs
    proc.output
      .pipeTo(
        new WritableStream({
          write(chunk) {
            const trimmed = chunk.trim();
            if (trimmed) {
              addLog(`[Container Output] ${trimmed}`);
            }
          },
        })
      )
      .catch(() => {
        // Stream aborted on process kill
      });

    const { port, url } = await serverReadyPromise;
    activePort = port;
    activeUrl = url;
    addLog(`Server is ready! Port: ${port}, URL: ${url}`);

    addLog('Step 6/6: Fetching HTTP response from container URL...');
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `HTTP request to WebContainer failed with status ${response.status} (${response.statusText})`
      );
    }

    const payload = await response.json();
    addLog(`HTTP response received (200 OK): ${JSON.stringify(payload)}`);

    // Strict assertions on response payload
    if (
      !payload ||
      typeof payload !== 'object' ||
      payload.status !== 'ok' ||
      payload.message !== 'Hello from in-browser WebContainer!'
    ) {
      throw new Error(
        `Unexpected response payload from WebContainer server: ${JSON.stringify(payload)}`
      );
    }

    addLog('Payload assertion PASSED: { status: "ok", message: "Hello from in-browser WebContainer!" }');

    // Clean up spawned server process
    if (spawnedProcess) {
      spawnedProcess.kill();
      spawnedProcess = null;
      addLog('Node server process terminated cleanly.');
    }

    const durationMs = Date.now() - startTime;
    addLog(`Verification complete! Total elapsed time: ${durationMs}ms`);

    return {
      success: true,
      durationMs,
      port: activePort,
      url: activeUrl,
      response: payload,
      logs,
    };
  } catch (error) {
    if (spawnedProcess) {
      try {
        spawnedProcess.kill();
      } catch {
        // Ignore kill error during exception handling
      }
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    addLog(`Verification FAILED: ${errorMsg}`);
    const durationMs = Date.now() - startTime;

    return {
      success: false,
      durationMs,
      port: activePort,
      url: activeUrl,
      response: null,
      logs,
      error: errorMsg,
    };
  }
}

/**
 * Convenient alias for runSandboxVerificationTest.
 */
export const verifySandbox = runSandboxVerificationTest;

export default runSandboxVerificationTest;
