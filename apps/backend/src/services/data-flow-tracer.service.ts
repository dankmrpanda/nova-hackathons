// @ts-nocheck
/**
 * Data Flow Tracer Service
 * Traces data flow through the application with depth limits
 * Requirements: 8.1, 8.2, 8.3, 8.6, 8.7
 */

import {
  ASTNode,
  DataFlowPath,
  DataFlowStep,
  DataStructure,
  DataField,
  EntryPoint,
  CodeLocation,
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
} from '@codebase-onboarding/shared';

/**
 * Data Flow Tracer Service
 * Identifies entry points and traces data flow through the application
 */
export class DataFlowTracerService {
  private readonly MAX_DEPTH = 10;
  private readonly MAX_TIME_PER_ENTRY_POINT = 60000; // 60 seconds

  /**
   * Trace data flow from all entry points
   */
  async traceDataFlow(ast: ASTNode): Promise<DataFlowPath[]> {
    const entryPoints = this.identifyEntryPoints(ast);
    const dataFlowPaths: DataFlowPath[] = [];

    for (const entryPoint of entryPoints) {
      const startTime = Date.now();
      try {
        const path = await this.traceFromEntryPoint(entryPoint, ast);
        dataFlowPaths.push(path);

        // Check time limit
        if (Date.now() - startTime > this.MAX_TIME_PER_ENTRY_POINT) {
          console.warn(`Time limit exceeded for entry point ${entryPoint.name}, moving to next`);
          break;
        }
      } catch (error) {
        console.error(`Error tracing from entry point ${entryPoint.name}:`, error);
      }
    }

    return dataFlowPaths;
  }

  /**
   * Identify entry points in the codebase
   */
  identifyEntryPoints(ast: ASTNode): EntryPoint[] {
    const entryPoints: EntryPoint[] = [];

    // Find API endpoints
    entryPoints.push(...this.findAPIEndpoints(ast));

    // Find event handlers
    entryPoints.push(...this.findEventHandlers(ast));

    // Find main functions
    entryPoints.push(...this.findMainFunctions(ast));

    // Find CLI commands
    entryPoints.push(...this.findCLICommands(ast));

    return entryPoints;
  }

  /**
   * Find API endpoints (REST, GraphQL, etc.)
   */
  private findAPIEndpoints(ast: ASTNode): EntryPoint[] {
    const endpoints: EntryPoint[] = [];

    const traverse = (node: ASTNode) => {
      // Look for Express-style routes
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'MethodDeclaration' ||
        node.type === 'FuncDecl'
      ) {
        const name = node.name || 'anonymous';

        // Check for route patterns
        if (
          name.match(/get|post|put|delete|patch|route|endpoint/i) ||
          node.metadata?.decorator?.includes('route') ||
          node.metadata?.decorator?.includes('api')
        ) {
          endpoints.push({
            type: 'api-endpoint',
            name,
            location: node.location,
            parameters: this.extractParameters(node),
          });
        }
      }

      node.children.forEach(traverse);
    };

    traverse(ast);
    return endpoints;
  }

  /**
   * Find event handlers
   */
  private findEventHandlers(ast: ASTNode): EntryPoint[] {
    const handlers: EntryPoint[] = [];

    const traverse = (node: ASTNode) => {
      const name = node.name || 'anonymous';

      // Look for event handler patterns
      if (
        name.match(/on[A-Z]|handle|listener|subscriber/i) ||
        node.metadata?.decorator?.includes('event') ||
        node.metadata?.decorator?.includes('listener')
      ) {
        handlers.push({
          type: 'event-handler',
          name,
          location: node.location,
          parameters: this.extractParameters(node),
        });
      }

      node.children.forEach(traverse);
    };

    traverse(ast);
    return handlers;
  }

  /**
   * Find main functions
   */
  private findMainFunctions(ast: ASTNode): EntryPoint[] {
    const mainFunctions: EntryPoint[] = [];

    const traverse = (node: ASTNode) => {
      const name = node.name || '';

      // Look for main function patterns
      if (name === 'main' || name === 'Main' || name === '__main__') {
        mainFunctions.push({
          type: 'main-function',
          name,
          location: node.location,
          parameters: this.extractParameters(node),
        });
      }

      node.children.forEach(traverse);
    };

    traverse(ast);
    return mainFunctions;
  }

  /**
   * Find CLI commands
   */
  private findCLICommands(ast: ASTNode): EntryPoint[] {
    const commands: EntryPoint[] = [];

    const traverse = (node: ASTNode) => {
      const name = node.name || '';

      // Look for CLI command patterns
      if (
        name.match(/command|cli|cmd/i) ||
        node.metadata?.decorator?.includes('command') ||
        node.metadata?.decorator?.includes('cli')
      ) {
        commands.push({
          type: 'cli-command',
          name,
          location: node.location,
          parameters: this.extractParameters(node),
        });
      }

      node.children.forEach(traverse);
    };

    traverse(ast);
    return commands;
  }

  /**
   * Extract parameters from a function node
   */
  private extractParameters(node: ASTNode): string[] {
    // Simplified - in production, parse actual parameter list
    return node.metadata?.parameters || [];
  }

  /**
   * Trace data flow from a specific entry point
   */
  private async traceFromEntryPoint(entryPoint: EntryPoint, ast: ASTNode): Promise<DataFlowPath> {
    const steps: DataFlowStep[] = [];
    const dataStructures: DataStructure[] = [];
    const visited = new Set<string>();

    // Build call graph
    const callGraph = this.buildCallGraph(ast);

    // Start tracing from entry point
    await this.traceRecursive(
      entryPoint.location,
      callGraph,
      ast,
      steps,
      dataStructures,
      visited,
      0
    );

    return {
      entryPoint: entryPoint.location,
      steps,
      dataStructures,
      depth: steps.length,
    };
  }

  /**
   * Recursive data flow tracing with depth limit
   */
  private async traceRecursive(
    location: CodeLocation,
    callGraph: CallGraph,
    ast: ASTNode,
    steps: DataFlowStep[],
    dataStructures: DataStructure[],
    visited: Set<string>,
    depth: number
  ): Promise<void> {
    // Check depth limit
    if (depth >= this.MAX_DEPTH) {
      console.warn(`Max depth ${this.MAX_DEPTH} reached, truncating trace`);
      return;
    }

    const locationKey = `${location.file}:${location.startLine}`;
    if (visited.has(locationKey)) {
      return; // Avoid cycles
    }
    visited.add(locationKey);

    // Find the node at this location
    const node = this.findNodeAtLocation(ast, location);
    if (!node) return;

    // Analyze data transformations at this node
    const step = this.analyzeDataTransformation(node, location);
    steps.push(step);

    // Extract data structures used
    const structures = this.extractDataStructures(node);
    dataStructures.push(...structures);

    // Find function calls from this node
    const calls = this.findFunctionCalls(node, callGraph);

    // Recursively trace each call
    for (const call of calls) {
      const callNode = callGraph.nodes.find((n) => n.id === call.to);
      if (callNode) {
        await this.traceRecursive(
          callNode.location,
          callGraph,
          ast,
          steps,
          dataStructures,
          visited,
          depth + 1
        );
      }
    }
  }

  /**
   * Build call graph from AST
   */
  buildCallGraph(ast: ASTNode): CallGraph {
    const nodes: CallGraphNode[] = [];
    const edges: CallGraphEdge[] = [];
    const nodeMap = new Map<string, CallGraphNode>();

    // First pass: collect all function/method nodes
    const collectNodes = (node: ASTNode) => {
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'MethodDeclaration' ||
        node.type === 'FuncDecl' ||
        node.type === 'FunctionDef'
      ) {
        const id = `${node.location.file}:${node.name || 'anonymous'}:${node.location.startLine}`;
        const graphNode: CallGraphNode = {
          id,
          name: node.name || 'anonymous',
          location: node.location,
          type: node.type.includes('Method') ? 'method' : 'function',
        };
        nodes.push(graphNode);
        nodeMap.set(id, graphNode);
      }

      node.children.forEach(collectNodes);
    };

    collectNodes(ast);

    // Second pass: find function calls and create edges
    const findCalls = (node: ASTNode, currentFunction?: string) => {
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'MethodDeclaration' ||
        node.type === 'FuncDecl' ||
        node.type === 'FunctionDef'
      ) {
        currentFunction = `${node.location.file}:${node.name || 'anonymous'}:${node.location.startLine}`;
      }

      // Look for call expressions
      if (node.type === 'CallExpression' || node.name?.includes('(')) {
        const calledName = node.name?.split('(')[0] || '';
        if (currentFunction && calledName) {
          // Find the target node
          const targetNode = Array.from(nodeMap.values()).find((n) => n.name === calledName);
          if (targetNode) {
            edges.push({
              from: currentFunction,
              to: targetNode.id,
              callType: 'direct',
              location: node.location,
            });
          }
        }
      }

      node.children.forEach((child) => findCalls(child, currentFunction));
    };

    findCalls(ast);

    return {
      nodes,
      edges,
      maxDepth: this.MAX_DEPTH,
    };
  }

  /**
   * Find function calls from a node using call graph
   */
  private findFunctionCalls(node: ASTNode, callGraph: CallGraph): CallGraphEdge[] {
    const nodeId = `${node.location.file}:${node.name || 'anonymous'}:${node.location.startLine}`;
    return callGraph.edges.filter((edge) => edge.from === nodeId);
  }

  /**
   * Analyze data transformation at a node
   */
  private analyzeDataTransformation(node: ASTNode, location: CodeLocation): DataFlowStep {
    // Simplified analysis - in production, perform deeper semantic analysis
    const operation = node.type;
    const dataIn: string[] = [];
    const dataOut: string[] = [];
    let transformation: string | undefined;

    // Look for variable assignments
    if (node.type.includes('Assignment') || node.type.includes('Declaration')) {
      transformation = 'Variable assignment';
      if (node.name) dataOut.push(node.name);
    }

    // Look for function calls
    if (node.type.includes('Call')) {
      transformation = `Function call: ${node.name}`;
    }

    // Look for return statements
    if (node.type.includes('Return')) {
      transformation = 'Return value';
    }

    return {
      location,
      operation,
      transformation,
      dataIn,
      dataOut,
    };
  }

  /**
   * Extract data structures from a node
   */
  private extractDataStructures(node: ASTNode): DataStructure[] {
    const structures: DataStructure[] = [];

    // Look for class/struct/interface definitions
    if (
      node.type === 'ClassDeclaration' ||
      node.type === 'ClassDef' ||
      node.type === 'StructDecl' ||
      node.type === 'InterfaceDeclaration'
    ) {
      const fields = this.extractFields(node);
      structures.push({
        name: node.name || 'Anonymous',
        type: node.type,
        fields,
        location: node.location,
        relationships: [],
      });
    }

    // Recursively check children
    node.children.forEach((child) => {
      structures.push(...this.extractDataStructures(child));
    });

    return structures;
  }

  /**
   * Extract fields from a class/struct node
   */
  private extractFields(node: ASTNode): DataField[] {
    const fields: DataField[] = [];

    node.children.forEach((child) => {
      if (
        child.type === 'PropertyDeclaration' ||
        child.type === 'FieldDeclaration' ||
        child.type === 'Attribute'
      ) {
        fields.push({
          name: child.name || 'unknown',
          type: child.metadata?.type || 'any',
          optional: child.metadata?.optional || false,
        });
      }
    });

    return fields;
  }

  /**
   * Find AST node at a specific location
   */
  private findNodeAtLocation(ast: ASTNode, location: CodeLocation): ASTNode | null {
    if (
      ast.location.file === location.file &&
      ast.location.startLine === location.startLine
    ) {
      return ast;
    }

    for (const child of ast.children) {
      const found = this.findNodeAtLocation(child, location);
      if (found) return found;
    }

    return null;
  }

  /**
   * Map data structure relationships
   */
  mapDataStructureRelationships(dataStructures: DataStructure[], ast: ASTNode): void {
    for (const structure of dataStructures) {
      // Find inheritance relationships
      const node = this.findNodeAtLocation(ast, structure.location);
      if (node) {
        // Look for extends/implements
        const extendsMatch = node.metadata?.extends;
        if (extendsMatch) {
          structure.relationships.push(`extends ${extendsMatch}`);
        }

        const implementsMatch = node.metadata?.implements;
        if (implementsMatch) {
          structure.relationships.push(`implements ${implementsMatch}`);
        }

        // Look for field type relationships
        structure.fields.forEach((field) => {
          const relatedStructure = dataStructures.find((s) => s.name === field.type);
          if (relatedStructure) {
            structure.relationships.push(`has-a ${field.type}`);
          }
        });
      }
    }
  }
}

export const dataFlowTracerService = new DataFlowTracerService();

