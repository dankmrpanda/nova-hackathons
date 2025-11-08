export type CostService = 'openrouter' | 'retell' | 'modal' | 'github';

export interface CostEntry {
  service: CostService;
  operation: string;
  amount: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface CostStatus {
  current: number;
  limit: number;
  percentage: number;
  warning: boolean; // true if >90%
  exceeded: boolean;
}

export interface CostEstimate {
  llmCost: number;
  voiceCost: number;
  animationCost: number;
  githubCost: number;
  total: number;
  confidence: number; // 0-1
}

export interface CostReport {
  tenantId?: string;
  userId?: string;
  startDate: Date;
  endDate: Date;
  totalCost: number;
  costByService: Record<CostService, number>;
  costByOperation: Record<string, number>;
  sessionCount: number;
  averageCostPerSession: number;
}

export interface TenantCostConfig {
  tenantId: string;
  defaultCostLimit: number;
  maxCostLimit: number;
  warningThreshold: number; // percentage (default 90)
}

export interface RecordCostRequest {
  sessionId: string;
  service: CostService;
  operation: string;
  amount: number;
  metadata?: Record<string, any>;
}

export interface CostReportQuery {
  tenantId?: string;
  userId?: string;
  startDate: Date;
  endDate: Date;
  groupBy?: 'service' | 'operation' | 'session';
}
