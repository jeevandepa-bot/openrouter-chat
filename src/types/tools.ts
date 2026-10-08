/**
 * AI SDK Tools & Autonomous Agent Type Definitions
 * Cloud Coding AI Agent (Milestone M3)
 *
 * Provides authoritative TypeScript interface contracts for:
 * - GitHub server-side tool parameters
 * - Sandbox in-browser tool parameters
 * - Tool execution lifecycle and client result binding
 * - Acceptance Criterion 3 (Agent Workflow) automated verification
 */

// ============================================================================
// 1. Tool Parameters Interfaces
// ============================================================================

export interface GithubCreateRepoParams {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

export interface GithubGetRepoParams {
  owner: string;
  repo: string;
}

export interface GithubListReposParams {
  perPage?: number;
  visibility?: 'all' | 'public' | 'private';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
}

export interface GithubReadFileParams {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export interface GithubWriteFileParams {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message?: string;
  branch?: string;
}

export interface BootSandboxParams {
  workdir?: string;
}

export interface SandboxWriteFileParams {
  path: string;
  content: string;
}

export interface SandboxReadFileParams {
  path: string;
}

export interface SandboxRunCommandParams {
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export interface SandboxStartServerParams {
  script?: string;
  scriptPath?: string;
  port?: number;
}

// ============================================================================
// 2. Tool Execution Lifecycle & Client Result Types
// ============================================================================

export type ToolExecutionState = 'pending' | 'running' | 'completed' | 'error';

export interface ToolCallExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: ToolExecutionState;
  result?: unknown;
  error?: string;
}

export interface ClientToolResult {
  toolCallId: string;
  toolName?: string;
  result?: unknown;
  error?: string;
}

// ============================================================================
// 3. Client Sandbox Backend & Tool Executors
// ============================================================================

export interface ClientSandboxProcess {
  exit: Promise<number>;
  onOutput?: (callback: (chunk: string) => void) => void;
  output?: unknown;
}

export interface ClientSandboxBackend {
  boot?: () => Promise<unknown>;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  spawn: (
    command: string,
    args: string[],
    options?: unknown
  ) => Promise<ClientSandboxProcess>;
  onServerReady?: (callback: (port: number, url: string) => void) => () => void;
}

export interface ClientToolExecutors {
  bootSandbox: (args?: BootSandboxParams) => Promise<{ ready: boolean; status: string }>;
  sandboxWriteFile: (args: SandboxWriteFileParams) => Promise<{ success: boolean; path: string; bytes: number }>;
  sandboxReadFile: (args: SandboxReadFileParams) => Promise<{ path: string; content: string }>;
  sandboxRunCommand: (args: SandboxRunCommandParams) => Promise<{ exitCode: number; output: string }>;
  sandboxStartServer: (args: SandboxStartServerParams) => Promise<{ port: number; url?: string; started: boolean }>;
}

// ============================================================================
// 4. Acceptance Criterion 3 (Agent Workflow) Verification Types
// ============================================================================

export interface PlannedToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface AgentVerificationStep {
  name: string;
  ok: boolean;
  detail: string;
  durationMs?: number;
}

export interface AgentVerificationResult {
  success: boolean;
  durationMs: number;
  prompt: string;
  steps: AgentVerificationStep[];
  toolCalls: PlannedToolCall[];
  logs: string[];
  error?: string;
}

export interface AgentWorkflowVerificationOptions {
  prompt?: string;
  token?: string;
  customRepoName?: string;
  timeoutMs?: number;
  onLog?: (message: string) => void;
  onStep?: (step: AgentVerificationStep) => void;
  githubClient?: unknown;
  sandboxHarness?: ClientSandboxBackend;
}
