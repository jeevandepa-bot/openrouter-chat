/**
 * AI SDK Tools & Execution Bridge
 * Cloud Coding AI Agent (Milestone M3)
 *
 * Implements strict Zod-backed tool definitions for:
 * 1. Server GitHub tools (execute server-side using forwarded GitHub PAT):
 *    - githubCreateRepo
 *    - githubGetRepo
 *    - githubListRepos
 *    - githubReadFile
 *    - githubWriteFile
 * 2. Client Sandbox tools (streamed to client for browser WebContainer execution):
 *    - bootSandbox
 *    - sandboxWriteFile
 *    - sandboxReadFile
 *    - sandboxRunCommand
 *    - sandboxStartServer
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  createRepository,
  getRepository,
  listRepositories,
  readFile as readGitHubFile,
  writeFile as writeGitHubFile,
} from './github';
import type {
  GithubCreateRepoParams,
  GithubGetRepoParams,
  GithubListReposParams,
  GithubReadFileParams,
  GithubWriteFileParams,
  SandboxWriteFileParams,
  SandboxReadFileParams,
  SandboxRunCommandParams,
  SandboxStartServerParams,
  BootSandboxParams,
  ClientToolExecutors,
  ClientSandboxBackend,
} from '@/types/tools';

// ============================================================================
// 1. Authoritative Zod Tool Schemas
// ============================================================================

export const githubCreateRepoSchema = z.object({
  name: z
    .string()
    .min(1, 'Repository name is required')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid repo name'),
  description: z.string().optional(),
  private: z.boolean().default(true),
  autoInit: z.boolean().default(true),
});

export const githubGetRepoSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
});

export const githubListReposSchema = z.object({
  perPage: z.number().int().min(1).max(100).default(30).optional(),
});

export const githubReadFileSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
});

export const githubWriteFileSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
  content: z.string(),
  message: z.string().default('Commit via Cloud Coding Agent').optional(),
});

export const bootSandboxSchema = z.object({
  workdir: z.string().optional().default('/app'),
}).optional();

export const sandboxWriteFileSchema = z.object({
  path: z.string().min(1, 'File path is required'),
  content: z.string(),
});

export const sandboxReadFileSchema = z.object({
  path: z.string().min(1, 'File path is required'),
});

export const sandboxRunCommandSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().optional(),
});

export const sandboxStartServerSchema = z.object({
  script: z.string().optional(),
  scriptPath: z.string().optional(),
  port: z.number().int().positive().default(3000).optional(),
});

/**
 * Authoritative schema dictionary matching PROJECT.md interface contract.
 */
export const toolSchemas = {
  githubCreateRepo: githubCreateRepoSchema,
  githubGetRepo: githubGetRepoSchema,
  githubListRepos: githubListReposSchema,
  githubWriteFile: githubWriteFileSchema,
  githubReadFile: githubReadFileSchema,
  bootSandbox: bootSandboxSchema,
  sandboxWriteFile: sandboxWriteFileSchema,
  sandboxReadFile: sandboxReadFileSchema,
  sandboxRunCommand: sandboxRunCommandSchema,
  sandboxStartServer: sandboxStartServerSchema,
};

/**
 * Validates tool arguments against the authoritative Zod schema.
 */
export function validateToolCall<K extends keyof typeof toolSchemas>(
  toolName: K,
  args: unknown
): z.infer<(typeof toolSchemas)[K]> {
  const schema = toolSchemas[toolName];
  if (!schema) {
    throw new Error(
      `Unknown tool name: "${String(toolName)}". Available tools: ${Object.keys(toolSchemas).join(', ')}`
    );
  }
  return schema.parse(args);
}

// ============================================================================
// 2. Server-side GitHub Tool Factory
// ============================================================================

export function createGitHubTools(githubToken?: string) {
  const requireToken = () => {
    if (!githubToken || !githubToken.trim()) {
      throw new Error(
        'GitHub token not provided. Please provide a GitHub Personal Access Token in headers or settings.'
      );
    }
    return githubToken.trim();
  };

  return {
    githubCreateRepo: tool({
      description: 'Create a new GitHub repository for the authenticated user.',
      parameters: githubCreateRepoSchema,
      execute: async ({ name, description, private: isPrivate, autoInit }: GithubCreateRepoParams) => {
        const token = requireToken();
        return await createRepository(token, {
          name,
          description,
          private: isPrivate,
          autoInit,
        });
      },
    }),

    githubGetRepo: tool({
      description: 'Get details and metadata of an existing GitHub repository.',
      parameters: githubGetRepoSchema,
      execute: async ({ owner, repo }: GithubGetRepoParams) => {
        const token = requireToken();
        return await getRepository(token, owner, repo);
      },
    }),

    githubListRepos: tool({
      description: 'List repositories accessible by the authenticated user.',
      parameters: githubListReposSchema,
      execute: async ({ perPage }: GithubListReposParams = {}) => {
        const token = requireToken();
        return await listRepositories(token, { perPage: perPage ?? 30 });
      },
    }),

    githubReadFile: tool({
      description: 'Read the plain text content of a file from a GitHub repository.',
      parameters: githubReadFileSchema,
      execute: async ({ owner, repo, path }: GithubReadFileParams) => {
        const token = requireToken();
        return await readGitHubFile(token, owner, repo, path);
      },
    }),

    githubWriteFile: tool({
      description: 'Create or update a file in a GitHub repository.',
      parameters: githubWriteFileSchema,
      execute: async ({ owner, repo, path, content, message }: GithubWriteFileParams) => {
        const token = requireToken();
        return await writeGitHubFile(
          token,
          owner,
          repo,
          path,
          content,
          message || 'Commit via Cloud Coding Agent'
        );
      },
    }),
  };
}

// ============================================================================
// 3. Client Sandbox Tools (Emitted to Client Stream)
// ============================================================================

export const sandboxTools = {
  bootSandbox: tool({
    description: 'Boot or reset the in-browser WebContainer sandbox execution environment.',
    parameters: bootSandboxSchema,
    // execute omitted: handled on browser client
  }),

  sandboxWriteFile: tool({
    description: 'Write a file into the in-browser WebContainer filesystem.',
    parameters: sandboxWriteFileSchema,
    // execute omitted: handled on browser client
  }),

  sandboxReadFile: tool({
    description: 'Read a file from the in-browser WebContainer filesystem.',
    parameters: sandboxReadFileSchema,
    // execute omitted: handled on browser client
  }),

  sandboxRunCommand: tool({
    description: 'Execute a shell command (e.g. node, npm) inside the in-browser WebContainer.',
    parameters: sandboxRunCommandSchema,
    // execute omitted: handled on browser client
  }),

  sandboxStartServer: tool({
    description: 'Start a Node.js development server script inside the WebContainer.',
    parameters: sandboxStartServerSchema,
    // execute omitted: handled on browser client
  }),
};

// ============================================================================
// 4. Combined Tools for AI SDK streamText Orchestration
// ============================================================================

export function getTools(githubToken?: string) {
  const ghTools = createGitHubTools(githubToken);
  return {
    ...ghTools,
    ...sandboxTools,
  };
}

// ============================================================================
// 5. Client Tool Executors Bridge (for WebContainer Execution)
// ============================================================================

export function getClientToolExecutors(backend?: ClientSandboxBackend): ClientToolExecutors {
  return {
    bootSandbox: async (args?: BootSandboxParams) => {
      if (backend?.boot) {
        await backend.boot();
        return { ready: true, status: 'booted' };
      }
      if (typeof window !== 'undefined') {
        const { bootWebContainer } = await import('./webcontainer');
        await bootWebContainer();
        return { ready: true, status: 'ready' };
      }
      return { ready: true, status: 'mock_booted' };
    },

    sandboxWriteFile: async ({ path, content }: SandboxWriteFileParams) => {
      if (backend) {
        await backend.writeFile(path, content);
        return { success: true, path, bytes: content.length };
      }
      if (typeof window !== 'undefined') {
        const { writeFile } = await import('./webcontainer');
        await writeFile(path, content);
        return { success: true, path, bytes: content.length };
      }
      throw new Error(
        'sandboxWriteFile requires a browser WebContainer environment or custom backend harness.'
      );
    },

    sandboxReadFile: async ({ path }: SandboxReadFileParams) => {
      if (backend) {
        const content = await backend.readFile(path);
        return { path, content };
      }
      if (typeof window !== 'undefined') {
        const { readFile } = await import('./webcontainer');
        const content = await readFile(path);
        return { path, content };
      }
      throw new Error(
        'sandboxReadFile requires a browser WebContainer environment or custom backend harness.'
      );
    },

    sandboxRunCommand: async ({ command, args = [], timeoutMs }: SandboxRunCommandParams) => {
      if (backend) {
        const proc = await backend.spawn(command, args);
        let output = '';
        if (proc.onOutput) {
          proc.onOutput((chunk: string) => {
            output += chunk;
          });
        }
        const exitCode = await proc.exit;
        return { exitCode, output: output.trim() };
      }
      if (typeof window !== 'undefined') {
        const { spawn } = await import('./webcontainer');
        const proc = await spawn(command, args);
        let output = '';
        const reader = proc.output.getReader();
        const readLoop = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) output += value;
          }
        };
        readLoop().catch(() => {});
        const exitCode = await proc.exit;
        return { exitCode, output: output.trim() };
      }
      throw new Error(
        'sandboxRunCommand requires a browser WebContainer environment or custom backend harness.'
      );
    },

    sandboxStartServer: async ({ script, scriptPath, port = 3000 }: SandboxStartServerParams) => {
      const targetScript = script || scriptPath || 'server.js';
      if (backend) {
        await backend.spawn('node', [targetScript]);
        return { port, url: `http://localhost:${port}`, started: true };
      }
      if (typeof window !== 'undefined') {
        const { spawn } = await import('./webcontainer');
        await spawn('node', [targetScript]);
        return { port, url: `http://localhost:${port}`, started: true };
      }
      throw new Error(
        'sandboxStartServer requires a browser WebContainer environment or custom backend harness.'
      );
    },
  };
}

export default getTools;
