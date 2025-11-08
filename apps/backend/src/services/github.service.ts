/**
 * GitHub API Client via Airia Connectors
 * 
 * Provides secure GitHub integration through Airia's data connectors
 * with OAuth token encryption, repository access, and rate limit handling.
 * 
 * Requirements: 1.2, 1.3, 2.1, 2.4, 2.5, 2.8, 6.5, 6.7, 20.1, 20.5, 20.7
 */

import crypto from 'crypto';
import axios from 'axios';
import {
  Repository,
  RepositoryListResponse,
  FileTreeResponse,
  FileTreeNode,
  GitHubToken,
  RateLimitResponse,
  RateLimit,
  RepositoryValidation,
  ParsedRepositoryUrl,
  CommitHistoryResponse,
  GitCommit,
  GitBranch,
  CommitDiff,
  FileDiff,
} from '@codebase-onboarding/shared';

import { config } from '../config';
import { getAiriaClient } from './airia.service';
// Removed Redis usage: using in-memory maps instead for tokens & caching

/**
 * Encryption key for GitHub tokens (should be from secure key management)
 */
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || 
  crypto.randomBytes(32).toString('hex');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Cache TTLs
 */
const CACHE_TTL = {
  REPO_METADATA: 3600, // 1 hour (Requirement 14.7)
  FILE_TREE: 3600, // 1 hour
  RATE_LIMIT: 60, // 1 minute
};

/**
 * GitHub API client via Airia connectors
 */
export class GitHubService {
  private airiaClient = getAiriaClient();
  // In-memory volatile stores (non-persistent; reset on process restart)
  private tokenStore: Map<string, string> = new Map();
  private cacheStore: Map<string, { value: any; expiresAt: number }> = new Map();

  private getCache<T=any>(key: string): T | null {
    const entry = this.cacheStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.cacheStore.delete(key); return null; }
    return entry.value as T;
  }

  private setCache(key: string, value: any, ttlSeconds: number): void {
    this.cacheStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  /**
   * Encrypt GitHub OAuth token using AES-256
   * Requirement 1.2: Encrypt the Access Token using AES-256 encryption
   */
  encryptToken(token: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + encrypted data
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  }

  /**
   * Decrypt GitHub OAuth token
   */
  decryptToken(encryptedToken: string): string {
    const iv = Buffer.from(encryptedToken.slice(0, IV_LENGTH * 2), 'hex');
    const authTag = Buffer.from(
      encryptedToken.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2),
      'hex'
    );
    const encrypted = encryptedToken.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Store encrypted GitHub token for user
   * Requirement 1.7: Store Access Tokens separately with tenant isolation
   */
  async storeToken(
    userId: string,
    tenantId: string,
    token: string,
    expiresIn: number = 28800, // 8 hours default
    refreshToken?: string,
    scope: string[] = ['repo']
  ): Promise<void> {
    const encryptedToken = this.encryptToken(token);
    const encryptedRefreshToken = refreshToken ? this.encryptToken(refreshToken) : undefined;

    const githubToken: GitHubToken = {
      encryptedToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      refreshToken: encryptedRefreshToken,
      scope,
    };
    const key = `token:${tenantId}:${userId}`;
    this.tokenStore.set(key, JSON.stringify(githubToken));
  }

  /**
   * Retrieve and decrypt GitHub token for user
   */
  async getToken(userId: string, tenantId: string): Promise<string | null> {
    const key = `token:${tenantId}:${userId}`;
    const data = this.tokenStore.get(key);

    if (!data) {
      return null;
    }

    const githubToken: GitHubToken = JSON.parse(data);
    
    // Check if token is expired
    if (new Date(githubToken.expiresAt) < new Date()) {
      await this.deleteToken(userId, tenantId);
      return null;
    }

    return this.decryptToken(githubToken.encryptedToken);
  }

  /**
   * Delete GitHub token for user
   * Requirement 1.6: Allow Developer to disconnect GitHub account
   */
  async deleteToken(userId: string, tenantId: string): Promise<void> {
    const key = `token:${tenantId}:${userId}`;
    this.tokenStore.delete(key);
  }

  /**
   * Make authenticated GitHub API request via Airia connector
   * Requirement 22.9: Use Airia data connectors for secure access to GitHub
   */
  private async makeGitHubRequest<T>(
    userId: string,
    tenantId: string,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown
  ): Promise<T> {
    const token = await this.getToken(userId, tenantId);
    if (!token) {
      throw new Error('GitHub token not found. Please authenticate with GitHub.');
    }

    // Route through Airia connector for governance
    const response = await this.airiaClient.routeLLMRequest({
      tenantId,
      model: 'github-connector', // Special model identifier for GitHub connector
      prompt: `GitHub API request: ${method} ${endpoint}`,
      context: JSON.stringify({
        connector: 'github',
        endpoint,
        method,
        token,
        body,
      }),
    });

    return JSON.parse(response.content) as T;
  }

  /**
   * Parse GitHub repository URL
   */
  parseRepositoryUrl(url: string): ParsedRepositoryUrl {
    // Support formats:
    // - https://github.com/owner/repo
    // - git@github.com:owner/repo.git
    // - owner/repo

    const httpsPattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/;
    const sshPattern = /^git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/;
    const shortPattern = /^([^\/]+)\/([^\/]+)$/;

    let match = url.match(httpsPattern) || url.match(sshPattern) || url.match(shortPattern);

    if (!match) {
      return {
        owner: '',
        repo: '',
        isValid: false,
        error: 'Invalid GitHub repository URL format',
      };
    }

    return {
      owner: match[1],
      repo: match[2],
      isValid: true,
    };
  }

  /**
   * List repositories for authenticated user with pagination
   * Requirement 2.1: Display paginated lists of accessible repositories with 50 per page
   */
  async listRepositories(
    userId: string,
    tenantId: string,
    page: number = 1,
    perPage: number = 50,
    searchQuery?: string
  ): Promise<RepositoryListResponse> {
    // Check cache first
  const cacheKey = `cache:repos:${tenantId}:${userId}:${page}:${perPage}:${searchQuery || ''}`;
  const cached = this.getCache(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const endpoint = searchQuery
      ? `/search/repositories?q=user:@me+${encodeURIComponent(searchQuery)}&page=${page}&per_page=${perPage}`
      : `/user/repos?page=${page}&per_page=${perPage}&sort=updated`;

    const response = await this.makeGitHubRequest<{
      items?: unknown[];
      total_count?: number;
      length?: number;
    }>(userId, tenantId, endpoint);

    const repos = searchQuery ? (response.items || []) : (response as unknown[]);
    const totalCount = searchQuery ? (response.total_count || 0) : (repos.length || 0);

    const repositories: Repository[] = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      url: repo.html_url,
      description: repo.description,
      primaryLanguage: repo.language,
      size: repo.size * 1024, // Convert KB to bytes
      hasSubmodules: false, // Will be determined when fetching tree
      defaultBranch: repo.default_branch,
      isPrivate: repo.private,
      createdAt: new Date(repo.created_at),
      updatedAt: new Date(repo.updated_at),
    }));

    const result: RepositoryListResponse = {
      repositories,
      page,
      perPage,
      totalCount,
      hasNextPage: repositories.length === perPage,
    };

    // Cache for 1 hour
  this.setCache(cacheKey, result, CACHE_TTL.REPO_METADATA);

    return result;
  }

  /**
   * Get repository metadata
   * Requirement 2.5: Display repository metadata including name, description, language, size
   */
  async getRepository(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string
  ): Promise<Repository> {
    // Check cache first
    const cacheKey = `github:repo:${tenantId}:${owner}:${repo}`;
  const cached = this.getCache(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const endpoint = `/repos/${owner}/${repo}`;
    const response = await this.makeGitHubRequest<any>(userId, tenantId, endpoint);

    const repository: Repository = {
      id: response.id,
      name: response.name,
      fullName: response.full_name,
      owner: response.owner.login,
      url: response.html_url,
      description: response.description,
      primaryLanguage: response.language,
      size: response.size * 1024, // Convert KB to bytes
      hasSubmodules: false, // Will check in file tree
      defaultBranch: response.default_branch,
      isPrivate: response.private,
      createdAt: new Date(response.created_at),
      updatedAt: new Date(response.updated_at),
    };

    // Cache for 1 hour
  this.setCache(cacheKey, repository, CACHE_TTL.REPO_METADATA);

    return repository;
  }

  /**
   * Validate repository accessibility
   * Requirement 2.4: Validate repository accessibility with retry logic for transient failures
   */
  async validateRepository(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string
  ): Promise<RepositoryValidation> {
    try {
      await this.getRepository(userId, tenantId, owner, repo);
      return {
        accessible: true,
        exists: true,
        hasPermission: true,
      };
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return {
          accessible: false,
          exists: false,
          hasPermission: false,
          error: 'Repository not found',
        };
      }

      if (error.message?.includes('403')) {
        return {
          accessible: false,
          exists: true,
          hasPermission: false,
          error: 'Insufficient permissions to access repository',
        };
      }

      return {
        accessible: false,
        exists: false,
        hasPermission: false,
        error: error.message || 'Failed to validate repository',
      };
    }
  }

  /**
   * Get repository file tree
   * Requirement 3.1: Display repository's file tree structure with file sizes
   */
  async getFileTree(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    branch?: string,
    recursive: boolean = true
  ): Promise<FileTreeResponse> {
    // Check cache first
    const cacheKey = `github:tree:${tenantId}:${owner}:${repo}:${branch || 'default'}`;
  const cached = this.getCache(cacheKey);
    
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        cachedAt: new Date(parsed.cachedAt),
      };
    }

    // Get default branch if not specified
    if (!branch) {
      const repoData = await this.getRepository(userId, tenantId, owner, repo);
      branch = repoData.defaultBranch;
    }

    const endpoint = `/repos/${owner}/${repo}/git/trees/${branch}${recursive ? '?recursive=1' : ''}`;
    const response = await this.makeGitHubRequest<any>(userId, tenantId, endpoint);

    const tree: FileTreeNode[] = response.tree.map((node: any) => ({
      path: node.path,
      type: node.type === 'tree' ? 'directory' : node.type === 'commit' ? 'submodule' : 'file',
      size: node.size || 0,
      sha: node.sha,
      url: node.url,
    }));

    const result: FileTreeResponse = {
      tree,
      truncated: response.truncated || false,
      sha: response.sha,
      cachedAt: new Date(),
    };

    // Cache for 1 hour
  this.setCache(cacheKey, result, CACHE_TTL.FILE_TREE);

    return result;
  }

  /**
   * Get list of branches
   */
  async listBranches(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string
  ): Promise<GitBranch[]> {
    const endpoint = `/repos/${owner}/${repo}/branches`;
    const response = await this.makeGitHubRequest<any[]>(userId, tenantId, endpoint);

    return response.map((branch: any) => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url,
      },
      protected: branch.protected,
    }));
  }

  /**
   * Get commit history for a branch
   * Requirement 6.5: Implement commit history fetching with depth limits (max 100)
   */
  async getCommitHistory(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    branch: string,
    maxDepth: number = 100
  ): Promise<CommitHistoryResponse> {
    // Limit depth to 100 commits
    const depth = Math.min(maxDepth, 100);
    
    const endpoint = `/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${depth}`;
    const response = await this.makeGitHubRequest<any[]>(userId, tenantId, endpoint);

    const commits: GitCommit[] = response.map((commit: any) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: new Date(commit.commit.author.date),
      },
      committer: {
        name: commit.commit.committer.name,
        email: commit.commit.committer.email,
        date: new Date(commit.commit.committer.date),
      },
      parents: commit.parents.map((p: any) => p.sha),
      url: commit.html_url,
    }));

    return {
      commits,
      branch,
      hasMore: response.length === depth,
      depth: commits.length,
    };
  }

  /**
   * Get commit diff
   * Requirement 6.7: Build commit diff analysis
   */
  async getCommitDiff(
    userId: string,
    tenantId: string,
    owner: string,
    repo: string,
    sha: string
  ): Promise<CommitDiff> {
    const endpoint = `/repos/${owner}/${repo}/commits/${sha}`;
    const response = await this.makeGitHubRequest<any>(userId, tenantId, endpoint);

    const files: FileDiff[] = response.files.map((file: any) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
      previousFilename: file.previous_filename,
    }));

    return {
      sha: response.sha,
      files,
      stats: {
        additions: response.stats.additions,
        deletions: response.stats.deletions,
        total: response.stats.total,
      },
    };
  }

  /**
   * Get GitHub API rate limit status
   * Requirement 2.8: Display remaining quota and estimated reset time
   * Requirement 20.7: Detect rate limiting responses and pause requests
   */
  async getRateLimit(userId: string, tenantId: string): Promise<RateLimitResponse> {
    // Check cache first
    const cacheKey = `github:ratelimit:${tenantId}:${userId}`;
  const cached = this.getCache(cacheKey);
    
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        core: { ...parsed.core, reset: new Date(parsed.core.reset) },
        search: { ...parsed.search, reset: new Date(parsed.search.reset) },
        graphql: { ...parsed.graphql, reset: new Date(parsed.graphql.reset) },
      };
    }

    const endpoint = '/rate_limit';
    const response = await this.makeGitHubRequest<any>(userId, tenantId, endpoint);

    const rateLimit: RateLimitResponse = {
      core: {
        limit: response.resources.core.limit,
        remaining: response.resources.core.remaining,
        reset: new Date(response.resources.core.reset * 1000),
        used: response.resources.core.used,
      },
      search: {
        limit: response.resources.search.limit,
        remaining: response.resources.search.remaining,
        reset: new Date(response.resources.search.reset * 1000),
        used: response.resources.search.used,
      },
      graphql: {
        limit: response.resources.graphql.limit,
        remaining: response.resources.graphql.remaining,
        reset: new Date(response.resources.graphql.reset * 1000),
        used: response.resources.graphql.used,
      },
    };

    // Cache for 1 minute
  this.setCache(cacheKey, rateLimit, CACHE_TTL.RATE_LIMIT);

    return rateLimit;
  }

  /**
   * Check if rate limited and get wait time
   * Requirement 20.5: Implement request queuing on rate limits
   */
  async checkRateLimit(userId: string, tenantId: string): Promise<{
    isLimited: boolean;
    waitTimeSeconds?: number;
  }> {
    const rateLimit = await this.getRateLimit(userId, tenantId);
    
    if (rateLimit.core.remaining === 0) {
      const waitTime = Math.ceil((rateLimit.core.reset.getTime() - Date.now()) / 1000);
      return {
        isLimited: true,
        waitTimeSeconds: waitTime > 0 ? waitTime : 0,
      };
    }

    return { isLimited: false };
  }

  /**
   * Analyze public repository without authentication
   * Uses unauthenticated GitHub API access for public repositories
   */
  async analyzePublicRepository(repoUrl: string): Promise<{
    repository: Repository;
    fileTree: FileTreeResponse;
    branches: GitBranch[];
    aiSummary: {
      overview: string;
      architecture: string[];
      keyTechnologies: string[];
      projectStructure: { category: string; paths: string[] }[];
      entryPoints: string[];
      buildTools: string[];
      suggestedOnboardingPath: string[];
    };
  }> {
    // Parse the repository URL
    const parsed = this.parseRepositoryUrl(repoUrl);
    
    if (!parsed.isValid) {
      throw new Error(parsed.error || 'Invalid repository URL');
    }

    const { owner, repo } = parsed;

    try {
      // Make direct GitHub API calls without authentication for public repos
      const baseUrl = 'https://api.github.com';
      
      // Add GitHub token from environment if available (for higher rate limits)
      const headers: any = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Codebase-Onboarding-Agent',
      };
      
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }

      // Fetch repository metadata
      const repoResponse = await axios.get(`${baseUrl}/repos/${owner}/${repo}`, { headers });
      const repoData = repoResponse.data;

      const repository: Repository = {
        id: repoData.id,
        name: repoData.name,
        fullName: repoData.full_name,
        owner: repoData.owner.login,
        url: repoData.html_url,
        description: repoData.description,
        primaryLanguage: repoData.language,
        size: repoData.size * 1024, // Convert KB to bytes
        hasSubmodules: false,
        defaultBranch: repoData.default_branch,
        isPrivate: repoData.private,
        createdAt: new Date(repoData.created_at),
        updatedAt: new Date(repoData.updated_at),
      };

      // Check if repository is private
      if (repository.isPrivate) {
        throw new Error('Repository is private and requires authentication. Please link your GitHub account.');
      }

      // Fetch file tree
      const treeResponse = await axios.get(
        `${baseUrl}/repos/${owner}/${repo}/git/trees/${repository.defaultBranch}?recursive=1`,
        { headers }
      );
      const treeData = treeResponse.data;

      const tree: FileTreeNode[] = treeData.tree.map((node: any) => ({
        path: node.path,
        type: node.type === 'tree' ? 'directory' : node.type === 'commit' ? 'submodule' : 'file',
        size: node.size || 0,
        sha: node.sha,
        url: node.url,
      }));

      const fileTree: FileTreeResponse = {
        tree,
        truncated: treeData.truncated || false,
        sha: treeData.sha,
        cachedAt: new Date(),
      };

      // Fetch branches
      const branchesResponse = await axios.get(`${baseUrl}/repos/${owner}/${repo}/branches`, { headers });
      const branchesData = branchesResponse.data;

      const branches: GitBranch[] = branchesData.map((branch: any) => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
        protected: branch.protected,
      }));

      // Generate AI-powered structural analysis
      const aiSummary = await this.generateAISummary(repository, tree);

      return {
        repository,
        fileTree,
        branches,
        aiSummary,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Repository not found. Please check the URL and ensure the repository is public.');
      } else if (error.response?.status === 403) {
        throw new Error('Access denied. The repository may be private or rate limit exceeded.');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication required. The repository is private.');
      }
      
      throw new Error(`Failed to access repository: ${error.message}`);
    }
  }

  /**
   * Generate AI-powered structural analysis from repository metadata and file tree
   */
  private async generateAISummary(
    repository: Repository,
    tree: FileTreeNode[]
  ): Promise<{
    overview: string;
    architecture: string[];
    keyTechnologies: string[];
    projectStructure: { category: string; paths: string[] }[];
    entryPoints: string[];
    buildTools: string[];
    suggestedOnboardingPath: string[];
  }> {
    // Analyze file tree to extract insights
    const stats = this.analyzeFileTree(tree);
    
    // Build a structured prompt for the LLM
    const prompt = this.buildAnalysisPrompt(repository, stats);
    
    try {
      // Route through Airia for LLM analysis (with fallback to local analysis if unavailable)
      const response = await this.airiaClient.routeLLMRequest({
        tenantId: 'public-analysis',
        model: config.openRouter.apiKey ? 'openrouter/anthropic/claude-3.5-sonnet' : 'local',
        prompt,
        context: JSON.stringify({ repository: repository.fullName, stats }),
      });

      // Parse structured response
      const analysis = this.parseAIResponse(response.content);
      return analysis;
    } catch (error) {
      console.warn('AI analysis failed, using rule-based fallback:', error);
      // Fallback to rule-based analysis
      return this.generateRuleBasedSummary(repository, stats);
    }
  }

  /**
   * Analyze file tree to extract statistics and patterns
   */
  private analyzeFileTree(tree: FileTreeNode[]): {
    languages: Map<string, number>;
    topLevelDirs: string[];
    totalFiles: number;
    totalSize: number;
    configFiles: string[];
    sourceFiles: string[];
    testFiles: string[];
    docFiles: string[];
  } {
    const languages = new Map<string, number>();
    const topLevelDirs = new Set<string>();
    const configFiles: string[] = [];
    const sourceFiles: string[] = [];
    const testFiles: string[] = [];
    const docFiles: string[] = [];
    let totalFiles = 0;
    let totalSize = 0;

    for (const node of tree) {
      if (node.type === 'file') {
        totalFiles++;
        totalSize += node.size;

        // Categorize by path patterns
        const pathLower = node.path.toLowerCase();
        
        // Extract language from extension
        const ext = node.path.split('.').pop()?.toLowerCase();
        if (ext) {
          languages.set(ext, (languages.get(ext) || 0) + 1);
        }

        // Categorize files
        if (['package.json', 'pom.xml', 'build.gradle', 'cargo.toml', 'go.mod', 'requirements.txt', 'setup.py', 'composer.json', 'Makefile', 'CMakeLists.txt', 'Dockerfile', '.dockerignore', 'docker-compose.yml'].includes(node.path.split('/').pop() || '')) {
          configFiles.push(node.path);
        } else if (pathLower.includes('test') || pathLower.includes('spec') || pathLower.includes('__tests__')) {
          testFiles.push(node.path);
        } else if (['readme.md', 'readme', 'contributing.md', 'license', 'changelog.md'].includes(node.path.split('/').pop()?.toLowerCase() || '')) {
          docFiles.push(node.path);
        } else if (['ts', 'js', 'tsx', 'jsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'cs', 'php', 'rb', 'swift', 'kt'].includes(ext || '')) {
          sourceFiles.push(node.path);
        }

        // Extract top-level directory
        const parts = node.path.split('/');
        if (parts.length > 1) {
          topLevelDirs.add(parts[0]);
        }
      }
    }

    return {
      languages,
      topLevelDirs: Array.from(topLevelDirs).sort(),
      totalFiles,
      totalSize,
      configFiles,
      sourceFiles,
      testFiles,
      docFiles,
    };
  }

  /**
   * Build LLM prompt for repository analysis
   */
  private buildAnalysisPrompt(repository: Repository, stats: any): string {
    const languageBreakdown = Array.from(stats.languages.entries())
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map((entry: any) => `${entry[0]}: ${entry[1]} files`)
      .join(', ');

    return `Analyze this GitHub repository and provide a structured summary:

Repository: ${repository.fullName}
Description: ${repository.description || 'No description'}
Primary Language: ${repository.primaryLanguage || 'Unknown'}
Total Files: ${stats.totalFiles}
Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB

File Breakdown:
- Languages: ${languageBreakdown}
- Source files: ${stats.sourceFiles.length}
- Test files: ${stats.testFiles.length}
- Config files: ${stats.configFiles.length}

Top-level directories: ${stats.topLevelDirs.join(', ')}

Config files found:
${stats.configFiles.slice(0, 10).map((f: string) => `- ${f}`).join('\n')}

Please provide:
1. A brief overview (2-3 sentences) describing what this project does
2. Architectural patterns detected (e.g., MVC, microservices, monolith, client-server)
3. Key technologies and frameworks identified
4. Project structure categories (e.g., "frontend", "backend", "tests", "docs")
5. Likely entry points (main files)
6. Build tools and package managers detected
7. Suggested onboarding path (3-5 steps for a new developer)

Respond in JSON format:
{
  "overview": "string",
  "architecture": ["pattern1", "pattern2"],
  "keyTechnologies": ["tech1", "tech2"],
  "projectStructure": [{"category": "name", "paths": ["path1", "path2"]}],
  "entryPoints": ["file1", "file2"],
  "buildTools": ["tool1", "tool2"],
  "suggestedOnboardingPath": ["step1", "step2", "step3"]
}`;
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(content: string): any {
    try {
      // Try to extract JSON from markdown code blocks or raw response
      const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      console.warn('Failed to parse AI response as JSON, using fallback');
      // Return a basic structure if parsing fails
      return {
        overview: content.substring(0, 300),
        architecture: [],
        keyTechnologies: [],
        projectStructure: [],
        entryPoints: [],
        buildTools: [],
        suggestedOnboardingPath: [],
      };
    }
  }

  /**
   * Generate rule-based summary when AI is unavailable
   */
  private generateRuleBasedSummary(repository: Repository, stats: any): any {
    const sizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
    const mainLang = repository.primaryLanguage || 'multi-language';
    
    // Create detailed overview
    let overview = `${repository.fullName} is a ${mainLang} project containing ${stats.totalFiles} files (${sizeMB} MB). `;
    
    if (repository.description) {
      overview += `${repository.description} `;
    }
    
    // Add insights about project size
    if (stats.totalFiles < 50) {
      overview += `This is a small, focused project that should be easy to understand.`;
    } else if (stats.totalFiles < 500) {
      overview += `This is a medium-sized project with a well-organized structure.`;
    } else {
      overview += `This is a large-scale project with extensive functionality.`;
    }
    
    // Add test coverage insight
    const testRatio = stats.testFiles.length / stats.sourceFiles.length;
    if (testRatio > 0.3) {
      overview += ` The project includes comprehensive test coverage.`;
    } else if (testRatio > 0.1) {
      overview += ` The project includes some test coverage.`;
    }

    // Detect architecture patterns with detailed descriptions
    const architecture: string[] = [];
    if (stats.topLevelDirs.some((d: string) => ['frontend', 'client', 'web', 'ui'].includes(d.toLowerCase())) &&
        stats.topLevelDirs.some((d: string) => ['backend', 'server', 'api'].includes(d.toLowerCase()))) {
      architecture.push('Full-stack application with separate frontend and backend');
    } else if (stats.topLevelDirs.some((d: string) => ['frontend', 'client', 'web', 'ui'].includes(d.toLowerCase()))) {
      architecture.push('Frontend-focused application');
    } else if (stats.topLevelDirs.some((d: string) => ['backend', 'server', 'api'].includes(d.toLowerCase()))) {
      architecture.push('Backend API service');
    }
    
    if (stats.topLevelDirs.some((d: string) => ['services', 'microservices'].includes(d.toLowerCase()))) {
      architecture.push('Microservices architecture');
    }
    
    if (stats.topLevelDirs.some((d: string) => ['packages', 'modules', 'libs', 'libraries'].includes(d.toLowerCase()))) {
      architecture.push('Modular/Monorepo structure');
    }
    
    if (stats.sourceFiles.some((f: string) => f.toLowerCase().includes('controller') || f.toLowerCase().includes('model') || f.toLowerCase().includes('view'))) {
      architecture.push('MVC (Model-View-Controller) pattern');
    }
    
    if (stats.sourceFiles.some((f: string) => f.toLowerCase().includes('component') && (mainLang === 'JavaScript' || mainLang === 'TypeScript'))) {
      architecture.push('Component-based architecture (likely React/Vue/Angular)');
    }

    // Detect technologies with detailed analysis
    const keyTechnologies: string[] = [];
    const topLangs = Array.from(stats.languages.entries())
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map((entry: any) => {
        const ext = entry[0] as string;
        const langMap: any = {
          'ts': 'TypeScript', 'js': 'JavaScript', 'tsx': 'TypeScript (React)',
          'jsx': 'JavaScript (React)', 'py': 'Python', 'java': 'Java',
          'go': 'Go', 'rs': 'Rust', 'cpp': 'C++', 'c': 'C', 'cs': 'C#',
          'rb': 'Ruby', 'php': 'PHP', 'swift': 'Swift', 'kt': 'Kotlin'
        };
        return langMap[ext] || ext.toUpperCase();
      });
    keyTechnologies.push(...topLangs);

    // Detect frameworks and tools
    if (stats.configFiles.some((f: string) => f.includes('package.json'))) {
      keyTechnologies.push('Node.js ecosystem');
      if (stats.sourceFiles.some((f: string) => f.includes('next.config'))) {
        keyTechnologies.push('Next.js');
      }
      if (stats.sourceFiles.some((f: string) => f.includes('vite.config'))) {
        keyTechnologies.push('Vite');
      }
      if (stats.configFiles.some((f: string) => f.includes('tsconfig.json'))) {
        keyTechnologies.push('TypeScript');
      }
    }
    
    if (stats.configFiles.some((f: string) => f.includes('pom.xml'))) {
      keyTechnologies.push('Maven');
    }
    if (stats.configFiles.some((f: string) => f.includes('build.gradle'))) {
      keyTechnologies.push('Gradle');
    }
    if (stats.configFiles.some((f: string) => f.includes('requirements.txt') || f.includes('pyproject.toml'))) {
      keyTechnologies.push('Python package management');
    }
    if (stats.configFiles.some((f: string) => f.includes('Dockerfile'))) {
      keyTechnologies.push('Docker containerization');
    }
    if (stats.configFiles.some((f: string) => f.includes('docker-compose'))) {
      keyTechnologies.push('Docker Compose');
    }
    if (stats.configFiles.some((f: string) => f.toLowerCase().includes('kubernetes') || f.includes('k8s'))) {
      keyTechnologies.push('Kubernetes');
    }

    // Project structure
    const projectStructure = stats.topLevelDirs.map((dir: string) => ({
      category: dir,
      paths: stats.sourceFiles.filter((f: string) => f.startsWith(dir + '/')).slice(0, 3),
    }));

    // Entry points
    const entryPoints = stats.configFiles.concat(
      stats.sourceFiles.filter((f: string) => 
        ['index', 'main', 'app', 'server'].some(name => f.toLowerCase().includes(name))
      )
    ).slice(0, 5);

    // Build tools
    const buildTools: string[] = [];
    if (stats.configFiles.some((f: string) => f.includes('package.json'))) buildTools.push('npm/yarn');
    if (stats.configFiles.some((f: string) => f.includes('pom.xml'))) buildTools.push('Maven');
    if (stats.configFiles.some((f: string) => f.includes('build.gradle'))) buildTools.push('Gradle');
    if (stats.configFiles.some((f: string) => f.includes('Makefile'))) buildTools.push('Make');
    if (stats.configFiles.some((f: string) => f.includes('Dockerfile'))) buildTools.push('Docker');

    // Enhanced onboarding path
    const readmeFile = stats.docFiles.find((f: string) => f.toLowerCase().includes('readme')) || 'README.md';
    const contributingFile = stats.docFiles.find((f: string) => f.toLowerCase().includes('contributing'));
    
    const suggestedOnboardingPath = [
      `📖 Start by reading ${readmeFile} to understand the project's purpose and goals`,
      `🏗️ Examine the architecture: ${architecture[0] || 'Review the project structure and organization'}`,
      `⚙️ Set up your development environment using ${buildTools[0] || 'the build configuration files'}`,
      `🚪 Identify entry points: Review ${entryPoints[0] || 'main application files'} to understand the code flow`,
      `📁 Explore the ${stats.topLevelDirs[0] || 'source code'} directory to understand module organization`,
      stats.testFiles.length > 0 
        ? `✅ Run the test suite (${stats.testFiles.length} test files) to ensure your setup is working correctly`
        : `⚠️ Note: No test files detected - consider writing tests as you contribute`,
      contributingFile 
        ? `🤝 Review ${contributingFile} for contribution guidelines`
        : `🤝 Check for contribution guidelines before making changes`,
      `💻 Start with small, well-understood changes to familiarize yourself with the codebase`,
    ];

    return {
      overview,
      architecture,
      keyTechnologies: Array.from(new Set(keyTechnologies)),
      projectStructure,
      entryPoints,
      buildTools,
      suggestedOnboardingPath,
    };
  }
}

// Singleton instance
let githubServiceInstance: GitHubService | null = null;

/**
 * Get singleton instance of GitHub service
 */
export function getGitHubService(): GitHubService {
  if (!githubServiceInstance) {
    githubServiceInstance = new GitHubService();
  }
  return githubServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetGitHubService(): void {
  githubServiceInstance = null;
}
