/**
 * Interactive Script Generator Service
 * Generates interactive scripts from analysis results with voice timeline integration
 * Requirements: 30.1, 30.2, 30.4, 30.8
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  InteractiveScript,
  ScriptSection,
  VoiceTimeline,
  VoiceSegment,
  Diagram,
  ScriptMetadata,
  ArtifactRetentionPolicy,
  AnalysisResult,
  FileReference,
} from '@codebase-onboarding/shared';
import { sanitizationService } from './sanitization.service';

export interface ScriptGenerationOptions {
  includeVoice?: boolean;
  includeDiagrams?: boolean;
  retentionPolicy: ArtifactRetentionPolicy;
  voiceSegments?: VoiceSegment[];
}

export interface DiagramData {
  type: 'architecture' | 'dataflow' | 'callgraph';
  title: string;
  mermaidCode: string;
  sectionId?: string;
}

export class ScriptGeneratorService {
  /**
   * Generate interactive script from analysis result
   */
  async generateScript(
    analysisResult: AnalysisResult,
    options: ScriptGenerationOptions
  ): Promise<InteractiveScript> {
    const scriptId = uuidv4();
    
    // Generate sections from analysis result
    const sections = await this.generateSections(analysisResult);

    // Generate diagrams if requested
    const diagrams = options.includeDiagrams
      ? await this.generateDiagrams(analysisResult, sections)
      : [];

    // Build voice timeline if voice segments provided
    const voiceTimeline = options.includeVoice && options.voiceSegments
      ? this.buildVoiceTimeline(options.voiceSegments, sections)
      : undefined;

    // Calculate metadata
    const metadata = this.buildMetadata(analysisResult, sections, diagrams, voiceTimeline);

    const script: InteractiveScript = {
      id: scriptId,
      sessionId: analysisResult.sessionId,
      tenantId: '', // Will be set by caller
      userId: '', // Will be set by caller
      sections,
      voiceTimeline,
      diagrams,
      annotations: [],
      metadata,
      retentionPolicy: options.retentionPolicy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return script;
  }

  /**
   * Generate script sections from analysis result
   */
  private async generateSections(analysisResult: AnalysisResult): Promise<ScriptSection[]> {
    const sections: ScriptSection[] = [];
    let order = 0;

    // Section 1: Architecture Overview
    if (analysisResult.architecture.length > 0) {
      const architectureSection = await this.createArchitectureSection(
        analysisResult.architecture,
        order++
      );
      sections.push(architectureSection);
    }

    // Section 2: Feature Locations
    if (analysisResult.features.length > 0) {
      const featureSection = await this.createFeatureSection(
        analysisResult.features,
        order++
      );
      sections.push(featureSection);
    }

    // Section 3: Data Flow Analysis
    if (analysisResult.dataFlows.length > 0) {
      const dataFlowSection = await this.createDataFlowSection(
        analysisResult.dataFlows,
        order++
      );
      sections.push(dataFlowSection);
    }

    // Section 4: Code Execution Examples
    if (analysisResult.executionResults.length > 0) {
      const executionSection = await this.createExecutionSection(
        analysisResult.executionResults,
        order++
      );
      sections.push(executionSection);
    }

    return sections;
  }

  /**
   * Create architecture overview section
   */
  private async createArchitectureSection(
    architecturePatterns: any[],
    order: number
  ): Promise<ScriptSection> {
    const references: FileReference[] = [];
    let explanation = '# Architecture Overview\n\n';

    for (const pattern of architecturePatterns) {
      explanation += `## ${pattern.type.toUpperCase()} Pattern\n\n`;
      explanation += `${pattern.explanation}\n\n`;
      explanation += `**Confidence:** ${(pattern.confidence * 100).toFixed(0)}%\n\n`;

      // Add component references
      for (const component of pattern.components) {
        references.push({
          path: component.location.file,
          lineNumbers: [component.location.startLine, component.location.endLine],
          relevance: 0.9,
        });
      }
    }

    // Sanitize the explanation
    const sanitized = sanitizationService.sanitizeContent(explanation, references);

    return {
      id: uuidv4(),
      title: 'Architecture Overview',
      explanation: sanitized.sanitized,
      references,
      order,
    };
  }

  /**
   * Create feature locations section
   */
  private async createFeatureSection(
    features: any[],
    order: number
  ): Promise<ScriptSection> {
    const references: FileReference[] = [];
    let explanation = '# Feature Locations\n\n';

    for (const feature of features) {
      explanation += `## ${feature.name}\n\n`;
      explanation += `${feature.description}\n\n`;
      explanation += `**Functional Area:** ${feature.functionalArea}\n\n`;

      // Add file references
      references.push(...feature.files);

      // Add entry points
      for (const entryPoint of feature.entryPoints) {
        references.push({
          path: entryPoint.file,
          lineNumbers: [entryPoint.startLine],
          relevance: 1.0,
        });
      }
    }

    // Sanitize the explanation
    const sanitized = sanitizationService.sanitizeContent(explanation, references);

    return {
      id: uuidv4(),
      title: 'Feature Locations',
      explanation: sanitized.sanitized,
      references,
      order,
    };
  }

  /**
   * Create data flow analysis section
   */
  private async createDataFlowSection(
    dataFlows: any[],
    order: number
  ): Promise<ScriptSection> {
    const references: FileReference[] = [];
    let explanation = '# Data Flow Analysis\n\n';

    for (const flow of dataFlows) {
      explanation += `## Flow from ${flow.entryPoint.file}\n\n`;
      explanation += `**Entry Point:** Line ${flow.entryPoint.startLine}\n\n`;
      explanation += `**Depth:** ${flow.depth} levels\n\n`;

      // Add entry point reference
      references.push({
        path: flow.entryPoint.file,
        lineNumbers: [flow.entryPoint.startLine],
        relevance: 1.0,
      });

      // Add step references
      for (const step of flow.steps) {
        references.push({
          path: step.location.file,
          lineNumbers: [step.location.startLine],
          relevance: 0.7,
        });
      }
    }

    // Sanitize the explanation
    const sanitized = sanitizationService.sanitizeContent(explanation, references);

    return {
      id: uuidv4(),
      title: 'Data Flow Analysis',
      explanation: sanitized.sanitized,
      references,
      order,
    };
  }

  /**
   * Create code execution examples section
   */
  private async createExecutionSection(
    executionResults: any[],
    order: number
  ): Promise<ScriptSection> {
    const references: FileReference[] = [];
    let explanation = '# Code Execution Examples\n\n';

    for (const result of executionResults) {
      explanation += `## Execution Result\n\n`;
      explanation += `**Success:** ${result.success}\n\n`;
      explanation += `**Duration:** ${result.duration}ms\n\n`;

      if (result.output) {
        explanation += `**Output:**\n\`\`\`\n${result.output}\n\`\`\`\n\n`;
      }

      if (result.error) {
        explanation += `**Error:**\n\`\`\`\n${result.error}\n\`\`\`\n\n`;
      }
    }

    // Sanitize the explanation
    const sanitized = sanitizationService.sanitizeContent(explanation, references);

    return {
      id: uuidv4(),
      title: 'Code Execution Examples',
      explanation: sanitized.sanitized,
      references,
      order,
    };
  }

  /**
   * Generate diagrams from analysis result
   */
  private async generateDiagrams(
    analysisResult: AnalysisResult,
    sections: ScriptSection[]
  ): Promise<Diagram[]> {
    const diagrams: Diagram[] = [];

    // Generate architecture diagram
    if (analysisResult.architecture.length > 0) {
      const archSection = sections.find(s => s.title === 'Architecture Overview');
      const archDiagram = this.createArchitectureDiagram(
        analysisResult.architecture[0],
        archSection?.id
      );
      diagrams.push(archDiagram);
    }

    // Generate data flow diagrams
    if (analysisResult.dataFlows.length > 0) {
      const flowSection = sections.find(s => s.title === 'Data Flow Analysis');
      for (const flow of analysisResult.dataFlows.slice(0, 3)) {
        const flowDiagram = this.createDataFlowDiagram(flow, flowSection?.id);
        diagrams.push(flowDiagram);
      }
    }

    return diagrams;
  }

  /**
   * Create architecture diagram in Mermaid format
   */
  private createArchitectureDiagram(pattern: any, sectionId?: string): Diagram {
    let mermaidCode = 'graph TB\n';

    // Add components
    for (const component of pattern.components) {
      const nodeId = component.name.replace(/\s+/g, '_');
      mermaidCode += `  ${nodeId}[${component.name}]\n`;
    }

    // Add relationships
    for (const rel of pattern.relationships) {
      const fromId = rel.from.replace(/\s+/g, '_');
      const toId = rel.to.replace(/\s+/g, '_');
      mermaidCode += `  ${fromId} --> ${toId}\n`;
    }

    return {
      id: uuidv4(),
      type: 'mermaid',
      title: `${pattern.type} Architecture`,
      content: mermaidCode,
      format: 'svg',
      sectionId,
      metadata: {
        patternType: pattern.type,
        confidence: pattern.confidence,
      },
    };
  }

  /**
   * Create data flow diagram in Mermaid format
   */
  private createDataFlowDiagram(flow: any, sectionId?: string): Diagram {
    let mermaidCode = 'graph LR\n';

    // Add entry point
    mermaidCode += `  Start[Entry Point]\n`;

    // Add steps
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      const nodeId = `Step${i}`;
      mermaidCode += `  ${nodeId}[${step.operation}]\n`;
      
      if (i === 0) {
        mermaidCode += `  Start --> ${nodeId}\n`;
      } else {
        mermaidCode += `  Step${i - 1} --> ${nodeId}\n`;
      }
    }

    return {
      id: uuidv4(),
      type: 'mermaid',
      title: 'Data Flow',
      content: mermaidCode,
      format: 'svg',
      sectionId,
      metadata: {
        depth: flow.depth,
        stepCount: flow.steps.length,
      },
    };
  }

  /**
   * Build voice timeline from voice segments
   */
  private buildVoiceTimeline(
    segments: VoiceSegment[],
    sections: ScriptSection[]
  ): VoiceTimeline {
    // Sanitize all voice segments
    const sanitizedSegments = segments.map(segment => {
      const sanitized = sanitizationService.sanitizeContent(
        segment.text,
        segment.references
      );

      return {
        ...segment,
        text: sanitized.sanitized,
      };
    });

    // Link segments to sections based on timestamp
    for (const segment of sanitizedSegments) {
      const matchingSection = this.findSectionForTimestamp(segment.timestamp, sections);
      if (matchingSection) {
        segment.sectionId = matchingSection.id;
      }
    }

    const totalDuration = sanitizedSegments.reduce(
      (sum, seg) => Math.max(sum, seg.timestamp + seg.duration),
      0
    );

    return {
      segments: sanitizedSegments,
      totalDuration,
      sanitized: true,
    };
  }

  /**
   * Find section for given timestamp
   */
  private findSectionForTimestamp(
    timestamp: number,
    sections: ScriptSection[]
  ): ScriptSection | undefined {
    // Simple heuristic: divide timeline by section count
    const sectionDuration = timestamp / sections.length;
    const sectionIndex = Math.floor(timestamp / sectionDuration);
    return sections[Math.min(sectionIndex, sections.length - 1)];
  }

  /**
   * Build script metadata
   */
  private buildMetadata(
    analysisResult: AnalysisResult,
    sections: ScriptSection[],
    diagrams: Diagram[],
    voiceTimeline?: VoiceTimeline
  ): ScriptMetadata {
    return {
      repositoryUrl: analysisResult.repositoryUrl,
      repositoryName: this.extractRepoName(analysisResult.repositoryUrl),
      analysisScope: analysisResult.analysisScope.type,
      totalDuration: voiceTimeline?.totalDuration,
      sectionCount: sections.length,
      diagramCount: diagrams.length,
      hasVoice: !!voiceTimeline,
      version: '1.0.0',
    };
  }

  /**
   * Extract repository name from URL
   */
  private extractRepoName(url: string): string {
    const match = url.match(/\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    return match ? `${match[1]}/${match[2]}` : url;
  }

  /**
   * Add annotation to script
   */
  addAnnotation(
    script: InteractiveScript,
    sectionId: string,
    userId: string,
    content: string
  ): InteractiveScript {
    const annotation = {
      id: uuidv4(),
      sectionId,
      userId,
      content,
      timestamp: Date.now(),
      createdAt: new Date(),
    };

    return {
      ...script,
      annotations: [...script.annotations, annotation],
      updatedAt: new Date(),
    };
  }

  /**
   * Embed diagram in script section
   */
  embedDiagram(
    script: InteractiveScript,
    sectionId: string,
    diagram: Diagram
  ): InteractiveScript {
    const updatedDiagram = {
      ...diagram,
      sectionId,
    };

    return {
      ...script,
      diagrams: [...script.diagrams, updatedDiagram],
      updatedAt: new Date(),
    };
  }
}

export const scriptGeneratorService = new ScriptGeneratorService();
