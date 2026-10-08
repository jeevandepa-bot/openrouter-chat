/**
 * Unit & Integration Test Suite for Milestone M2: GitHub REST API Client & Verifier
 */
import assert from 'node:assert';
import {
  toBase64,
  fromBase64,
  validateAuth,
  listRepositories,
  createRepository,
  getRepository,
  readFile,
  writeFile,
  deleteRepository,
  getTree,
  createGitHubClient,
  githubClient,
  GitHubApiError,
} from '../src/lib/github';
import {
  runGitHubVerificationTest,
  verifyGitHub,
} from '../src/lib/github-verifier';
import { MockGitHubServer } from './e2e/helpers/github-mock-server';

async function run() {
  console.log('======================================================');
  console.log('  Milestone M2: GitHub Client & Verifier Test Suite   ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✔ PASS: ${name}`);
        passed++;
      } catch (err: unknown) {
        console.error(`  ✘ FAIL: ${name}`);
        console.error('    Error:', err instanceof Error ? err.message : String(err));
        failed++;
      }
    })();
  }

  // 1. Base64 encoding & decoding tests
  await test('Base64 ASCII Roundtrip', () => {
    const original = 'Hello World from Cloud Coding Agent!';
    const encoded = toBase64(original);
    const decoded = fromBase64(encoded);
    assert.strictEqual(decoded, original);
  });

  await test('Base64 Multibyte Unicode & Emojis Roundtrip', () => {
    const unicodeStrings = [
      '🚀 ⚡ 💻 🌍 ✨',
      'こんにちは世界 (Japanese)',
      '你好世界 (Chinese)',
      'नमस्ते दुनिया (Hindi)',
      'Привет мир (Russian)',
      'Café, München, niño, façade (Accents)',
      'Special chars: <>&"\'!@#$%^&*()_+=-`~[]{}|\\;:,./?',
    ];

    for (const str of unicodeStrings) {
      const encoded = toBase64(str);
      const decoded = fromBase64(encoded);
      assert.strictEqual(decoded, str, `Failed for string: ${str}`);
    }
  });

  await test('Base64 Whitespace & Newline Sanitization', () => {
    const original = 'This is a test of GitHub whitespace handling in base64 blobs.';
    const encoded = toBase64(original);
    // Simulate GitHub REST API inserting newlines every 60 chars or whitespace
    const withWhitespace = encoded.slice(0, 20) + '\n  \r\n' + encoded.slice(20, 40) + '\t \n' + encoded.slice(40);
    const decoded = fromBase64(withWhitespace);
    assert.strictEqual(decoded, original);
  });

  await test('Base64 Empty String', () => {
    assert.strictEqual(toBase64(''), '');
    assert.strictEqual(fromBase64(''), '');
  });

  // Start Mock Server for API client testing
  const server = new MockGitHubServer();
  const baseUrl: string = await server.start();
  const validToken = 'ghp_valid_test_token_123456789';
  const invalidToken = 'ghp_invalid_token_999999999';

  try {
    // 2. Auth Validation tests
    await test('validateAuth - Success with valid token', async () => {
      const user = await validateAuth(validToken, { baseUrl });
      assert.strictEqual(user.login, 'test-agent-user');
      assert.strictEqual(user.id, 98765432);
      assert.ok(user.htmlUrl.includes('test-agent-user'));
    });

    await test('validateAuth - Rejects invalid token with 401 GitHubApiError', async () => {
      await assert.rejects(
        async () => {
          await validateAuth(invalidToken, { baseUrl });
        },
        (err: unknown) => {
          assert.ok(err instanceof GitHubApiError);
          assert.strictEqual(err.status, 401);
          return true;
        }
      );
    });

    // 3. Repository CRUD tests
    const repoName = `test-m2-repo-${Date.now()}`;
    await test('createRepository - Creates private repo with autoInit', async () => {
      const repo = await createRepository(validToken, {
        name: repoName,
        description: 'M2 Unit Test Repository',
        private: true,
        autoInit: true,
        baseUrl,
      });

      assert.strictEqual(repo.name, repoName);
      assert.strictEqual(repo.private, true);
      assert.strictEqual(repo.defaultBranch, 'main');
    });

    await test('getRepository - Fetches created repository metadata', async () => {
      const repo = await getRepository(validToken, 'test-agent-user', repoName, { baseUrl });
      assert.strictEqual(repo.name, repoName);
      assert.strictEqual(repo.private, true);
    });

    await test('listRepositories - Lists repos including newly created one', async () => {
      const repos = await listRepositories(validToken, { baseUrl });
      const found = repos.find((r) => r.name === repoName);
      assert.ok(found, `Repository ${repoName} should exist in list`);
      assert.strictEqual(found?.private, true);
    });

    // 4. File CRUD tests
    const filePath = 'src/test-file.txt';
    const initialContent = 'Hello from M2 Test Suite! Unicode: 🚀';
    let contentSha = '';

    await test('writeFile - Creates new file with automatic SHA resolution', async () => {
      const result = await writeFile(
        validToken,
        'test-agent-user',
        repoName,
        filePath,
        initialContent,
        'Add test-file.txt',
        { baseUrl }
      );

      assert.strictEqual(result.path, filePath);
      assert.ok(result.commitSha);
      assert.ok(result.contentSha);
      assert.strictEqual(result.updated, false);
      contentSha = result.contentSha;
    });

    await test('readFile - Reads file and decodes UTF-8 content', async () => {
      const file = await readFile(validToken, 'test-agent-user', repoName, filePath, { baseUrl });
      assert.strictEqual(file.path, filePath);
      assert.strictEqual(file.content, initialContent);
      assert.strictEqual(file.sha, contentSha);
    });

    await test('writeFile - Updates existing file by auto-resolving SHA', async () => {
      const updatedContent = 'Updated M2 content! ⚡ 🎉';
      const result = await writeFile(
        validToken,
        'test-agent-user',
        repoName,
        filePath,
        updatedContent,
        'Update test-file.txt',
        { baseUrl }
      );

      assert.strictEqual(result.path, filePath);
      assert.ok(result.commitSha);
      assert.strictEqual(result.updated, true);

      // Verify readback matches updated content
      const readBack = await readFile(validToken, 'test-agent-user', repoName, filePath, { baseUrl });
      assert.strictEqual(readBack.content, updatedContent);
    });

    await test('getTree - Recursively inspects Git tree', async () => {
      const tree = await getTree(validToken, 'test-agent-user', repoName, 'main', true, { baseUrl });
      assert.ok(Array.isArray(tree.tree));
      const hasFile = tree.tree.some((item) => item.path === filePath);
      assert.ok(hasFile, 'Tree should contain written file');
    });

    // 5. Client factory tests
    await test('createGitHubClient - Pre-bound client instance operations', async () => {
      const client = createGitHubClient(validToken, { baseUrl });
      const user = await client.validateAuth();
      assert.strictEqual(user.login, 'test-agent-user');

      const repos = await client.listRepositories();
      assert.ok(repos.length > 0);
    });

    await test('githubClient - Default object interface', async () => {
      assert.strictEqual(typeof githubClient.validateAuth, 'function');
      assert.strictEqual(typeof githubClient.listRepositories, 'function');
      assert.strictEqual(typeof githubClient.createRepository, 'function');
      assert.strictEqual(typeof githubClient.getRepository, 'function');
      assert.strictEqual(typeof githubClient.readFile, 'function');
      assert.strictEqual(typeof githubClient.writeFile, 'function');
    });

    // 6. Automated GitHub Verifier Routine (Acceptance Criterion 1)
    await test('runGitHubVerificationTest - Full AC1 4-step sequence execution', async () => {
      const result = await runGitHubVerificationTest(validToken, {
        baseUrl,
        customRepoName: `verify-ac1-suite-${Date.now()}`,
      });

      assert.strictEqual(result.success, true, 'Verification should report success');
      assert.strictEqual(result.steps.length, 4, 'Should execute 4 verification steps');
      assert.ok(result.steps.every((s) => s.ok), 'All verification steps should be ok');
      assert.ok(result.logs.length >= 6, 'Should output detailed timestamped logs');
      assert.ok(result.durationMs > 0, 'Duration should be recorded');
      assert.ok(result.repo.startsWith('verify-ac1-suite-'), 'Repo name should match');
      assert.strictEqual(typeof verifyGitHub, 'function', 'verifyGitHub alias should exist');
    });

    await test('runGitHubVerificationTest - Fails gracefully with invalid token', async () => {
      const result = await runGitHubVerificationTest(invalidToken, {
        baseUrl,
      });

      assert.strictEqual(result.success, false, 'Verification should report failure');
      assert.ok(result.error?.includes('401') || result.error?.includes('credentials'));
      assert.strictEqual(result.steps[0].ok, false);
    });

  } finally {
    await server.stop();
  }

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
