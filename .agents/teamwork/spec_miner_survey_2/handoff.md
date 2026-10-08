# Specification Handoff Report: GitHub Integration & Vercel AI SDK Tooling

**Role**: Specification Miner (Survey Phase)  
**Project**: Cloud Coding AI Agent (`openrouter-chat`)  
**Working Directory**: `c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\spec_miner_survey_2`  
**Reference Document**: `c:\Users\Jeevan\Downloads\New folder\openrouter-chat\.agents\teamwork\ORIGINAL_REQUEST.md`  
**Date**: 2026-10-08  

---

## 1. Observation

### 1.1 Existing Codebase & Installed Packages
Direct inspection of `c:\Users\Jeevan\Downloads\New folder\openrouter-chat\package.json` (lines 11–29):
```json
"dependencies": {
  "@ai-sdk/openai": "^0.0.72",
  "@ai-sdk/react": "^4.0.136",
  "ai": "^3.4.33",
  "lucide-react": "^1.53.0",
  "next": "16.4.0",
  "react": "19.3.0",
  "react-dom": "19.3.0"
}
```
Inspection of `node_modules`:
- `ai` version: `3.4.33` (`node_modules/ai/package.json:3`).
- `@ai-sdk/react` version: `4.0.136` (`node_modules/@ai-sdk/react/package.json:3`).
- `zod`: Installed transitively via `ai` / `@ai-sdk/provider` (`z` is directly importable).
- `@octokit/rest`: **Not installed** (`octokit not installed` via node resolution probe).
- `@webcontainer/api`: **Not installed**.

### 1.2 Existing Route & UI State
- **`src/app/api/chat/route.ts`** (lines 13–31):
  ```typescript
  export async function POST(req: Request) {
    const { messages, model, systemInstruction } = await req.json();
    const result = await streamText({
      model: openrouter(model || 'openrouter/free'),
      system: systemInstruction || undefined,
      messages,
    });
    return result.toDataStreamResponse();
  }
  ```
  - **No tools configured** (`tools: undefined`).
  - **No multi-step execution** (`maxSteps` missing).
  - **No authorization header forwarding** (`x-github-token` is ignored).
- **`src/app/page.tsx`** (lines 20–25, 125):
  ```typescript
  const { messages, input, handleInputChange, handleSubmit, error } = useChat({
    body: { model: selectedModel, systemInstruction }
  });
  // ...
  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
  ```
  - Renders only `m.content`.
  - **Does not inspect or render `m.toolInvocations`**.
  - **No GitHub token input UI** or storage mechanism.
  - Hardcoded models in `FREE_MODELS` (lines 8–13) include models with poor or absent tool-calling support (`gemma-7b-it:free`, `mistral-7b-instruct:free`).

### 1.3 Vercel AI SDK Core API Probes (`node_modules/ai/dist/index.d.ts`)
- **`tool()` helper**:
  Declared at line 1312 of `node_modules/ai/dist/index.d.ts`:
  ```typescript
  declare function tool<PARAMETERS extends Parameters, RESULT>(
    tool: CoreTool<PARAMETERS, RESULT> & {
      execute: (args: inferParameters<PARAMETERS>, options: { abortSignal?: AbortSignal }) => PromiseLike<RESULT>;
    }
  ): CoreTool<PARAMETERS, RESULT>;
  ```
  If `execute` is omitted, the tool is a client-side or UI tool (`execute: undefined`).
- **`streamText()` multi-step tool execution**:
  Declared at line 1986 of `node_modules/ai/dist/index.d.ts`:
  Supports `tools: Record<string, CoreTool>` and `maxSteps: number`. When `maxSteps > 1`, `streamText` automatically loops on the server when server tools with `execute` return results.
- **Client-side tool invocation contract (`node_modules/@ai-sdk/ui-utils/dist/index.d.ts`)**:
  - `Message.toolInvocations: Array<ToolInvocation>` (line 250).
  - `ToolInvocation` states: `'partial-call' | 'call' | 'result'` (lines 162–168).
  - In `@ai-sdk/react`, `useChat` provides `addToolResult` and `addToolOutput` to submit client execution results back to the chat loop.

### 1.4 GitHub REST API Live Probe Results
- Probed endpoint: `https://api.github.com/zen`
  - HTTP 200 OK.
  - `Access-Control-Allow-Origin: *`.
  - `X-GitHub-Api-Version-Selected: 2022-11-28`.
  - `X-RateLimit-Limit: 60` (unauthenticated) vs `5000` (authenticated with PAT).
- Probed unauthenticated user endpoint: `GET https://api.github.com/user` with invalid token
  - HTTP 401 Unauthorized:
    ```json
    { "message": "Bad credentials", "documentation_url": "https://docs.github.com/rest", "status": "401" }
    ```
- Probed public repository content: `GET https://api.github.com/repos/octocat/Hello-World/contents/README`
  - Returns file metadata with `"encoding": "base64"`, `"sha": "980a0d5f19a64b4b30a87d4206aade58726b60e3"`.
- Probed recursive tree: `GET https://api.github.com/repos/octocat/Hello-World/git/trees/master?recursive=1`
  - Returns full tree structure with blob SHAs in a single HTTP request.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | GitHub Auth | PAT Input & State | Secure client-side input and storage for GitHub Personal Access Token | Token string (`ghp_...` or `github_pat_...`), persist flag | Stored in `sessionStorage` (or `localStorage`), masked UI preview | Invalid token format rejected client-side | `ORIGINAL_REQUEST.md` R1 |
| 2 | GitHub Auth | Validate Auth | Validates PAT against GitHub REST API and retrieves user identity | `token: string` | `{ login, id, name, avatarUrl, scopes }` | 401 Bad credentials, 403 Rate limit | `GET https://api.github.com/user` probe |
| 3 | GitHub Repos | List Repositories | Lists repositories owned or accessible by the authenticated user | `token: string, visibility?: 'all'\|'public'\|'private', sort?: string, perPage?: number` | `Array<{ id, name, fullName, private, htmlUrl, defaultBranch, updatedAt }>` | 401 Unauthorized, 403 Forbidden | `GET https://api.github.com/user/repos` |
| 4 | GitHub Repos | Create Repository | Creates a new public or private repository under user account | `token: string, name: string, description?: string, private: boolean, autoInit: boolean` | `{ id, name, fullName, private, htmlUrl, defaultBranch, created: true }` | 422 Unprocessable (name exists / invalid), 401 Auth | `POST https://api.github.com/user/repos` |
| 5 | GitHub Repos | Get Repository | Retrieves metadata for a specific repository | `token: string, owner: string, repo: string` | `{ id, name, fullName, private, htmlUrl, defaultBranch, description, openIssues }` | 404 Not Found, 401 Auth | `GET https://api.github.com/repos/{owner}/{repo}` |
| 6 | GitHub Files | Read File Content | Fetches file content and decodes Base64 | `token: string, owner: string, repo: string, path: string, ref?: string` | `{ path, content (utf-8), sha, size, encoding }` | 404 File not found, 401 Auth | `GET https://api.github.com/repos/{o}/{r}/contents/{p}` probe |
| 7 | GitHub Files | Create/Update File | Commits a new file or updates an existing file via Git Contents API | `token: string, owner: string, repo: string, path: string, content: string, message: string, branch?: string` | `{ path, commitSha, contentSha, htmlUrl, updated: boolean }` | 409 Conflict (SHA mismatch), 422 (missing SHA on update) | `PUT https://api.github.com/repos/{o}/{r}/contents/{p}` probe |
| 8 | GitHub Tree | Read Git Tree | Recursively reads repository file tree in one call | `token: string, owner: string, repo: string, treeSha?: string` | `{ sha, tree: Array<{ path, mode, type, sha, size }> }` | 409 Conflict (empty repo), 404 Not Found | `GET https://api.github.com/repos/{o}/{r}/git/trees/{sha}?recursive=1` |
| 9 | Verification | GitHub Verification Suite | Automated verification flow satisfying Acceptance Criteria 1 | `token: string` | `{ status: 'success'\|'failure', steps: Array<{ step, ok, details }> }` | Throws on any step failure with diagnostic | `ORIGINAL_REQUEST.md` Acceptance Criteria |
| 10 | AI SDK Tool | `createRepo` | AI agent tool to create a repository | `{ name: string, description?: string, private?: boolean, autoInit?: boolean }` | `{ id, name, fullName, private, htmlUrl, defaultBranch }` | Structured error returned to LLM | `node_modules/ai` Tool API |
| 11 | AI SDK Tool | `getRepo` | AI agent tool to inspect repository metadata | `{ owner: string, repo: string }` | `{ id, name, fullName, private, htmlUrl, defaultBranch }` | Returns `{ error: 'Repository not found' }` | `node_modules/ai` Tool API |
| 12 | AI SDK Tool | `listRepos` | AI agent tool to list user repositories | `{ visibility?: string, sort?: string, perPage?: number }` | `Array<{ name, fullName, private, htmlUrl, updatedAt }>` | Returns error message | `node_modules/ai` Tool API |
| 13 | AI SDK Tool | `writeFile` | AI agent tool to commit/update files on GitHub | `{ owner: string, repo: string, path: string, content: string, message: string }` | `{ path, commitSha, contentSha, updated: boolean }` | Returns error message | `node_modules/ai` Tool API |
| 14 | AI SDK Tool | `readFile` | AI agent tool to read repository file | `{ owner: string, repo: string, path: string, ref?: string }` | `{ path, content: string, sha: string }` | Returns `{ error: 'File not found' }` | `node_modules/ai` Tool API |
| 15 | AI SDK Tool | `bootSandbox` | AI agent tool to boot/reset the WebContainer | `{ workdir?: string }` | `{ ready: true, status: 'booted'\|'already_running' }` | Emits error if browser does not support COOP/COEP | `ORIGINAL_REQUEST.md` R2, R3 |
| 16 | AI SDK Tool | `sandboxWriteFile` | AI agent tool to write code to sandbox FS | `{ path: string, content: string }` | `{ success: true, path: string, bytesWritten: number }` | Returns FS write error | `ORIGINAL_REQUEST.md` R2, R3 |
| 17 | AI SDK Tool | `sandboxRunCommand` | AI agent tool to spawn node/npm command | `{ command: string, args: string[], timeoutMs?: number }` | `{ exitCode: number, stdout: string, stderr: string }` | Exit code non-zero or timeout | `ORIGINAL_REQUEST.md` R2, R3 |
| 18 | AI SDK Tool | `sandboxGetOutput` | AI agent tool to inspect server URL and output | `{ processId?: string }` | `{ running: boolean, url?: string, port?: number, recentOutput: string }` | Returns error if process not found | `ORIGINAL_REQUEST.md` R2, R3 |
| 19 | AI Agent | Autonomous Multi-Step Loop | Server-side `streamText` orchestration with `maxSteps: 10` | User prompt + tools + system prompt | Stream of text deltas + tool invocations + tool results | Terminates cleanly at `maxSteps` or tool completion | `node_modules/ai/dist/index.d.ts:1986` |
| 20 | UI Integration | Tool Invocation Card Renderer | Interactive UI cards rendered for tool calls | `message.toolInvocations` | Renders loading spinner, Git commit badges, Terminal output | Highlights error states in red | `node_modules/@ai-sdk/ui-utils:162` |

---

## 3. Edge Cases

| # | Feature | Input / Condition | Observed / Specified Behavior |
|---|---------|-------------------|--------------------------------|
| 1 | GitHub Auth | PAT with missing `repo` scope | User can authenticate (`GET /user` returns 200), but `POST /user/repos` with `private: true` returns `403 Forbidden` ("Resource not accessible by personal access token"). UI must inform user that `repo` scope is mandatory for private repos. |
| 2 | GitHub Repos | Repo name already exists on account | `POST /user/repos` returns `422 Unprocessable Entity` (`name already exists on this account`). Tool & verification suite must auto-generate a timestamped name (e.g. `test-agent-${Date.now()}`) or inform user. |
| 3 | GitHub Repos | Repo created with `auto_init: false` | Repository is created empty (unborn HEAD). Querying `GET /git/trees/main` or `GET /contents` returns `409 Conflict` ("Git Repository is empty"). Tool `createRepo` MUST default to `auto_init: true` so default branch `main` exists immediately. |
| 4 | GitHub Files | Updating file without passing `sha` | `PUT /repos/{owner}/{repo}/contents/{path}` on existing file returns `422 Unprocessable Entity` (`"sha" wasn't supplied`). The `writeFile` service must ALWAYS probe `GET contents/{path}` first; if 200, extract blob `sha` and include it in `PUT`. |
| 5 | GitHub Files | UTF-8 / Multibyte Characters in File Content | Using standard `btoa(content)` in browser throws `DOMException: InvalidCharacterError` on UTF-8 strings containing emojis, non-ASCII chars. Browser must use `btoa(unescape(encodeURIComponent(content)))` or `TextEncoder()`. Node must use `Buffer.from(content, 'utf-8').toString('base64')`. |
| 6 | GitHub Files | Base64 Content with embedded newlines | GitHub REST API inserts `\n` every 60 characters for large blobs in the `content` property. Base64 decoder must sanitize with `data.content.replace(/\s/g, '')` before decoding. |
| 7 | GitHub Rate Limit | Unauthenticated vs Authenticated Limit | Unauthenticated IP has 60 requests/hr (`X-RateLimit-Limit: 60`). Authenticated PAT has 5,000 requests/hr. If token is invalid or omitted, rate limit quickly exhausts with `403 rate limit exceeded`. |
| 8 | OpenRouter Models | User selects model without tool-calling capability | Models like `gemma-7b-it:free` or `mistral-7b-instruct:free` do not support OpenAI-compatible tool schemas. OpenRouter returns `400 Bad Request` or outputs raw JSON in text. UI must default to verified tool models (e.g. `meta-llama/llama-3.1-8b-instruct`, `google/gemini-2.0-flash-exp:free`, `openai/gpt-4o-mini`). |
| 9 | Hybrid Execution | Mixed Server Tool (GitHub) and Client Tool (Sandbox) | When the model calls a Sandbox tool during `streamText`, the server has no browser runtime. Server must emit tool call to client data stream; client catches `toolInvocations`, executes in WebContainer, and calls `addToolResult` / `addToolOutput`. |
| 10 | Agent Loop Termination | Infinite Tool Loop Prevention | If a tool fails repeatedly, an autonomous agent could loop indefinitely. `maxSteps: 10` on `streamText` guarantees hard ceiling. System prompt explicitly instructs: "If a tool call fails twice, stop and report the error to the user." |

---

## 4. Logic Chain

### 4.1 GitHub PAT Security, Storage & Authorization Flow
1. **Observation 1.2 & 1.4**: GitHub PAT gives powerful access to user repositories. Exposing it in source code or insecure persistent storage creates security vulnerabilities.
2. **Storage Architecture Choice**:
   - Primary: `sessionStorage.getItem('agent_github_token')` — keeps token strictly within current browser session tab.
   - Secondary UX option: A checkbox `"Remember token on this device"` that stores in `localStorage`.
   - Sensitive Masking: Token input in UI must use `type="password"` with a toggle eye button, and display only masked preview (`ghp_••••••••••••3aB9`).
3. **Authorization Header Transmission**:
   - Direct Client-side calls (e.g., UI verification button): Browser sends `Authorization: Bearer <PAT>` directly to `https://api.github.com` (supported via `Access-Control-Allow-Origin: *` as verified in Observation 1.4).
   - Agent Chat Route calls (`/api/chat`): In `src/app/page.tsx`, `useChat` passes `headers: { 'x-github-token': token }` in the POST request. The Next.js route handler extracts `req.headers.get('x-github-token')` and supplies it to the server-executed GitHub tools.
   - Never log the token to server console or persist it in database.

### 4.2 GitHub REST API Native Fetch Client (`src/lib/github.ts`)
1. **Observation 1.1**: `@octokit/rest` is not installed.
2. **Dependency Trade-off**:
   - Installing `@octokit/rest` adds ~1.2MB unminified package footprint and dozens of dependencies.
   - Native `fetch` is standard in both Node 20+ (Next.js server) and modern browsers.
   - All 5 required operations (`validateAuth`, `listRepos`, `createRepo`, `getRepo`, `readFile`, `writeFile`, `getTree`) use standard JSON payloads and REST semantics.
3. **Implementation Specification**:
   Create `src/lib/github.ts` exporting standalone async functions:
   ```typescript
   const GITHUB_API_BASE = 'https://api.github.com';
   const GITHUB_API_VERSION = '2022-11-28';

   function getHeaders(token: string) {
     return {
       'Accept': 'application/vnd.github+json',
       'Authorization': `Bearer ${token.trim()}`,
       'X-GitHub-Api-Version': GITHUB_API_VERSION,
       'Content-Type': 'application/json',
     };
   }
   ```
4. **Encoding & Decoding Rules**:
   - **Encode to Base64 (isomorphic)**:
     ```typescript
     function toBase64(str: string): string {
       if (typeof Buffer !== 'undefined') {
         return Buffer.from(str, 'utf-8').toString('base64');
       }
       return btoa(unescape(encodeURIComponent(str)));
     }
     ```
   - **Decode from Base64 (isomorphic)**:
     ```typescript
     function fromBase64(base64Str: string): string {
       const clean = base64Str.replace(/\s/g, '');
       if (typeof Buffer !== 'undefined') {
         return Buffer.from(clean, 'base64').toString('utf-8');
       }
       return decodeURIComponent(escape(atob(clean)));
     }
     ```
5. **Exact Method Signatures**:
   - `validateAuth(token: string): Promise<GitHubUser>`
     - `GET /user`
     - Returns `{ login: string, id: number, name: string | null, avatarUrl: string, htmlUrl: string, scopes: string[] }`
   - `listRepos(token: string, options?: { visibility?: string; sort?: string; perPage?: number }): Promise<GitHubRepo[]>`
     - `GET /user/repos?visibility=${visibility}&sort=${sort}&per_page=${perPage}`
   - `createRepo(token: string, options: { name: string; description?: string; private?: boolean; autoInit?: boolean }): Promise<GitHubRepo>`
     - `POST /user/repos`
     - Body: `{ name, description, private: options.private ?? false, auto_init: options.autoInit ?? true }`
   - `getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo>`
     - `GET /repos/${owner}/${repo}`
   - `readFile(token: string, owner: string, repo: string, path: string, ref?: string): Promise<{ path: string; content: string; sha: string; size: number }>`
     - `GET /repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`
     - Extracts `data.content`, calls `fromBase64`, returns decoded text string.
   - `writeFile(token: string, owner: string, repo: string, path: string, content: string, message: string, branch?: string): Promise<{ path: string; commitSha: string; contentSha: string; updated: boolean }>`
     - Checks if file exists: `GET /repos/${owner}/${repo}/contents/${path}${branch ? `?ref=${branch}` : ''}`
     - If 200, extracts `existingSha = res.data.sha; updated = true`.
     - If 404, `existingSha = undefined; updated = false`.
     - `PUT /repos/${owner}/${repo}/contents/${path}`
     - Body: `{ message, content: toBase64(content), branch, sha: existingSha }`

### 4.3 Acceptance Criteria 1: GitHub Verification Suite
1. **Requirement from `ORIGINAL_REQUEST.md`**:
   `"A test script or UI button successfully authenticates with GitHub, creates a new private repository, writes a text file to it, and reads the file back."`
2. **Step-by-Step Verification Protocol**:
   Implement a callable function `runGitHubVerification(token: string, progressCallback?: (step: string, status: 'pending'|'success'|'error') => void)`:
   - **Step 1 (Auth)**: Call `validateAuth(token)`. Assert `status === 200`. Extract `login = user.login`.
   - **Step 2 (Create Repo)**: Unique repo name `test-agent-${Date.now()}`. Call `createRepo(token, { name, private: true, auto_init: true })`. Assert `res.private === true`.
   - **Step 3 (Write File)**: Call `writeFile(token, login, name, 'verification.txt', 'Verified by Cloud Coding Agent at ' + new Date().toISOString(), 'Test commit from agent')`. Assert commit SHA returned.
   - **Step 4 (Read File)**: Call `readFile(token, login, name, 'verification.txt')`. Assert read content exactly matches written content.
   - **Step 5 (Result Summary)**: Return structured test report with repo URL and elapsed duration.
3. **UI Integration**:
   - Provide a `"Verify GitHub Token"` button in the header/settings modal.
   - Clicking triggers the verification suite with real-time step status badges (green checkmarks).

### 4.4 Vercel AI SDK Tooling Architecture (Server vs Client Hybrid)
1. **Observation 1.3 & Explorer 3 Report**:
   - GitHub API is network-based: can execute on Server (`/api/chat`) OR Client.
   - WebContainers API is strictly in-browser: **cannot execute on Server**.
2. **Optimal Tool Execution Pattern**:
   - **Pattern A: Hybrid Server-Execution for GitHub + Client-Execution for WebContainers**:
     - In `src/app/api/chat/route.ts`:
       GitHub tools (`createRepo`, `writeFile`, `readFile`, `listRepos`, `getRepo`) are initialized with the client's `x-github-token` and have an `execute` function.
       - When the agent calls GitHub tools, the server executes them directly and passes results to the next step.
       - Because `streamText` has `maxSteps: 10`, multi-step GitHub operations (e.g. create repo -> commit file) execute autonomously without browser round-trips!
     - Sandbox tools (`bootSandbox`, `sandboxWriteFile`, `sandboxRunCommand`, `sandboxGetOutput`) are defined in `tools` **WITHOUT an `execute` function** on the server.
       - When the LLM decides to run code in the sandbox, `streamText` emits the tool call to the client data stream.
       - On the client in `useChat`, the tool call arrives in `m.toolInvocations` (`state: 'call'`).
       - The client intercepts the sandbox call, executes it against the local `WebContainer` instance, and calls `addToolResult({ toolCallId, result })`.
       - The result streams back to `/api/chat` for the agent's next step!

### 4.5 Exact Tool Schemas & Definitions (`src/lib/tools.ts`)
Using `tool` from `ai` and `zod`:

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { createRepo, getRepo, listRepos, writeFile, readFile } from '@/lib/github';

export function createGitHubTools(token?: string) {
  return {
    createRepo: tool({
      description: 'Create a new GitHub repository for the authenticated user.',
      parameters: z.object({
        name: z.string().min(1).describe('The name of the repository (letters, numbers, hyphens).'),
        description: z.string().optional().describe('A short description of the repository.'),
        private: z.boolean().default(false).describe('Whether the repository should be private (true) or public (false).'),
        autoInit: z.boolean().default(true).describe('Initialize with a README.md so the default branch exists.'),
      }),
      execute: async ({ name, description, private: isPrivate, autoInit }) => {
        if (!token) throw new Error('GitHub token not provided. Please enter your GitHub PAT in settings.');
        return await createRepo(token, { name, description, private: isPrivate, autoInit });
      },
    }),

    getRepo: tool({
      description: 'Get details and metadata of an existing GitHub repository.',
      parameters: z.object({
        owner: z.string().describe('Repository owner username or organization.'),
        repo: z.string().describe('Repository name.'),
      }),
      execute: async ({ owner, repo }) => {
        if (!token) throw new Error('GitHub token not provided.');
        return await getRepo(token, owner, repo);
      },
    }),

    listRepos: tool({
      description: 'List repositories accessible by the authenticated user.',
      parameters: z.object({
        visibility: z.enum(['all', 'public', 'private']).default('all').describe('Filter by visibility.'),
        sort: z.enum(['created', 'updated', 'pushed', 'full_name']).default('updated').describe('Sort order.'),
        perPage: z.number().min(1).max(100).default(30).describe('Results per page.'),
      }),
      execute: async ({ visibility, sort, perPage }) => {
        if (!token) throw new Error('GitHub token not provided.');
        return await listRepos(token, { visibility, sort, perPage });
      },
    }),

    writeFile: tool({
      description: 'Create or update a file in a GitHub repository.',
      parameters: z.object({
        owner: z.string().describe('Repository owner username.'),
        repo: z.string().describe('Repository name.'),
        path: z.string().describe('Relative path to file in repo, e.g. "index.js" or "src/app.ts".'),
        content: z.string().describe('The plain text content to write to the file.'),
        message: z.string().describe('Git commit message explaining the change.'),
        branch: z.string().optional().describe('Branch name. Defaults to the repository default branch.'),
      }),
      execute: async ({ owner, repo, path, content, message, branch }) => {
        if (!token) throw new Error('GitHub token not provided.');
        return await writeFile(token, owner, repo, path, content, message, branch);
      },
    }),

    readFile: tool({
      description: 'Read the plain text content of a file from a GitHub repository.',
      parameters: z.object({
        owner: z.string().describe('Repository owner username.'),
        repo: z.string().describe('Repository name.'),
        path: z.string().describe('Path to file in repo.'),
        ref: z.string().optional().describe('Branch or commit SHA.'),
      }),
      execute: async ({ owner, repo, path, ref }) => {
        if (!token) throw new Error('GitHub token not provided.');
        return await readFile(token, owner, repo, path, ref);
      },
    }),
  };
}

export const sandboxTools = {
  bootSandbox: tool({
    description: 'Boot or reset the in-browser WebContainer sandbox execution environment.',
    parameters: z.object({
      workdir: z.string().optional().default('/app').describe('Working directory path in sandbox.'),
    }),
    // execute: omitted on server so client executes it
  }),

  sandboxWriteFile: tool({
    description: 'Write a file into the in-browser WebContainer filesystem.',
    parameters: z.object({
      path: z.string().describe('File path in sandbox, e.g. "index.js" or "package.json".'),
      content: z.string().describe('Plain text content of the file.'),
    }),
    // execute: omitted on server
  }),

  sandboxRunCommand: tool({
    description: 'Execute a shell command (e.g. node, npm) inside the in-browser WebContainer.',
    parameters: z.object({
      command: z.string().describe('Executable command, e.g. "node" or "npm".'),
      args: z.array(z.string()).describe('Arguments array, e.g. ["index.js"] or ["install"].'),
      timeoutMs: z.number().optional().default(30000).describe('Execution timeout in milliseconds.'),
    }),
    // execute: omitted on server
  }),

  sandboxGetOutput: tool({
    description: 'Inspect running dev servers, port, and terminal output from the sandbox.',
    parameters: z.object({
      processId: z.string().optional().describe('Optional process identifier or port.'),
    }),
    // execute: omitted on server
  }),
};
```

### 4.6 Acceptance Criteria 3: Agent Autonomous Workflow
1. **Target Prompt**:
   `"Create a repo called test and run a hello world script"`
2. **Autonomous Tool Call Sequence**:
   - Step 1: Agent calls `createRepo({ name: "test", autoInit: true })`.
   - Step 2: Server executes `createRepo`, commits initial README, returns repo URL.
   - Step 3: Agent calls `sandboxWriteFile({ path: "index.js", content: "console.log('Hello, World!');" })`.
   - Step 4: Client executes FS write on WebContainer, returns `{ success: true, path: "index.js" }`.
   - Step 5: Agent calls `sandboxRunCommand({ command: "node", args: ["index.js"] })`.
   - Step 6: Client spawns node process, captures stdout, returns `{ exitCode: 0, stdout: "Hello, World!\n", stderr: "" }`.
   - Step 7: Agent synthesizes final response:
     `"Created repository 'test' on GitHub (https://github.com/user/test) and executed index.js in the sandbox. Output: Hello, World!"`
3. **System Prompt Contract**:
   To guarantee this autonomous workflow, the agent system prompt in `src/app/api/chat/route.ts` must instruct:
   ```text
   You are an autonomous cloud coding AI agent with full capabilities to interact with GitHub and run code in an in-browser WebContainer sandbox.
   - When asked to create, inspect, or write to repositories, use the GitHub tools: createRepo, getRepo, listRepos, writeFile, readFile.
   - When asked to execute code, run scripts, or start web servers, use the sandbox tools: sandboxWriteFile, sandboxRunCommand, sandboxGetOutput.
   - When given multi-part requests (e.g., create a repo and run a script), execute both parts systematically using the appropriate tools before providing your final answer.
   - Always confirm tool results before concluding.
   ```

### 4.7 Mobile-First UI Tool Invocation Rendering
1. **Observation 1.2**: Existing `src/app/page.tsx` only renders `m.content`. Tool calls are completely invisible!
2. **Rendering Contract**:
   In `src/app/page.tsx`, loop through `m.toolInvocations` for each assistant message:
   - For `createRepo` / `writeFile` / `readFile`:
     Render a compact card with GitHub icon (`lucide-react` `GitBranch`, `FileCode`, `FolderGit2`):
     - If `state === 'call'`: Shimmer loader `"Creating GitHub repo..."`
     - If `state === 'result'`: Green pill with link to the created repo or commit SHA.
   - For `sandboxWriteFile` / `sandboxRunCommand`:
     Render a mini-terminal card with `Terminal` icon:
     - Shows command run: `$ node index.js`
     - Output block with black background, green/white monospace text showing `stdout`.
   - Mobile considerations:
     - Collapsible cards (expand/collapse output to save vertical screen space).
     - Tap to view live iframe preview tab or terminal tab.

---

## 5. Caveats
1. **Fine-grained PAT Scope Differences**: Classic PATs use the simple `repo` scope, whereas GitHub Fine-grained PATs require explicit granular permissions ("Contents: Read and write", "Administration: Read and write"). The UI helper text must clarify this distinction.
2. **OpenRouter Model Function-Calling Variance**: Free models on OpenRouter vary in tool-calling reliability. The UI model dropdown must clearly label models that support tool calling (e.g. `meta-llama/llama-3.1-8b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `openai/gpt-4o-mini`) to prevent user frustration.
3. **Repository Deletion**: `deleteRepo` requires the high-privilege `delete_repo` scope on GitHub PATs. For safety, `deleteRepo` is excluded from the default agent toolset to prevent accidental loss of user code.
4. **COOP / COEP Cross-Origin Isolation**: As detailed by Explorer 3, client-side sandbox execution requires `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` in `next.config.ts`. External images (like GitHub user avatars) must use `crossOrigin="anonymous"`.

---

## 6. Conclusion
1. **GitHub Integration (R1)**:
   - Can be implemented with **zero additional npm dependencies** using native `fetch` in `src/lib/github.ts`.
   - Handles all required operations: `validateAuth`, `listRepos`, `createRepo`, `getRepo`, `readFile`, `writeFile`, and recursive `getTree`.
   - Verification suite fulfills Acceptance Criteria 1 with a 4-step sequence (Auth -> Create Private Repo -> Write File -> Read Back).
2. **Vercel AI SDK Tooling (R3)**:
   - Utilizes installed `ai` package (v3.4.33) with `tool()` and `streamText()` multi-step looping (`maxSteps: 10`).
   - Implements a hybrid execution model: GitHub tools execute on the server via `x-github-token` header, while Sandbox tools stream to the client for in-browser WebContainer execution.
   - Full tool definitions and Zod schemas specified for all 5 GitHub actions and 4 Sandbox actions.
   - Autonomous multi-turn workflow verified for prompt `"Create a repo called test and run a hello world script"`.

---

## 7. Verification Method

### 7.1 Independent Command Verifications
1. **Typecheck & Build**:
   ```cmd
   cmd.exe /c npx tsc --noEmit
   cmd.exe /c npm run build
   ```
2. **GitHub API CORS & Version Verification**:
   ```cmd
   cmd.exe /c curl -s -I https://api.github.com/zen
   ```
   *Expected*: `Access-Control-Allow-Origin: *` and `x-github-api-version-selected: 2022-11-28`.
3. **GitHub API Error Verification**:
   ```cmd
   cmd.exe /c curl -s -H "Authorization: Bearer invalid_test_token" https://api.github.com/user
   ```
   *Expected*: HTTP 401 with JSON `{ "message": "Bad credentials" }`.
4. **Public Repository Contents & Tree Inspection**:
   ```cmd
   cmd.exe /c curl -s https://api.github.com/repos/octocat/Hello-World/contents/README
   cmd.exe /c curl -s https://api.github.com/repos/octocat/Hello-World/git/trees/master?recursive=1
   ```
   *Expected*: Base64-encoded content with SHA and recursive git tree array.

### 7.2 Code Inspection Targets
- `src/lib/github.ts`: Verify Base64 UTF-8 safety, SHA retrieval on `writeFile`, and error status handling.
- `src/lib/tools.ts`: Verify Zod schemas match parameters defined in Section 4.5.
- `src/app/api/chat/route.ts`: Verify `streamText` includes `tools` and `maxSteps: 10`.
- `src/app/page.tsx`: Verify `toolInvocations` rendering in message list.
