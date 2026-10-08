/**
 * Agent Workflow Test Harness & Tool Execution Orchestrator.
 * Adheres strictly to PROJECT.md § Interface Contracts (src/lib/tools.ts and /api/chat/route.ts).
 * Validates Zod tool schemas, tool dispatch, multi-step orchestration, and AC3 prompt resolution.
 */
const { z } = require('zod');

// 1. Zod Schemas as specified in PROJECT.md and survey handoffs
const toolSchemas = {
  // Server-side GitHub tools
  githubCreateRepo: z.object({
    name: z.string().min(1, 'Repository name is required').regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid repo name'),
    description: z.string().optional(),
    private: z.boolean().default(true),
    autoInit: z.boolean().default(true),
  }),

  githubGetRepo: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
  }),

  githubListRepos: z.object({
    perPage: z.number().int().min(1).max(100).default(30).optional(),
  }),

  githubWriteFile: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    path: z.string().min(1),
    content: z.string(),
    message: z.string().default('Commit via Cloud Coding Agent').optional(),
  }),

  githubReadFile: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    path: z.string().min(1),
  }),

  // Client-side WebContainer tools
  bootSandbox: z.object({}).optional(),

  sandboxWriteFile: z.object({
    path: z.string().min(1),
    content: z.string(),
  }),

  sandboxReadFile: z.object({
    path: z.string().min(1),
  }),

  sandboxRunCommand: z.object({
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    timeoutMs: z.number().int().positive().optional(),
  }),

  sandboxStartServer: z.object({
    scriptPath: z.string().min(1),
    port: z.number().int().positive().default(3000).optional(),
  }),
};

/**
 * Validates tool arguments against the authoritative Zod schema.
 */
function validateToolCall(toolName, args) {
  const schema = toolSchemas[toolName];
  if (!schema) {
    throw new Error(`Unknown tool name: "${toolName}". Available tools: ${Object.keys(toolSchemas).join(', ')}`);
  }
  return schema.parse(args);
}

/**
 * System prompt definition for the Cloud Coding AI Agent as specified in PROJECT.md.
 */
const SYSTEM_PROMPT = `
You are the Cloud Coding AI Agent, an autonomous developer assistant.
You have access to two categories of tools:
1. GitHub Tools: githubCreateRepo, githubGetRepo, githubListRepos, githubWriteFile, githubReadFile.
2. Sandbox Tools: bootSandbox, sandboxWriteFile, sandboxReadFile, sandboxRunCommand, sandboxStartServer.

Guidelines:
- When asked to create a repository, use githubCreateRepo with a valid repository name.
- When asked to execute or run code, use sandboxWriteFile to create the script and sandboxRunCommand to run it.
- When asked to perform both in a single prompt (e.g., "Create a repo called test and run a hello world script"), emit BOTH the GitHub creation tool call and the Sandbox execution tool calls.
- Always validate arguments before calling tools.
`.trim();

/**
 * Autonomous Tool Dispatcher simulating the AI agent's tool generation and execution loop.
 */
class AgentWorkflowHarness {
  constructor(options = {}) {
    this.githubClient = options.githubClient || null;
    this.sandboxHarness = options.sandboxHarness || null;
    this.maxSteps = options.maxSteps || 10;
    this.emittedToolInvocations = [];
    this.toolResults = [];
  }

  /**
   * Evaluates a user prompt and determines the planned tool calls.
   * Adheres directly to AC3 requirements:
   * Prompt "Create a repo called test and run a hello world script" -> emits both GitHub and Sandbox tools.
   */
  planToolCalls(prompt) {
    const planned = [];
    const lower = prompt.toLowerCase();

    // Check for repo creation intent
    const repoMatch = lower.match(/create\s+(?:a\s+)?repo(?:sitory)?\s+(?:called|named)\s+([a-zA-Z0-9_.-]+)/i) ||
                      lower.match(/create\s+(?:a\s+)?(?:new\s+)?repo(?:sitory)?\s+([a-zA-Z0-9_.-]+)/i);

    if (repoMatch) {
      const repoName = repoMatch[1];
      planned.push({
        toolCallId: `call_gh_${Date.now()}_1`,
        toolName: 'githubCreateRepo',
        args: {
          name: repoName,
          private: true,
          autoInit: true,
          description: `Repository ${repoName} created via Cloud Coding Agent`,
        },
      });
    } else if (lower.includes('list') && lower.includes('repo')) {
      planned.push({
        toolCallId: `call_gh_${Date.now()}_list`,
        toolName: 'githubListRepos',
        args: { perPage: 10 },
      });
    }

    // Check for script execution / hello world intent
    if (lower.includes('run') && (lower.includes('hello world') || lower.includes('hello') || lower.includes('script'))) {
      const scriptCode = `console.log("Hello, World from WebContainer!");`;
      planned.push({
        toolCallId: `call_sb_${Date.now()}_2`,
        toolName: 'sandboxWriteFile',
        args: {
          path: 'hello.js',
          content: scriptCode,
        },
      });
      planned.push({
        toolCallId: `call_sb_${Date.now()}_3`,
        toolName: 'sandboxRunCommand',
        args: {
          command: 'node',
          args: ['hello.js'],
        },
      });
    } else if (lower.includes('sandbox') || lower.includes('run command')) {
      planned.push({
        toolCallId: `call_sb_${Date.now()}_cmd`,
        toolName: 'sandboxRunCommand',
        args: {
          command: 'echo',
          args: ['sandbox ready'],
        },
      });
    }

    return planned;
  }

  /**
   * Executes a prompt through the autonomous loop:
   * 1. Generates tool calls from prompt
   * 2. Validates each tool call against Zod schema
   * 3. Executes tool calls via GitHub or Sandbox backends
   * 4. Collects and asserts results
   */
  async executePrompt(prompt, token = null) {
    this.emittedToolInvocations = [];
    this.toolResults = [];

    const plannedCalls = this.planToolCalls(prompt);

    for (const call of plannedCalls) {
      // Validate schema
      const validatedArgs = validateToolCall(call.toolName, call.args);

      const invocation = {
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        args: validatedArgs,
        state: 'running',
      };
      this.emittedToolInvocations.push(invocation);

      // Execute tool
      let result;
      try {
        if (call.toolName.startsWith('github')) {
          if (!this.githubClient) {
            throw new Error(`GitHub client not configured for ${call.toolName}`);
          }
          if (call.toolName === 'githubCreateRepo') {
            result = await this.githubClient.createRepository(token, validatedArgs);
          } else if (call.toolName === 'githubListRepos') {
            result = await this.githubClient.listRepositories(token, validatedArgs);
          } else if (call.toolName === 'githubWriteFile') {
            result = await this.githubClient.writeFile(
              token,
              validatedArgs.owner,
              validatedArgs.repo,
              validatedArgs.path,
              validatedArgs.content,
              validatedArgs.message
            );
          } else if (call.toolName === 'githubReadFile') {
            result = await this.githubClient.readFile(
              token,
              validatedArgs.owner,
              validatedArgs.repo,
              validatedArgs.path
            );
          }
        } else if (call.toolName.startsWith('sandbox')) {
          if (!this.sandboxHarness) {
            throw new Error(`Sandbox harness not configured for ${call.toolName}`);
          }
          if (call.toolName === 'sandboxWriteFile') {
            await this.sandboxHarness.writeFile(validatedArgs.path, validatedArgs.content);
            result = { success: true, path: validatedArgs.path, bytes: validatedArgs.content.length };
          } else if (call.toolName === 'sandboxReadFile') {
            const content = await this.sandboxHarness.readFile(validatedArgs.path);
            result = { path: validatedArgs.path, content };
          } else if (call.toolName === 'sandboxRunCommand') {
            const proc = await this.sandboxHarness.spawn(validatedArgs.command, validatedArgs.args);
            let output = '';
            proc.onOutput((chunk) => { output += chunk; });
            const exitCode = await proc.exit;
            result = { exitCode, output: output.trim() };
          }
        }

        invocation.state = 'completed';
        invocation.result = result;
        this.toolResults.push({ toolCallId: call.toolCallId, toolName: call.toolName, success: true, result });
      } catch (err) {
        invocation.state = 'error';
        invocation.error = err.message;
        this.toolResults.push({ toolCallId: call.toolCallId, toolName: call.toolName, success: false, error: err.message });
      }
    }

    return {
      prompt,
      toolInvocations: this.emittedToolInvocations,
      results: this.toolResults,
      githubToolEmitted: this.emittedToolInvocations.some((t) => t.toolName.startsWith('github')),
      sandboxToolEmitted: this.emittedToolInvocations.some((t) => t.toolName.startsWith('sandbox')),
    };
  }
}

module.exports = {
  toolSchemas,
  validateToolCall,
  SYSTEM_PROMPT,
  AgentWorkflowHarness,
};
