/**
 * Tier 1 Test Suite: Core Feature Coverage
 * Exercises all primary features across GitHub integration, WebContainer runtime,
 * and AI Agent tooling contracts (happy path).
 */
const path = require('node:path');
const assert = require('./helpers/assert');
const { MockGitHubServer, createGitHubClient } = require('./helpers/github-mock-server');
const { SandboxHarness, verifyNextConfigHeaders } = require('./helpers/sandbox-harness');
const { validateToolCall, toolSchemas } = require('./helpers/agent-harness');

async function run(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '../..');
  const results = [];
  const server = new MockGitHubServer();
  const sandbox = new SandboxHarness();

  let baseUrl = '';
  let githubClient = null;
  const token = 'ghp_valid_test_token_123456789';

  try {
    baseUrl = await server.start();
    githubClient = createGitHubClient({ baseUrl });
    await sandbox.boot();

    // 1. Feature: Next.js Security Headers
    try {
      const headers = verifyNextConfigHeaders(projectRoot);
      assert.strictEqual(headers.valid, true);
      results.push({ name: 'Tier 1 - COOP/COEP Security Headers', passed: true, details: 'Verified require-corp and same-origin' });
    } catch (err) {
      results.push({ name: 'Tier 1 - COOP/COEP Security Headers', passed: false, error: err.message });
    }

    // 2. Feature: GitHub User Auth & Profile
    try {
      const user = await githubClient.validateAuth(token);
      assert.strictEqual(user.login, 'test-agent-user');
      assert.strictEqual(user.id, 98765432);
      assert.ok(user.avatarUrl);
      results.push({ name: 'Tier 1 - GitHub User Auth & Identity', passed: true, details: `Validated ${user.login}` });
    } catch (err) {
      results.push({ name: 'Tier 1 - GitHub User Auth & Identity', passed: false, error: err.message });
    }

    // 3. Feature: GitHub Repo Creation & Get Metadata
    try {
      const repo = await githubClient.createRepository(token, {
        name: 'tier1-feature-repo',
        description: 'Testing feature 1',
        private: false,
        autoInit: true,
      });
      assert.strictEqual(repo.name, 'tier1-feature-repo');
      assert.strictEqual(repo.private, false);

      const fetched = await githubClient.getRepository(token, 'test-agent-user', 'tier1-feature-repo');
      assert.strictEqual(fetched.name, 'tier1-feature-repo');
      assert.strictEqual(fetched.defaultBranch, 'main');
      results.push({ name: 'Tier 1 - GitHub Repo Creation & Metadata Retrieval', passed: true, details: 'Created and fetched repo' });
    } catch (err) {
      results.push({ name: 'Tier 1 - GitHub Repo Creation & Metadata Retrieval', passed: false, error: err.message });
    }

    // 4. Feature: GitHub File CRUD Operations
    try {
      const write = await githubClient.writeFile(token, 'test-agent-user', 'tier1-feature-repo', 'src/app.js', 'console.log("Tier 1");');
      assert.ok(write.contentSha);

      const read = await githubClient.readFile(token, 'test-agent-user', 'tier1-feature-repo', 'src/app.js');
      assert.strictEqual(read.content, 'console.log("Tier 1");');
      assert.strictEqual(read.sha, write.contentSha);
      results.push({ name: 'Tier 1 - GitHub File Create & Read Operations', passed: true, details: 'Verified src/app.js write/read cycle' });
    } catch (err) {
      results.push({ name: 'Tier 1 - GitHub File Create & Read Operations', passed: false, error: err.message });
    }

    // 5. Feature: WebContainer Virtual Filesystem Operations
    try {
      await sandbox.writeFile('data/config.json', '{"env":"test","port":8080}');
      const content = await sandbox.readFile('data/config.json');
      assert.strictEqual(content, '{"env":"test","port":8080}');

      const dirContents = await sandbox.readdir('data');
      assert.ok(dirContents.includes('config.json'));

      await sandbox.rm('data/config.json');
      let deleted = false;
      try {
        await sandbox.readFile('data/config.json');
      } catch (e) {
        deleted = true;
      }
      assert.strictEqual(deleted, true, 'File data/config.json must be deleted');
      results.push({ name: 'Tier 1 - Virtual Filesystem (FS) Operations', passed: true, details: 'Verified writeFile, readFile, readdir, rm' });
    } catch (err) {
      results.push({ name: 'Tier 1 - Virtual Filesystem (FS) Operations', passed: false, error: err.message });
    }

    // 6. Feature: WebContainer Process Spawning & Output
    try {
      const proc = await sandbox.spawn('echo', ['hello', 'tier', '1']);
      let output = '';
      proc.onOutput((chunk) => { output += chunk; });
      const code = await proc.exit;
      assert.strictEqual(code, 0);
      assert.includes(output, 'hello tier 1');
      results.push({ name: 'Tier 1 - Process Spawning & Stream Output', passed: true, details: 'Spawned echo and captured stream' });
    } catch (err) {
      results.push({ name: 'Tier 1 - Process Spawning & Stream Output', passed: false, error: err.message });
    }

    // 7. Feature: Zod Tool Schemas Comprehensive Validation
    try {
      const toolNames = Object.keys(toolSchemas);
      assert.ok(toolNames.length >= 8, 'Expected at least 8 tools in schema inventory');

      // Validate valid payloads
      validateToolCall('githubCreateRepo', { name: 'my-repo', private: true });
      validateToolCall('githubGetRepo', { owner: 'user', repo: 'my-repo' });
      validateToolCall('githubListRepos', { perPage: 25 });
      validateToolCall('githubWriteFile', { owner: 'user', repo: 'my-repo', path: 'index.js', content: 'code' });
      validateToolCall('githubReadFile', { owner: 'user', repo: 'my-repo', path: 'index.js' });
      validateToolCall('sandboxWriteFile', { path: 'index.js', content: 'code' });
      validateToolCall('sandboxReadFile', { path: 'index.js' });
      validateToolCall('sandboxRunCommand', { command: 'node', args: ['index.js'] });

      results.push({ name: 'Tier 1 - AI SDK Tool Schemas Validation', passed: true, details: `All ${toolNames.length} tool schemas passed validation` });
    } catch (err) {
      results.push({ name: 'Tier 1 - AI SDK Tool Schemas Validation', passed: false, error: err.message });
    }

  } finally {
    await server.stop();
    await sandbox.cleanup();
  }

  return results;
}

module.exports = {
  name: 'Tier 1: Feature Coverage Suite',
  run,
};
