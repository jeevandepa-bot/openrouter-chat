## 2026-10-08T08:10:50Z
You are the Worker for Milestone M1 (Core Sandbox & Isolation Headers).
Your working directory is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\worker_m1
The project root is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat
The original request is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\ORIGINAL_REQUEST.md
The project plan is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\PROJECT.md
Survey Explorer 3 report is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\explorer_survey_3\handoff.md

You MUST read ORIGINAL_REQUEST.md and PROJECT.md first.

Exclusive Write Ownership:
You own exclusively:
- next.config.ts
- package.json
- src/lib/webcontainer.ts
- src/lib/sandbox-verifier.ts
- src/types/sandbox.ts
Do NOT modify files owned by other milestones.

Objective:
Implement Milestone M1:
1. Install `@webcontainer/api` and `zod`:
   Run `cmd.exe /c npm install @webcontainer/api zod` (remember on Windows to run commands via cmd.exe /c).
2. Configure `next.config.ts`:
   Add `async headers()` returning:
   - `Cross-Origin-Embedder-Policy: require-corp`
   - `Cross-Origin-Opener-Policy: same-origin`
   covering all paths `/(.*)`.
3. Create `src/types/sandbox.ts` with TypeScript types for WebContainer instance, status, process output, and verification results.
4. Create `src/lib/webcontainer.ts`:
   - Client-only singleton manager memoized on `bootPromise` and `window.__webcontainerPromise`.
   - Browser guards preventing execution on server/SSR (`typeof window === 'undefined'`).
   - Dynamic `import('@webcontainer/api')`.
   - File system methods: `writeFile`, `readFile`, `rm`, `mkdir`, `readdir`.
   - Process execution method: `spawn(command, args)` returning streamable stdout/stderr via `ReadableStream`.
   - Event listeners for `server-ready` (port, url) and `port` changes.
5. Create `src/lib/sandbox-verifier.ts`:
   - Implements Acceptance Criterion 2 automated verification routine.
   - Verifies `window.crossOriginIsolated === true`.
   - Boots WebContainer instance via singleton.
   - Writes `test-server.js` (simple Node http server responding with `{ status: "ok", message: "Hello from in-browser WebContainer!" }`).
   - Listens for `server-ready` event.
   - Spawns `node test-server.js`.
   - Fetches response from container url and asserts JSON payload and HTTP 200.
   - Kills process and reports clean result with logs.
6. Verification & Build:
   - Run `cmd.exe /c npx tsc --noEmit` and `cmd.exe /c npm run build` to verify clean compilation.
   - Document verification commands and results in your handoff report.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When finished, write your handoff report to c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\worker_m1\handoff.md and notify the orchestrator via send_message.
