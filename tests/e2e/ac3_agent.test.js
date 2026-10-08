/**
 * AC3 Test Suite: Agent Workflow
 * Validates Acceptance Criterion 3:
 * "When prompted to 'Create a repo called test and run a hello world script',
 *  the AI agent correctly emits the tool calls to perform both the GitHub creation
 *  and the Sandbox execution."
 */
const assert = require('./helpers/assert');
const { MockGitHubServer, createGitHubClient } = require('./helpers/github-mock-server');
const { SandboxHarness } = require('./helpers/sandbox-harness');
const { AgentWorkflowHarness, validateToolCall, toolSchemas } = require('./helpers/agent-harness');

async function run() {
  const results = [];
  const server = new MockGitHubServer();
  const sandbox = new SandboxHarness();
  await sandbox.boot();

  let baseUrl = '';
  let githubClient = null;
  const token = 'ghp_valid_test_token_123456789';

  try {
    baseUrl = await server.start();
    githubClient = createGitHubClient({ baseUrl });

    const agentHarness = new AgentWorkflowHarness({
      githubClient,
      sandboxHarness: sandbox,
      maxSteps: 10,
    });

    // Test 1: Exact AC3 Prompt Tool Emission
    const targetPrompt = 'Create a repo called test and run a hello world script';
    try {
      const planned = agentHarness.planToolCalls(targetPrompt);
      const ghCall = planned.find((c) => c.toolName === 'githubCreateRepo');
      const sbWriteCall = planned.find((c) => c.toolName === 'sandboxWriteFile');
      const sbRunCall = planned.find((c) => c.toolName === 'sandboxRunCommand');

      assert.ok(ghCall, 'Agent must emit a GitHub repository creation tool call (githubCreateRepo)');
      assert.strictEqual(ghCall.args.name, 'test', 'GitHub tool call repo name must be "test"');

      assert.ok(sbWriteCall || sbRunCall, 'Agent must emit a Sandbox execution tool call (sandboxWriteFile/sandboxRunCommand)');
      if (sbWriteCall) {
        assert.includes(sbWriteCall.args.content.toLowerCase(), 'hello', 'Sandbox write call must contain hello world script');
      }

      results.push({
        name: 'AC3.1 - Prompt Emission: Dual GitHub & Sandbox Tool Calls',
        passed: true,
        details: `Emitted GitHub call (${ghCall.toolName}: name="${ghCall.args.name}") and Sandbox call (${sbWriteCall ? sbWriteCall.toolName : sbRunCall.toolName})`,
      });
    } catch (err) {
      results.push({
        name: 'AC3.1 - Prompt Emission: Dual GitHub & Sandbox Tool Calls',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 2: Strict Zod Schema Validation for Emitted Tool Calls
    try {
      const ghArgs = { name: 'test', private: true, autoInit: true };
      const validatedGh = validateToolCall('githubCreateRepo', ghArgs);
      assert.strictEqual(validatedGh.name, 'test');
      assert.strictEqual(validatedGh.private, true);
      assert.strictEqual(validatedGh.autoInit, true);

      const sbWriteArgs = { path: 'hello.js', content: 'console.log("Hello, World!");' };
      const validatedSbWrite = validateToolCall('sandboxWriteFile', sbWriteArgs);
      assert.strictEqual(validatedSbWrite.path, 'hello.js');

      const sbRunArgs = { command: 'node', args: ['hello.js'] };
      const validatedSbRun = validateToolCall('sandboxRunCommand', sbRunArgs);
      assert.strictEqual(validatedSbRun.command, 'node');
      assert.deepStrictEqual(validatedSbRun.args, ['hello.js']);

      results.push({
        name: 'AC3.2 - Zod Schema Validation for Tool Arguments',
        passed: true,
        details: 'Validated tool arguments conform to strict Zod interface contracts',
      });
    } catch (err) {
      results.push({
        name: 'AC3.2 - Zod Schema Validation for Tool Arguments',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 3: End-to-End Autonomous Workflow Execution
    try {
      const executionResult = await agentHarness.executePrompt(targetPrompt, token);
      assert.strictEqual(executionResult.githubToolEmitted, true, 'GitHub tool execution must be recorded');
      assert.strictEqual(executionResult.sandboxToolEmitted, true, 'Sandbox tool execution must be recorded');

      // Verify that the GitHub repo was actually created in mock backend
      const repos = await githubClient.listRepositories(token);
      const testRepo = repos.find((r) => r.name === 'test');
      assert.ok(testRepo, 'Repository "test" must exist on GitHub after tool execution');

      // Verify that the sandbox script was written and executed
      const helloContent = await sandbox.readFile('hello.js');
      assert.includes(helloContent, 'Hello, World', 'Virtual FS must contain hello.js created by agent');

      // Verify tool call completion states
      for (const invocation of executionResult.toolInvocations) {
        assert.strictEqual(invocation.state, 'completed', `Tool ${invocation.toolName} must reach completed state`);
      }

      results.push({
        name: 'AC3.3 - Autonomous Multi-Tool Execution & Real World Outcome',
        passed: true,
        details: 'Repo "test" created in GitHub and hello world executed in Sandbox with completed states',
      });
    } catch (err) {
      results.push({
        name: 'AC3.3 - Autonomous Multi-Tool Execution & Real World Outcome',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 4: Tool Segregation (Only GitHub prompt)
    try {
      const ghOnlyResult = await agentHarness.executePrompt('List my repositories', token);
      assert.strictEqual(ghOnlyResult.githubToolEmitted, true, 'GitHub list tool must be emitted');
      assert.strictEqual(ghOnlyResult.sandboxToolEmitted, false, 'No Sandbox tool should be emitted for GitHub-only prompt');

      results.push({
        name: 'AC3.4 - Tool Segregation: GitHub-Only Intent',
        passed: true,
        details: 'Correctly routed to GitHub tool without spurious Sandbox calls',
      });
    } catch (err) {
      results.push({
        name: 'AC3.4 - Tool Segregation: GitHub-Only Intent',
        passed: false,
        error: err.message,
      });
      throw err;
    }

    // Test 5: Tool Segregation (Only Sandbox prompt)
    try {
      const sbOnlyResult = await agentHarness.executePrompt('Run command in the sandbox', token);
      assert.strictEqual(sbOnlyResult.sandboxToolEmitted, true, 'Sandbox tool must be emitted');
      assert.strictEqual(sbOnlyResult.githubToolEmitted, false, 'No GitHub tool should be emitted for Sandbox-only prompt');

      results.push({
        name: 'AC3.5 - Tool Segregation: Sandbox-Only Intent',
        passed: true,
        details: 'Correctly routed to Sandbox tool without spurious GitHub calls',
      });
    } catch (err) {
      results.push({
        name: 'AC3.5 - Tool Segregation: Sandbox-Only Intent',
        passed: false,
        error: err.message,
      });
      throw err;
    }

  } finally {
    await server.stop();
    await sandbox.cleanup();
  }

  return results;
}

module.exports = {
  name: 'AC3: Agent Workflow Suite',
  run,
};
