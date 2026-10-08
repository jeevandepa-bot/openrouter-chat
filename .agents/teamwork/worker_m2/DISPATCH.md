## 2026-10-08T08:17:51Z
You are the Worker for Milestone M2 (GitHub REST API Client & Verifier).
Your working directory is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\worker_m2
The project root is: c:\Users\Jeevan\Downloads\New folder\openrouter-chat
The original request is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\ORIGINAL_REQUEST.md
The project plan is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\PROJECT.md
The spec miner survey report is at: c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\spec_miner_survey_2\handoff.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and the spec miner survey report first.

Exclusive Write Ownership:
You own exclusively:
- src/types/github.ts
- src/lib/github.ts
- src/lib/github-verifier.ts
Do NOT modify files owned by other milestones.

Objective:
Implement Milestone M2:
1. Create `src/types/github.ts`:
   - Comprehensive types for GitHub entities: `GitHubUser`, `GitHubRepo`, `GitHubFileContent`, `GitHubCommitResult`, `GitHubVerificationResult`, `GitHubVerificationStep`.
2. Create `src/lib/github.ts`:
   - Isomorphic REST client using native fetch (zero bulky third-party dependencies).
   - Robust isomorphic Base64 encoder/decoder supporting multibyte UTF-8 and sanitizing API whitespace.
   - Operations:
     - `validateAuth(token: string)`: calls `GET /user`, parses identity and token scopes.
     - `listRepositories(token: string, options?: { perPage?: number; sort?: string })`: calls `GET /user/repos`.
     - `createRepository(token: string, options: { name: string; description?: string; private: boolean; autoInit?: boolean })`: calls `POST /user/repos` (default autoInit to true so main branch exists).
     - `getRepository(token: string, owner: string, repo: string)`: calls `GET /repos/{owner}/{repo}`.
     - `readFile(token: string, owner: string, repo: string, path: string, ref?: string)`: calls `GET /repos/{owner}/{repo}/contents/{path}` and decodes Base64 content to utf-8.
     - `writeFile(token: string, owner: string, repo: string, path: string, content: string, message: string, branch?: string)`: checks existing file to extract `sha` if updating, encodes content to Base64, and calls `PUT /repos/{owner}/{repo}/contents/{path}`.
3. Create `src/lib/github-verifier.ts`:
   - Automated verification routine fulfilling Acceptance Criterion 1:
     - Step 1: Validates provided PAT.
     - Step 2: Creates a new private repository (e.g. `test-agent-verify-${Date.now()}`) with `auto_init: true`.
     - Step 3: Writes a text file (e.g. `README.md` or `test.txt`) with known content.
     - Step 4: Reads back the file and asserts content match.
     - Returns `{ success: boolean, durationMs: number, repo: string, steps: Array<{ name: string, ok: boolean, detail: string }>, logs: string[] }`.
4. Verification & Build:
   - Run `cmd.exe /c npx tsc --noEmit` and `cmd.exe /c npm run build` to verify clean compilation.
   - Document verification commands and results in your handoff report.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When finished, write your handoff report to c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\worker_m2\handoff.md and notify the orchestrator via send_message.
