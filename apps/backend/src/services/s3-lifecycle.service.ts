/**
 * S3 Lifecycle Management Service
 * 
 * Manages S3 bucket lifecycle policies for automatic retention enforcement
 * Task: 11.3 Build S3 artifact storage
 * Requirements: 18.5, 39.4
 */

import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
  DeleteBucketLifecycleCommand,
  PutBucketEncryptionCommand,
  GetBucketEncryptionCommand,
  LifecycleRule,
  ServerSideEncryptionConfiguration,
} from '@aws-sdk/client-s3';
import { config } from '../config';

export interface LifecyclePolicyConfig {
  id: string;
  prefix: string;
  expirationDays: number;
  enabled: boolean;
  transitions?: Array<{
    days: number;
    storageClass: string;
  }>;
}

export class S3LifecycleService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.s3Client = new S3Client({
      endpoint: config.s3.endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
      forcePathStyle: true,
    });

    this.bucket = config.s3.bucket;
  }

  /**
   * Configure bucket lifecycle policies for retention enforcement
   * Requirement 39.4: Automatic deletion based on retention policies
   */
  async configureBucketLifecycle(): Promise<void> {
    const lifecycleRules: LifecycleRule[] = [
      // Raw repository data and intermediate artifacts: 24-hour deletion
      {
        ID: 'delete-raw-data-24h',
        Status: 'Enabled',
        Prefix: 'raw/',
        Expiration: {
          Days: 1, // 24 hours
        },
      },
      {
        ID: 'delete-intermediate-artifacts-24h',
        Status: 'Enabled',
        Prefix: 'intermediate/',
        Expiration: {
          Days: 1, // 24 hours
        },
      },
      // Audio recordings: Default 24 hours (can be overridden per tenant)
      {
        ID: 'delete-audio-recordings-24h',
        Status: 'Enabled',
        Prefix: 'audio/',
        Expiration: {
          Days: 1, // 24 hours default
        },
      },
      // Sanitized artifacts: 90 days default (configurable per tenant)
      {
        ID: 'delete-sanitized-artifacts-90d',
        Status: 'Enabled',
        Prefix: 'artifacts/',
        Expiration: {
          Days: 90,
        },
      },
      // Interactive scripts: 1 year default (configurable per tenant)
      {
        ID: 'delete-scripts-1y',
        Status: 'Enabled',
        Prefix: 'scripts/',
        Expiration: {
          Days: 365,
        },
      },
      // Templates: No automatic deletion (managed manually)
      // Transcripts: 1 year default (configurable per tenant)
      {
        ID: 'delete-transcripts-1y',
        Status: 'Enabled',
        Prefix: 'transcripts/',
        Expiration: {
          Days: 365,
        },
      },
      // Temporary files: 1 hour deletion
      {
        ID: 'delete-temp-files-1h',
        Status: 'Enabled',
        Prefix: 'temp/',
        Expiration: {
          Days: 1, // Minimum is 1 day for S3 lifecycle
        },
      },
    ];

    try {
      await this.s3Client.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: this.bucket,
          LifecycleConfiguration: {
            Rules: lifecycleRules,
          },
        })
      );
      console.log('S3 bucket lifecycle policies configured successfully');
    } catch (error) {
      console.error('Error configuring S3 bucket lifecycle:', error);
      throw error;
    }
  }

  /**
   * Configure encryption at rest for S3 bucket
   * Requirement 18.5: AES-256 encryption at rest
   */
  async configureBucketEncryption(): Promise<void> {
    const encryptionConfig: ServerSideEncryptionConfiguration = {
      Rules: [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256', // AES-256 encryption
          },
          BucketKeyEnabled: true, // Reduce encryption costs
        },
      ],
    };

    try {
      await this.s3Client.send(
        new PutBucketEncryptionCommand({
          Bucket: this.bucket,
          ServerSideEncryptionConfiguration: encryptionConfig,
        })
      );
      console.log('S3 bucket encryption configured successfully (AES-256)');
    } catch (error) {
      console.error('Error configuring S3 bucket encryption:', error);
      throw error;
    }
  }

  /**
   * Add custom lifecycle policy
   */
  async addLifecyclePolicy(policy: LifecyclePolicyConfig): Promise<void> {
    try {
      // Get existing policies
      const existing = await this.getLifecyclePolicies();

      // Create new rule
      const newRule: LifecycleRule = {
        ID: policy.id,
        Status: policy.enabled ? 'Enabled' : 'Disabled',
        Prefix: policy.prefix,
        Expiration: {
          Days: policy.expirationDays,
        },
      };

      // Add transitions if specified (commented out - not commonly used)
      // if (policy.transitions && policy.transitions.length > 0) {
      //   newRule.Transitions = policy.transitions.map((t) => ({
      //     Days: t.days,
      //     StorageClass: t.storageClass as TransitionStorageClass,
      //   }));
      // }

      // Combine with existing rules
      const allRules = [...existing, newRule];

      // Update lifecycle configuration
      await this.s3Client.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: this.bucket,
          LifecycleConfiguration: {
            Rules: allRules,
          },
        })
      );

      console.log(`Lifecycle policy '${policy.id}' added successfully`);
    } catch (error) {
      console.error('Error adding lifecycle policy:', error);
      throw error;
    }
  }

  /**
   * Remove lifecycle policy by ID
   */
  async removeLifecyclePolicy(policyId: string): Promise<void> {
    try {
      // Get existing policies
      const existing = await this.getLifecyclePolicies();

      // Filter out the policy to remove
      const updatedRules = existing.filter((rule) => rule.ID !== policyId);

      if (updatedRules.length === existing.length) {
        console.warn(`Lifecycle policy '${policyId}' not found`);
        return;
      }

      // Update lifecycle configuration
      if (updatedRules.length > 0) {
        await this.s3Client.send(
          new PutBucketLifecycleConfigurationCommand({
            Bucket: this.bucket,
            LifecycleConfiguration: {
              Rules: updatedRules,
            },
          })
        );
      } else {
        // Delete all lifecycle policies if none remain
        await this.s3Client.send(
          new DeleteBucketLifecycleCommand({
            Bucket: this.bucket,
          })
        );
      }

      console.log(`Lifecycle policy '${policyId}' removed successfully`);
    } catch (error) {
      console.error('Error removing lifecycle policy:', error);
      throw error;
    }
  }

  /**
   * Get all lifecycle policies
   */
  async getLifecyclePolicies(): Promise<LifecycleRule[]> {
    try {
      const response = await this.s3Client.send(
        new GetBucketLifecycleConfigurationCommand({
          Bucket: this.bucket,
        })
      );

      return response.Rules || [];
    } catch (error: any) {
      if (error.name === 'NoSuchLifecycleConfiguration') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get bucket encryption configuration
   */
  async getBucketEncryption(): Promise<ServerSideEncryptionConfiguration | null> {
    try {
      const response = await this.s3Client.send(
        new GetBucketEncryptionCommand({
          Bucket: this.bucket,
        })
      );

      return response.ServerSideEncryptionConfiguration || null;
    } catch (error: any) {
      if (error.name === 'ServerSideEncryptionConfigurationNotFoundError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update lifecycle policy for tenant-specific retention
   */
  async updateTenantRetentionPolicy(
    tenantId: string,
    resourceType: 'audio' | 'transcript' | 'artifact',
    retentionDays: number
  ): Promise<void> {
    const policyId = `tenant-${tenantId}-${resourceType}-retention`;
    const prefix = this.getTenantPrefix(tenantId, resourceType);

    const policy: LifecyclePolicyConfig = {
      id: policyId,
      prefix,
      expirationDays: retentionDays,
      enabled: true,
    };

    // Remove existing policy if it exists
    try {
      await this.removeLifecyclePolicy(policyId);
    } catch (error) {
      // Ignore if policy doesn't exist
    }

    // Add new policy
    await this.addLifecyclePolicy(policy);

    console.log(
      `Updated retention policy for tenant ${tenantId} ${resourceType}: ${retentionDays} days`
    );
  }

  /**
   * Get tenant-specific prefix for lifecycle policies
   */
  private getTenantPrefix(tenantId: string, resourceType: string): string {
    switch (resourceType) {
      case 'audio':
        return `audio/${tenantId}/`;
      case 'transcript':
        return `transcripts/${tenantId}/`;
      case 'artifact':
        return `artifacts/${tenantId}/`;
      default:
        return `${resourceType}/${tenantId}/`;
    }
  }

  /**
   * Initialize bucket with default configuration
   */
  async initializeBucket(): Promise<void> {
    console.log('Initializing S3 bucket configuration...');

    try {
      // Configure encryption
      await this.configureBucketEncryption();

      // Configure lifecycle policies
      await this.configureBucketLifecycle();

      console.log('S3 bucket initialized successfully');
    } catch (error) {
      console.error('Error initializing S3 bucket:', error);
      throw error;
    }
  }

  /**
   * Verify bucket configuration
   */
  async verifyConfiguration(): Promise<{
    encryptionEnabled: boolean;
    lifecyclePoliciesCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check encryption
    let encryptionEnabled = false;
    try {
      const encryption = await this.getBucketEncryption();
      encryptionEnabled = encryption !== null;
      if (!encryptionEnabled) {
        issues.push('Bucket encryption is not configured');
      }
    } catch (error) {
      issues.push('Failed to check bucket encryption');
    }

    // Check lifecycle policies
    let lifecyclePoliciesCount = 0;
    try {
      const policies = await this.getLifecyclePolicies();
      lifecyclePoliciesCount = policies.length;
      if (lifecyclePoliciesCount === 0) {
        issues.push('No lifecycle policies configured');
      }
    } catch (error) {
      issues.push('Failed to check lifecycle policies');
    }

    return {
      encryptionEnabled,
      lifecyclePoliciesCount,
      issues,
    };
  }
}

// Singleton instance
let s3LifecycleServiceInstance: S3LifecycleService | null = null;

/**
 * Get singleton S3LifecycleService instance
 */
export function getS3LifecycleService(): S3LifecycleService {
  if (!s3LifecycleServiceInstance) {
    s3LifecycleServiceInstance = new S3LifecycleService();
  }
  return s3LifecycleServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetS3LifecycleService(): void {
  s3LifecycleServiceInstance = null;
}

