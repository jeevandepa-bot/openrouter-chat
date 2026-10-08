/**
 * Tier 3 Test Suite: Cross-Feature Interactions & Hybrid Workflows
 * Tests end-to-end interactions across GitHub and WebContainer subsystems,
 * simulating complete round-trip workflows (GitHub -> Sandbox -> Execution -> GitHub).
 */
const assert = require('./helpers/assert');
const { MockGitHubServer, createGitHubClient } = require('./helpers/github-mock-server');
const { SandboxHarness } = require('./helpers/sandbox-harness');
const { AgentWorkflowHarness } = require('./helpers/agent-harness');

async function run() {
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

    // 1. Cross-Feature Pipeline: GitHub Source -> Sandbox Execution -> GitHub Artifact Commit
    try {
      const repoName = 'calculator-project';
      await githubClient.createRepository(token, { name: repoName, private: true, autoInit: true });

      const mathSource = `
function calculate() {
  const result = 42 * 10;
  console.log("CALCULATION_RESULT=" + result);
}
calculate();
`.trim();

      // Step A: Commit code to GitHub
      await githubClient.writeFile(token, 'test-agent-user', repoName, 'math.js', mathSource, 'Add math.js');

      // Step B: Read code from GitHub into local memory
      const remoteFile = await githubClient.readFile(token, 'test-agent-user', repoName, 'math.js');
      assert.strictEqual(remoteFile.content, mathSource);

      // Step C: Write to Sandbox virtual filesystem
      await sandbox.writeFile('math.js', remoteFile.content);

      // Step D: Execute in Sandbox
      const proc = await sandbox.spawn('node', ['math.js']);
      let output = '';
      proc.onOutput((chunk) => { output += chunk; });
      const exitCode = await proc.exit;
      assert.strictEqual(exitCode, 0, 'Script must exit with code 0');
      assert.includes(output, 'CALCULATION_RESULT=420');

      // Step E: Commit execution report back to GitHub
      const reportContent = `# Execution Report\n\n- Source: math.js\n- Status: Success (exit 0)\n- Output: ${output.trim()}\n- Timestamp: ${new Date().toISOString()}\n`;
      const commitReport = await githubClient.writeFile(token, 'test-agent-user', repoName, 'output.log', reportContent, 'Add execution output');
      assert.ok(commitReport.contentSha);

      // Step F: Read report back from GitHub
      const verifiedReport = await githubClient.readFile(token, 'test-agent-user', repoName, 'output.log');
      assert.includes(verifiedReport.content, 'CALCULATION_RESULT=420');

      results.push({
        name: 'Tier 3 - Full Roundtrip: GitHub -> Sandbox -> Output -> GitHub Commit',
        passed: true,
        details: 'Successfully executed cross-feature workflow and verified committed report',
      });
    } catch (err) {
      results.push({
        name: 'Tier 3 - Full Roundtrip: GitHub -> Sandbox -> Output -> GitHub Commit',
        passed: false,
        error: err.message,
      });
    }

    // 2. Interactive Tool Card Lifecycle Simulation
    try {
      const agent = new AgentWorkflowHarness({ githubClient, sandboxHarness: sandbox });
      const prompt = 'Create a repo called widget and run a hello world script';
      const execution = await agent.executePrompt(prompt, token);

      // Verify state sequence
      for (const invocation of execution.toolInvocations) {
        assert.ok(['running', 'completed'].includes(invocation.state), 'Tool state must be running or completed');
        assert.ok(invocation.toolCallId.startsWith('call_'), 'Tool invocation must have unique toolCallId');
        assert.ok(invocation.result !== undefined, 'Completed tool invocation must contain result payload');
      }

      results.push({
        name: 'Tier 3 - Tool Invocation State Transition & Result Binding',
        passed: true,
        details: 'All tool invocations transitioned properly with valid result payloads',
      });
    } catch (err) {
      results.push({
        name: 'Tier 3 - Tool Invocation State Transition & Result Binding',
        passed: false,
        error: err.message,
      });
    }

    // 3. Multi-turn Agent Workflow Execution
    try {
      const agent = new AgentWorkflowHarness({ githubClient, sandboxHarness: sandbox });

      // Turn 1: GitHub intent
      const turn1 = await agent.executePrompt('Create a repo called multi-turn-repo', token);
      assert.strictEqual(turn1.githubToolEmitted, true);
      assert.strictEqual(turn1.sandboxToolEmitted, false);

      // Turn 2: Sandbox execution intent
      const turn2 = await agent.executePrompt('Run a hello world script', token);
      assert.strictEqual(turn2.githubToolEmitted, false);
      assert.strictEqual(turn2.sandboxToolEmitted, true);

      results.push({
        name: 'Tier 3 - Multi-Turn Conversational Tool Coordination',
        passed: true,
        details: 'Successfully coordinated independent intents across conversational turns',
      });
    } catch (err) {
      results.push({
        name: 'Tier 3 - Multi-Turn Conversational Tool Coordination',
        passed: false,
        error: err.message,
      });
    }

  } finally {
    await server.stop();
    await sandbox.cleanup();
  }

  return results;
}

module.exports = {
  name: 'Tier 3: Cross-Feature Interactions Suite',
  run,
};
