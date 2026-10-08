/**
 * GitHub REST API Client & Verification Type Definitions
 * Cloud Coding AI Agent (Milestone M2)
 */

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  scopes: string[];
  email?: string | null;
  bio?: string | null;
  publicRepos?: number;
  totalPrivateRepos?: number;
}

export interface GitHubRepoOwner {
  login: string;
  id: number;
  avatarUrl?: string;
  htmlUrl?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  description: string | null;
  owner: GitHubRepoOwner;
  createdAt?: string;
  updatedAt?: string;
  pushedAt?: string;
  fork?: boolean;
  archived?: boolean;
  openIssuesCount?: number;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string; // Decoded UTF-8 content
  encoding: string;
  htmlUrl?: string;
  downloadUrl?: string | null;
  type?: string;
}

export interface GitHubCommitAuthor {
  name: string;
  email: string;
  date?: string;
}

export interface GitHubCommitResult {
  path: string;
  commitSha: string;
  contentSha: string;
  htmlUrl?: string;
  updated: boolean;
  commitMessage?: string;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  baseUrl?: string;
}

export interface ListReposOptions {
  visibility?: 'all' | 'public' | 'private';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
  baseUrl?: string;
}

export interface ReadFileOptions {
  ref?: string;
  baseUrl?: string;
}

export interface WriteFileOptions {
  branch?: string;
  author?: {
    name: string;
    email: string;
  };
  sha?: string;
  baseUrl?: string;
}

export interface GitHubVerificationStep {
  name: string;
  ok: boolean;
  detail: string;
  durationMs?: number;
}

export interface GitHubVerificationResult {
  success: boolean;
  durationMs: number;
  repo: string;
  steps: GitHubVerificationStep[];
  logs: string[];
  repoUrl?: string;
  error?: string;
}

export interface GitHubClient {
  validateAuth(token: string): Promise<GitHubUser>;
  listRepositories(token: string, options?: ListReposOptions): Promise<GitHubRepo[]>;
  createRepository(token: string, options: CreateRepoOptions): Promise<GitHubRepo>;
  getRepository(token: string, owner: string, repo: string): Promise<GitHubRepo>;
  readFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    options?: ReadFileOptions | string
  ): Promise<GitHubFileContent>;
  writeFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    options?: WriteFileOptions | string
  ): Promise<GitHubCommitResult>;
}

export interface BoundGitHubClient {
  validateAuth(): Promise<GitHubUser>;
  listRepositories(options?: ListReposOptions): Promise<GitHubRepo[]>;
  createRepository(options: CreateRepoOptions): Promise<GitHubRepo>;
  getRepository(owner: string, repo: string): Promise<GitHubRepo>;
  readFile(
    owner: string,
    repo: string,
    path: string,
    options?: ReadFileOptions | string
  ): Promise<GitHubFileContent>;
  writeFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    options?: WriteFileOptions | string
  ): Promise<GitHubCommitResult>;
}

