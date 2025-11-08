/**
 * Code Execution Sandbox Service
 * Executes code in isolated Docker containers with resource limits
 * Requirements: 9.1, 9.2, 9.5, 9.6, 9.7, 9.8
 */

import {
  SandboxConfig,
  ExecutionResult,
  SupportedLanguage,
} from '@codebase-onboarding/shared';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Code Execution Sandbox Service
 * Provides isolated code execution with strict resource limits
 */
export class CodeSandboxService {
  private readonly DEFAULT_CONFIG: SandboxConfig = {
    memoryLimit: 512 * 1024 * 1024, // 512MB
    cpuLimit: 1, // 1 core
    timeLimit: 5, // 5 seconds
    networkAccess: false,
  };

  private readonly TEMP_DIR = '/tmp/code-sandbox';
  private readonly DOCKER_IMAGE_MAP: Record<SupportedLanguage, string> = {
    javascript: 'node:18-alpine',
    typescript: 'node:18-alpine',
    python: 'python:3.11-alpine',
    java: 'openjdk:17-alpine',
    go: 'golang:1.21-alpine',
    rust: 'rust:1.75-alpine',
    cpp: 'gcc:13-alpine',
    unknown: 'alpine:latest',
  };

  /**
   * Execute code in a sandbox
   */
  async executeCode(
    code: string,
    language: SupportedLanguage,
    config: Partial<SandboxConfig> = {}
  ): Promise<ExecutionResult> {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    const executionId = uuidv4();
    const workDir = path.join(this.TEMP_DIR, executionId);

    try {
      // Create isolated working directory
      await this.createWorkingDirectory(workDir);

      // Write code to file
      const codeFile = await this.writeCodeFile(workDir, code, language);

      // Execute in Docker container
      const result = await this.executeInDocker(
        codeFile,
        language,
        fullConfig,
        workDir,
        executionId
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        duration: 0,
      };
    } finally {
      // Cleanup
      await this.cleanup(workDir);
    }
  }

  /**
   * Create isolated working directory
   */
  private async createWorkingDirectory(workDir: string): Promise<void> {
    try {
      await fs.mkdir(workDir, { recursive: true });
      // Set restrictive permissions
      await fs.chmod(workDir, 0o700);
    } catch (error) {
      throw new Error(`Failed to create working directory: ${error}`);
    }
  }

  /**
   * Write code to file with appropriate extension
   */
  private async writeCodeFile(
    workDir: string,
    code: string,
    language: SupportedLanguage
  ): Promise<string> {
    const extensions: Record<SupportedLanguage, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      go: 'go',
      rust: 'rs',
      cpp: 'cpp',
      unknown: 'txt',
    };

    const ext = extensions[language];
    const filename = `code.${ext}`;
    const filepath = path.join(workDir, filename);

    await fs.writeFile(filepath, code, 'utf-8');
    return filepath;
  }

  /**
   * Execute code in Docker container with resource limits
   */
  private async executeInDocker(
    codeFile: string,
    language: SupportedLanguage,
    config: SandboxConfig,
    workDir: string,
    containerId: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const image = this.DOCKER_IMAGE_MAP[language];
    const filename = path.basename(codeFile);

    // Build Docker run command with resource limits
    const dockerArgs = [
      'run',
      '--rm',
      '--name', `sandbox-${containerId}`,
      // Resource limits
      '--memory', `${config.memoryLimit}`,
      '--cpus', `${config.cpuLimit}`,
      // Network isolation
      ...(config.networkAccess ? [] : ['--network', 'none']),
      // Filesystem restrictions
      '--read-only',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=10m',
      // Mount code directory
      '-v', `${workDir}:/workspace:ro`,
      '-w', '/workspace',
      // Security options
      '--security-opt', 'no-new-privileges',
      '--cap-drop', 'ALL',
      // Image
      image,
    ];

    // Add language-specific execution command
    const execCommand = this.getExecutionCommand(language, filename);
    dockerArgs.push(...execCommand);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const process = spawn('docker', dockerArgs);

      // Set timeout
      const timeout = setTimeout(() => {
        killed = true;
        process.kill('SIGKILL');
        // Also kill the container
        spawn('docker', ['kill', `sandbox-${containerId}`]);
      }, config.timeLimit * 1000);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        if (killed) {
          resolve({
            success: false,
            error: `Execution timeout (${config.timeLimit}s limit exceeded)`,
            duration,
          });
        } else if (code === 0) {
          resolve({
            success: true,
            output: stdout,
            exitCode: code ?? 0,
            duration,
          });
        } else {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code ?? 'unknown'}`,
            exitCode: code ?? undefined,
            duration,
          });
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `Failed to start container: ${error.message}`,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Get execution command for each language
   */
  private getExecutionCommand(language: SupportedLanguage, filename: string): string[] {
    switch (language) {
      case 'javascript':
        return ['node', filename];
      
      case 'typescript':
        // For TypeScript, we'd need to compile first or use ts-node
        // Simplified: treat as JavaScript
        return ['node', filename];
      
      case 'python':
        return ['python', filename];
      
      case 'java':
        // Java requires compilation
        const className = filename.replace('.java', '');
        return ['sh', '-c', `javac ${filename} && java ${className}`];
      
      case 'go':
        return ['go', 'run', filename];
      
      case 'rust':
        // Rust requires compilation
        return ['sh', '-c', `rustc ${filename} -o /tmp/program && /tmp/program`];
      
      case 'cpp':
        // C++ requires compilation
        return ['sh', '-c', `g++ ${filename} -o /tmp/program && /tmp/program`];
      
      default:
        return ['cat', filename];
    }
  }

  /**
   * Cleanup working directory and containers
   */
  private async cleanup(workDir: string): Promise<void> {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Cleanup failed for ${workDir}:`, error);
    }
  }

  /**
   * Execute multiple code samples in batch
   */
  async executeBatch(
    samples: Array<{ code: string; language: SupportedLanguage }>,
    config: Partial<SandboxConfig> = {}
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const sample of samples) {
      try {
        const result = await this.executeCode(sample.code, sample.language, config);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
        });
      }
    }

    return results;
  }

  /**
   * Validate sandbox environment
   */
  async validateEnvironment(): Promise<boolean> {
    try {
      // Check if Docker is available
      const result = await new Promise<boolean>((resolve) => {
        const process = spawn('docker', ['--version']);
        process.on('close', (code) => resolve(code === 0));
        process.on('error', () => resolve(false));
      });

      if (!result) {
        console.error('Docker is not available');
        return false;
      }

      // Check if temp directory is writable
      try {
        await fs.mkdir(this.TEMP_DIR, { recursive: true });
        await fs.access(this.TEMP_DIR, fs.constants.W_OK);
      } catch (error) {
        console.error('Temp directory is not writable:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Environment validation failed:', error);
      return false;
    }
  }

  /**
   * Get memory usage from execution (if available)
   */
  private async getMemoryUsage(containerId: string): Promise<number | undefined> {
    try {
      return new Promise((resolve) => {
        let output = '';
        const process = spawn('docker', [
          'stats',
          `sandbox-${containerId}`,
          '--no-stream',
          '--format',
          '{{.MemUsage}}',
        ]);

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.on('close', () => {
          // Parse memory usage (e.g., "123.4MiB / 512MiB")
          const match = output.match(/([0-9.]+)MiB/);
          if (match) {
            resolve(parseFloat(match[1]) * 1024 * 1024);
          } else {
            resolve(undefined);
          }
        });

        process.on('error', () => resolve(undefined));
      });
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Capture execution result with error handling
   */
  captureExecutionResult(
    stdout: string,
    stderr: string,
    exitCode: number,
    duration: number
  ): ExecutionResult {
    if (exitCode === 0) {
      return {
        success: true,
        output: stdout,
        exitCode,
        duration,
      };
    } else {
      return {
        success: false,
        output: stdout,
        error: stderr,
        exitCode,
        duration,
      };
    }
  }

  /**
   * Check if sandbox creation failed
   */
  private isSandboxCreationError(error: Error): boolean {
    return (
      error.message.includes('Docker') ||
      error.message.includes('container') ||
      error.message.includes('working directory')
    );
  }
}

export const codeSandboxService = new CodeSandboxService();
