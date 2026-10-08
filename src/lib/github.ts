/**
 * Isomorphic GitHub REST API Client
 * Cloud Coding AI Agent (Milestone M2)
 *
 * Implements native fetch-based interaction with GitHub REST API v2022-11-28.
 * Supports Node.js and Browser environments with zero bulky third-party dependencies.
 */

import type {
  GitHubUser,
  GitHubRepo,
  GitHubFileContent,
  GitHubCommitResult,
  CreateRepoOptions,
  ListReposOptions,
  ReadFileOptions,
  WriteFileOptions,
  GitHubClient,
  BoundGitHubClient,
} from '@/types/github';

export const DEFAULT_GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_API_BASE =
  typeof process !== 'undefined' && process.env?.GITHUB_API_BASE
    ? process.env.GITHUB_API_BASE
    : DEFAULT_GITHUB_API_BASE;
export const GITHUB_API_VERSION = '2022-11-28';

/**
 * Custom error class for GitHub API responses.
 */
export class GitHubApiError extends Error {
  public status: number;
  public statusText: string;
  public url: string;
  public responseBody: unknown;
  public documentationUrl?: string;

  constructor(
    message: string,
    status: number,
    statusText: string,
    url: string,
    responseBody?: unknown,
    documentationUrl?: string
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.responseBody = responseBody;
    this.documentationUrl = documentationUrl;
  }
}

/**
 * Robust isomorphic Base64 encoder supporting multibyte UTF-8 strings.
 */
export function toBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  if (typeof btoa !== 'undefined') {
    const encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    );
    return btoa(encoded);
  }
  throw new Error('No Base64 encoder available in current runtime environment.');
}

/**
 * Robust isomorphic Base64 decoder supporting multibyte UTF-8 and sanitizing API whitespace.
 */
export function fromBase64(base64Str: string): string {
  if (!base64Str) return '';
  const sanitized = base64Str.replace(/\s+/g, '');
  if (!sanitized) return '';

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(sanitized, 'base64').toString('utf-8');
  }
  if (typeof atob !== 'undefined') {
    const binary = atob(sanitized);
    try {
      const bytes = Array.from(
        binary,
        (char) => '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)
      ).join('');
      return decodeURIComponent(bytes);
    } catch {
      return binary;
    }
  }
  throw new Error('No Base64 decoder available in current runtime environment.');
}

/**
 * Safely sanitizes and builds standard GitHub API request headers.
 */
export function buildHeaders(token: string): HeadersInit {
  const cleanToken = token.trim();
  const authHeader =
    cleanToken.startsWith('Bearer ') || cleanToken.startsWith('token ')
      ? cleanToken
      : `Bearer ${cleanToken}`;

  return {
    Accept: 'application/vnd.github+json',
    Authorization: authHeader,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'Cloud-Coding-Agent',
    'Content-Type': 'application/json',
  };
}

/**
 * Encodes a path preserving path separators ('/').
 */
function encodePath(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  return normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Internal helper to execute GitHub API fetch requests with enhanced error diagnostics.
 */
async function fetchGitHub<T>(
  endpoint: string,
  token: string,
  options: RequestInit & { baseUrl?: string } = {}
): Promise<{ data: T; headers: Headers; status: number }> {
  const cleanToken = token ? token.trim() : '';
  if (!cleanToken) {
    throw new GitHubApiError(
      'GitHub Personal Access Token is required.',
      401,
      'Unauthorized',
      endpoint
    );
  }

  const base =
    options.baseUrl ||
    (typeof process !== 'undefined' && process.env?.GITHUB_API_BASE) ||
    GITHUB_API_BASE;
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
  const requestHeaders = {
    ...buildHeaders(cleanToken),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers: requestHeaders,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let responseBody: unknown = null;
  if (response.status !== 204) {
    if (isJson) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }
    } else {
      try {
        responseBody = await response.text();
      } catch {
        responseBody = null;
      }
    }
  }

  if (!response.ok) {
    let message = `GitHub API request failed with status ${response.status} (${response.statusText})`;
    let docUrl: string | undefined;

    if (responseBody && typeof responseBody === 'object') {
      const errObj = responseBody as Record<string, unknown>;
      if (typeof errObj.message === 'string') {
        message = errObj.message;
      }
      if (typeof errObj.documentation_url === 'string') {
        docUrl = errObj.documentation_url;
      }
    } else if (typeof responseBody === 'string' && responseBody.trim()) {
      message = responseBody;
    }

    // Enhance standard HTTP errors with actionable diagnostics
    if (response.status === 401) {
      message = `Invalid or expired GitHub Personal Access Token (PAT): ${message}`;
    } else if (response.status === 403) {
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      if (rateLimitRemaining === '0') {
        message = 'GitHub API rate limit exceeded. Please wait or use an authenticated PAT with higher limits.';
      } else {
        message = `GitHub permission denied (403): ${message}. Verify that your PAT includes the 'repo' scope.`;
      }
    } else if (response.status === 404) {
      message = `Resource not found on GitHub (${url}): ${message}`;
    }

    throw new GitHubApiError(
      message,
      response.status,
      response.statusText,
      url,
      responseBody,
      docUrl
    );
  }

  return {
    data: responseBody as T,
    headers: response.headers,
    status: response.status,
  };
}

/**
 * Validates the provided PAT, retrieving user identity and authorized OAuth scopes.
 * Endpoint: GET /user
 */
export async function validateAuth(
  token: string,
  options: { baseUrl?: string } = {}
): Promise<GitHubUser> {
  const { data, headers } = await fetchGitHub<Record<string, unknown>>('/user', token, {
    baseUrl: options.baseUrl,
  });

  const rawScopes = headers.get('x-oauth-scopes');
  const scopes = rawScopes
    ? rawScopes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    login: String(data.login ?? ''),
    id: Number(data.id ?? 0),
    name: data.name ? String(data.name) : null,
    avatarUrl: String(data.avatar_url ?? data.avatarUrl ?? ''),
    htmlUrl: String(data.html_url ?? data.htmlUrl ?? ''),
    scopes,
    email: data.email ? String(data.email) : null,
    bio: data.bio ? String(data.bio) : null,
    publicRepos: typeof data.public_repos === 'number' ? data.public_repos : undefined,
    totalPrivateRepos:
      typeof data.total_private_repos === 'number' ? data.total_private_repos : undefined,
  };
}

/**
 * Lists repositories accessible by the authenticated user.
 * Endpoint: GET /user/repos
 */
export async function listRepositories(
  token: string,
  options: ListReposOptions = {}
): Promise<GitHubRepo[]> {
  const query = new URLSearchParams();
  if (options.visibility) query.set('visibility', options.visibility);
  if (options.sort) query.set('sort', options.sort);
  if (options.direction) query.set('direction', options.direction);
  if (options.perPage) query.set('per_page', String(options.perPage));
  if (options.page) query.set('page', String(options.page));

  const queryString = query.toString();
  const endpoint = `/user/repos${queryString ? `?${queryString}` : ''}`;

  const { data } = await fetchGitHub<Array<Record<string, unknown>>>(endpoint, token, {
    baseUrl: options.baseUrl,
  });

  return data.map((item) => {
    const ownerObj = (item.owner as Record<string, unknown>) || {};
    return {
      id: Number(item.id),
      name: String(item.name),
      fullName: String(item.full_name),
      private: Boolean(item.private),
      htmlUrl: String(item.html_url),
      defaultBranch: String(item.default_branch || 'main'),
      description: item.description ? String(item.description) : null,
      owner: {
        login: String(ownerObj.login || ''),
        id: Number(ownerObj.id || 0),
        avatarUrl: ownerObj.avatar_url ? String(ownerObj.avatar_url) : undefined,
        htmlUrl: ownerObj.html_url ? String(ownerObj.html_url) : undefined,
      },
      createdAt: item.created_at ? String(item.created_at) : undefined,
      updatedAt: item.updated_at ? String(item.updated_at) : undefined,
      pushedAt: item.pushed_at ? String(item.pushed_at) : undefined,
      fork: Boolean(item.fork),
      archived: Boolean(item.archived),
      openIssuesCount:
        typeof item.open_issues_count === 'number' ? item.open_issues_count : undefined,
    };
  });
}

/**
 * Creates a new repository under the authenticated user's account.
 * Endpoint: POST /user/repos
 * Defaults autoInit to true so default branch (main) exists immediately.
 */
export async function createRepository(
  token: string,
  options: CreateRepoOptions
): Promise<GitHubRepo> {
  const payload = {
    name: options.name.trim(),
    description: options.description?.trim() || undefined,
    private: options.private ?? false,
    auto_init: options.autoInit ?? true,
  };

  const { data } = await fetchGitHub<Record<string, unknown>>('/user/repos', token, {
    method: 'POST',
    body: JSON.stringify(payload),
    baseUrl: options.baseUrl,
  });

  const ownerObj = (data.owner as Record<string, unknown>) || {};
  return {
    id: Number(data.id),
    name: String(data.name),
    fullName: String(data.full_name || data.fullName || `${ownerObj.login || ''}/${data.name}`),
    private: Boolean(data.private),
    htmlUrl: String(data.html_url || data.htmlUrl || ''),
    defaultBranch: String(data.default_branch || data.defaultBranch || 'main'),
    description: data.description ? String(data.description) : null,
    owner: {
      login: String(ownerObj.login || ''),
      id: Number(ownerObj.id || 0),
      avatarUrl: ownerObj.avatar_url ? String(ownerObj.avatar_url) : undefined,
      htmlUrl: ownerObj.html_url ? String(ownerObj.html_url) : undefined,
    },
    createdAt: data.created_at ? String(data.created_at) : undefined,
    updatedAt: data.updated_at ? String(data.updated_at) : undefined,
    pushedAt: data.pushed_at ? String(data.pushed_at) : undefined,
  };
}

/**
 * Retrieves repository metadata for a specific owner and repo.
 * Endpoint: GET /repos/{owner}/{repo}
 */
export async function getRepository(
  token: string,
  owner: string,
  repo: string,
  options: { baseUrl?: string } = {}
): Promise<GitHubRepo> {
  const endpoint = `/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(repo.trim())}`;
  const { data } = await fetchGitHub<Record<string, unknown>>(endpoint, token, {
    baseUrl: options.baseUrl,
  });

  const ownerObj = (data.owner as Record<string, unknown>) || {};
  return {
    id: Number(data.id),
    name: String(data.name),
    fullName: String(data.full_name || data.fullName || `${ownerObj.login || owner}/${data.name}`),
    private: Boolean(data.private),
    htmlUrl: String(data.html_url || data.htmlUrl || ''),
    defaultBranch: String(data.default_branch || data.defaultBranch || 'main'),
    description: data.description ? String(data.description) : null,
    owner: {
      login: String(ownerObj.login || owner),
      id: Number(ownerObj.id || 0),
      avatarUrl: ownerObj.avatar_url ? String(ownerObj.avatar_url) : undefined,
      htmlUrl: ownerObj.html_url ? String(ownerObj.html_url) : undefined,
    },
    createdAt: data.created_at ? String(data.created_at) : undefined,
    updatedAt: data.updated_at ? String(data.updated_at) : undefined,
    pushedAt: data.pushed_at ? String(data.pushed_at) : undefined,
    fork: Boolean(data.fork),
    archived: Boolean(data.archived),
    openIssuesCount:
      typeof data.open_issues_count === 'number' ? data.open_issues_count : undefined,
  };
}

/**
 * Reads a file's content from a GitHub repository, decoding Base64 content to UTF-8.
 * Endpoint: GET /repos/{owner}/{repo}/contents/{path}
 */
export async function readFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  optionsOrRef?: ReadFileOptions | string
): Promise<GitHubFileContent> {
  const options: ReadFileOptions =
    typeof optionsOrRef === 'string'
      ? { ref: optionsOrRef }
      : optionsOrRef || {};
  const ref = options.ref;

  const encodedPath = encodePath(path);
  const endpoint = `/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(
    repo.trim()
  )}/contents/${encodedPath}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;

  const { data } = await fetchGitHub<Record<string, unknown>>(endpoint, token, {
    baseUrl: options.baseUrl,
  });

  if (Array.isArray(data)) {
    throw new GitHubApiError(
      `Path "${path}" is a directory, not a file.`,
      400,
      'Bad Request',
      endpoint
    );
  }

  const rawContent = typeof data.content === 'string' ? data.content : '';
  const decodedContent = fromBase64(rawContent);

  return {
    name: String(data.name || ''),
    path: String(data.path || path),
    sha: String(data.sha || ''),
    size: Number(data.size || 0),
    content: decodedContent,
    encoding: String(data.encoding || 'base64'),
    htmlUrl: data.html_url ? String(data.html_url) : undefined,
    downloadUrl: data.download_url ? String(data.download_url) : null,
    type: String(data.type || 'file'),
  };
}

/**
 * Writes or updates a file in a GitHub repository.
 * Probes for existing file SHA to allow transparent updates.
 * Endpoint: PUT /repos/{owner}/{repo}/contents/{path}
 */
export async function writeFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  optionsOrBranch?: WriteFileOptions | string
): Promise<GitHubCommitResult> {
  const options: WriteFileOptions =
    typeof optionsOrBranch === 'string'
      ? { branch: optionsOrBranch }
      : optionsOrBranch || {};

  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();
  const encodedPath = encodePath(path);

  // Automatic SHA probe: check if file already exists so we can supply SHA
  let fileSha: string | undefined = options.sha;
  let isUpdate = Boolean(fileSha);

  if (!fileSha) {
    try {
      const probeEndpoint = `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(
        cleanRepo
      )}/contents/${encodedPath}${options.branch ? `?ref=${encodeURIComponent(options.branch)}` : ''}`;

      const { data } = await fetchGitHub<Record<string, unknown>>(probeEndpoint, token, {
        baseUrl: options.baseUrl,
      });
      if (data && typeof data.sha === 'string') {
        fileSha = data.sha;
        isUpdate = true;
      }
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 404) {
        // File does not exist yet; creating a new file
        fileSha = undefined;
        isUpdate = false;
      } else {
        throw err;
      }
    }
  }

  const base64Content = toBase64(content);
  const payload: Record<string, unknown> = {
    message: message.trim() || `Update ${path}`,
    content: base64Content,
  };

  if (fileSha) {
    payload.sha = fileSha;
  }
  if (options.branch) {
    payload.branch = options.branch;
  }
  if (options.author) {
    payload.author = options.author;
  }

  const endpoint = `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(
    cleanRepo
  )}/contents/${encodedPath}`;

  const { data } = await fetchGitHub<Record<string, unknown>>(endpoint, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
    baseUrl: options.baseUrl,
  });

  const commitObj = (data.commit as Record<string, unknown>) || {};
  const contentObj = (data.content as Record<string, unknown>) || {};

  return {
    path: String(contentObj.path || path),
    commitSha: String(commitObj.sha || ''),
    contentSha: String(contentObj.sha || ''),
    htmlUrl: contentObj.html_url ? String(contentObj.html_url) : undefined,
    updated: isUpdate,
    commitMessage: message,
  };
}

/**
 * Deletes a repository under the authenticated user or organization.
 * Endpoint: DELETE /repos/{owner}/{repo}
 * Note: Requires PAT with 'delete_repo' scope.
 */
export async function deleteRepository(
  token: string,
  owner: string,
  repo: string,
  options: { baseUrl?: string } = {}
): Promise<boolean> {
  const endpoint = `/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(repo.trim())}`;
  await fetchGitHub<unknown>(endpoint, token, {
    method: 'DELETE',
    baseUrl: options.baseUrl,
  });
  return true;
}

/**
 * Recursively fetches the Git tree for a repository.
 * Endpoint: GET /repos/{owner}/{repo}/git/trees/{treeSha}?recursive=1
 */
export async function getTree(
  token: string,
  owner: string,
  repo: string,
  treeSha = 'main',
  recursive = true,
  options: { baseUrl?: string } = {}
): Promise<{
  sha: string;
  url: string;
  truncated: boolean;
  tree: Array<{ path: string; mode: string; type: string; sha: string; size?: number; url: string }>;
}> {
  const endpoint = `/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(
    repo.trim()
  )}/git/trees/${encodeURIComponent(treeSha)}${recursive ? '?recursive=1' : ''}`;

  const { data } = await fetchGitHub<{
    sha: string;
    url: string;
    truncated: boolean;
    tree: Array<{ path: string; mode: string; type: string; sha: string; size?: number; url: string }>;
  }>(endpoint, token, {
    baseUrl: options.baseUrl,
  });

  return data;
}

// Aliases for compatibility across tools, UI, and test suites
export const listRepos = listRepositories;
export const createRepo = createRepository;
export const getRepo = getRepository;
export const deleteRepo = deleteRepository;

/**
 * Creates a pre-bound GitHub client instance for a given token.
 */
export function createGitHubClient(
  token: string,
  clientOptions: { baseUrl?: string } = {}
): BoundGitHubClient {
  const base = clientOptions.baseUrl;
  return {
    validateAuth: () => validateAuth(token, { baseUrl: base }),
    listRepositories: (opts) => listRepositories(token, { baseUrl: base, ...opts }),
    createRepository: (opts) => createRepository(token, { baseUrl: base, ...opts }),
    getRepository: (owner, repo) => getRepository(token, owner, repo, { baseUrl: base }),
    readFile: (owner, repo, path, opts) => {
      const parsedOpts =
        typeof opts === 'string' ? { ref: opts, baseUrl: base } : { baseUrl: base, ...opts };
      return readFile(token, owner, repo, path, parsedOpts);
    },
    writeFile: (owner, repo, path, content, msg, opts) => {
      const parsedOpts =
        typeof opts === 'string' ? { branch: opts, baseUrl: base } : { baseUrl: base, ...opts };
      return writeFile(token, owner, repo, path, content, msg, parsedOpts);
    },
  };
}

/**
 * Default GitHubClient object implementation conforming to PROJECT.md interface contract.
 */
export const githubClient: GitHubClient = {
  validateAuth,
  listRepositories,
  createRepository,
  getRepository,
  readFile,
  writeFile,
};

export default githubClient;
