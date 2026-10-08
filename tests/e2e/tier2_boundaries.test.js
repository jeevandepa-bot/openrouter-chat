/**
 * Tier 2 Test Suite: Boundary & Corner Cases (Negative Testing & Resilience)
 * Validates error codes (401, 404, 409, 422), schema rejection, non-zero exits,
 * Unicode edge cases, and failure cascading.
 */
const assert = require('./helpers/assert');
const { MockGitHubServer, createGitHubClient } = require('./helpers/github-mock-server');
const { SandboxHarness } = require('./helpers/sandbox-harness');
const { validateToolCall, AgentWorkflowHarness } = require('./helpers/agent-harness');

async function run() {
  const results = [];
  const server = new MockGitHubServer();
  const sandbox = new SandboxHarness();

  let baseUrl = '';
  let githubClient = null;
  const validToken = 'ghp_valid_test_token_123456789';

  try {
    baseUrl = await server.start();
    githubClient = createGitHubClient({ baseUrl });
    await sandbox.boot();

    // 1. GitHub: 401 Bad credentials on invalid token
    try {
      let threw401 = false;
      try {
        await githubClient.validateAuth('invalid_token_xyz');
      } catch (err) {
        if (err.status === 401 || err.message.includes('Bad credentials')) {
          threw401 = true;
        }
      }
      assert.strictEqual(threw401, true, 'Must reject invalid token with HTTP 401');
      results.push({ name: 'Tier 2 - GitHub 401 Bad Credentials Rejection', passed: true, details: 'Correctly rejected invalid token' });
    } catch (err) {
      results.push({ name: 'Tier 2 - GitHub 401 Bad Credentials Rejection', passed: false, error: err.message });
    }

    // 2. GitHub: 422 Unprocessable Entity on duplicate repo name
    try {
      await githubClient.createRepository(validToken, { name: 'duplicate-test-repo', private: true });
      let threw422 = false;
      try {
        await githubClient.createRepository(validToken, { name: 'duplicate-test-repo', private: true });
      } catch (err) {
        if (err.status === 422 || err.message.includes('already exists')) {
          threw422 = true;
        }
      }
      assert.strictEqual(threw422, true, 'Must reject duplicate repo name with HTTP 422');
      results.push({ name: 'Tier 2 - GitHub 422 Duplicate Repo Rejection', passed: true, details: 'Correctly rejected duplicate repository name' });
    } catch (err) {
      results.push({ name: 'Tier 2 - GitHub 422 Duplicate Repo Rejection', passed: false, error: err.message });
    }

    // 3. GitHub: 404 Not Found on nonexistent repo and nonexistent file
    try {
      let threw404Repo = false;
      try {
        await githubClient.getRepository(validToken, 'test-agent-user', 'nonexistent-repo-999');
      } catch (err) {
        if (err.status === 404) threw404Repo = true;
      }
      assert.strictEqual(threw404Repo, true, 'Must return 404 for nonexistent repo');

      let threw404File = false;
      try {
        await githubClient.readFile(validToken, 'test-agent-user', 'duplicate-test-repo', 'nonexistent/file.txt');
      } catch (err) {
        if (err.status === 404) threw404File = true;
      }
      assert.strictEqual(threw404File, true, 'Must return 404 for nonexistent file');

      results.push({ name: 'Tier 2 - GitHub 404 Not Found Verification', passed: true, details: 'Correctly handled nonexistent repo and file with 404' });
    } catch (err) {
      results.push({ name: 'Tier 2 - GitHub 404 Not Found Verification', passed: false, error: err.message });
    }

    // 4. Unicode & Multibyte Base64 Encoding/Decoding
    try {
      const complexString = 'Multibyte string: 日本語 ⚡ 🚀 😊 \nNewlines \r\n and tabs \t & special chars: <>&"\'';
      await githubClient.writeFile(validToken, 'test-agent-user', 'duplicate-test-repo', 'unicode.txt', complexString, 'Add unicode.txt');
      const readBack = await githubClient.readFile(validToken, 'test-agent-user', 'duplicate-test-repo', 'unicode.txt');
      assert.strictEqual(readBack.content, complexString, 'Content must preserve multibyte characters and newlines');
      results.push({ name: 'Tier 2 - Base64 Encoding Unicode & Multiline Fidelity', passed: true, details: 'Successfully round-tripped multibyte unicode string' });
    } catch (err) {
      results.push({ name: 'Tier 2 - Base64 Encoding Unicode & Multiline Fidelity', passed: false, error: err.message });
    }

    // 5. Sandbox: Script Syntax Error / Non-zero Exit Code Handling
    try {
      await sandbox.writeFile('syntax-error.js', 'const x = ; // intentional syntax error');
      const proc = await sandbox.spawn('node', ['syntax-error.js']);
      let output = '';
      proc.onOutput((chunk) => { output += chunk; });
      const exitCode = await proc.exit;
      assert.ok(exitCode !== 0, 'Script with syntax error must exit with non-zero exit code');
      assert.ok(output.includes('SyntaxError') || output.includes('error'), 'Output must capture syntax error message');
      results.push({ name: 'Tier 2 - Sandbox Script Syntax Error & Non-Zero Exit', passed: true, details: `Captured error stream (exitCode: ${exitCode})` });
    } catch (err) {
      results.push({ name: 'Tier 2 - Sandbox Script Syntax Error & Non-Zero Exit', passed: false, error: err.message });
    }

    // 6. Zod Tool Schema Validation Rejections (Malformed Inputs)
    try {
      let ghInvalidName = false;
      try {
        validateToolCall('githubCreateRepo', { name: 'invalid repo with spaces!!!' });
      } catch (err) {
        ghInvalidName = true;
      }
      assert.strictEqual(ghInvalidName, true, 'githubCreateRepo must reject names with spaces and special characters');

      let ghMissingPath = false;
      try {
        validateToolCall('githubWriteFile', { owner: 'user', repo: 'r', content: 'code' }); // missing path
      } catch (err) {
        ghMissingPath = true;
      }
      assert.strictEqual(ghMissingPath, true, 'githubWriteFile must reject when path is omitted');

      let sbInvalidPerPage = false;
      try {
        validateToolCall('githubListRepos', { perPage: 9999 }); // max 100
      } catch (err) {
        sbInvalidPerPage = true;
      }
      assert.strictEqual(sbInvalidPerPage, true, 'githubListRepos must reject perPage exceeding 100');

      results.push({ name: 'Tier 2 - Zod Schema Rejection on Malformed Inputs', passed: true, details: 'Strict schema successfully blocked invalid tool arguments' });
    } catch (err) {
      results.push({ name: 'Tier 2 - Zod Schema Rejection on Malformed Inputs', passed: false, error: err.message });
    }

    // 7. Agent Error Recovery: Failure in tool execution reported cleanly
    try {
      const agent = new AgentWorkflowHarness({
        githubClient,
        sandboxHarness: sandbox,
      });

      // Try executing with invalid token
      const result = await agent.executePrompt('Create a repo called failtest and run a hello world script', 'invalid_token');
      const failedGh = result.results.find((r) => r.toolName === 'githubCreateRepo');
      assert.ok(failedGh, 'GitHub tool execution must be recorded');
      assert.strictEqual(failedGh.success, false, 'Tool execution with invalid token must record failure');
      assert.ok(failedGh.error, 'Error message must be captured for feedback');

      results.push({ name: 'Tier 2 - Agent Autonomous Error Capture & Isolation', passed: true, details: 'Tool failure was captured and isolated cleanly without crashing harness' });
    } catch (err) {
      results.push({ name: 'Tier 2 - Agent Autonomous Error Capture & Isolation', passed: false, error: err.message });
    }

  } finally {
    await server.stop();
    await sandbox.cleanup();
  }

  return results;
}

module.exports = {
  name: 'Tier 2: Boundary & Corner Cases Suite',
  run,
};
