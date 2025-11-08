// Airia Control Plane Types

export interface AgentFlow {
  id: string;
  name: string;
  version: string;
  steps: FlowStep[];
  policies: Policy[];
  fallbackFlow?: string;
  metadata?: Record<string, unknown>;
}

export interface FlowStep {
  id: string;
  name: string;
  type: 'llm' | 'tool' | 'condition' | 'loop';
  config: Record<string, unknown>;
  nextSteps?: string[];
}

export interface Policy {
  id: string;
  name: string;
  type: 'data_access' | 'model_restriction' | 'cost_limit' | 'sensitive_data';
  rules: PolicyRule[];
  enforcement: 'block' | 'warn' | 'log';
}

export interface PolicyRule {
  condition: string;
  action: string;
  parameters?: Record<string, unknown>;
}

export interface FlowInput {
  sessionId: string;
  tenantId: string;
  operation: string;
  context: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface FlowOutput {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata: {
    executionTime: number;
    cost: number;
    modelUsed?: string;
    fallbacksUsed?: string[];
  };
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  alternatives?: string[];
  maskedContent?: string;
  violations?: PolicyViolation[];
}

export interface PolicyViolation {
  policyId: string;
  policyName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

export interface LLMRequest {
  model: string;
  prompt: string;
  context?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    [key: string]: unknown;
  };
  tenantId: string;
  sessionId?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  metadata?: {
    finishReason?: string;
    latency?: number;
    [key: string]: unknown;
  };
}

export interface AiriaConfig {
  version: string;
  tenantId: string;
  policies: Policy[];
  routingRules: RoutingRule[];
  agentFlows: AgentFlow[];
  modelAllowlist?: string[];
  costLimits?: CostLimit[];
  retentionPolicies?: RetentionPolicy[];
  exportedAt: Date;
}

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: RoutingCondition[];
  targetModel: string;
  fallbackModels?: string[];
}

export interface RoutingCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  value: string | number;
}

export interface CostLimit {
  scope: 'tenant' | 'user' | 'session';
  limit: number;
  period?: 'hour' | 'day' | 'month';
  enforcement: 'hard' | 'soft';
}

export interface RetentionPolicy {
  artifactType: 'raw_code' | 'intermediate' | 'sanitized' | 'transcript' | 'audio';
  retentionDays: number;
  autoDelete: boolean;
}

export interface SensitiveDataMaskingConfig {
  enabled: boolean;
  patterns: MaskingPattern[];
  redactionStrategy: 'remove' | 'replace' | 'hash';
}

export interface MaskingPattern {
  name: string;
  pattern: string;
  type: 'regex' | 'keyword' | 'semantic';
  replacement?: string;
}

export interface ModelAvailability {
  model: string;
  available: boolean;
  latency?: number;
  errorRate?: number;
  lastChecked: Date;
}

export interface ABTestConfig {
  flowId: string;
  variants: ABTestVariant[];
  splitPercentages: number[];
  startDate: Date;
  endDate?: Date;
  metrics: string[];
}

export interface ABTestVariant {
  id: string;
  name: string;
  flowVersion: string;
  description?: string;
}

export interface ConfigDiff {
  added: ConfigChange[];
  modified: ConfigChange[];
  removed: ConfigChange[];
}

export interface ConfigChange {
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  changeType: 'added' | 'modified' | 'removed';
}

export interface AiriaMetrics {
  policyEnforcements: PolicyEnforcementMetric[];
  routingDecisions: RoutingDecisionMetric[];
  modelUsage: ModelUsageMetric[];
  costs: CostMetric[];
}

export interface PolicyEnforcementMetric {
  policyId: string;
  policyName: string;
  enforcements: number;
  violations: number;
  timestamp: Date;
}

export interface RoutingDecisionMetric {
  model: string;
  requests: number;
  fallbacks: number;
  averageLatency: number;
  timestamp: Date;
}

export interface ModelUsageMetric {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
  timestamp: Date;
}

export interface CostMetric {
  tenantId: string;
  service: 'llm' | 'voice' | 'animation' | 'storage';
  cost: number;
  timestamp: Date;
}
