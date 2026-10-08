# Project: Cloud Coding AI Agent (`openrouter-chat`)

## Architecture
A mobile-first cloud coding web application built on Next.js 16 (App Router, Turbopack) and React 19, enabling autonomous AI-driven development.
- **Frontend / Client Runtime**:
  - Segmented mobile workspace (`[Chat | Code | Terminal | Preview | Verify]`) with desktop dual-pane expansion.
  - In-browser Node.js sandbox via `@webcontainer/api` singleton with virtual filesystem, terminal output streaming, and live `server-ready` iframe preview.
  - Client-side tool execution bridge hooking into `@ai-sdk/react`'s `useChat` (`toolInvocations` -> client execution -> `addToolResult`).
  - GitHub token persistence (`sessionStorage` / `localStorage`).
- **Backend / Next.js Server Route**:
  - `/api/chat/route.ts`: Vercel AI SDK `streamText` orchestration with OpenRouter provider, tool definitions, and multi-step autonomous execution loop (`maxSteps: 10`).
  - Server-side execution of GitHub REST API tools using forwarded `x-github-token`.
  - Injected security headers (`Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin`) for WebAssembly `SharedArrayBuffer` isolation.
- **Verification & Testing**:
  - Dual-track testing architecture with dedicated E2E test runner covering GitHub operations, WebContainer execution, and Agent autonomous workflows.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | COOP/COEP Headers | Cross-Origin Isolation headers (`same-origin`, `require-corp`) in Next.js config | M1 | Survey / R2 |
| 2 | WebContainer Dependency | Installation of `@webcontainer/api` and `zod` | M1 | Survey / R2 |
| 3 | WebContainer Singleton | Client-only browser memoized singleton (`src/lib/webcontainer.ts`) preventing duplicate boots | M1 | Survey / R2 |
| 4 | WebContainer File System & Spawn | Methods for FS read/write/mkdir and process spawn with streaming stdout/stderr | M1 | Survey / R2 |
| 5 | WebContainer Server Listener | Port listener and `server-ready` event capture for local preview URL | M1 | Survey / R2 |
| 6 | Sandbox Verification Test | Automated script/function to boot container, write web server, run it, and fetch response | M1 | Survey / Acceptance Criteria 2 |
| 7 | GitHub PAT Storage & Headers | Secure token input, storage in sessionStorage/localStorage, and header forwarding | M2 | Survey / R1 |
| 8 | GitHub Native REST Client | Isomorphic client (`src/lib/github.ts`) for auth, repos, and files without bulky dependencies | M2 | Survey / R1 |
| 9 | GitHub Repo Management | Operations to list user repos, get repo metadata, and create public/private repo with auto_init | M2 | Survey / R1 |
| 10 | GitHub File CRUD | Operations to read file (Base64 decode) and create/update file with automatic SHA resolution | M2 | Survey / R1 |
| 11 | GitHub Verification Test | Automated routine to authenticate, create private repo, write file, and read file back | M2 | Survey / Acceptance Criteria 1 |
| 12 | AI SDK Tool Schemas | Strict Zod schemas for GitHub tools and Sandbox tools in `src/lib/tools.ts` | M3 | Survey / R3 |
| 13 | Autonomous Chat API Route | `/api/chat/route.ts` with `streamText`, system prompts, tool schemas, and `maxSteps: 10` | M3 | Survey / R3 |
| 14 | Client-Side Tool Bridge | Integration with `useChat` catching Sandbox `toolInvocations`, executing on WebContainer, and returning `addToolResult` | M3 | Survey / R3 |
| 15 | Agent Prompt Workflow | System prompt tuning to autonomously emit both GitHub and Sandbox tool calls for multi-action prompts | M3 | Survey / Acceptance Criteria 3 |
| 16 | Mobile Tab Navigation | Responsive segmented tab control `[Chat | Code | Terminal | Preview | Verify]` (360px–430px) | M4 | Survey / Mobile UI |
| 17 | Mobile Header & Status Pills | Sticky header with live WebContainer (Ready/Booting) and GitHub (Connected) status indicators | M4 | Survey / Mobile UI |
| 18 | Interactive Tool Cards | Collapsible UI cards for `toolInvocations` displaying loading, status, and outputs in chat | M4 | Survey / Mobile UI |
| 19 | Terminal & Preview Panels | Live dark-mode console for container stdout/stderr, and `credentialless` iframe preview | M4 | Survey / Mobile UI |
| 20 | Code Editor & File Tree | Mobile-friendly monospace code viewer/editor for inspecting sandbox files | M4 | Survey / Mobile UI |
| 21 | Verification UI Suite | Interactive 1-click test buttons with live step-by-step progress cards for AC1, AC2, AC3 | M4 | Survey / Acceptance Criteria |
| 22 | Settings Modal | Modal for configuring GitHub PAT, OpenRouter API Key, and selecting tool-capable models | M4 | Survey / Mobile UI |
| 23 | E2E Test Suite (Dual Track) | Comprehensive test suite covering Tiers 1-4 and all acceptance criteria | E2E Track / M5 | Survey / E2E Track |
| 24 | Final Acceptance & Victory Audit | 100% pass of E2E tests and forensic integrity verification | M5 | Prompt / Sentinel |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Design test runner, test harness, and Tiers 1-4 test cases; publish TEST_READY.md | none | DONE |
| M1 | Core Sandbox & Isolation | Headers in `next.config.ts`, `@webcontainer/api` install, `src/lib/webcontainer.ts`, sandbox verification test | none | DONE |
| M2 | GitHub REST Client & Verifier | `src/lib/github.ts`, isomorphic Base64, repo CRUD, file CRUD with SHA probe, GitHub verification routine | none | DONE |
| M3 | AI SDK Tools & Autonomous Loop | `src/lib/tools.ts`, `/api/chat/route.ts` with multi-step tools, client execution handler, system prompt | M1, M2 | DONE |
| M4 | Mobile-First UI & Workspace | Segmented tabs, Terminal, Preview, Editor, Tool cards, VerificationSuite, SettingsModal | M1, M2, M3 | DONE |
| M5 | Final E2E Pass & Forensic Audit | Run 100% E2E tests, verify AC1, AC2, AC3, forensic integrity audit | E2E, M4 | DONE |

## Interface Contracts

### `src/lib/webcontainer.ts` (M1) ↔ `src/app/page.tsx` & Tools (M3, M4)
```typescript
export interface WebContainerInstance {
  boot(): Promise<WebContainer>;
  getInstance(): Promise<WebContainer>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  spawn(command: string, args: string[]): Promise<WebContainerProcess>;
  onServerReady(callback: (port: number, url: string) => void): () => void;
  onPortChange(callback: (port: number, type: 'open' | 'close') => void): () => void;
  getStatus(): 'uninitialized' | 'booting' | 'ready' | 'error';
}
```

### `src/lib/github.ts` (M2) ↔ `/api/chat/route.ts` (M3) & UI (M4)
```typescript
export interface GitHubClient {
  validateAuth(token: string): Promise<{ login: string; id: number; name: string | null; avatarUrl: string }>;
  listRepositories(token: string, options?: { perPage?: number }): Promise<Array<{ id: number; name: string; fullName: string; private: boolean; htmlUrl: string }>>;
  createRepository(token: string, options: { name: string; description?: string; private: boolean; autoInit?: boolean }): Promise<{ id: number; name: string; fullName: string; private: boolean; htmlUrl: string; defaultBranch: string }>;
  getRepository(token: string, owner: string, repo: string): Promise<{ id: number; name: string; fullName: string; private: boolean; htmlUrl: string; defaultBranch: string }>;
  readFile(token: string, owner: string, repo: string, path: string): Promise<{ path: string; content: string; sha: string }>;
  writeFile(token: string, owner: string, repo: string, path: string, content: string, message: string): Promise<{ path: string; commitSha: string; contentSha: string }>;
}
```

### `src/lib/tools.ts` (M3) ↔ API & Client Execution Bridge (M3, M4)
```typescript
// Server tools: githubCreateRepo, githubGetRepo, githubListRepos, githubWriteFile, githubReadFile
// Client tools: sandboxWriteFile, sandboxReadFile, sandboxRunCommand, sandboxStartServer
export interface ToolCallExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'pending' | 'running' | 'completed' | 'error';
  result?: unknown;
}
```

## Code Layout
```text
c:\Users\Jeevan\Downloads\New folder\openrouter-chat\
├── next.config.ts            # COOP / COEP headers
├── package.json              # @webcontainer/api, zod, etc.
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts # Vercel AI SDK route with multi-step tools
│   │   │   └── verify/route.ts # Optional verification test endpoint
│   │   ├── globals.css       # Tailwind v4, mobile safe areas, terminal styles
│   │   ├── layout.tsx        # Shell & Geist font
│   │   └── page.tsx          # Main mobile-first workspace orchestrator
│   ├── components/
│   │   ├── Header.tsx        # Sticky header with WebContainer & GitHub status pills
│   │   ├── TabNavigation.tsx # Segmented navigation [Chat | Code | Terminal | Preview | Verify]
│   │   ├── ChatPanel.tsx     # Message list + prompt input + tool invocation cards
│   │   ├── ToolCard.tsx      # Interactive collapsible card for tool execution
│   │   ├── CodeEditor.tsx    # Monospace code viewer / editor
│   │   ├── Terminal.tsx      # Streaming container console
│   │   ├── Preview.tsx       # Live credentialless iframe preview
│   │   ├── VerificationSuite.tsx # 1-click test runners for AC1, AC2, AC3
│   │   └── SettingsModal.tsx # GitHub PAT & Model selection modal
│   ├── lib/
│   │   ├── github.ts         # Isomorphic GitHub REST client
│   │   ├── github-verifier.ts# Acceptance Criterion 1 test runner
│   │   ├── webcontainer.ts   # WebContainer browser singleton & manager
│   │   ├── sandbox-verifier.ts # Acceptance Criterion 2 test runner
│   │   ├── tools.ts          # Zod schemas & AI SDK tool definitions
│   │   └── agent-verifier.ts # Acceptance Criterion 3 workflow verifier
│   └── types/
│       └── index.ts          # Shared TypeScript interfaces
└── tests/
    └── e2e/                  # Dual-track automated test suite
```
