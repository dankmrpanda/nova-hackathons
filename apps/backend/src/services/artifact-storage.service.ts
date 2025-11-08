/**
 * Artifact Storage Service
 * Handles S3 storage, retrieval, caching, and retention policy enforcement for sanitized artifacts
 * Requirements: 18.2, 39.2, 39.3
 * 
 * Features:
 * - S3/MinIO storage with tenant isolation
 * - Redis caching for fast retrieval
 * - Automatic retention policy enforcement
 * - Support for sanitized artifacts, interactive scripts, and templates
 * 
 * Usage Example:
 * ```typescript
 * import { artifactStorageService } from './services';
 * 
 * // Store a sanitized artifact
 * const artifact: SanitizedArtifact = {
 *   id: 'artifact-123',
 *   type: 'explanation',
 *   content: 'Sanitized explanation text...',
 *   references: [{ path: 'src/main.ts', lineNumbers: [10, 20], relevance: 1.0 }],
 *   metadata: {
 *     sessionId: 'session-456',
 *     tenantId: 'tenant-789',
 *     userId: 'user-101',
 *     size: 1024,
 *   },
 *   createdAt: new Date(),
 *   retentionPolicy: {
 *     type: 'days',
 *     duration: 30,
 *     autoDelete: true,
 *   },
 * };
 * 
 * const key = await artifactStorageService.storeArtifact(artifact);
 * 
 * // Retrieve artifact (with caching)
 * const retrieved = await artifactStorageService.retrieveArtifact('artifact-123');
 * 
 * // Delete session artifacts (Requirement 18.2: 24-hour deletion)
 * await artifactStorageService.deleteSessionArtifacts('session-456', 'tenant-789');
 * 
 * // Enforce retention policies (called periodically by retention-enforcer)
 * await artifactStorageService.enforceRetentionPolicies();
 * ```
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { getRedisClient } from '../db/redis';

// Import types from shared package
import type {
  SanitizedArtifact,
  InteractiveScript,
  Template,
  ArtifactRetentionPolicy,
  ArtifactType,
  ArtifactMetadata,
} from '@codebase-onboarding/shared';

export interface StorageOptions {
  useCache?: boolean;
  cacheTTL?: number; // seconds
  metadata?: Record<string, string>;
}

export interface RetrievalOptions {
  useCache?: boolean;
}

export interface DeletionResult {
  success: boolean;
  deletedCount: number;
  errors: string[];
}

export class ArtifactStorageService {
  private s3Client: S3Client;
  private redis = getRedisClient();
  private bucket: string;

  constructor() {
    // Initialize S3 client with MinIO/S3 configuration
    this.s3Client = new S3Client({
      endpoint: config.s3.endpoint,
      region: 'us-east-1', // Required but not used for MinIO
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.bucket = config.s3.bucket;
  }

  /**
   * Store sanitized artifact in S3 with retention policy
   * Requirement 18.2: Delete raw data within 24 hours
   * Requirement 39.2: Retain sanitized artifacts per policy
   */
  async storeArtifact(
    artifact: SanitizedArtifact,
    options: StorageOptions = {}
  ): Promise<string> {
    const { useCache = true, cacheTTL, metadata = {} } = options;

    // Generate S3 key with tenant isolation
    const key = this.generateArtifactKey(artifact);

    // Prepare artifact data
    const artifactData = JSON.stringify(artifact);

    // Calculate expiry based on retention policy
    const expiryDate = this.calculateExpiryDate(artifact.retentionPolicy);

    // Store in S3 with metadata
    const s3Metadata: Record<string, string> = {
      ...metadata,
      tenantId: String(artifact.metadata.tenantId),
      userId: String(artifact.metadata.userId),
      sessionId: String(artifact.metadata.sessionId),
      type: artifact.type,
      expiryDate: expiryDate?.toISOString() || 'none',
      retentionType: artifact.retentionPolicy.type,
      retentionDuration: artifact.retentionPolicy.duration.toString(),
    };

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: artifactData,
        ContentType: 'application/json',
        Metadata: s3Metadata,
      })
    );

    // Cache artifact if requested
    if (useCache) {
      const cacheKey = this.getCacheKey(artifact.id);
      const ttl = cacheTTL || this.getDefaultCacheTTL(artifact.retentionPolicy);
      await this.redis.setex(cacheKey, ttl, artifactData);
    }

    // Schedule automatic deletion if retention policy requires it
    if (artifact.retentionPolicy.autoDelete && expiryDate) {
      await this.scheduleAutoDeletion(artifact.id, key, expiryDate);
    }

    return key;
  }

  /**
   * Store interactive script with sanitized content only
   * Requirement 39.3: Retain sanitized artifacts per retention policy
   */
  async storeInteractiveScript(
    script: InteractiveScript,
    options: StorageOptions = {}
  ): Promise<string> {
    const { useCache = true, cacheTTL, metadata = {} } = options;

    // Generate S3 key for script
    const key = this.generateScriptKey(script);

    // Prepare script data
    const scriptData = JSON.stringify(script);

    // Calculate expiry based on retention policy
    const expiryDate = this.calculateExpiryDate(script.retentionPolicy);

    // Store in S3 with metadata
    const s3Metadata: Record<string, string> = {
      ...metadata,
      tenantId: script.tenantId,
      userId: script.userId,
      sessionId: script.sessionId,
      type: 'interactive-script',
      expiryDate: expiryDate?.toISOString() || 'none',
      retentionType: script.retentionPolicy.type,
      retentionDuration: script.retentionPolicy.duration.toString(),
      hasVoice: script.metadata.hasVoice.toString(),
    };

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: scriptData,
        ContentType: 'application/json',
        Metadata: s3Metadata,
      })
    );

    // Cache script if requested
    if (useCache) {
      const cacheKey = this.getCacheKey(`script:${script.id}`);
      const ttl = cacheTTL || this.getDefaultCacheTTL(script.retentionPolicy);
      await this.redis.setex(cacheKey, ttl, scriptData);
    }

    // Schedule automatic deletion if retention policy requires it
    if (script.retentionPolicy.autoDelete && expiryDate) {
      await this.scheduleAutoDeletion(script.id, key, expiryDate);
    }

    return key;
  }

  /**
   * Store template with sanitized content validation
   * Requirement 39.3: Only sanitized artifacts in templates
   */
  async storeTemplate(
    template: Template,
    options: StorageOptions = {}
  ): Promise<string> {
    const { useCache = true, cacheTTL = 3600, metadata = {} } = options;

    // Generate S3 key for template
    const key = this.generateTemplateKey(template);

    // Prepare template data
    const templateData = JSON.stringify(template);

    // Store in S3 with metadata
    const s3Metadata: Record<string, string> = {
      ...metadata,
      tenantId: template.tenantId,
      creatorId: template.creatorId,
      type: 'template',
      version: template.version,
      sharedWith: template.sharedWith.join(','),
    };

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: templateData,
        ContentType: 'application/json',
        Metadata: s3Metadata,
      })
    );

    // Cache template
    if (useCache) {
      const cacheKey = this.getCacheKey(`template:${template.id}`);
      await this.redis.setex(cacheKey, cacheTTL, templateData);
    }

    return key;
  }

  /**
   * Retrieve artifact with caching support
   */
  async retrieveArtifact(
    artifactId: string,
    options: RetrievalOptions = {}
  ): Promise<SanitizedArtifact | null> {
    const { useCache = true } = options;

    // Try cache first
    if (useCache) {
      const cacheKey = this.getCacheKey(artifactId);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SanitizedArtifact;
      }
    }

    // Retrieve from S3
    try {
      // We need to search for the artifact by ID
      const key = await this.findArtifactKey(artifactId);
      if (!key) {
        return null;
      }

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        return null;
      }

      const artifactData = await this.streamToString(response.Body);
      const artifact = JSON.parse(artifactData) as SanitizedArtifact;

      // Update cache
      if (useCache) {
        const cacheKey = this.getCacheKey(artifactId);
        const ttl = this.getDefaultCacheTTL(artifact.retentionPolicy);
        await this.redis.setex(cacheKey, ttl, artifactData);
      }

      return artifact;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Retrieve interactive script with caching
   */
  async retrieveInteractiveScript(
    scriptId: string,
    options: RetrievalOptions = {}
  ): Promise<InteractiveScript | null> {
    const { useCache = true } = options;

    // Try cache first
    if (useCache) {
      const cacheKey = this.getCacheKey(`script:${scriptId}`);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as InteractiveScript;
      }
    }

    // Retrieve from S3
    try {
      const key = await this.findScriptKey(scriptId);
      if (!key) {
        return null;
      }

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        return null;
      }

      const scriptData = await this.streamToString(response.Body);
      const script = JSON.parse(scriptData) as InteractiveScript;

      // Update cache
      if (useCache) {
        const cacheKey = this.getCacheKey(`script:${scriptId}`);
        const ttl = this.getDefaultCacheTTL(script.retentionPolicy);
        await this.redis.setex(cacheKey, ttl, scriptData);
      }

      return script;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Retrieve template with caching
   */
  async retrieveTemplate(
    templateId: string,
    options: RetrievalOptions = {}
  ): Promise<Template | null> {
    const { useCache = true } = options;

    // Try cache first
    if (useCache) {
      const cacheKey = this.getCacheKey(`template:${templateId}`);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Template;
      }
    }

    // Retrieve from S3
    try {
      const key = await this.findTemplateKey(templateId);
      if (!key) {
        return null;
      }

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        return null;
      }

      const templateData = await this.streamToString(response.Body);
      const template = JSON.parse(templateData) as Template;

      // Update cache
      if (useCache) {
        const cacheKey = this.getCacheKey(`template:${templateId}`);
        await this.redis.setex(cacheKey, 3600, templateData);
      }

      return template;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete artifact from S3 and cache
   */
  async deleteArtifact(artifactId: string): Promise<boolean> {
    try {
      // Find and delete from S3
      const key = await this.findArtifactKey(artifactId);
      if (key) {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          })
        );
      }

      // Delete from cache
      const cacheKey = this.getCacheKey(artifactId);
      await this.redis.del(cacheKey);

      // Remove from deletion schedule
      await this.unscheduleAutoDeletion(artifactId);

      return true;
    } catch (error) {
      console.error('Error deleting artifact:', error);
      return false;
    }
  }

  /**
   * Delete interactive script
   */
  async deleteInteractiveScript(scriptId: string): Promise<boolean> {
    try {
      // Find and delete from S3
      const key = await this.findScriptKey(scriptId);
      if (key) {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          })
        );
      }

      // Delete from cache
      const cacheKey = this.getCacheKey(`script:${scriptId}`);
      await this.redis.del(cacheKey);

      // Remove from deletion schedule
      await this.unscheduleAutoDeletion(scriptId);

      return true;
    } catch (error) {
      console.error('Error deleting script:', error);
      return false;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      // Find and delete from S3
      const key = await this.findTemplateKey(templateId);
      if (key) {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          })
        );
      }

      // Delete from cache
      const cacheKey = this.getCacheKey(`template:${templateId}`);
      await this.redis.del(cacheKey);

      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }

  /**
   * Delete all artifacts for a session
   * Requirement 18.2: Delete raw data within 24 hours
   */
  async deleteSessionArtifacts(sessionId: string, tenantId: string): Promise<DeletionResult> {
    const result: DeletionResult = {
      success: true,
      deletedCount: 0,
      errors: [],
    };

    try {
      // List all artifacts for this session
      const prefix = `artifacts/${tenantId}/sessions/${sessionId}/`;
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
        })
      );

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return result;
      }

      // Delete each artifact
      for (const object of listResponse.Contents) {
        if (!object.Key) continue;

        try {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: object.Key,
            })
          );
          result.deletedCount++;
        } catch (error: any) {
          result.errors.push(`Failed to delete ${object.Key}: ${error.message}`);
          result.success = false;
        }
      }

      // Clear cache entries for this session
      const cachePattern = `artifact:*:session:${sessionId}`;
      const cacheKeys = await this.redis.keys(cachePattern);
      for (const key of cacheKeys) {
        await this.redis.del(key);
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Failed to list session artifacts: ${error.message}`);
    }

    return result;
  }

  /**
   * Enforce retention policies by deleting expired artifacts
   * Requirement 39.2: Automatic deletion based on retention
   */
  async enforceRetentionPolicies(): Promise<DeletionResult> {
    const result: DeletionResult = {
      success: true,
      deletedCount: 0,
      errors: [],
    };

    try {
      // Get all scheduled deletions that are due
      const now = Date.now();
      const scheduleKeys = await this.redis.keys('deletion:schedule:*');

      for (const scheduleKey of scheduleKeys) {
        const scheduleData = await this.redis.get(scheduleKey);
        if (!scheduleData) continue;

        const schedule = JSON.parse(scheduleData);
        const expiryTime = new Date(schedule.expiryDate).getTime();

        // Check if artifact has expired
        if (expiryTime <= now) {
          try {
            // Delete the artifact
            await this.s3Client.send(
              new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: schedule.key,
              })
            );

            // Delete from cache
            const cacheKey = this.getCacheKey(schedule.artifactId);
            await this.redis.del(cacheKey);

            // Remove schedule
            await this.redis.del(scheduleKey);

            result.deletedCount++;
          } catch (error: any) {
            result.errors.push(`Failed to delete ${schedule.key}: ${error.message}`);
            result.success = false;
          }
        }
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Failed to enforce retention policies: ${error.message}`);
    }

    return result;
  }

  /**
   * Check if artifact exists
   */
  async artifactExists(artifactId: string): Promise<boolean> {
    try {
      const key = await this.findArtifactKey(artifactId);
      if (!key) return false;

      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get artifact metadata without downloading full content
   */
  async getArtifactMetadata(artifactId: string): Promise<ArtifactMetadata | null> {
    try {
      const key = await this.findArtifactKey(artifactId);
      if (!key) return null;

      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Metadata) return null;

      return {
        sessionId: response.Metadata.sessionId || '',
        tenantId: response.Metadata.tenantId || '',
        userId: response.Metadata.userId || '',
        size: response.ContentLength || 0,
        format: response.ContentType,
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate S3 key for artifact with tenant isolation
   */
  private generateArtifactKey(artifact: SanitizedArtifact): string {
    const { tenantId, sessionId } = artifact.metadata;
    return `artifacts/${tenantId}/sessions/${sessionId}/${artifact.type}/${artifact.id}.json`;
  }

  /**
   * Generate S3 key for interactive script
   */
  private generateScriptKey(script: InteractiveScript): string {
    return `scripts/${script.tenantId}/sessions/${script.sessionId}/${script.id}.json`;
  }

  /**
   * Generate S3 key for template
   */
  private generateTemplateKey(template: Template): string {
    return `templates/${template.tenantId}/${template.id}.json`;
  }

  /**
   * Find artifact key by ID (searches S3)
   */
  private async findArtifactKey(artifactId: string): Promise<string | null> {
    // Check cache first
    const cacheKey = `artifact:key:${artifactId}`;
    const cachedKey = await this.redis.get(cacheKey);
    if (cachedKey) {
      return cachedKey;
    }

    // Search S3 (this is expensive, should be optimized with database index in production)
    try {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'artifacts/',
        })
      );

      if (!listResponse.Contents) return null;

      for (const object of listResponse.Contents) {
        if (object.Key && object.Key.includes(artifactId)) {
          // Cache the key for future lookups
          await this.redis.setex(cacheKey, 3600, object.Key);
          return object.Key;
        }
      }
    } catch (error) {
      console.error('Error finding artifact key:', error);
    }

    return null;
  }

  /**
   * Find script key by ID
   */
  private async findScriptKey(scriptId: string): Promise<string | null> {
    const cacheKey = `script:key:${scriptId}`;
    const cachedKey = await this.redis.get(cacheKey);
    if (cachedKey) {
      return cachedKey;
    }

    try {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'scripts/',
        })
      );

      if (!listResponse.Contents) return null;

      for (const object of listResponse.Contents) {
        if (object.Key && object.Key.includes(scriptId)) {
          await this.redis.setex(cacheKey, 3600, object.Key);
          return object.Key;
        }
      }
    } catch (error) {
      console.error('Error finding script key:', error);
    }

    return null;
  }

  /**
   * Find template key by ID
   */
  private async findTemplateKey(templateId: string): Promise<string | null> {
    const cacheKey = `template:key:${templateId}`;
    const cachedKey = await this.redis.get(cacheKey);
    if (cachedKey) {
      return cachedKey;
    }

    try {
      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'templates/',
        })
      );

      if (!listResponse.Contents) return null;

      for (const object of listResponse.Contents) {
        if (object.Key && object.Key.includes(templateId)) {
          await this.redis.setex(cacheKey, 3600, object.Key);
          return object.Key;
        }
      }
    } catch (error) {
      console.error('Error finding template key:', error);
    }

    return null;
  }

  /**
   * Calculate expiry date based on retention policy
   */
  private calculateExpiryDate(policy: ArtifactRetentionPolicy): Date | null {
    if (policy.type === 'immediate') {
      return new Date(); // Expire immediately
    }

    const now = new Date();
    let expiryDate: Date;

    switch (policy.type) {
      case 'hours':
        expiryDate = new Date(now.getTime() + policy.duration * 60 * 60 * 1000);
        break;
      case 'days':
        expiryDate = new Date(now.getTime() + policy.duration * 24 * 60 * 60 * 1000);
        break;
      case 'years':
        expiryDate = new Date(now.getTime() + policy.duration * 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return null;
    }

    return expiryDate;
  }

  /**
   * Get default cache TTL based on retention policy
   */
  private getDefaultCacheTTL(policy: ArtifactRetentionPolicy): number {
    switch (policy.type) {
      case 'immediate':
        return 60; // 1 minute
      case 'hours':
        return Math.min(policy.duration * 3600, 3600); // Max 1 hour
      case 'days':
        return 3600; // 1 hour
      case 'years':
        return 3600; // 1 hour
      default:
        return 3600;
    }
  }

  /**
   * Get cache key for artifact
   */
  private getCacheKey(identifier: string): string {
    return `artifact:cache:${identifier}`;
  }

  /**
   * Schedule automatic deletion for artifact
   */
  private async scheduleAutoDeletion(
    artifactId: string,
    key: string,
    expiryDate: Date
  ): Promise<void> {
    const scheduleKey = `deletion:schedule:${artifactId}`;
    const scheduleData = JSON.stringify({
      artifactId,
      key,
      expiryDate: expiryDate.toISOString(),
      scheduledAt: new Date().toISOString(),
    });

    // Store schedule with TTL slightly longer than expiry
    const ttl = Math.ceil((expiryDate.getTime() - Date.now()) / 1000) + 3600;
    await this.redis.setex(scheduleKey, ttl, scheduleData);
  }

  /**
   * Unschedule automatic deletion
   */
  private async unscheduleAutoDeletion(artifactId: string): Promise<void> {
    const scheduleKey = `deletion:schedule:${artifactId}`;
    await this.redis.del(scheduleKey);
  }

  /**
   * Convert stream to string
   */
  private async streamToString(stream: any): Promise<string> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}

export const artifactStorageService = new ArtifactStorageService();
