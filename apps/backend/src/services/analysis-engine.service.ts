/**
 * Analysis Engine Service
 * Main orchestrator for code analysis
 * Coordinates AST parsing, architecture detection, data flow tracing, and feature location
 */

import {
  SourceFile,
  AnalysisResult,
  AnalysisScope,
  ASTNode,
  ArchitecturePattern,
  FeatureLocation,
  DataFlowPath,
  ExecutionResult,
  SanitizedArtifact,
} from '@codebase-onboarding/shared';
import { astParserService } from './ast-parser.service';
import { architectureDetectorService } from './architecture-detector.service';
import { dataFlowTracerService } from './data-flow-tracer.service';
import { codeSandboxService } from './code-sandbox.service';
import { featureLocatorService } from './feature-locator.service';

/**
 * Analysis Engine Service
 * Main entry point for repository analysis
 */
export class AnalysisEngineService {
  /**
   * Analyze a repository
   */
  async analyzeRepository(
    sessionId: string,
    repositoryUrl: string,
    files: SourceFile[],
    scope: AnalysisScope,
    tenantId: string,
    userId: string
  ): Promise<AnalysisResult> {
    const startedAt = new Date();

    try {
      console.log(`Starting analysis for session ${sessionId}`);

      // Step 1: Parse all files to AST
      console.log('Step 1: Parsing files...');
      const parseResults = await astParserService.parseFiles(files);
      const unifiedAST = astParserService.createUnifiedAST(parseResults);

      // Step 2: Detect architecture patterns
      console.log('Step 2: Detecting architecture patterns...');
      const architecture = await architectureDetectorService.detectPatterns(unifiedAST);

      // Step 3: Locate features
      console.log('Step 3: Locating features...');
      const features = await featureLocatorService.locateFeatures(unifiedAST, architecture);

      // Step 4: Trace data flow
      console.log('Step 4: Tracing data flow...');
      const dataFlows = await dataFlowTracerService.traceDataFlow(unifiedAST);

      // Step 5: Execute code samples (optional, based on configuration)
      console.log('Step 5: Executing code samples...');
      const executionResults = await this.executeCodeSamples(files);

      // Step 6: Generate sanitized artifacts
      console.log('Step 6: Generating sanitized artifacts...');
      const sanitizedArtifacts = await this.generateSanitizedArtifacts(
        sessionId,
        tenantId,
        userId,
        architecture,
        features,
        dataFlows
      );

      const completedAt = new Date();

      console.log(`Analysis completed for session ${sessionId}`);

      return {
        sessionId,
        repositoryUrl,
        analysisScope: scope,
        architecture,
        features,
        dataFlows,
        executionResults,
        sanitizedArtifacts,
        startedAt,
        completedAt,
        status: 'completed',
      };
    } catch (error) {
      console.error(`Analysis failed for session ${sessionId}:`, error);
      
      return {
        sessionId,
        repositoryUrl,
        analysisScope: scope,
        architecture: [],
        features: [],
        dataFlows: [],
        executionResults: [],
        sanitizedArtifacts: [],
        startedAt,
        status: 'failed',
      };
    }
  }

  /**
   * Execute code samples in sandbox
   */
  private async executeCodeSamples(files: SourceFile[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    // Find executable code samples (e.g., test files, example files)
    const executableFiles = files.filter((file) =>
      file.path.match(/example|sample|demo/i)
    );

    // Limit to first 5 samples to avoid excessive execution time
    const samplesToExecute = executableFiles.slice(0, 5);

    for (const file of samplesToExecute) {
      try {
        const result = await codeSandboxService.executeCode(
          file.content,
          file.language
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to execute ${file.path}:`, error);
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
   * Generate sanitized artifacts from analysis results
   */
  private async generateSanitizedArtifacts(
    sessionId: string,
    tenantId: string,
    userId: string,
    architecture: ArchitecturePattern[],
    features: FeatureLocation[],
    dataFlows: DataFlowPath[]
  ): Promise<SanitizedArtifact[]> {
    const artifacts: SanitizedArtifact[] = [];

    // Generate architecture explanation artifact
    if (architecture.length > 0) {
      const content = this.generateArchitectureExplanation(architecture);
      artifacts.push({
        id: `arch-${Date.now()}`,
        type: 'explanation',
        content,
        references: this.extractReferencesFromArchitecture(architecture),
        metadata: {
          sessionId,
          tenantId,
          userId,
          size: Buffer.byteLength(content, 'utf8'),
          type: 'architecture',
        },
        createdAt: new Date(),
        retentionPolicy: {
          type: 'days',
          duration: 30,
          autoDelete: true,
        },
      });
    }

    // Generate feature map artifact
    if (features.length > 0) {
      const content = this.generateFeatureMapExplanation(features);
      artifacts.push({
        id: `features-${Date.now()}`,
        type: 'explanation',
        content,
        references: this.extractReferencesFromFeatures(features),
        metadata: {
          sessionId,
          tenantId,
          userId,
          size: Buffer.byteLength(content, 'utf8'),
          type: 'features',
        },
        createdAt: new Date(),
        retentionPolicy: {
          type: 'days',
          duration: 30,
          autoDelete: true,
        },
      });
    }

    // Generate data flow artifact
    if (dataFlows.length > 0) {
      const content = this.generateDataFlowExplanation(dataFlows);
      artifacts.push({
        id: `dataflow-${Date.now()}`,
        type: 'explanation',
        content,
        references: this.extractReferencesFromDataFlows(dataFlows),
        metadata: {
          sessionId,
          tenantId,
          userId,
          size: Buffer.byteLength(content, 'utf8'),
          type: 'dataflow',
        },
        createdAt: new Date(),
        retentionPolicy: {
          type: 'days',
          duration: 30,
          autoDelete: true,
        },
      });
    }

    return artifacts;
  }

  /**
   * Generate architecture explanation (sanitized)
   */
  private generateArchitectureExplanation(patterns: ArchitecturePattern[]): string {
    let explanation = '# Architecture Analysis\n\n';

    for (const pattern of patterns) {
      explanation += `## ${pattern.type.toUpperCase()} Pattern (Confidence: ${(pattern.confidence * 100).toFixed(0)}%)\n\n`;
      explanation += `${pattern.explanation}\n\n`;

      if (pattern.components.length > 0) {
        explanation += '### Components:\n\n';
        for (const component of pattern.components) {
          explanation += `- **${component.name}** (${component.type})\n`;
          explanation += `  - Files: ${component.files.length} files\n`;
          explanation += `  - Responsibilities: ${component.responsibilities.join(', ')}\n`;
        }
        explanation += '\n';
      }

      if (pattern.relationships.length > 0) {
        explanation += '### Relationships:\n\n';
        for (const rel of pattern.relationships) {
          explanation += `- ${rel.from} → ${rel.to} (${rel.type}): ${rel.description}\n`;
        }
        explanation += '\n';
      }
    }

    return explanation;
  }

  /**
   * Generate feature map explanation (sanitized)
   */
  private generateFeatureMapExplanation(features: FeatureLocation[]): string {
    let explanation = '# Feature Map\n\n';

    // Group by functional area
    const areas = featureLocatorService.getFunctionalAreas(features);

    for (const area of areas) {
      const areaFeatures = featureLocatorService.getFeaturesByArea(features, area);
      explanation += `## ${area}\n\n`;

      for (const feature of areaFeatures) {
        explanation += `### ${feature.name}\n\n`;
        explanation += `${feature.description}\n\n`;
        explanation += `**Files:** ${feature.files.length} file(s)\n\n`;
        
        // List file references (no code)
        for (const fileRef of feature.files.slice(0, 3)) {
          explanation += `- ${fileRef.path} (lines: ${fileRef.lineNumbers.join(', ')})\n`;
        }
        if (feature.files.length > 3) {
          explanation += `- ... and ${feature.files.length - 3} more files\n`;
        }
        explanation += '\n';
      }
    }

    return explanation;
  }

  /**
   * Generate data flow explanation (sanitized)
   */
  private generateDataFlowExplanation(dataFlows: DataFlowPath[]): string {
    let explanation = '# Data Flow Analysis\n\n';

    for (let i = 0; i < Math.min(dataFlows.length, 10); i++) {
      const flow = dataFlows[i];
      explanation += `## Flow ${i + 1}: ${flow.entryPoint.file}\n\n`;
      explanation += `**Entry Point:** Line ${flow.entryPoint.startLine}\n`;
      explanation += `**Depth:** ${flow.depth} levels\n`;
      explanation += `**Steps:** ${flow.steps.length}\n\n`;

      if (flow.dataStructures.length > 0) {
        explanation += '**Data Structures Used:**\n\n';
        for (const structure of flow.dataStructures.slice(0, 5)) {
          explanation += `- ${structure.name} (${structure.type})\n`;
        }
        explanation += '\n';
      }
    }

    if (dataFlows.length > 10) {
      explanation += `\n_... and ${dataFlows.length - 10} more data flows_\n`;
    }

    return explanation;
  }

  /**
   * Extract file references from architecture patterns
   */
  private extractReferencesFromArchitecture(patterns: ArchitecturePattern[]) {
    const references = [];
    
    for (const pattern of patterns) {
      for (const component of pattern.components) {
        for (const file of component.files) {
          references.push({
            path: file,
            lineNumbers: [component.location.startLine],
            relevance: pattern.confidence,
          });
        }
      }
    }

    return references;
  }

  /**
   * Extract file references from features
   */
  private extractReferencesFromFeatures(features: FeatureLocation[]) {
    const references = [];
    
    for (const feature of features) {
      references.push(...feature.files);
    }

    return references;
  }

  /**
   * Extract file references from data flows
   */
  private extractReferencesFromDataFlows(dataFlows: DataFlowPath[]) {
    const references = [];
    
    for (const flow of dataFlows) {
      references.push({
        path: flow.entryPoint.file,
        lineNumbers: [flow.entryPoint.startLine],
        relevance: 1.0,
      });

      for (const step of flow.steps) {
        references.push({
          path: step.location.file,
          lineNumbers: [step.location.startLine],
          relevance: 0.8,
        });
      }
    }

    return references;
  }

  /**
   * Get analysis progress
   */
  getAnalysisProgress(sessionId: string): {
    stage: string;
    progress: number;
  } {
    // This would be implemented with real-time progress tracking
    // For now, return a placeholder
    return {
      stage: 'analyzing',
      progress: 50,
    };
  }

  /**
   * Cancel analysis
   */
  async cancelAnalysis(sessionId: string): Promise<void> {
    console.log(`Cancelling analysis for session ${sessionId}`);
    // Implementation would stop ongoing analysis
  }
}

export const analysisEngineService = new AnalysisEngineService();
