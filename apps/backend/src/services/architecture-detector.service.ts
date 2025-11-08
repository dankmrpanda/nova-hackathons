/**
 * Architecture Pattern Detector Service
 * Detects architectural patterns in codebases
 * Requirements: 6.3, 6.4
 */

import {
  ASTNode,
  ArchitecturePattern,
  ArchitecturePatternType,
  Component,
  Relationship,
  CodeLocation,
} from '@codebase-onboarding/shared';

interface PatternIndicator {
  pattern: ArchitecturePatternType;
  score: number;
  evidence: string[];
}

/**
 * Architecture Pattern Detector Service
 * Identifies architectural patterns like MVC, microservices, layered, event-driven
 */
export class ArchitectureDetectorService {
  /**
   * Detect architecture patterns from unified AST
   */
  async detectPatterns(ast: ASTNode): Promise<ArchitecturePattern[]> {
    const patterns: ArchitecturePattern[] = [];

    // Detect each pattern type
    const mvcPattern = this.detectMVC(ast);
    if (mvcPattern) patterns.push(mvcPattern);

    const microservicesPattern = this.detectMicroservices(ast);
    if (microservicesPattern) patterns.push(microservicesPattern);

    const layeredPattern = this.detectLayeredArchitecture(ast);
    if (layeredPattern) patterns.push(layeredPattern);

    const eventDrivenPattern = this.detectEventDriven(ast);
    if (eventDrivenPattern) patterns.push(eventDrivenPattern);

    // Sort by confidence
    patterns.sort((a, b) => b.confidence - a.confidence);

    return patterns;
  }

  /**
   * Detect MVC (Model-View-Controller) pattern
   */
  private detectMVC(ast: ASTNode): ArchitecturePattern | null {
    const indicators: PatternIndicator = {
      pattern: 'mvc',
      score: 0,
      evidence: [],
    };

    const components: Component[] = [];
    const relationships: Relationship[] = [];

    // Look for model directories/files
    const modelFiles = this.findFilesByPattern(ast, /model|entity|schema/i);
    if (modelFiles.length > 0) {
      indicators.score += 0.3;
      indicators.evidence.push(`Found ${modelFiles.length} model files`);
      components.push({
        name: 'Models',
        type: 'model',
        files: modelFiles.map((f) => f.location.file),
        responsibilities: ['Data representation', 'Business logic'],
        location: modelFiles[0].location,
      });
    }

    // Look for view directories/files
    const viewFiles = this.findFilesByPattern(ast, /view|template|component|page/i);
    if (viewFiles.length > 0) {
      indicators.score += 0.3;
      indicators.evidence.push(`Found ${viewFiles.length} view files`);
      components.push({
        name: 'Views',
        type: 'view',
        files: viewFiles.map((f) => f.location.file),
        responsibilities: ['UI rendering', 'User interaction'],
        location: viewFiles[0].location,
      });
    }

    // Look for controller directories/files
    const controllerFiles = this.findFilesByPattern(ast, /controller|handler|route/i);
    if (controllerFiles.length > 0) {
      indicators.score += 0.3;
      indicators.evidence.push(`Found ${controllerFiles.length} controller files`);
      components.push({
        name: 'Controllers',
        type: 'controller',
        files: controllerFiles.map((f) => f.location.file),
        responsibilities: ['Request handling', 'Business logic coordination'],
        location: controllerFiles[0].location,
      });
    }

    // Check for MVC framework indicators
    const frameworkIndicators = this.findFilesByPattern(
      ast,
      /express|django|rails|spring|laravel|asp\.net/i
    );
    if (frameworkIndicators.length > 0) {
      indicators.score += 0.1;
      indicators.evidence.push('MVC framework detected');
    }

    // Need at least 2 of the 3 components for MVC
    if (components.length >= 2 && indicators.score >= 0.5) {
      // Add relationships
      if (components.some((c) => c.type === 'controller') && components.some((c) => c.type === 'model')) {
        relationships.push({
          from: 'Controllers',
          to: 'Models',
          type: 'depends-on',
          description: 'Controllers use models for data access',
        });
      }
      if (components.some((c) => c.type === 'controller') && components.some((c) => c.type === 'view')) {
        relationships.push({
          from: 'Controllers',
          to: 'Views',
          type: 'depends-on',
          description: 'Controllers render views',
        });
      }

      return {
        type: 'mvc',
        confidence: Math.min(indicators.score, 1.0),
        components,
        relationships,
        explanation: `MVC pattern detected with ${components.length} components. ${indicators.evidence.join('. ')}.`,
      };
    }

    return null;
  }

  /**
   * Detect Microservices architecture
   */
  private detectMicroservices(ast: ASTNode): ArchitecturePattern | null {
    const indicators: PatternIndicator = {
      pattern: 'microservices',
      score: 0,
      evidence: [],
    };

    const components: Component[] = [];
    const relationships: Relationship[] = [];

    // Look for service directories
    const serviceFiles = this.findFilesByPattern(ast, /service|microservice/i);
    if (serviceFiles.length > 2) {
      indicators.score += 0.3;
      indicators.evidence.push(`Found ${serviceFiles.length} service files`);
    }

    // Look for API gateway patterns
    const gatewayFiles = this.findFilesByPattern(ast, /gateway|proxy|router/i);
    if (gatewayFiles.length > 0) {
      indicators.score += 0.2;
      indicators.evidence.push('API gateway pattern detected');
      components.push({
        name: 'API Gateway',
        type: 'gateway',
        files: gatewayFiles.map((f) => f.location.file),
        responsibilities: ['Request routing', 'Load balancing'],
        location: gatewayFiles[0].location,
      });
    }

    // Look for message queue/event bus
    const messagingFiles = this.findFilesByPattern(ast, /queue|kafka|rabbitmq|pubsub|event-bus/i);
    if (messagingFiles.length > 0) {
      indicators.score += 0.2;
      indicators.evidence.push('Message queue/event bus detected');
    }

    // Look for Docker/Kubernetes configs
    const containerFiles = this.findFilesByPattern(ast, /dockerfile|docker-compose|kubernetes|k8s/i);
    if (containerFiles.length > 0) {
      indicators.score += 0.2;
      indicators.evidence.push('Container orchestration detected');
    }

    // Look for independent databases per service
    const dbFiles = this.findFilesByPattern(ast, /database|db|repository/i);
    if (dbFiles.length > 2) {
      indicators.score += 0.1;
      indicators.evidence.push('Multiple database access patterns');
    }

    if (indicators.score >= 0.5) {
      // Group services as components
      const serviceGroups = this.groupServiceFiles(serviceFiles);
      serviceGroups.forEach((group, index) => {
        components.push({
          name: `Service ${index + 1}`,
          type: 'microservice',
          files: group,
          responsibilities: ['Independent business capability'],
          location: { file: group[0], startLine: 1, endLine: 1 },
        });
      });

      return {
        type: 'microservices',
        confidence: Math.min(indicators.score, 1.0),
        components,
        relationships,
        explanation: `Microservices architecture detected. ${indicators.evidence.join('. ')}.`,
      };
    }

    return null;
  }

  /**
   * Detect Layered architecture
   */
  private detectLayeredArchitecture(ast: ASTNode): ArchitecturePattern | null {
    const indicators: PatternIndicator = {
      pattern: 'layered',
      score: 0,
      evidence: [],
    };

    const components: Component[] = [];
    const relationships: Relationship[] = [];

    // Look for presentation layer
    const presentationFiles = this.findFilesByPattern(ast, /ui|view|component|page|frontend/i);
    if (presentationFiles.length > 0) {
      indicators.score += 0.25;
      indicators.evidence.push('Presentation layer detected');
      components.push({
        name: 'Presentation Layer',
        type: 'presentation',
        files: presentationFiles.map((f) => f.location.file),
        responsibilities: ['User interface', 'User interaction'],
        location: presentationFiles[0].location,
      });
    }

    // Look for business logic layer
    const businessFiles = this.findFilesByPattern(ast, /service|business|logic|domain/i);
    if (businessFiles.length > 0) {
      indicators.score += 0.25;
      indicators.evidence.push('Business logic layer detected');
      components.push({
        name: 'Business Logic Layer',
        type: 'business',
        files: businessFiles.map((f) => f.location.file),
        responsibilities: ['Business rules', 'Domain logic'],
        location: businessFiles[0].location,
      });
    }

    // Look for data access layer
    const dataFiles = this.findFilesByPattern(ast, /repository|dao|data-access|persistence/i);
    if (dataFiles.length > 0) {
      indicators.score += 0.25;
      indicators.evidence.push('Data access layer detected');
      components.push({
        name: 'Data Access Layer',
        type: 'data-access',
        files: dataFiles.map((f) => f.location.file),
        responsibilities: ['Database operations', 'Data persistence'],
        location: dataFiles[0].location,
      });
    }

    // Look for database layer
    const dbFiles = this.findFilesByPattern(ast, /database|db|schema|migration/i);
    if (dbFiles.length > 0) {
      indicators.score += 0.25;
      indicators.evidence.push('Database layer detected');
      components.push({
        name: 'Database Layer',
        type: 'database',
        files: dbFiles.map((f) => f.location.file),
        responsibilities: ['Data storage'],
        location: dbFiles[0].location,
      });
    }

    if (components.length >= 3 && indicators.score >= 0.6) {
      // Add layer relationships (top-down dependencies)
      for (let i = 0; i < components.length - 1; i++) {
        relationships.push({
          from: components[i].name,
          to: components[i + 1].name,
          type: 'depends-on',
          description: `${components[i].name} depends on ${components[i + 1].name}`,
        });
      }

      return {
        type: 'layered',
        confidence: Math.min(indicators.score, 1.0),
        components,
        relationships,
        explanation: `Layered architecture detected with ${components.length} layers. ${indicators.evidence.join('. ')}.`,
      };
    }

    return null;
  }

  /**
   * Detect Event-Driven architecture
   */
  private detectEventDriven(ast: ASTNode): ArchitecturePattern | null {
    const indicators: PatternIndicator = {
      pattern: 'event-driven',
      score: 0,
      evidence: [],
    };

    const components: Component[] = [];
    const relationships: Relationship[] = [];

    // Look for event emitters/publishers
    const publisherFiles = this.findFilesByPattern(ast, /emit|publish|dispatch|trigger/i);
    if (publisherFiles.length > 0) {
      indicators.score += 0.3;
      indicators.evidence.push(`Found ${publisherFiles.length} event publishers`);
      components.push({
        name: 'Event Publishers',
        type: 'publisher',
        files: publisherFiles.map((f) => f.location.file),
        responsibilities: ['Emit events', 'Trigger actions'],
        location: publisherFiles[0].location,
      });
    }

    // Look for event listeners/subscribers
    const subscriberFiles = this.findFilesByPattern(ast, /listen|subscribe|on\(|handler/i);
    if (subscriberFiles.length > 0) {
      indicators.score += 0.3;
      indicators.evidence.push(`Found ${subscriberFiles.length} event subscribers`);
      components.push({
        name: 'Event Subscribers',
        type: 'subscriber',
        files: subscriberFiles.map((f) => f.location.file),
        responsibilities: ['Handle events', 'React to changes'],
        location: subscriberFiles[0].location,
      });
    }

    // Look for event bus/broker
    const eventBusFiles = this.findFilesByPattern(
      ast,
      /event-bus|event-emitter|message-broker|kafka|rabbitmq/i
    );
    if (eventBusFiles.length > 0) {
      indicators.score += 0.3;
      indicators.evidence.push('Event bus/broker detected');
      components.push({
        name: 'Event Bus',
        type: 'event-bus',
        files: eventBusFiles.map((f) => f.location.file),
        responsibilities: ['Route events', 'Decouple components'],
        location: eventBusFiles[0].location,
      });
    }

    // Look for event definitions
    const eventFiles = this.findFilesByPattern(ast, /event|message|notification/i);
    if (eventFiles.length > 2) {
      indicators.score += 0.1;
      indicators.evidence.push('Event definitions detected');
    }

    if (indicators.score >= 0.5) {
      // Add relationships
      if (components.some((c) => c.type === 'publisher') && components.some((c) => c.type === 'event-bus')) {
        relationships.push({
          from: 'Event Publishers',
          to: 'Event Bus',
          type: 'calls',
          description: 'Publishers send events to event bus',
        });
      }
      if (components.some((c) => c.type === 'event-bus') && components.some((c) => c.type === 'subscriber')) {
        relationships.push({
          from: 'Event Bus',
          to: 'Event Subscribers',
          type: 'calls',
          description: 'Event bus delivers events to subscribers',
        });
      }

      return {
        type: 'event-driven',
        confidence: Math.min(indicators.score, 1.0),
        components,
        relationships,
        explanation: `Event-driven architecture detected. ${indicators.evidence.join('. ')}.`,
      };
    }

    return null;
  }

  /**
   * Find files matching a pattern in the AST
   */
  private findFilesByPattern(ast: ASTNode, pattern: RegExp): ASTNode[] {
    const matches: ASTNode[] = [];

    const traverse = (node: ASTNode) => {
      if (node.location.file.match(pattern) || node.name?.match(pattern)) {
        matches.push(node);
      }
      node.children.forEach(traverse);
    };

    traverse(ast);
    return matches;
  }

  /**
   * Group service files by directory
   */
  private groupServiceFiles(files: ASTNode[]): string[][] {
    const groups = new Map<string, string[]>();

    files.forEach((file) => {
      const dir = file.location.file.split('/').slice(0, -1).join('/');
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(file.location.file);
    });

    return Array.from(groups.values());
  }

  /**
   * Analyze relationships between components
   */
  analyzeComponentRelationships(components: Component[], ast: ASTNode): Relationship[] {
    const relationships: Relationship[] = [];

    // Analyze imports and dependencies
    for (let i = 0; i < components.length; i++) {
      for (let j = 0; j < components.length; j++) {
        if (i !== j) {
          const hasImport = this.checkImportRelationship(components[i], components[j], ast);
          if (hasImport) {
            relationships.push({
              from: components[i].name,
              to: components[j].name,
              type: 'imports',
              description: `${components[i].name} imports from ${components[j].name}`,
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Check if one component imports from another
   */
  private checkImportRelationship(from: Component, to: Component, ast: ASTNode): boolean {
    // Simplified check - in production, analyze actual import statements
    const fromFiles = new Set(from.files);
    const toFiles = new Set(to.files);

    // Check if any file in 'from' imports any file in 'to'
    for (const file of fromFiles) {
      const node = this.findNodeByFile(ast, file);
      if (node) {
        const imports = node.children.filter((child) => child.type.includes('Import'));
        for (const imp of imports) {
          const importPath = (imp.metadata?.source as string) || imp.name || '';
          if (importPath && Array.from(toFiles).some((f) => f.includes(importPath))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Find AST node by file path
   */
  private findNodeByFile(ast: ASTNode, file: string): ASTNode | null {
    if (ast.location.file === file) {
      return ast;
    }

    for (const child of ast.children) {
      const found = this.findNodeByFile(child, file);
      if (found) return found;
    }

    return null;
  }
}

export const architectureDetectorService = new ArchitectureDetectorService();
