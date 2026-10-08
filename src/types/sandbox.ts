import type {
  WebContainer,
  WebContainerProcess,
  SpawnOptions,
  DirEnt,
} from '@webcontainer/api';

export type SandboxStatus = 'uninitialized' | 'booting' | 'ready' | 'error';

export interface WebContainerInstance {
  boot(): Promise<WebContainer>;
  getInstance(): Promise<WebContainer>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<string | void>;
  readdir(
    path: string,
    options?: { withFileTypes?: boolean }
  ): Promise<string[] | DirEnt<string>[]>;
  spawn(command: string, args: string[], options?: SpawnOptions): Promise<WebContainerProcess>;
  onServerReady(callback: (port: number, url: string) => void): () => void;
  onPortChange(callback: (port: number, type: 'open' | 'close', url?: string) => void): () => void;
  getStatus(): SandboxStatus;
}

export interface SandboxVerificationResult {
  success: boolean;
  durationMs: number;
  port: number;
  url: string;
  response: unknown;
  logs: string[];
  error?: string;
}

export interface ProcessOutputChunk {
  type: 'stdout' | 'stderr' | 'system';
  data: string;
  timestamp: number;
}

export interface SandboxPortEvent {
  port: number;
  type: 'open' | 'close';
  url?: string;
}

export interface SandboxServerReadyEvent {
  port: number;
  url: string;
}

export type {
  WebContainer,
  WebContainerProcess,
  SpawnOptions,
  DirEnt,
};
