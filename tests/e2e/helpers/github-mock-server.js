/**
 * High-fidelity Mock GitHub REST API v3 Server and GitHub Native Client.
 * Adheres strictly to GitHub REST API v3 specifications and PROJECT.md interface contracts.
 */
const http = require('node:http');
const crypto = require('node:crypto');

function computeGitBlobSha(contentBuffer) {
  const header = `blob ${contentBuffer.length}\0`;
  const store = Buffer.concat([Buffer.from(header), contentBuffer]);
  return crypto.createHash('sha1').update(store).digest('hex');
}

class MockGitHubServer {
  constructor(options = {}) {
    this.port = options.port || 0;
    this.server = null;
    this.baseUrl = '';
    this.validTokens = new Set(['ghp_valid_test_token_123456789', 'test-token']);
    this.repos = new Map(); // key: owner/repo, value: { metadata, files: Map(path -> { contentBuffer, sha }) }
    this.requestLog = [];
    this.rateLimit = { limit: 5000, remaining: 5000 };
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        const address = this.server.address();
        this.port = address.port;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve(this.baseUrl);
      });

      this.server.on('error', reject);
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  reset() {
    this.repos.clear();
    this.requestLog = [];
    this.rateLimit = { limit: 5000, remaining: 5000 };
  }

  handleRequest(req, res) {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });

    req.on('end', () => {
      const urlObj = new URL(req.url, this.baseUrl);
      const pathname = urlObj.pathname;
      const method = req.method.toUpperCase();

      this.requestLog.push({
        method,
        pathname,
        headers: req.headers,
        body: rawBody,
        timestamp: Date.now(),
      });

      // Default response headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-GitHub-Media-Type', 'github.v3; format=json');
      res.setHeader('X-RateLimit-Limit', String(this.rateLimit.limit));
      res.setHeader('X-RateLimit-Remaining', String(this.rateLimit.remaining));

      // Auth check
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+|^token\s+/i, '').trim();

      if (!token || (!this.validTokens.has(token) && !token.startsWith('ghp_valid'))) {
        res.statusCode = 401;
        return res.end(JSON.stringify({
          message: 'Bad credentials',
          documentation_url: 'https://docs.github.com/rest'
        }));
      }

      // Decrement rate limit
      this.rateLimit.remaining = Math.max(0, this.rateLimit.remaining - 1);

      // Routing
      try {
        // 1. GET /user
        if (method === 'GET' && pathname === '/user') {
          res.statusCode = 200;
          return res.end(JSON.stringify({
            login: 'test-agent-user',
            id: 98765432,
            name: 'Cloud Coding Agent User',
            avatar_url: 'https://avatars.githubusercontent.com/u/98765432',
            avatarUrl: 'https://avatars.githubusercontent.com/u/98765432',
            html_url: 'https://github.com/test-agent-user',
            type: 'User',
          }));
        }

        // 2. GET /user/repos
        if (method === 'GET' && pathname === '/user/repos') {
          const repoList = [];
          for (const [fullName, repo] of this.repos.entries()) {
            repoList.push({
              id: repo.metadata.id,
              name: repo.metadata.name,
              full_name: fullName,
              fullName: fullName,
              private: repo.metadata.private,
              html_url: repo.metadata.htmlUrl,
              htmlUrl: repo.metadata.htmlUrl,
              default_branch: repo.metadata.defaultBranch,
              defaultBranch: repo.metadata.defaultBranch,
              created_at: repo.metadata.createdAt,
            });
          }
          res.statusCode = 200;
          return res.end(JSON.stringify(repoList));
        }

        // 3. POST /user/repos
        if (method === 'POST' && pathname === '/user/repos') {
          const body = rawBody ? JSON.parse(rawBody) : {};
          const name = body.name;

          if (!name || typeof name !== 'string') {
            res.statusCode = 422;
            return res.end(JSON.stringify({
              message: 'Validation Failed',
              errors: [{ resource: 'Repository', code: 'missing_field', field: 'name' }]
            }));
          }

          const fullName = `test-agent-user/${name}`;
          if (this.repos.has(fullName)) {
            res.statusCode = 422;
            return res.end(JSON.stringify({
              message: 'Repository creation failed.',
              errors: [{
                resource: 'Repository',
                code: 'already_exists',
                field: 'name',
                message: 'name already exists on this account'
              }]
            }));
          }

          const repoMetadata = {
            id: 100000 + this.repos.size + 1,
            name,
            fullName,
            full_name: fullName,
            private: Boolean(body.private),
            htmlUrl: `https://github.com/${fullName}`,
            html_url: `https://github.com/${fullName}`,
            defaultBranch: 'main',
            default_branch: 'main',
            description: body.description || '',
            createdAt: new Date().toISOString(),
          };

          const files = new Map();
          if (body.auto_init) {
            const readmeContent = Buffer.from(`# ${name}\n\nCreated by Cloud Coding Agent.`);
            const sha = computeGitBlobSha(readmeContent);
            files.set('README.md', {
              contentBuffer: readmeContent,
              sha,
            });
          }

          this.repos.set(fullName, {
            metadata: repoMetadata,
            files,
            autoInit: Boolean(body.auto_init),
          });

          res.statusCode = 201;
          return res.end(JSON.stringify(repoMetadata));
        }

        // 4. GET /repos/:owner/:repo
        const getRepoMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)$/);
        if (method === 'GET' && getRepoMatch) {
          const owner = getRepoMatch[1];
          const repoName = getRepoMatch[2];
          const fullName = `${owner}/${repoName}`;

          const repo = this.repos.get(fullName);
          if (!repo) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ message: 'Not Found' }));
          }

          res.statusCode = 200;
          return res.end(JSON.stringify(repo.metadata));
        }

        // 5. GET /repos/:owner/:repo/contents/:path*
        const getContentsMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
        if (method === 'GET' && getContentsMatch) {
          const owner = getContentsMatch[1];
          const repoName = getContentsMatch[2];
          const filePath = decodeURIComponent(getContentsMatch[3]);
          const fullName = `${owner}/${repoName}`;

          const repo = this.repos.get(fullName);
          if (!repo) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ message: 'Not Found' }));
          }

          if (repo.files.size === 0 && !repo.autoInit) {
            res.statusCode = 409;
            return res.end(JSON.stringify({ message: 'Git Repository is empty.' }));
          }

          const file = repo.files.get(filePath);
          if (!file) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ message: 'Not Found' }));
          }

          res.statusCode = 200;
          return res.end(JSON.stringify({
            name: filePath.split('/').pop(),
            path: filePath,
            sha: file.sha,
            size: file.contentBuffer.length,
            encoding: 'base64',
            content: file.contentBuffer.toString('base64'),
            html_url: `https://github.com/${fullName}/blob/main/${filePath}`,
            download_url: `https://raw.githubusercontent.com/${fullName}/main/${filePath}`,
          }));
        }

        // 6. PUT /repos/:owner/:repo/contents/:path*
        const putContentsMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
        if (method === 'PUT' && putContentsMatch) {
          const owner = putContentsMatch[1];
          const repoName = putContentsMatch[2];
          const filePath = decodeURIComponent(putContentsMatch[3]);
          const fullName = `${owner}/${repoName}`;

          const repo = this.repos.get(fullName);
          if (!repo) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ message: 'Not Found' }));
          }

          const body = rawBody ? JSON.parse(rawBody) : {};
          if (!body.content || typeof body.content !== 'string') {
            res.statusCode = 422;
            return res.end(JSON.stringify({
              message: 'Validation Failed',
              errors: [{ resource: 'Commit', code: 'missing_field', field: 'content' }]
            }));
          }

          // Check if file exists
          const existingFile = repo.files.get(filePath);
          if (existingFile) {
            if (!body.sha) {
              res.statusCode = 422;
              return res.end(JSON.stringify({
                message: '"sha" wasn\'t supplied.',
                documentation_url: 'https://docs.github.com/rest'
              }));
            }
            if (body.sha !== existingFile.sha) {
              res.statusCode = 409;
              return res.end(JSON.stringify({
                message: `${filePath} does not match ${body.sha}`,
                documentation_url: 'https://docs.github.com/rest'
              }));
            }
          }

          // Sanitize base64 (strip newlines/whitespace)
          const cleanBase64 = body.content.replace(/\s/g, '');
          const contentBuffer = Buffer.from(cleanBase64, 'base64');
          const contentSha = computeGitBlobSha(contentBuffer);
          const commitSha = crypto.randomBytes(20).toString('hex');

          repo.files.set(filePath, {
            contentBuffer,
            sha: contentSha,
          });

          res.statusCode = existingFile ? 200 : 201;
          return res.end(JSON.stringify({
            content: {
              name: filePath.split('/').pop(),
              path: filePath,
              sha: contentSha,
              size: contentBuffer.length,
              html_url: `https://github.com/${fullName}/blob/main/${filePath}`,
            },
            commit: {
              sha: commitSha,
              message: body.message || 'Commit via Cloud Coding Agent',
            }
          }));
        }

        // 7. GET /repos/:owner/:repo/git/trees/:sha
        const getTreeMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^/]+)$/);
        if (method === 'GET' && getTreeMatch) {
          const owner = getTreeMatch[1];
          const repoName = getTreeMatch[2];
          const treeSha = getTreeMatch[3];
          const fullName = `${owner}/${repoName}`;

          const repo = this.repos.get(fullName);
          if (!repo) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ message: 'Not Found' }));
          }

          if (repo.files.size === 0) {
            res.statusCode = 409;
            return res.end(JSON.stringify({ message: 'Git Repository is empty.' }));
          }

          const tree = [];
          for (const [filePath, file] of repo.files.entries()) {
            tree.push({
              path: filePath,
              mode: '100644',
              type: 'blob',
              sha: file.sha,
              size: file.contentBuffer.length,
              url: `https://api.github.com/repos/${fullName}/git/blobs/${file.sha}`,
            });
          }

          res.statusCode = 200;
          return res.end(JSON.stringify({
            sha: treeSha,
            url: `https://api.github.com/repos/${fullName}/git/trees/${treeSha}`,
            tree,
            truncated: false,
          }));
        }

        // Route not matched
        res.statusCode = 404;
        return res.end(JSON.stringify({ message: `Not Found: ${method} ${pathname}` }));
      } catch (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ message: 'Internal Server Error', error: err.message }));
      }
    });
  }
}

/**
 * Creates an isomorphic GitHub client implementing the PROJECT.md interface contract.
 */
function createGitHubClient(options = {}) {
  const baseUrl = options.baseUrl || 'https://api.github.com';

  async function request(endpoint, token, fetchOptions = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Cloud-Coding-AI-Agent-E2E-Runner',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(fetchOptions.headers || {}),
    };

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const errorMsg = data.message || `GitHub API request failed with HTTP ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.response = data;
      throw err;
    }

    return data;
  }

  return {
    async validateAuth(token) {
      if (!token) throw new Error('GitHub token is required.');
      const data = await request('/user', token);
      return {
        login: data.login,
        id: data.id,
        name: data.name || null,
        avatarUrl: data.avatar_url || data.avatarUrl || '',
      };
    },

    async listRepositories(token, options = {}) {
      const perPage = options.perPage || 30;
      const data = await request(`/user/repos?per_page=${perPage}&sort=updated`, token);
      return data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name || repo.fullName,
        private: Boolean(repo.private),
        htmlUrl: repo.html_url || repo.htmlUrl,
      }));
    },

    async createRepository(token, options) {
      if (!options || !options.name) throw new Error('Repository name is required.');
      const payload = {
        name: options.name,
        description: options.description || '',
        private: Boolean(options.private),
        auto_init: options.autoInit !== undefined ? Boolean(options.autoInit) : true,
      };

      const data = await request('/user/repos', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name || data.fullName,
        private: Boolean(data.private),
        htmlUrl: data.html_url || data.htmlUrl,
        defaultBranch: data.default_branch || data.defaultBranch || 'main',
      };
    },

    async getRepository(token, owner, repo) {
      const data = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name || data.fullName,
        private: Boolean(data.private),
        htmlUrl: data.html_url || data.htmlUrl,
        defaultBranch: data.default_branch || data.defaultBranch || 'main',
      };
    },

    async readFile(token, owner, repo, path) {
      const cleanPath = path.replace(/^\//, '');
      const data = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(cleanPath)}`, token);
      
      const cleanBase64 = (data.content || '').replace(/\s/g, '');
      const decodedContent = Buffer.from(cleanBase64, 'base64').toString('utf-8');

      return {
        path: data.path || cleanPath,
        content: decodedContent,
        sha: data.sha,
      };
    },

    async writeFile(token, owner, repo, path, content, message = 'Update file via Cloud Coding Agent') {
      const cleanPath = path.replace(/^\//, '');
      
      // Proactively probe for existing file to resolve SHA
      let existingSha;
      try {
        const existing = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(cleanPath)}`, token);
        if (existing && existing.sha) {
          existingSha = existing.sha;
        }
      } catch (err) {
        if (err.status !== 404) {
          // If error is not 404, rethrow
          throw err;
        }
      }

      // Encode content in base64 safely supporting Unicode / UTF-8
      const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

      const body = {
        message,
        content: encodedContent,
        ...(existingSha ? { sha: existingSha } : {}),
      };

      const data = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(cleanPath)}`, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return {
        path: data.content ? data.content.path : cleanPath,
        commitSha: data.commit ? data.commit.sha : '',
        contentSha: data.content ? data.content.sha : '',
      };
    },
  };
}

module.exports = {
  MockGitHubServer,
  createGitHubClient,
  computeGitBlobSha,
};
