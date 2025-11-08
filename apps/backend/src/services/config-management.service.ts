import {
  AiriaConfig,
  ConfigDiff,
} from '@codebase-onboarding/shared';
import * as semver from 'semver';

import { getAiriaClient } from './airia.service';

/**
 * Configuration Management Service
 * 
 * Handles Airia configuration export, import, versioning, and diffing
 * 
 * Requirements:
 * - 35.1: Export Airia Agent Policies as versioned configuration files
 * - 35.2: Export Airia routing rules as versioned configuration files
 * - 35.3: Export Retell AI voice personas as versioned configuration files
 * - 35.7: Import and apply configuration versions
 * - 35.10: Diff configuration versions to review changes
 */
export class ConfigManagementService {
  private airiaClient = getAiriaClient();
  private configVersions: Map<string, AiriaConfig[]> = new Map();

  /**
   * Export configuration for a tenant
   * Requirement 35.1, 35.2, 35.3: Export all configurations
   */
  async exportConfiguration(tenantId: string): Promise<AiriaConfig> {
    try {
      const config = await this.airiaClient.exportConfiguration(tenantId);

      // Store in version history
      this.addToVersionHistory(tenantId, config);

      return config;
    } catch (error) {
      console.error(`Failed to export configuration for tenant ${tenantId}:`, error);
      throw new Error(`Configuration export failed: ${(error as Error).message}`);
    }
  }

  /**
   * Import and apply configuration
   * Requirement 35.7: Import and apply configuration versions
   */
  async importConfiguration(
    config: AiriaConfig,
    options?: {
      validate?: boolean;
      dryRun?: boolean;
    }
  ): Promise<{
    success: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    const { validate = true, dryRun = false } = options || {};

    try {
      // Validate configuration if requested
      if (validate) {
        const validation = await this.validateConfiguration(config);
        if (!validation.valid) {
          return {
            success: false,
            errors: validation.errors,
          };
        }
      }

      // Check version compatibility
      const compatibility = this.checkVersionCompatibility(config);
      if (!compatibility.compatible) {
        return {
          success: false,
          errors: [compatibility.reason || 'Version incompatible'],
        };
      }

      // Dry run - just validate without applying
      if (dryRun) {
        return {
          success: true,
          warnings: ['Dry run - configuration not applied'],
        };
      }

      // Apply configuration
      await this.airiaClient.importConfiguration(config);

      // Store in version history
      this.addToVersionHistory(config.tenantId, config);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Validate configuration before import
   */
  async validateConfiguration(config: AiriaConfig): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      // Validate with Airia
      const airiaValidation = await this.airiaClient.validateConfiguration(config);

      // Additional local validation
      const localValidation = this.performLocalValidation(config);

      return {
        valid: airiaValidation.valid && localValidation.valid,
        errors: [
          ...(airiaValidation.errors || []),
          ...(localValidation.errors || []),
        ],
        warnings: localValidation.warnings,
      };
    } catch (error) {
      console.error('Configuration validation failed:', error);
      return {
        valid: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Perform local validation checks
   */
  private performLocalValidation(config: AiriaConfig): {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check version format
    if (!semver.valid(config.version)) {
      errors.push(`Invalid semantic version: ${config.version}`);
    }

    // Check tenant ID
    if (!config.tenantId || config.tenantId.trim() === '') {
      errors.push('Tenant ID is required');
    }

    // Check policies
    if (!config.policies || config.policies.length === 0) {
      warnings.push('No policies defined in configuration');
    }

    // Check routing rules
    if (!config.routingRules || config.routingRules.length === 0) {
      warnings.push('No routing rules defined in configuration');
    }

    // Check agent flows
    if (!config.agentFlows || config.agentFlows.length === 0) {
      warnings.push('No agent flows defined in configuration');
    }

    // Check for duplicate policy IDs
    const policyIds = new Set<string>();
    for (const policy of config.policies || []) {
      if (policyIds.has(policy.id)) {
        errors.push(`Duplicate policy ID: ${policy.id}`);
      }
      policyIds.add(policy.id);
    }

    // Check for duplicate routing rule IDs
    const ruleIds = new Set<string>();
    for (const rule of config.routingRules || []) {
      if (ruleIds.has(rule.id)) {
        errors.push(`Duplicate routing rule ID: ${rule.id}`);
      }
      ruleIds.add(rule.id);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check version compatibility
   */
  private checkVersionCompatibility(config: AiriaConfig): {
    compatible: boolean;
    reason?: string;
  } {
    // Check if version is valid semver
    if (!semver.valid(config.version)) {
      return {
        compatible: false,
        reason: `Invalid semantic version: ${config.version}`,
      };
    }

    // In production, would check against current system version
    // For now, accept all valid semver versions
    return {
      compatible: true,
    };
  }

  /**
   * Get configuration diff between two versions
   * Requirement 35.10: Diff configuration versions
   */
  async getConfigurationDiff(
    tenantId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<ConfigDiff> {
    try {
      return await this.airiaClient.getConfigurationDiff(
        tenantId,
        fromVersion,
        toVersion
      );
    } catch (error) {
      console.error('Failed to get configuration diff:', error);
      throw new Error(`Configuration diff failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get configuration version history for a tenant
   */
  getVersionHistory(tenantId: string): AiriaConfig[] {
    return this.configVersions.get(tenantId) || [];
  }

  /**
   * Add configuration to version history
   */
  private addToVersionHistory(tenantId: string, config: AiriaConfig): void {
    const history = this.configVersions.get(tenantId) || [];
    
    // Check if version already exists
    const existingIndex = history.findIndex((c) => c.version === config.version);
    
    if (existingIndex >= 0) {
      // Update existing version
      history[existingIndex] = config;
    } else {
      // Add new version
      history.push(config);
      
      // Sort by version (descending)
      history.sort((a, b) => semver.rcompare(a.version, b.version));
    }

    this.configVersions.set(tenantId, history);
  }

  /**
   * Get specific configuration version
   */
  getConfigurationVersion(tenantId: string, version: string): AiriaConfig | null {
    const history = this.getVersionHistory(tenantId);
    return history.find((c) => c.version === version) || null;
  }

  /**
   * Increment configuration version
   */
  incrementVersion(
    currentVersion: string,
    type: 'major' | 'minor' | 'patch'
  ): string {
    const newVersion = semver.inc(currentVersion, type);
    if (!newVersion) {
      throw new Error(`Failed to increment version: ${currentVersion}`);
    }
    return newVersion;
  }

  /**
   * Compare two configurations and generate diff
   */
  compareConfigurations(
    config1: AiriaConfig,
    config2: AiriaConfig
  ): ConfigDiff {
    const diff: ConfigDiff = {
      added: [],
      modified: [],
      removed: [],
    };

    // Compare policies
    this.comparePolicies(config1, config2, diff);

    // Compare routing rules
    this.compareRoutingRules(config1, config2, diff);

    // Compare agent flows
    this.compareAgentFlows(config1, config2, diff);

    // Compare model allowlist
    this.compareModelAllowlist(config1, config2, diff);

    // Compare cost limits
    this.compareCostLimits(config1, config2, diff);

    return diff;
  }

  private comparePolicies(
    config1: AiriaConfig,
    config2: AiriaConfig,
    diff: ConfigDiff
  ): void {
    const policies1 = new Map(config1.policies.map((p) => [p.id, p]));
    const policies2 = new Map(config2.policies.map((p) => [p.id, p]));

    // Find added policies
    for (const [id, policy] of policies2) {
      if (!policies1.has(id)) {
        diff.added.push({
          path: `policies.${id}`,
          newValue: policy,
          changeType: 'added',
        });
      }
    }

    // Find removed policies
    for (const [id, policy] of policies1) {
      if (!policies2.has(id)) {
        diff.removed.push({
          path: `policies.${id}`,
          oldValue: policy,
          changeType: 'removed',
        });
      }
    }

    // Find modified policies
    for (const [id, policy1] of policies1) {
      const policy2 = policies2.get(id);
      if (policy2 && JSON.stringify(policy1) !== JSON.stringify(policy2)) {
        diff.modified.push({
          path: `policies.${id}`,
          oldValue: policy1,
          newValue: policy2,
          changeType: 'modified',
        });
      }
    }
  }

  private compareRoutingRules(
    config1: AiriaConfig,
    config2: AiriaConfig,
    diff: ConfigDiff
  ): void {
    const rules1 = new Map(config1.routingRules.map((r) => [r.id, r]));
    const rules2 = new Map(config2.routingRules.map((r) => [r.id, r]));

    // Find added rules
    for (const [id, rule] of rules2) {
      if (!rules1.has(id)) {
        diff.added.push({
          path: `routingRules.${id}`,
          newValue: rule,
          changeType: 'added',
        });
      }
    }

    // Find removed rules
    for (const [id, rule] of rules1) {
      if (!rules2.has(id)) {
        diff.removed.push({
          path: `routingRules.${id}`,
          oldValue: rule,
          changeType: 'removed',
        });
      }
    }

    // Find modified rules
    for (const [id, rule1] of rules1) {
      const rule2 = rules2.get(id);
      if (rule2 && JSON.stringify(rule1) !== JSON.stringify(rule2)) {
        diff.modified.push({
          path: `routingRules.${id}`,
          oldValue: rule1,
          newValue: rule2,
          changeType: 'modified',
        });
      }
    }
  }

  private compareAgentFlows(
    config1: AiriaConfig,
    config2: AiriaConfig,
    diff: ConfigDiff
  ): void {
    const flows1 = new Map(config1.agentFlows.map((f) => [f.id, f]));
    const flows2 = new Map(config2.agentFlows.map((f) => [f.id, f]));

    // Find added flows
    for (const [id, flow] of flows2) {
      if (!flows1.has(id)) {
        diff.added.push({
          path: `agentFlows.${id}`,
          newValue: flow,
          changeType: 'added',
        });
      }
    }

    // Find removed flows
    for (const [id, flow] of flows1) {
      if (!flows2.has(id)) {
        diff.removed.push({
          path: `agentFlows.${id}`,
          oldValue: flow,
          changeType: 'removed',
        });
      }
    }

    // Find modified flows
    for (const [id, flow1] of flows1) {
      const flow2 = flows2.get(id);
      if (flow2 && JSON.stringify(flow1) !== JSON.stringify(flow2)) {
        diff.modified.push({
          path: `agentFlows.${id}`,
          oldValue: flow1,
          newValue: flow2,
          changeType: 'modified',
        });
      }
    }
  }

  private compareModelAllowlist(
    config1: AiriaConfig,
    config2: AiriaConfig,
    diff: ConfigDiff
  ): void {
    const models1 = new Set(config1.modelAllowlist || []);
    const models2 = new Set(config2.modelAllowlist || []);

    // Find added models
    for (const model of models2) {
      if (!models1.has(model)) {
        diff.added.push({
          path: `modelAllowlist.${model}`,
          newValue: model,
          changeType: 'added',
        });
      }
    }

    // Find removed models
    for (const model of models1) {
      if (!models2.has(model)) {
        diff.removed.push({
          path: `modelAllowlist.${model}`,
          oldValue: model,
          changeType: 'removed',
        });
      }
    }
  }

  private compareCostLimits(
    config1: AiriaConfig,
    config2: AiriaConfig,
    diff: ConfigDiff
  ): void {
    const limits1 = config1.costLimits || [];
    const limits2 = config2.costLimits || [];

    if (JSON.stringify(limits1) !== JSON.stringify(limits2)) {
      diff.modified.push({
        path: 'costLimits',
        oldValue: limits1,
        newValue: limits2,
        changeType: 'modified',
      });
    }
  }

  /**
   * Rollback to a previous configuration version
   */
  async rollbackToVersion(
    tenantId: string,
    version: string
  ): Promise<{
    success: boolean;
    errors?: string[];
  }> {
    const config = this.getConfigurationVersion(tenantId, version);

    if (!config) {
      return {
        success: false,
        errors: [`Configuration version ${version} not found`],
      };
    }

    return await this.importConfiguration(config);
  }

  /**
   * Create a new configuration version from current
   */
  async createNewVersion(
    tenantId: string,
    versionType: 'major' | 'minor' | 'patch',
    changes?: Partial<AiriaConfig>
  ): Promise<AiriaConfig> {
    // Get current configuration
    const currentConfig = await this.exportConfiguration(tenantId);

    // Increment version
    const newVersion = this.incrementVersion(currentConfig.version, versionType);

    // Create new configuration
    const newConfig: AiriaConfig = {
      ...currentConfig,
      ...changes,
      version: newVersion,
      exportedAt: new Date(),
    };

    return newConfig;
  }
}

// Singleton instance
let configManagementServiceInstance: ConfigManagementService | null = null;

/**
 * Get singleton instance of configuration management service
 */
export function getConfigManagementService(): ConfigManagementService {
  if (!configManagementServiceInstance) {
    configManagementServiceInstance = new ConfigManagementService();
  }
  return configManagementServiceInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetConfigManagementService(): void {
  configManagementServiceInstance = null;
}
