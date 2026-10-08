/**
 * AC1 Test Suite: GitHub Verification
 * Validates Acceptance Criterion 1:
 * "A test script or UI button successfully authenticates with GitHub,
 *  creates a new private repository, writes a text file to it, and reads the file back."
 */
const assert = require('./helpers/assert');
const { MockGitHubServer, createGitHubClient } = require('./helpers/github-mock-server');

async function run(options = {}) {
  const isLive = Boolean(options.live && process.env.GITHUB_TOKEN);
  let server = null;
  let client = null;
  let token = '';

  if (isLive) {
    token = process.env.GITHUB_TOKEN;
    client = createGitHubClient({ baseUrl: 'https://api.github.com' });
  } else {
    server = new MockGitHubServer();
    const baseUrl = await server.start();
    token = 'ghp_valid_test_token_123456789';
    client = createGitHubClient({ baseUrl });
  }

  const results = [];
  const testRepoName = `test-e2e-repo-${Date.now()}`;
  let owner = '';

  try {
    // Test 1: Authenticate with GitHub
    try {
      const user = await client.validateAuth(token);
      assert.ok(user.login, 'User login must not be empty');
      assert.ok(typeof user.id === 'number', 'User ID must be a number');
      owner = user.login;
      results.push({ name: 'AC1.1 - GitHub Authentication', passed: true, details: `Authenticated as ${user.login} (ID: ${user.id})` });
    } catch (err) {
      results.push({ name: 'AC1.1 - GitHub Authentication', passed: false, error: err.message });
      throw err;
    }

    // Test 2: Create a new private repository
    let repo = null;
    try {
      repo = await client.createRepository(token, {
        name: testRepoName,
        description: 'E2E Test Private Repository for AC1 Verification',
        private: true,
        autoInit: true,
      });
      assert.strictEqual(repo.name, testRepoName, 'Repository name must match input');
      assert.strictEqual(repo.private, true, 'Repository must be private');
      assert.ok(repo.id > 0, 'Repository ID must be a positive integer');
      assert.strictEqual(repo.defaultBranch, 'main', 'Default branch should be main');
      results.push({ name: 'AC1.2 - Create Private Repository', passed: true, details: `Created repo ${repo.fullName} (Private: ${repo.private})` });
    } catch (err) {
      results.push({ name: 'AC1.2 - Create Private Repository', passed: false, error: err.message });
      throw err;
    }

    // Test 3: Write a text file to the repository
    const testFileName = 'greeting.txt';
    const testFileContent = 'Hello GitHub! Created by Cloud Coding Agent E2E Verifier.';
    let writeResult = null;
    try {
      writeResult = await client.writeFile(
        token,
        owner,
        testRepoName,
        testFileName,
        testFileContent,
        'Initial commit of greeting.txt'
      );
      assert.strictEqual(writeResult.path, testFileName, 'Write result path must match');
      assert.ok(writeResult.contentSha, 'Content SHA must be generated');
      results.push({ name: 'AC1.3 - Write Text File to Repo', passed: true, details: `Wrote ${testFileName} (SHA: ${writeResult.contentSha.slice(0, 8)}...)` });
    } catch (err) {
      results.push({ name: 'AC1.3 - Write Text File to Repo', passed: false, error: err.message });
      throw err;
    }

    // Test 4: Read the text file back and verify content fidelity
    try {
      const readResult = await client.readFile(token, owner, testRepoName, testFileName);
      assert.strictEqual(readResult.path, testFileName, 'Read path must match');
      assert.strictEqual(readResult.content, testFileContent, 'Read content must exactly match original written content');
      assert.strictEqual(readResult.sha, writeResult.contentSha, 'Read SHA must match write SHA');
      results.push({ name: 'AC1.4 - Read Text File Back', passed: true, details: `Read ${testFileName} verified (Bytes: ${readResult.content.length})` });
    } catch (err) {
      results.push({ name: 'AC1.4 - Read Text File Back', passed: false, error: err.message });
      throw err;
    }

    // Test 5: Update the file and read back (verifying automatic SHA resolution)
    const updatedContent = 'Hello GitHub! Updated with unicode symbols: 🚀 ⚡ 💻';
    try {
      const updateResult = await client.writeFile(
        token,
        owner,
        testRepoName,
        testFileName,
        updatedContent,
        'Update greeting.txt with unicode'
      );
      assert.ok(updateResult.contentSha, 'Updated content SHA must exist');
      const updatedRead = await client.readFile(token, owner, testRepoName, testFileName);
      assert.strictEqual(updatedRead.content, updatedContent, 'Updated content must match with unicode characters');
      results.push({ name: 'AC1.5 - Automatic SHA Resolution & File Update', passed: true, details: 'Successfully resolved SHA and committed updated content' });
    } catch (err) {
      results.push({ name: 'AC1.5 - Automatic SHA Resolution & File Update', passed: false, error: err.message });
      throw err;
    }

    // Test 6: Verify repository appears in user repos list
    try {
      const repos = await client.listRepositories(token, { perPage: 100 });
      const found = repos.some((r) => r.name === testRepoName && r.private === true);
      assert.ok(found, `Repository ${testRepoName} must appear in listRepositories output`);
      results.push({ name: 'AC1.6 - Repository Listing Verification', passed: true, details: `Found ${testRepoName} in user repository list` });
    } catch (err) {
      results.push({ name: 'AC1.6 - Repository Listing Verification', passed: false, error: err.message });
      throw err;
    }

  } finally {
    if (server) {
      await server.stop();
    }
  }

  return results;
}

module.exports = {
  name: 'AC1: GitHub Verification Suite',
  run,
};
