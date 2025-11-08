/**
 * Retention Policy Enforcer Service
 * Periodically enforces retention policies by deleting expired artifacts
 * Requirement 39.2: Automatic deletion based on retention
 */

import { artifactStorageService } from './artifact-storage.service';

export class RetentionEnforcerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the retention enforcer with specified interval
   * @param intervalMinutes - How often to check for expired artifacts (default: 60 minutes)
   */
  start(intervalMinutes: number = 60): void {
    if (this.isRunning) {
      console.log('Retention enforcer is already running');
      return;
    }

    console.log(`Starting retention enforcer with ${intervalMinutes} minute interval`);
    
    // Run immediately on start
    this.enforceRetentionPolicies();

    // Schedule periodic enforcement
    this.intervalId = setInterval(
      () => this.enforceRetentionPolicies(),
      intervalMinutes * 60 * 1000
    );

    this.isRunning = true;
  }

  /**
   * Stop the retention enforcer
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('Retention enforcer stopped');
    }
  }

  /**
   * Manually trigger retention policy enforcement
   */
  async enforceRetentionPolicies(): Promise<void> {
    try {
      console.log('Enforcing retention policies...');
      const result = await artifactStorageService.enforceRetentionPolicies();

      if (result.success) {
        console.log(`Retention enforcement completed: ${result.deletedCount} artifacts deleted`);
      } else {
        console.error('Retention enforcement completed with errors:', result.errors);
      }
    } catch (error) {
      console.error('Error enforcing retention policies:', error);
    }
  }

  /**
   * Check if enforcer is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export const retentionEnforcerService = new RetentionEnforcerService();
