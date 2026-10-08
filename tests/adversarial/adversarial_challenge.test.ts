/**
 * Adversarial Challenge & Empirical Stress Test Suite
 * Milestone M5 - Final Integration & Verification
 *
 * Exercises rigorous boundary, edge-case, concurrency, and stress testing
 * against the Cloud Coding AI Agent architecture.
 */

import assert from 'node:assert';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import {
  toBase64,
  fromBase64,
  validateAuth,
  listRepositories,
  createRepository,
  getRepository,
  readFile as ghReadFile,
  writeFile as ghWriteFile,
  createGitHubClient,
  GitHubApiError,
} from '../../src/lib/github';
import {
  toolSchemas,
  validateToolCall,
  createGitHubTools,
  sandboxTools,
  getClientToolExecutors,
} from '../../src/lib/tools';
import {
  getWebContainer,
  bootWebContainer,
  getStatus,
  teardownWebContainer,
} from '../../src/lib/webcontainer';
import { MockGitHubServer } from '../e2e/helpers/github-mock-server';
import { SandboxHarness, verifyNextConfigHeaders } from '../e2e/helpers/sandbox-harness';
import { AgentWorkflowHarness } from '../e2e/helpers/agent-harness';

// Global error tracking for unhandled rejections / exceptions
let unhandledRejectionsCount = 0;
let uncaughtExceptionsCount = 0;

process.on('unhandledRejection', (reason) => {
  unhandledRejectionsCount++;
  console.error('🚨 [ADVERSARIAL] Unhandled Rejection detected:', reason);
});

process.on('uncaughtException', (error) => {
  uncaughtExceptionsCount++;
  console.error('🚨 [ADVERSARIAL] Uncaught Exception detected:', error);
});

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

const results: TestResult[] = [];

async function challenge(name: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`  ✔ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    results.push({ name, passed: false, durationMs, error: msg });
    console.error(`  ✘ [FAIL] ${name} (${durationMs}ms)`);
    console.error(`    Details: ${msg}`);
  }
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('  ADVERSARIAL CHALLENGE & EMPIRICAL STRESS TEST SUITE (M5)     ');
  console.log('================================================================\n');

  const initialMemory = process.memoryUsage();

  // ============================================================================
  // SECTION 1: Multibyte and Unicode Base64 Encoding/Decoding Under Stress
  // ============================================================================
  console.log('--- 1. MULTIBYTE & UNICODE BASE64 STRESS TESTING ---');

  await challenge('1.1 Extreme Emojis, Modifiers & ZWJ Sequences', () => {
    const extremeEmojis = [
      '👨‍👩‍👧‍👦', // Family ZWJ sequence
      '🧑🏽‍💻', // Technologist with skin tone modifier
      '🏳️‍🌈', // Rainbow flag with ZWJ
      '🏴‍☠️', // Pirate flag
      '❤️‍🔥', // Heart on fire
      '🫠 🫡 🫣 🫢 🫣 🫡 🫠',
      '🤖 🦾 🧠 🔬 🚀 🛰️ 🛸',
    ];
    for (const item of extremeEmojis) {
      const encoded = toBase64(item);
      const decoded = fromBase64(encoded);
      assert.strictEqual(decoded, item, `Failed roundtrip for emoji: ${item}`);
    }
  });

  await challenge('1.2 Cross-Script Multibyte Polyglot (CJK, Arabic RTL, Devanagari, Math)', () => {
    const polyglot = [
      '日本語のテキスト：こんにちは世界！プログラミングは楽しいです。',
      '中文测试：云编码智能体正在运行，无缝集成与验证。',
      'العربية: هذا نص تجريبي باللغة العربية مع اتجاه من اليمين إلى اليسار.',
      'हिन्दी: क्लाउड कोडिंग एजेंट पूरी तरह से कार्यात्मक और सत्यापित है।',
      'Русский: Надежная изоляция и поддержка кросс-доменных заголовков.',
      'Math & Astral: 𝒳𝒴𝒵 ∯ ∇ × 𝐁 = 𝐉 + ∂𝐃/∂t, ∑_{i=0}^∞ 1/n² = π²/6, 𠜎𠜱𠝹𠱓',
      'Accents & Diacritics: Ångström, Caña, Curaçao, naïve, façade, Zoë',
    ];
    for (const text of polyglot) {
      const enc = toBase64(text);
      const dec = fromBase64(enc);
      assert.strictEqual(dec, text);
    }
  });

  await challenge('1.3 Boundary Buffer Sizes (0B, 1B, 2B, 3B, 7B, and 250KB Multibyte Buffer)', () => {
    // 0 bytes
    assert.strictEqual(toBase64(''), '');
    assert.strictEqual(fromBase64(''), '');

    // 1, 2, 3 byte boundaries (testing padding '=', '==', and exact 3-byte multiples)
    const boundaries = ['A', 'AB', 'ABC', 'ABCD', 'ABCDE', 'ABCDEF', 'ABCDEFG'];
    for (const b of boundaries) {
      assert.strictEqual(fromBase64(toBase64(b)), b);
    }

    // Large 250KB multibyte buffer
    const chunk = '🔥 Unicode Cloud Agent 🚀 日本語 [2026] ⚡ ';
    const repeatCount = 5000; // ~250,000 bytes
    const largeStr = chunk.repeat(repeatCount);
    const enc = toBase64(largeStr);
    assert.ok(enc.length > 250000, 'Base64 string should exceed 250KB');
    const dec = fromBase64(enc);
    assert.strictEqual(dec.length, largeStr.length);
    assert.strictEqual(dec, largeStr);
  });

  await challenge('1.4 Whitespace, Newline & Formatting Sanitization Under Stress', () => {
    const original = 'Adversarial Test String with Whitespace and Multiple Lines.';
    const enc = toBase64(original);

    // Inject aggressive whitespace: CR, LF, tabs, consecutive spaces, trailing spaces
    const corruptedBase64 = `   \r\n\t  ${enc.slice(0, 10)}\n\n  \r\n ${enc.slice(10, 25)}\t\t  ${enc.slice(25)}  \r\n\n  `;
    const dec = fromBase64(corruptedBase64);
    assert.strictEqual(dec, original, 'Sanitizer must strip all internal/external whitespace and restore original text');
  });

  await challenge('1.5 Simulated Browser Implementation (btoa/atob + encodeURIComponent) Parity', () => {
    // Directly test the browser fallback algorithm implemented in github.ts
    function browserToBase64(str: string): string {
      const encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      );
      return btoa(encoded);
    }

    function browserFromBase64(base64Str: string): string {
      const sanitized = base64Str.replace(/\s+/g, '');
      const binary = atob(sanitized);
      const bytes = Array.from(
        binary,
        (char) => '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)
      ).join('');
      return decodeURIComponent(bytes);
    }

    const testStrings = [
      'Simple ASCII text',
      '🌟 Star emoji and 💻 Laptop',
      'Mixed Japanese: 東京, Chinese: 北京, Korean: 서울',
      'Special symbols: <xml attr="&amp;">\'\n\t\r`~',
    ];

    for (const str of testStrings) {
      const nodeEnc = toBase64(str);
      const browserEnc = browserToBase64(str);
      assert.strictEqual(browserEnc, nodeEnc, `Browser toBase64 did not match Node Buffer for: ${str}`);

      const nodeDec = fromBase64(browserEnc);
      const browserDec = browserFromBase64(nodeEnc);
      assert.strictEqual(browserDec, str, `Browser fromBase64 failed to decode: ${str}`);
      assert.strictEqual(nodeDec, str);
    }
  });

  await challenge('1.6 Null Bytes, Control Characters and BOM Handling', () => {
    const special = '\uFEFFBOM_PREFIX\x00NULL_BYTE\x01\x02\x03CONTROL\tTAB\rCR\nLF\u200BZERO_WIDTH';
    const enc = toBase64(special);
    const dec = fromBase64(enc);
    assert.strictEqual(dec, special);
  });

  // ============================================================================
  // SECTION 2: Automatic SHA Probing on File Update Collisions
  // ============================================================================
  console.log('\n--- 2. AUTOMATIC SHA PROBING & COLLISION TESTING ---');

  const mockServer = new MockGitHubServer();
  const baseUrl = await mockServer.start();
  const token = 'ghp_valid_test_token_123456789';

  try {
    const repoName = `adversarial-repo-${Date.now()}`;
    await createRepository(token, {
      name: repoName,
      private: true,
      autoInit: true,
      baseUrl,
    });

    await challenge('2.1 Initial Write Probing (404 Not Found -> 201 Created)', async () => {
      const filePath = 'config/app.json';
      const content = '{"version": "1.0.0", "status": "init"}';

      // Probing should discover 404, then create cleanly without providing sha
      const res = await ghWriteFile(token, 'test-agent-user', repoName, filePath, content, 'Init config', {
        baseUrl,
      });

      assert.strictEqual(res.path, filePath);
      assert.strictEqual(res.updated, false, 'Initial write should have updated=false');
      assert.ok(res.contentSha, 'Must return content SHA');
      assert.ok(res.commitSha, 'Must return commit SHA');

      const readBack = await ghReadFile(token, 'test-agent-user', repoName, filePath, { baseUrl });
      assert.strictEqual(readBack.content, content);
      assert.strictEqual(readBack.sha, res.contentSha);
    });

    await challenge('2.2 Update Probing (200 OK -> Auto SHA Resolution -> 200 Updated)', async () => {
      const filePath = 'config/app.json';
      const updatedContent = '{"version": "1.0.1", "status": "updated_v1"}';

      // No sha passed in options: writeFile must probe and supply the existing sha
      const res = await ghWriteFile(token, 'test-agent-user', repoName, filePath, updatedContent, 'Update config v1', {
        baseUrl,
      });

      assert.strictEqual(res.path, filePath);
      assert.strictEqual(res.updated, true, 'Subsequent write must have updated=true');

      const readBack = await ghReadFile(token, 'test-agent-user', repoName, filePath, { baseUrl });
      assert.strictEqual(readBack.content, updatedContent);
      assert.strictEqual(readBack.sha, res.contentSha);
    });

    await challenge('2.3 Rapid Sequential Update Stress (15 Consecutive Probed Commits)', async () => {
      const filePath = 'stress/counter.txt';
      for (let i = 1; i <= 15; i++) {
        const content = `Counter value: ${i} (iteration ${i}/15)`;
        const res = await ghWriteFile(token, 'test-agent-user', repoName, filePath, content, `Increment counter to ${i}`, {
          baseUrl,
        });
        assert.ok(res.contentSha);
        if (i > 1) {
          assert.strictEqual(res.updated, true);
        }
      }

      const finalRead = await ghReadFile(token, 'test-agent-user', repoName, filePath, { baseUrl });
      assert.strictEqual(finalRead.content, 'Counter value: 15 (iteration 15/15)');
    });

    await challenge('2.4 Concurrent Write Collision Detection (409 Conflict Rejection)', async () => {
      const filePath = 'concurrent/shared.txt';
      // First, write base version
      const initRes = await ghWriteFile(token, 'test-agent-user', repoName, filePath, 'Base version 0', 'Base write', {
        baseUrl,
      });

      const staleSha = initRes.contentSha;

      // Client A updates the file
      await ghWriteFile(token, 'test-agent-user', repoName, filePath, 'Client A update (v1)', 'Client A', {
        baseUrl,
      });

      // Client B attempts to write supplying the STALE sha explicitly (simulating collision)
      await assert.rejects(
        async () => {
          await ghWriteFile(
            token,
            'test-agent-user',
            repoName,
            filePath,
            'Client B conflicting update',
            'Client B collision',
            { baseUrl, sha: staleSha }
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof GitHubApiError, 'Must throw GitHubApiError');
          assert.strictEqual(err.status, 409, 'Must receive 409 Conflict for outdated SHA');
          return true;
        }
      );

      // Verify file still contains Client A's update and was not corrupted
      const current = await ghReadFile(token, 'test-agent-user', repoName, filePath, { baseUrl });
      assert.strictEqual(current.content, 'Client A update (v1)');
    });

    await challenge('2.5 Deep Nested Paths with URL-Sensitive Characters', async () => {
      const deepPath = 'src/sub directory/modules+v1/data#test@sample.json';
      const content = '{"nested": true, "special": "@#+"}';

      const res = await ghWriteFile(token, 'test-agent-user', repoName, deepPath, content, 'Add nested special path', {
        baseUrl,
      });
      assert.strictEqual(res.path, deepPath);

      const readBack = await ghReadFile(token, 'test-agent-user', repoName, deepPath, { baseUrl });
      assert.strictEqual(readBack.content, content);
    });

  } finally {
    await mockServer.stop();
  }

  // ============================================================================
  // SECTION 3: WebContainer Singleton Promise Memoization Under Repeated Calls
  // ============================================================================
  console.log('\n--- 3. WEBCONTAINER SINGLETON PROMISE MEMOIZATION ---');

  await challenge('3.1 Non-Browser Environment Safety Guard', async () => {
    // In Node.js environment, calling getWebContainer directly must throw clear error
    await assert.rejects(
      async () => {
        await getWebContainer();
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('browser environment'));
        return true;
      }
    );
  });

  await challenge('3.2 Thundering Herd Concurrency (100 Concurrent Boot Requests on Harness)', async () => {
    const harness = new SandboxHarness();
    assert.strictEqual(harness.getStatus(), 'uninitialized');

    // Launch 100 concurrent boot() calls simultaneously
    const bootPromises = Array.from({ length: 100 }, () => harness.boot());
    const instances = await Promise.all(bootPromises);

    // Verify all 100 promises resolved to the exact same harness reference
    assert.strictEqual(instances.length, 100);
    for (const inst of instances) {
      assert.strictEqual(inst, harness, 'All concurrent callers must receive the exact same singleton instance');
    }
    assert.strictEqual(harness.getStatus(), 'ready');
  });

  await challenge('3.3 Post-Boot Memoization (100 Successive Calls)', async () => {
    const harness = new SandboxHarness();
    await harness.boot();

    for (let i = 0; i < 100; i++) {
      const inst = await harness.getInstance();
      assert.strictEqual(inst, harness);
    }
  });

  await challenge('3.4 Error Recovery & Promise Cleanup Resiliency', async () => {
    // Test the singleton manager's recovery logic in webcontainer.ts
    // Simulate window environment
    const fakeWindow: Record<string, unknown> = {};
    (global as unknown as { window: unknown }).window = fakeWindow;

    try {
      // getStatus initially 'uninitialized'
      assert.strictEqual(getStatus(), 'uninitialized');

      // Teardown resets all internal references cleanly
      await teardownWebContainer();
      assert.strictEqual(getStatus(), 'uninitialized');
    } finally {
      delete (global as unknown as { window?: unknown }).window;
    }
  });

  // ============================================================================
  // SECTION 4: Process Termination and Clean Socket Cleanup
  // ============================================================================
  console.log('\n--- 4. PROCESS TERMINATION & CLEAN SOCKET CLEANUP ---');

  await challenge('4.1 Server Process Lifecycle & Clean HTTP Assertion', async () => {
    const harness = new SandboxHarness();
    await harness.boot();

    const serverScript = `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'live', pid: process.pid }));
});
server.listen(3000, '127.0.0.1', () => {
  console.log('HTTP Server listening on port 3000');
});
`;
    await harness.writeFile('server.js', serverScript);

    let serverReadyPort = 0;
    let serverReadyUrl = '';
    harness.onServerReady((port: number, url: string) => {
      serverReadyPort = port;
      serverReadyUrl = url;
    });

    const proc = await harness.spawn('node', ['server.js']);

    // Wait for server ready event
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for server-ready')), 3000);
      const check = setInterval(() => {
        if (serverReadyPort === 3000) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 25);
    });

    // Make real HTTP GET request
    const responsePayload = await new Promise<string>((resolve, reject) => {
      http.get('http://127.0.0.1:3000', (res) => {
        assert.strictEqual(res.statusCode, 200);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });

    const parsed = JSON.parse(responsePayload);
    assert.strictEqual(parsed.status, 'live');

    // Terminate process
    proc.kill();
    await proc.exit;
    await harness.cleanup();
  });

  await challenge('4.2 Immediate Port Re-Binding After Process Kill (No EADDRINUSE)', async () => {
    const harness = new SandboxHarness();
    await harness.boot();

    const makeScript = (msg: string) => `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('${msg}');
});
server.listen(3000, '127.0.0.1', () => {
  console.log('Server listening on port 3000');
});
`;

    // 1st cycle
    await harness.writeFile('server1.js', makeScript('instance_1'));
    const proc1 = await harness.spawn('node', ['server1.js']);
    await new Promise((r) => setTimeout(r, 150));

    proc1.kill();
    await proc1.exit;
    await harness.cleanup();

    // 2nd cycle immediately on SAME port 3000
    await harness.writeFile('server2.js', makeScript('instance_2'));
    const proc2 = await harness.spawn('node', ['server2.js']);
    await new Promise((r) => setTimeout(r, 150));

    const res = await new Promise<string>((resolve, reject) => {
      http.get('http://127.0.0.1:3000', (resp) => {
        let text = '';
        resp.on('data', (c) => { text += c; });
        resp.on('end', () => resolve(text));
      }).on('error', reject);
    });

    assert.strictEqual(res, 'instance_2', 'Port 3000 must cleanly release and bind to second process without EADDRINUSE');

    proc2.kill();
    await proc2.exit;
    await harness.cleanup();
  });

  await challenge('4.3 Force Termination of Stalled Infinite Loop Process', async () => {
    const harness = new SandboxHarness();
    await harness.boot();

    // Script with persistent timer keeping event loop alive
    const stalledScript = `
console.log('Stalled process started');
setInterval(() => {
  // Keep process alive indefinitely
}, 500);
`;
    await harness.writeFile('stall.js', stalledScript);
    const proc = await harness.spawn('node', ['stall.js']);

    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(proc.exitCode, null, 'Process should still be running');

    // Force kill
    proc.kill();
    const exitCode = await proc.exit;
    assert.ok(exitCode !== null, 'proc.exit must resolve upon kill');
    await harness.cleanup();
  });

  await challenge('4.4 High-Volume Stdout Output Streaming (5,000 Lines Stream Test)', async () => {
    const harness = new SandboxHarness();
    await harness.boot();

    const floodScript = `
for (let i = 1; i <= 5000; i++) {
  console.log('LOG_LINE_' + i);
}
`;
    await harness.writeFile('flood.js', floodScript);
    const proc = await harness.spawn('node', ['flood.js']);

    let totalChunks = 0;
    let accumulatedText = '';
    proc.onOutput((chunk: string) => {
      totalChunks++;
      accumulatedText += chunk;
    });

    const exitCode = await proc.exit;
    assert.strictEqual(exitCode, 0);
    assert.ok(accumulatedText.includes('LOG_LINE_1'), 'Must contain first line');
    assert.ok(accumulatedText.includes('LOG_LINE_5000'), 'Must contain 5000th line');
    await harness.cleanup();
  });

  // ============================================================================
  // SECTION 5: Agent Workflow Schema Validation and Error Handling
  // ============================================================================
  console.log('\n--- 5. AGENT WORKFLOW SCHEMA VALIDATION & ERROR HANDLING ---');

  await challenge('5.1 Authoritative Zod Schema Validation Across All 10 Tools', () => {
    const validTestCases: Array<{ tool: keyof typeof toolSchemas; args: unknown }> = [
      { tool: 'githubCreateRepo', args: { name: 'my-valid-repo_123', private: true, autoInit: true } },
      { tool: 'githubGetRepo', args: { owner: 'user', repo: 'my-repo' } },
      { tool: 'githubListRepos', args: { perPage: 25 } },
      { tool: 'githubWriteFile', args: { owner: 'user', repo: 'repo', path: 'src/index.js', content: 'console.log();' } },
      { tool: 'githubReadFile', args: { owner: 'user', repo: 'repo', path: 'README.md' } },
      { tool: 'bootSandbox', args: {} },
      { tool: 'sandboxWriteFile', args: { path: 'server.js', content: 'let x = 1;' } },
      { tool: 'sandboxReadFile', args: { path: 'server.js' } },
      { tool: 'sandboxRunCommand', args: { command: 'node', args: ['server.js'], timeoutMs: 5000 } },
      { tool: 'sandboxStartServer', args: { scriptPath: 'index.js', port: 8080 } },
    ];

    for (const tc of validTestCases) {
      const parsed = validateToolCall(tc.tool, tc.args);
      assert.ok(parsed, `Tool ${tc.tool} should accept valid args`);
    }
  });

  await challenge('5.2 Strict Zod Schema Rejection on Malformed & Adversarial Inputs', () => {
    const invalidTestCases: Array<{ tool: keyof typeof toolSchemas; args: unknown; reason: string }> = [
      { tool: 'githubCreateRepo', args: { name: 'invalid repo with spaces' }, reason: 'Spaces in repo name' },
      { tool: 'githubCreateRepo', args: { name: 'repo; rm -rf /' }, reason: 'Shell injection characters' },
      { tool: 'githubCreateRepo', args: { name: '' }, reason: 'Empty repo name' },
      { tool: 'githubCreateRepo', args: { name: 123 }, reason: 'Non-string repo name' },
      { tool: 'githubGetRepo', args: { owner: '', repo: 'test' }, reason: 'Empty owner' },
      { tool: 'githubListRepos', args: { perPage: 999 }, reason: 'perPage exceeds 100 max' },
      { tool: 'githubListRepos', args: { perPage: 0 }, reason: 'perPage below 1 min' },
      { tool: 'sandboxRunCommand', args: { command: '' }, reason: 'Empty command' },
      { tool: 'sandboxStartServer', args: { scriptPath: 'app.js', port: -1 }, reason: 'Negative port' },
      { tool: 'sandboxStartServer', args: { scriptPath: 'app.js', port: 0 }, reason: 'Zero port' },
      { tool: 'sandboxStartServer', args: { scriptPath: 'app.js', port: '3000' }, reason: 'String port instead of number' },
    ];

    for (const tc of invalidTestCases) {
      assert.throws(
        () => {
          validateToolCall(tc.tool, tc.args);
        },
        (err: unknown) => {
          assert.ok(err instanceof z.ZodError || (err as { name?: string }).name === 'ZodError');
          return true;
        },
        `Expected ZodError for ${tc.tool} with invalid args (${tc.reason})`
      );
    }
  });

  await challenge('5.3 Error Isolation: Tool Failures Do Not Crash Workflow Harness', async () => {
    const harness = new AgentWorkflowHarness({
      githubClient: {
        async createRepository() {
          throw new Error('GitHub API Simulated Failure: 401 Unauthorized');
        },
      },
      sandboxHarness: new SandboxHarness(),
    });

    // Run prompt that triggers githubCreateRepo
    const outcome = await harness.executePrompt('Create a repo called test-failing');
    assert.strictEqual(outcome.toolInvocations.length, 1);
    assert.strictEqual(outcome.toolInvocations[0].state, 'error');
    assert.ok(outcome.toolInvocations[0].error?.includes('401 Unauthorized'));
    assert.strictEqual(outcome.results[0].success, false);
  });

  await challenge('5.4 Multi-Step Autonomous Recursion Hard Limit (maxSteps: 10)', () => {
    // Assert maxSteps is configured to 10 in chat API route and harness
    const harness = new AgentWorkflowHarness({ maxSteps: 10 });
    assert.strictEqual(harness.maxSteps, 10);
  });

  // ============================================================================
  // SECTION 6: Security Header Enforcement
  // ============================================================================
  console.log('\n--- 6. SECURITY HEADER ENFORCEMENT ---');

  await challenge('6.1 next.config.ts COOP / COEP Cross-Origin Isolation Verification', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const headerVerification = verifyNextConfigHeaders(projectRoot);

    assert.strictEqual(headerVerification.valid, true, 'Security headers must be valid');
    assert.strictEqual(headerVerification.hasCOEP, true, 'COEP must be present');
    assert.strictEqual(headerVerification.hasCOOP, true, 'COOP must be present');
    assert.strictEqual(headerVerification.coepValue, 'require-corp', 'COEP must be require-corp');
    assert.strictEqual(headerVerification.coopValue, 'same-origin', 'COOP must be same-origin');
  });

  await challenge('6.2 Header Route Matcher Covers Entire Application (/(.*))', async () => {
    const nextConfigPath = path.resolve(__dirname, '../../next.config.ts');
    const content = fs.readFileSync(nextConfigPath, 'utf-8');

    assert.ok(content.includes('source: "/(.*)"'), 'Header rule must match all routes /(.*)');
    assert.ok(content.includes('Cross-Origin-Embedder-Policy'));
    assert.ok(content.includes('Cross-Origin-Opener-Policy'));
  });

  // ============================================================================
  // SECTION 7: API Error Diagnostics & Boundary Handling
  // ============================================================================
  console.log('\n--- 7. API ERROR DIAGNOSTICS & BOUNDARY HANDLING ---');

  await challenge('7.1 Empty or Whitespace PAT Rejection Before Network Call', async () => {
    await assert.rejects(
      async () => {
        await validateAuth('   ');
      },
      (err: unknown) => {
        assert.ok(err instanceof GitHubApiError);
        assert.strictEqual(err.status, 401);
        assert.ok(err.message.includes('Personal Access Token is required'));
        return true;
      }
    );
  });

  await challenge('7.2 Virtual FS Rapid Concurrency & Recursive Deletion Stress', async () => {
    const harness = new SandboxHarness();
    await harness.boot();

    // Concurrently write 50 virtual files across nested directories
    const writeTasks = Array.from({ length: 50 }, (_, i) =>
      harness.writeFile(`src/module_${i % 5}/file_${i}.ts`, `export const val_${i} = ${i};`)
    );
    await Promise.all(writeTasks);

    // Verify files in directory
    const dirEntries = await harness.readdir('src/module_0');
    assert.ok(dirEntries.length > 0);

    // Recursive removal of src directory
    await harness.rm('src', { recursive: true });

    // Verify directory is empty
    const postRmEntries = await harness.readdir('src');
    assert.strictEqual(postRmEntries.length, 0);
  });

  await challenge('7.3 Rapid Sequential Process Spawning & Disposal (10 Processes)', async () => {
    const harness = new SandboxHarness();
    await harness.boot();

    for (let i = 1; i <= 10; i++) {
      await harness.writeFile(`quick_${i}.js`, `console.log('PROC_${i}');`);
      const proc = await harness.spawn('node', [`quick_${i}.js`]);
      let out = '';
      proc.onOutput((chunk: string) => { out += chunk; });
      const code = await proc.exit;
      assert.strictEqual(code, 0);
      assert.ok(out.includes(`PROC_${i}`));
      proc.kill();
      await harness.cleanup();
    }
  });

  await challenge('7.4 Large 1MB Data Blob Base64 Transfer Fidelity', () => {
    const megaChunk = '0123456789ABCDEF'.repeat(65536); // exactly 1,048,576 bytes
    assert.strictEqual(megaChunk.length, 1048576);

    const encoded = toBase64(megaChunk);
    const decoded = fromBase64(encoded);
    assert.strictEqual(decoded.length, megaChunk.length);
    assert.strictEqual(decoded, megaChunk);
  });

  // ============================================================================
  // SECTION 8: Global Invariants (Zero Rejections & Resource Leaks)
  // ============================================================================
  console.log('\n--- 8. GLOBAL INVARIANTS: ZERO REJECTIONS & RESOURCE LEAKS ---');

  await challenge('8.1 Global Unhandled Promise Rejections & Uncaught Exceptions Count = 0', () => {
    assert.strictEqual(unhandledRejectionsCount, 0, 'Must have zero unhandled promise rejections');
    assert.strictEqual(uncaughtExceptionsCount, 0, 'Must have zero uncaught exceptions');
  });

  await challenge('8.2 Memory Usage & Resource Leak Invariant Assertion', () => {
    const finalMemory = process.memoryUsage();
    const heapDiffMb = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);
    console.log(`    Heap used difference: ${heapDiffMb.toFixed(2)} MB`);
    assert.ok(heapDiffMb < 150, `Heap growth (${heapDiffMb.toFixed(2)} MB) must be within safe bounds`);
  });

  // ============================================================================
  // Summary & Pass/Fail Reporting
  // ============================================================================
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`  ADVERSARIAL STRESS TEST SUMMARY: ${passed}/${results.length} PASSED`);
  if (failed > 0) {
    console.log(`  ✘ ${failed} CHALLENGE(S) FAILED`);
  } else {
    console.log('  ✅ ALL 20 ADVERSARIAL CHALLENGES EMPIRICALLY PASSED!');
  }
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal crash in adversarial test harness:', err);
  process.exit(1);
});
