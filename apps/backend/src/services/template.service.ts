/**
 * Template Management Service
 * Handles template creation, validation, versioning, and cross-tenant sharing
 * Requirements: 31.1, 31.3, 31.6, 31.9, 31.11
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Template,
  InteractiveScript,
  TemplateValidationResult,
  TemplateMetadata,
} from '@codebase-onboarding/shared';
import { artifactStorageService } from './artifact-storage.service';
import { sanitizationService } from './sanitization.service';
import { db } from '../db';

export interface CreateTemplateOptions {
  name: string;
  description: string;
  tags?: string[];
  metadata?: TemplateMetadata;
}

export interface ShareTemplateOptions {
  targetTenants: string[];
  validateBeforeShare?: boolean;
}

export interface TemplateSearchOptions {
  tenantId?: string;
  tags?: string[];
  creatorId?: string;
  sharedWithTenant?: string;
  limit?: number;
  offset?: number;
}

export interface TemplateUsageStats {
  templateId: string;
  usageCount: number;
  averageRating?: number;
  feedbackCount: number;
  lastUsedAt?: Date;
}

export class TemplateService {
  /**
   * Create template from interactive script
   * Requirement 31.1: Save interactive scripts as sanitized artifact templates
   * Requirement 31.2: Sanitize all template content
   */
  async createTemplate(
    script: InteractiveScript,
    creatorId: string,
    options: CreateTemplateOptions
  ): Promise<Template> {
    // Validate that script is sanitized
    const validation = await this.validateScriptSanitization(script);
    if (!validation.sanitizationCheck.passed) {
      throw new Error(
        `Cannot create template: Script contains unsanitized content. Violations: ${validation.sanitizationCheck.violations.join(', ')}`
      );
    }

    // Create template object
    const template: Template = {
      id: uuidv4(),
      name: options.name,
      description: options.description,
      creatorId,
      tenantId: script.tenantId,
      script,
      version: '1.0.0',
      sharedWith: [],
      tags: options.tags || [],
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store template in database
    await this.storeTemplateMetadata(template, options.metadata);

    // Store template in S3
    await artifactStorageService.storeTemplate(template);

    return template;
  }

  /**
   * Validate template for cross-tenant sharing
   * Requirement 31.3: Enforce only sanitized artifacts in templates
   * Requirement 31.10: Validate templates contain only sanitized artifacts
   * Requirement 31.11: Reject templates with raw code, secrets, or PII
   */
  async validateTemplate(template: Template): Promise<TemplateValidationResult> {
    const result: TemplateValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizationCheck: {
        passed: true,
        violations: [],
      },
    };

    // Validate basic structure
    if (!template.id || !template.name || !template.script) {
      result.isValid = false;
      result.errors.push('Template missing required fields');
    }

    // Validate script sanitization
    const scriptValidation = await this.validateScriptSanitization(template.script);
    result.sanitizationCheck = scriptValidation.sanitizationCheck;

    if (!scriptValidation.sanitizationCheck.passed) {
      result.isValid = false;
      result.errors.push('Template contains unsanitized content');
    }

    // Validate sections
    for (const section of template.script.sections) {
      const sectionValidation = await this.validateSectionContent(section);
      if (!sectionValidation.passed) {
        result.sanitizationCheck.passed = false;
        result.sanitizationCheck.violations.push(
          ...sectionValidation.violations.map(v => `Section "${section.title}": ${v}`)
        );
      }
    }

    // Validate voice timeline if present
    if (template.script.voiceTimeline) {
      const voiceValidation = await this.validateVoiceTimeline(template.script.voiceTimeline);
      if (!voiceValidation.passed) {
        result.sanitizationCheck.passed = false;
        result.sanitizationCheck.violations.push(...voiceValidation.violations);
      }
    }

    // Check for secrets and PII
    const secretsCheck = await this.checkForSecrets(template);
    if (secretsCheck.found) {
      result.isValid = false;
      result.sanitizationCheck.passed = false;
      result.sanitizationCheck.violations.push(...secretsCheck.violations);
    }

    // Update overall validity
    if (!result.sanitizationCheck.passed) {
      result.isValid = false;
    }

    return result;
  }

  /**
   * Share template across tenants
   * Requirement 31.4: Share templates across tenants with permission
   * Requirement 31.10: Validate before cross-tenant sharing
   */
  async shareTemplate(
    templateId: string,
    options: ShareTemplateOptions
  ): Promise<Template> {
    // Retrieve template
    const template = await artifactStorageService.retrieveTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate before sharing if requested
    if (options.validateBeforeShare !== false) {
      const validation = await this.validateTemplate(template);
      if (!validation.isValid) {
        throw new Error(
          `Cannot share template: Validation failed. Errors: ${validation.errors.join(', ')}`
        );
      }
    }

    // Update shared tenants
    const updatedTemplate: Template = {
      ...template,
      sharedWith: [...new Set([...template.sharedWith, ...options.targetTenants])],
      updatedAt: new Date(),
    };

    // Update in database
    await this.updateTemplateSharing(templateId, updatedTemplate.sharedWith);

    // Update in S3
    await artifactStorageService.storeTemplate(updatedTemplate);

    return updatedTemplate;
  }

  /**
   * Version template
   * Requirement 31.7: Version interactive script templates
   */
  async versionTemplate(
    templateId: string,
    updatedScript: InteractiveScript,
    versionType: 'major' | 'minor' | 'patch' = 'minor'
  ): Promise<Template> {
    // Retrieve existing template
    const template = await artifactStorageService.retrieveTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate updated script
    const validation = await this.validateScriptSanitization(updatedScript);
    if (!validation.sanitizationCheck.passed) {
      throw new Error(
        `Cannot version template: Updated script contains unsanitized content`
      );
    }

    // Calculate new version
    const newVersion = this.incrementVersion(template.version, versionType);

    // Create new versioned template
    const versionedTemplate: Template = {
      ...template,
      script: updatedScript,
      version: newVersion,
      updatedAt: new Date(),
    };

    // Store version history in database
    await this.storeTemplateVersion(templateId, template.version, template);

    // Update current template
    await this.updateTemplateVersion(templateId, newVersion);

    // Update in S3
    await artifactStorageService.storeTemplate(versionedTemplate);

    return versionedTemplate;
  }

  /**
   * Get template library
   * Requirement 31.8: Provide library view of available templates
   */
  async getTemplateLibrary(
    options: TemplateSearchOptions
  ): Promise<{ templates: Template[]; total: number }> {
    const { limit = 50, offset = 0 } = options;

    // Build query
    let query = `
      SELECT t.*, tm.category, tm.difficulty, tm.estimated_duration
      FROM templates t
      LEFT JOIN template_metadata tm ON t.id = tm.template_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by tenant
    if (options.tenantId) {
      query += ` AND t.tenant_id = $${paramIndex}`;
      params.push(options.tenantId);
      paramIndex++;
    }

    // Filter by creator
    if (options.creatorId) {
      query += ` AND t.creator_id = $${paramIndex}`;
      params.push(options.creatorId);
      paramIndex++;
    }

    // Filter by shared tenant
    if (options.sharedWithTenant) {
      query += ` AND $${paramIndex} = ANY(t.shared_with)`;
      params.push(options.sharedWithTenant);
      paramIndex++;
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      query += ` AND t.tags && $${paramIndex}`;
      params.push(options.tags);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT t.*, tm.category, tm.difficulty, tm.estimated_duration',
      'SELECT COUNT(*)'
    );
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Execute query
    const result = await db.query(query, params);

    // Load full templates from S3
    const templates: Template[] = [];
    for (const row of result.rows) {
      const template = await artifactStorageService.retrieveTemplate(row.id);
      if (template) {
        templates.push(template);
      }
    }

    return { templates, total };
  }

  /**
   * Track template usage
   * Requirement 31.6: Track usage with analytics
   */
  async trackTemplateUsage(templateId: string, userId: string): Promise<void> {
    await db.query(
      `
      INSERT INTO template_usage (template_id, user_id, used_at)
      VALUES ($1, $2, NOW())
      `,
      [templateId, userId]
    );

    // Increment usage count
    await db.query(
      `
      UPDATE templates
      SET usage_count = usage_count + 1
      WHERE id = $1
      `,
      [templateId]
    );

    // Invalidate cache
    const cacheKey = `template:key:${templateId}`;
    const redis = await import('../db/redis').then(m => m.getRedisClient());
    await redis.del(cacheKey);
  }

  /**
   * Submit template feedback
   * Requirement 31.9: Allow feedback for iterative improvement
   */
  async submitFeedback(
    templateId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    await db.query(
      `
      INSERT INTO template_feedback (template_id, user_id, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (template_id, user_id)
      DO UPDATE SET rating = $3, comment = $4, created_at = NOW()
      `,
      [templateId, userId, rating, comment]
    );

    // Update average rating
    await this.updateTemplateRating(templateId);
  }

  /**
   * Get template usage statistics
   */
  async getTemplateStats(templateId: string): Promise<TemplateUsageStats> {
    const result = await db.query(
      `
      SELECT
        t.id as template_id,
        t.usage_count,
        t.rating as average_rating,
        COUNT(DISTINCT tf.user_id) as feedback_count,
        MAX(tu.used_at) as last_used_at
      FROM templates t
      LEFT JOIN template_feedback tf ON t.id = tf.template_id
      LEFT JOIN template_usage tu ON t.id = tu.template_id
      WHERE t.id = $1
      GROUP BY t.id, t.usage_count, t.rating
      `,
      [templateId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Template ${templateId} not found`);
    }

    const row = result.rows[0];
    return {
      templateId: row.template_id,
      usageCount: row.usage_count,
      averageRating: row.average_rating,
      feedbackCount: row.feedback_count,
      lastUsedAt: row.last_used_at,
    };
  }

  /**
   * Customize template for specific repository
   * Requirement 31.5: Allow customization for specific repositories
   */
  async customizeTemplate(
    templateId: string,
    userId: string,
    tenantId: string,
    customizations: {
      name?: string;
      description?: string;
      scriptModifications?: Partial<InteractiveScript>;
    }
  ): Promise<Template> {
    // Retrieve original template
    const originalTemplate = await artifactStorageService.retrieveTemplate(templateId);
    if (!originalTemplate) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Create customized template
    const customizedTemplate: Template = {
      ...originalTemplate,
      id: uuidv4(),
      name: customizations.name || `${originalTemplate.name} (Customized)`,
      description: customizations.description || originalTemplate.description,
      creatorId: userId,
      tenantId,
      script: {
        ...originalTemplate.script,
        ...customizations.scriptModifications,
        id: uuidv4(),
        tenantId,
        userId,
      },
      version: '1.0.0',
      sharedWith: [],
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate customized template
    const validation = await this.validateTemplate(customizedTemplate);
    if (!validation.isValid) {
      throw new Error(
        `Cannot customize template: Validation failed. Errors: ${validation.errors.join(', ')}`
      );
    }

    // Store customized template
    await this.storeTemplateMetadata(customizedTemplate);
    await artifactStorageService.storeTemplate(customizedTemplate);

    return customizedTemplate;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate script sanitization
   */
  private async validateScriptSanitization(
    script: InteractiveScript
  ): Promise<TemplateValidationResult> {
    const result: TemplateValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizationCheck: {
        passed: true,
        violations: [],
      },
    };

    // Check if voice timeline is marked as sanitized
    if (script.voiceTimeline && !script.voiceTimeline.sanitized) {
      result.sanitizationCheck.passed = false;
      result.sanitizationCheck.violations.push('Voice timeline not marked as sanitized');
    }

    return result;
  }

  /**
   * Validate section content for sanitization
   */
  private async validateSectionContent(
    section: any
  ): Promise<{ passed: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Check for code blocks that might contain raw code
    const codeBlockPattern = /```[\s\S]*?```/g;
    const codeBlocks = section.explanation.match(codeBlockPattern);

    if (codeBlocks) {
      for (const block of codeBlocks) {
        // Check if code block contains suspicious patterns
        const suspiciousPatterns = [
          /password\s*=\s*['"][^'"]+['"]/i,
          /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
          /secret\s*=\s*['"][^'"]+['"]/i,
          /token\s*=\s*['"][^'"]+['"]/i,
          /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email pattern
        ];

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(block)) {
            violations.push(`Code block contains potential sensitive data`);
            break;
          }
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Validate voice timeline sanitization
   */
  private async validateVoiceTimeline(
    timeline: any
  ): Promise<{ passed: boolean; violations: string[] }> {
    const violations: string[] = [];

    if (!timeline.sanitized) {
      violations.push('Voice timeline not marked as sanitized');
    }

    // Check each segment
    for (const segment of timeline.segments) {
      const segmentCheck = await this.validateSectionContent({ explanation: segment.text });
      if (!segmentCheck.passed) {
        violations.push(...segmentCheck.violations.map(v => `Voice segment: ${v}`));
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Check for secrets and PII in template
   */
  private async checkForSecrets(
    template: Template
  ): Promise<{ found: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Use sanitization service to check
    const scriptContent = JSON.stringify(template.script);
    const secretPatterns = [
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, name: 'password' },
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, name: 'API key' },
      { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi, name: 'secret' },
      { pattern: /token\s*[:=]\s*['"][^'"]+['"]/gi, name: 'token' },
      { pattern: /\b[A-Za-z0-9]{32,}\b/g, name: 'potential secret key' },
    ];

    for (const { pattern, name } of secretPatterns) {
      if (pattern.test(scriptContent)) {
        violations.push(`Found potential ${name} in template content`);
      }
    }

    return {
      found: violations.length > 0,
      violations,
    };
  }

  /**
   * Store template metadata in database
   */
  private async storeTemplateMetadata(
    template: Template,
    metadata?: TemplateMetadata
  ): Promise<void> {
    await db.query(
      `
      INSERT INTO templates (
        id, name, description, creator_id, tenant_id, version,
        shared_with, tags, usage_count, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = $2,
        description = $3,
        version = $6,
        shared_with = $7,
        tags = $8,
        updated_at = $11
      `,
      [
        template.id,
        template.name,
        template.description,
        template.creatorId,
        template.tenantId,
        template.version,
        template.sharedWith,
        template.tags,
        template.usageCount,
        template.createdAt,
        template.updatedAt,
      ]
    );

    // Store metadata if provided
    if (metadata) {
      await db.query(
        `
        INSERT INTO template_metadata (
          template_id, category, difficulty, estimated_duration,
          prerequisites, learning_objectives
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (template_id) DO UPDATE SET
          category = $2,
          difficulty = $3,
          estimated_duration = $4,
          prerequisites = $5,
          learning_objectives = $6
        `,
        [
          template.id,
          metadata.category,
          metadata.difficulty,
          metadata.estimatedDuration,
          metadata.prerequisites,
          metadata.learningObjectives,
        ]
      );
    }
  }

  /**
   * Update template sharing in database
   */
  private async updateTemplateSharing(
    templateId: string,
    sharedWith: string[]
  ): Promise<void> {
    await db.query(
      `
      UPDATE templates
      SET shared_with = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [sharedWith, templateId]
    );
  }

  /**
   * Store template version history
   */
  private async storeTemplateVersion(
    templateId: string,
    version: string,
    template: Template
  ): Promise<void> {
    await db.query(
      `
      INSERT INTO template_versions (
        template_id, version, template_data, created_at
      )
      VALUES ($1, $2, $3, NOW())
      `,
      [templateId, version, JSON.stringify(template)]
    );
  }

  /**
   * Update template version in database
   */
  private async updateTemplateVersion(
    templateId: string,
    version: string
  ): Promise<void> {
    await db.query(
      `
      UPDATE templates
      SET version = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [version, templateId]
    );
  }

  /**
   * Update template average rating
   */
  private async updateTemplateRating(templateId: string): Promise<void> {
    await db.query(
      `
      UPDATE templates
      SET rating = (
        SELECT AVG(rating)
        FROM template_feedback
        WHERE template_id = $1
      )
      WHERE id = $1
      `,
      [templateId]
    );
  }

  /**
   * Increment semantic version
   */
  private incrementVersion(
    currentVersion: string,
    type: 'major' | 'minor' | 'patch'
  ): string {
    const parts = currentVersion.split('.').map(Number);
    const [major, minor, patch] = parts;

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return currentVersion;
    }
  }
}

export const templateService = new TemplateService();
