# Survey Phase Handoff Report: Cloud Coding AI Agent

## 1. Observation

### 1.1 Existing Environment & Dependencies
- **Project Location**: `c:\Users\Jeevan\Downloads\New folder\openrouter-chat`
- **Package Configuration** (`package.json`, lines 11–29):
  ```json
  "dependencies": {
    "@ai-sdk/openai": "^0.0.72",
    "@ai-sdk/react": "^4.0.136",
    "ai": "^3.4.33",
    "lucide-react": "^1.53.0",
    "next": "16.4.0",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@tailwindcss/turbopack": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.4.0",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
  ```
- **Next.js Configuration** (`next.config.ts`, lines 1–17):
  ```typescript
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    cacheComponents: true,
    partialPrefetching: true,
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };

  export default nextConfig;
  ```
- **Build & Quality Check**:
  - `cmd.exe /c npm run build`: Exited 0 with static route `/` and dynamic route `/api/chat`.
  - `cmd.exe /c npm run lint`: Exited 0 (1 warning: unused `error` parameter in `src/app/api/chat/route.ts:28`).
  - `cmd.exe /c npx tsc --noEmit`: Exited 0 with no type errors.
  - Windows execution note: PowerShell script execution is restricted on this host; all npm/npx scripts must run via `cmd.exe /c`.

### 1.2 File & Folder Layout
```text
c:\Users\Jeevan\Downloads\New folder\openrouter-chat\
├── .env.example              # OPENROUTER_API_KEY placeholder
├── .env.local                # Contains active OPENROUTER_API_KEY
├── next.config.ts            # Next.js 16 config with Turbopack (no COOP/COEP headers)
├── package.json              # Current dependencies (missing @webcontainer/api, @octokit/rest)
├── tsconfig.json             # Paths alias configured to @/* -> ./src/*
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts  # POST route streaming via OpenRouter & Vercel AI SDK
│   │   ├── favicon.ico
│   │   ├── globals.css       # Tailwind base, components, utilities
│   │   ├── layout.tsx        # Geist font wrapper & HTML document shell
│   │   └── page.tsx          # Monolithic 168-line client chat UI
```

### 1.3 Existing Chat & API Implementation
- `src/app/page.tsx`:
  - Uses `useChat` from `ai/react` (lines 4, 20–25).
  - Displays a single chat stream with hardcoded models (`FREE_MODELS`: OpenRouter Auto, Llama 3 8B, Mistral 7B, Gemma 7B) (lines 8–13).
  - Only renders `m.content` (line 125). **Does not render `toolInvocations`**.
  - Has a settings overlay for model and system prompt, but **no GitHub token input** and **no workspace interface**.
- `src/app/api/chat/route.ts`:
  - Configures `createOpenAI` pointing to `https://openrouter.ai/api/v1` (lines 4–11).
  - Invokes `streamText` without tools (`tools: undefined`) and without `maxSteps` (lines 21–25).
  - Returns `result.toDataStreamResponse()` (line 27).

### 1.4 Original Requirements from `ORIGINAL_REQUEST.md`
- **R1. GitHub Integration**: Provide GitHub token, list, read, modify, and create repositories from chat interface.
- **R2. Live Cloud Sandbox**: WebContainers API to run Node.js code, start servers, display live output or preview directly within mobile UI with Cross-Origin Isolation headers.
- **R3. Agent Tooling**: Vercel AI SDK autonomous tools to trigger GitHub actions and execute sandbox code.
- **Acceptance Criteria**:
  1. Test script or UI button successfully authenticates with GitHub, creates a new private repository, writes a text file to it, and reads the file back.
  2. Test script or UI button successfully boots WebContainer, writes a simple Node.js web server script, runs it, and fetches the local response.
  3. Prompt "Create a repo called test and run a hello world script" -> AI agent correctly emits tool calls for both GitHub creation and Sandbox execution.

---

## 2. Logic Chain

### Step 2.1: Runtime & Cross-Origin Isolation (WebContainer Requirement R2)
1. Observation 1.1 shows `next.config.ts` has no `headers()` configuration.
2. WebContainer documentation dictates that `WebContainer.boot()` requires a `SharedArrayBuffer`-enabled environment (`window.crossOriginIsolated === true`).
3. To enable `crossOriginIsolated`, the HTTP response must include:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`)
4. Therefore, `next.config.ts` must be updated with an `async headers()` configuration block covering `/:path*`.
5. Observation 1.1 shows `@webcontainer/api` is not installed. Installing `@webcontainer/api` (v1.6.4, 0 external dependencies) is a hard prerequisite.
6. Since WebContainers are strictly browser-based (client-side only), initialization must occur inside client components using a singleton manager (`lib/webcontainer.ts`) to prevent illegal duplicate `WebContainer.boot()` calls across React re-renders.

### Step 2.2: GitHub Integration Architecture (Requirement R1)
1. Observation 1.3 shows no mechanism currently exists for entering or persisting a GitHub token.
2. User tokens should be stored in browser `localStorage` and optionally configurable via `GITHUB_TOKEN` in `.env.local`.
3. To perform repository listing, creation, file writing, and reading:
   - A dedicated GitHub service (`src/lib/github.ts`) using GitHub REST API v3 (via `@octokit/rest` or native `fetch` with `Bearer` authentication) is required.
   - Required actions:
     - `verifyToken(token)` -> verifies identity and `repo` scope (`GET /user`).
     - `createRepository(token, name, options)` -> `POST /user/repos`.
     - `writeFile(token, owner, repo, path, content, message)` -> `PUT /repos/{owner}/{repo}/contents/{path}`.
     - `readFile(token, owner, repo, path)` -> `GET /repos/{owner}/{repo}/contents/{path}` (decoding base64 content).
     - `listRepositories(token)` -> `GET /user/repos`.
4. To fulfill Acceptance Criterion 1 ("A test script or UI button successfully authenticates with GitHub, creates a new private repository, writes a text file to it, and reads the file back"), the UI should include a dedicated "Verify GitHub" interactive test button and step card displaying live green checkmarks.

### Step 2.3: Agent Tooling Loop (Requirement R3)
1. Observation 1.3 shows `src/app/api/chat/route.ts` lacks tool definitions.
2. Tools are split into two operational scopes:
   - **GitHub Tools** (`github_create_repository`, `github_write_file`, `github_read_file`, `github_list_repositories`): Can execute on the server inside `streamText` using the user's forwarded token, or via client-side execution.
   - **Sandbox Tools** (`sandbox_write_file`, `sandbox_read_file`, `sandbox_execute_command`, `sandbox_start_server`): MUST execute in the browser client where the WebContainer instance lives.
3. In Vercel AI SDK (`ai` v3.4+ / `@ai-sdk/react` v4):
   - Server route defines tools with schemas (`zod`).
   - For client-side WebContainer tools, omitting `execute` on the server causes `streamText` to emit the tool call to the client stream.
   - In `src/app/page.tsx`, `useChat` receives `toolInvocations`.
   - When a sandbox tool invocation arrives, the client executes it against the local `WebContainer`, and invokes `addToolResult({ toolCallId, result })`.
   - `useChat` automatically transmits the tool result back to the server, allowing the model to inspect outputs (e.g. exit codes, stdout, server URLs) and continue its reasoning loop (`maxSteps: 5` or `10`).
4. In `src/app/page.tsx`, `m.toolInvocations` must be rendered with status indicators (tool name, params, spinner/success icon, output drawer).

### Step 2.4: Mobile-First Workspace Architecture
1. Observation 1.3 shows the current UI is a single chat list.
2. On mobile screens (360px–430px), displaying chat, code editor, terminal, and live server preview side-by-side causes layout collapse and unusable touch targets.
3. The optimal mobile layout architecture consists of:
   - **Header**: Status badges (WebContainer status: 🟢 Ready / 🟡 Booting; GitHub Auth: 🔑 Connected / Not connected) + Settings / Token button.
   - **Segmented Control / Top Tab Navigation**:
     - 💬 **Chat** (conversation stream, prompt input, interactive tool execution cards)
     - 💻 **Editor** (file explorer drawer, syntax-highlighted / monospace code viewer and editor)
     - ⚡ **Terminal** (live streaming stdout/stderr of node commands and npm scripts)
     - 🌐 **Preview** (responsive iframe connected to WebContainer's `server-ready` event URL)
     - 🧪 **Tests** (1-click verification runner for GitHub & Sandbox acceptance criteria)
   - **Desktop Breakpoint (`md:` / `lg:`)**: Automatically expands into a dual-pane layout (Chat on left 40%, Workspace tabs on right 60%).
   - **Mobile Safety**: Touch targets ≥ 44px, input font size 16px (prevents iOS auto-zoom), dynamic viewport height (`100dvh`), `overflow-x-hidden`, and safe-area padding (`env(safe-area-inset-bottom)`).

---

## 3. Caveats

1. **Browser Support for WebContainers**:
   - WebContainers run in modern Chromium (Chrome, Edge, Android Chrome) and Safari (16.4+ on macOS and iOS).
   - In private browsing mode or environments blocking `SharedArrayBuffer`, WebContainers will throw an initialization error. The UI must detect and display a graceful diagnostic notice.
2. **Cross-Origin Isolation Subresource Impact**:
   - Setting `Cross-Origin-Embedder-Policy: require-corp` blocks cross-origin assets (e.g., third-party images or unauthenticated CDNs) that do not serve `Cross-Origin-Resource-Policy: cross-origin`.
   - Local Next.js fonts (`Geist`) and SVGs are internal and safe. External avatars or scripts must use `crossorigin="anonymous"` or `credentialless`.
3. **OpenRouter Model Capability with Tool Calling**:
   - Several free OpenRouter models (e.g., older Mistral 7B or Gemma 7B) do not support function/tool calling.
   - Models with reliable tool calling support include `meta-llama/llama-3.3-70b-instruct:free`, `meta-llama/llama-3.1-8b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `qwen/qwen-2.5-72b-instruct`, or paid models like `openai/gpt-4o-mini`. The model selector must highlight models with verified tool calling.
4. **GitHub PAT Scopes**:
   - Creating private repositories and committing files requires a GitHub Personal Access Token with the `repo` scope. Clear instructions must be provided in the UI.

---

## 4. Conclusion

The existing codebase is a clean Next.js 16 / React 19 Turbopack project, making it an ideal foundation. To satisfy Requirements R1, R2, R3, and all Acceptance Criteria, the following concrete additions must be implemented:

### Required Package Additions
1. `@webcontainer/api` (`^1.6.4`): In-browser Node.js sandbox.
2. `@octokit/rest` (or native fetch client): GitHub REST API integration.
3. `zod` (`^3.23.8`): Strict schema definitions for Vercel AI SDK tools.

### Required Configuration Updates
1. `next.config.ts`: Add `headers()` returning COOP (`same-origin`) and COEP (`require-corp`).

### Required Modular Architecture (`src/`)
```text
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts         # StreamText with tool definitions & maxSteps
│   │   └── github/verify/route.ts # Optional endpoint for server-side token validation
│   ├── globals.css               # Mobile safe area and terminal styles
│   ├── layout.tsx                # Metadata & shell
│   └── page.tsx                  # Root page orchestrating Chat + Workspace tabs
├── components/
│   ├── Header.tsx                # Mobile header with status indicators & settings modal
│   ├── TabNavigation.tsx         # Segmented switcher [Chat | Code | Terminal | Preview | Verify]
│   ├── ChatPanel.tsx             # Chat message stream + tool invocation cards + prompt input
│   ├── ToolInvocationCard.tsx    # Live badge & progress display for GitHub/Sandbox tool calls
│   ├── CodeEditorPanel.tsx       # Monospace file viewer / editor for sandbox files
│   ├── TerminalPanel.tsx         # Live stdout/stderr stream from WebContainer commands
│   ├── PreviewPanel.tsx          # Iframe displaying WebContainer server-ready URL
│   ├── VerificationSuite.tsx     # One-click test runners for Acceptance Criteria 1 & 2
│   └── SettingsModal.tsx         # Inputs for GitHub PAT, OpenRouter Key, Model choice
├── lib/
│   ├── github.ts                 # GitHub API client (auth, create repo, write, read)
│   ├── webcontainer.ts           # WebContainer singleton manager (boot, fs, spawn, server listener)
│   └── tools.ts                  # Tool schemas & definitions for Vercel AI SDK
└── types/
    └── index.ts                  # Shared types for tools, tabs, files, and execution status
```

---

## 5. Verification Method

To independently verify the survey observations and baseline project health:

1. **Lint Check**:
   ```powershell
   cmd.exe /c npm run lint
   ```
   *Expected result*: Exits with code 0 (1 minor unused warning in `route.ts`).
2. **Type Check**:
   ```powershell
   cmd.exe /c npx tsc --noEmit
   ```
   *Expected result*: Exits with code 0 with 0 errors.
3. **Production Build**:
   ```powershell
   cmd.exe /c npm run build
   ```
   *Expected result*: Successfully compiles static and dynamic routes in ~2 seconds.
4. **Header Verification (Post-Configuration)**:
   Inspect `next.config.ts` to confirm `headers()` returns `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`.
5. **Acceptance Criteria Verification**:
   - Acceptance Criterion 1: Execute GitHub verification test script or click UI test button to authenticate, create private repo, write file, and read file.
   - Acceptance Criterion 2: Execute Sandbox verification test script or click UI test button to boot WebContainer, run HTTP server, and fetch response.
   - Acceptance Criterion 3: Send chat prompt "Create a repo called test and run a hello world script" and observe both GitHub creation and Sandbox execution tool calls emitted and resolved.
