// @ts-nocheck
import { db } from '../db';
import { logger } from './logger.service';
import { githubService } from './github.service';
import { astParserService } from './ast-parser.service';
import { agentuityService } from './agentuity.service';
import { v4 as uuidv4 } from 'uuid';

interface AnalysisRequest {
  userId: string;
  repositoryId: string;
  selectedPaths: string[];
  modelProvider: string;
  includeAnimation: boolean;
  options: any;
}

class AnalysisService {
  async startAnalysis(request: AnalysisRequest) {
    try {
      const analysisId = uuidv4();

      // Create analysis record
      await db.query(
        `INSERT INTO analyses (
          id, user_id, repository_id, status, model_provider, 
          include_animation, selected_paths, options, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          analysisId,
          request.userId,
          request.repositoryId,
          'queued',
          request.modelProvider,
          request.includeAnimation,
          JSON.stringify(request.selectedPaths),
          JSON.stringify(request.options),
        ]
      );

      // Queue analysis job
      this.processAnalysis(analysisId, request).catch(error => {
        logger.error('Analysis processing failed', { service: 'analysis' }, error);
      });

      return {
        analysisId,
        status: 'queued',
      };
    } catch (error: any) {
      logger.error('Failed to start analysis', { service: 'analysis' }, error);
      throw error;
    }
  }

  private async processAnalysis(analysisId: string, request: AnalysisRequest) {
    try {
      // Update status to processing
      await db.query(
        'UPDATE analyses SET status = $1, started_at = NOW() WHERE id = $2',
        ['processing', analysisId]
      );

      // Get repository details
      const repoResult = await db.query(
        'SELECT owner, name, github_url FROM repositories WHERE id = $1',
        [request.repositoryId]
      );

      if (repoResult.rows.length === 0) {
        throw new Error('Repository not found');
      }

      const { owner, name } = repoResult.rows[0];

      // Fetch repository content
      const files = await this.fetchRepositoryFiles(
        request.userId,
        owner,
        name,
        request.selectedPaths
      );

      // Parse AST for code files
      const astResults = await astParserService.parseFiles(files);

      // Get commit history for context
      const commits = await githubService.getCommitHistory(request.userId, owner, name, 50);

      // Analyze with Agentuity
      const analysis = await agentuityService.analyzeCodebase({
        repository: { owner, name },
        files,
        astResults,
        commits: commits.slice(0, 20), // Last 20 commits
        modelProvider: request.modelProvider,
      });

      // Store results
      await db.query(
        `UPDATE analyses 
         SET status = $1, 
             results = $2, 
             completed_at = NOW() 
         WHERE id = $3`,
        ['completed', JSON.stringify(analysis), analysisId]
      );

      logger.info('Analysis completed', {
        service: 'analysis',
        metadata: { analysisId },
      });

      return analysis;
    } catch (error: any) {
      logger.error('Analysis processing failed', { service: 'analysis' }, error);

      await db.query(
        `UPDATE analyses 
         SET status = $1, 
             error = $2, 
             completed_at = NOW() 
         WHERE id = $3`,
        ['failed', error.message, analysisId]
      );

      throw error;
    }
  }

  private async fetchRepositoryFiles(
    userId: string,
    owner: string,
    repo: string,
    selectedPaths: string[]
  ) {
    const files: any[] = [];

    if (selectedPaths.length === 0) {
      // Fetch all files recursively
      await this.fetchAllFiles(userId, owner, repo, '', files);
    } else {
      // Fetch only selected paths
      for (const path of selectedPaths) {
        await this.fetchPath(userId, owner, repo, path, files);
      }
    }

    return files;
  }

  private async fetchAllFiles(
    userId: string,
    owner: string,
    repo: string,
    path: string,
    files: any[],
    depth: number = 0
  ) {
    if (depth > 10) return; // Prevent infinite recursion

    const tree = await githubService.getRepositoryTree(userId, owner, repo, path);

    for (const item of tree) {
      if (item.type === 'file') {
        // Skip large files and binary files
        if (item.size > 1000000) continue; // Skip files > 1MB
        
        const content = await githubService.getFileContent(userId, owner, repo, item.path);
        files.push({
          path: item.path,
          content,
          size: item.size,
        });
      } else if (item.type === 'dir') {
        // Skip common directories
        if (['node_modules', '.git', 'dist', 'build', '.next'].includes(item.name)) {
          continue;
        }
        await this.fetchAllFiles(userId, owner, repo, item.path, files, depth + 1);
      }
    }
  }

  private async fetchPath(userId: string, owner: string, repo: string, path: string, files: any[]) {
    const tree = await githubService.getRepositoryTree(userId, owner, repo, path);

    if (Array.isArray(tree)) {
      for (const item of tree) {
        if (item.type === 'file') {
          const content = await githubService.getFileContent(userId, owner, repo, item.path);
          files.push({
            path: item.path,
            content,
            size: item.size,
          });
        }
      }
    } else {
      // Single file
      const content = await githubService.getFileContent(userId, owner, repo, path);
      files.push({
        path,
        content,
        size: tree.size,
      });
    }
  }

  async getAnalysisStatus(userId: string, analysisId: string) {
    const result = await db.query(
      'SELECT status, started_at, completed_at FROM analyses WHERE id = $1 AND user_id = $2',
      [analysisId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Analysis not found');
    }

    return result.rows[0];
  }

  async getAnalysisResults(userId: string, analysisId: string) {
    const result = await db.query(
      'SELECT * FROM analyses WHERE id = $1 AND user_id = $2',
      [analysisId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Analysis not found');
    }

    return result.rows[0];
  }

  async cancelAnalysis(userId: string, analysisId: string) {
    await db.query(
      `UPDATE analyses 
       SET status = $1, 
           completed_at = NOW() 
       WHERE id = $2 AND user_id = $3 AND status IN ('queued', 'processing')`,
      ['cancelled', analysisId, userId]
    );
  }

  async listUserAnalyses(userId: string, limit: number, offset: number) {
    const result = await db.query(
      `SELECT a.*, r.name as repository_name, r.owner as repository_owner
       FROM analyses a
       LEFT JOIN repositories r ON a.repository_id = r.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      analyses: result.rows,
      total: result.rows.length,
    };
  }
}

export const analysisService = new AnalysisService();
