## 2026-10-08T08:30:05Z
You are the Worker for Milestone M3 (AI SDK Tools & Autonomous Loop).
Your working directory is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\worker_m3
The project root is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat
The original request is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\ORIGINAL_REQUEST.md
The project plan is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\PROJECT.md
The spec miner survey report is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\spec_miner_survey_2\handoff.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and the spec miner survey report first.

Exclusive Write Ownership:
You own exclusively:
- src/types/tools.ts
- src/lib/tools.ts
- src/app/api/chat/route.ts
- src/lib/agent-verifier.ts
Do NOT modify files owned by other milestones.

Objective:
Implement Milestone M3:
1. Create `src/types/tools.ts`:
   - Type definitions for tool schemas, execution parameters, client tool results, and agent workflow verification.
2. Create `src/lib/tools.ts`:
   - Use `zod` for strict parameter schemas.
   - Use `tool()` from `ai` package:
     - Server GitHub tools (with `execute` calling `src/lib/github.ts`):
       - `githubCreateRepo`: params `{ name: z.string(), description: z.string().optional(), private: z.boolean().default(true), autoInit: z.boolean().default(true) }`
       - `githubGetRepo`: params `{ owner: z.string(), repo: z.string() }`
       - `githubListRepos`: params `{ perPage: z.number().optional() }`
       - `githubReadFile`: params `{ owner: z.string(), repo: z.string(), path: z.string() }`
       - `githubWriteFile`: params `{ owner: z.string(), repo: z.string(), path: z.string(), content: z.string(), message: z.string() }`
     - Client Sandbox tools (emitted to client stream for browser WebContainer execution):
       - `sandboxWriteFile`: params `{ path: z.string(), content: z.string() }`
       - `sandboxReadFile`: params `{ path: z.string() }`
       - `sandboxRunCommand`: params `{ command: z.string(), args: z.array(z.string()).default([]) }`
       - `sandboxStartServer`: params `{ script: z.string(), port: z.number().default(3000) }`
     - Export `getTools(githubToken?: string)` and `getClientToolExecutors()`.
3. Update `src/app/api/chat/route.ts`:
   - Extract `x-github-token` from `req.headers`.
   - Call `streamText({ model: ..., system: ..., messages: ..., tools: getTools(githubToken), maxSteps: 10 })`.
   - Ensure system prompt instructs the agent to autonomously plan and execute tools sequentially when prompted with multi-action requests like "Create a repo called test and run a hello world script".
   - Return `result.toDataStreamResponse()`.
4. Create `src/lib/agent-verifier.ts`:
   - Automated verification routine for Acceptance Criterion 3:
     - Tests the agent workflow with prompt "Create a repo called test and run a hello world script".
     - Validates tool schema conformance and emission of both GitHub creation and Sandbox execution tool calls.
5. Verification & Build:
   - Run `cmd.exe /c npx tsc --noEmit` and `cmd.exe /c npm run build`.
   - Run `cmd.exe /c node tests/e2e/runner.js` to ensure zero regressions across all 38 tests.
   - Document verification commands and results in your handoff report.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When finished, write your handoff report to c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\worker_m3\handoff.md and notify the orchestrator via send_message.
