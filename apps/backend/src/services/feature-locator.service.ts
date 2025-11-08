/**
 * Feature Locator Service
 * Maps features to code locations with context
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import {
  ASTNode,
  FeatureLocation,
  FileReference,
  CodeSnippet,
  CodeLocation,
  ArchitecturePattern,
} from '@codebase-onboarding/shared';
import * as fs from 'fs/promises';

interface FeatureCandidate {
  name: string;
  locations: CodeLocation[];
  score: number;
  type: string;
}

/**
 * Feature Locator Service
 * Identifies and maps features to specific code locations
 */
export class FeatureLocatorService {
  private readonly SNIPPET_CONTEXT_LINES = 3;
  private readonly MIN_FEATURE_SCORE = 0.3;

  /**
   * Locate features in the codebase
   */
  async locateFeatures(
    ast: ASTNode,
    architecturePatterns: ArchitecturePattern[]
  ): Promise<FeatureLocation[]> {
    const features: FeatureLocation[] = [];

    // Extract features from code structure
    const candidates = this.extractFeatureCandidates(ast);

    // Organize by functional area using architecture patterns
    const organizedCandidates = this.organizeByFunctionalArea(candidates, architecturePatterns);

    // Convert candidates to feature locations
    for (const [functionalArea, areaCandidates] of organizedCandidates.entries()) {
      for (const candidate of areaCandidates) {
        if (candidate.score >= this.MIN_FEATURE_SCORE) {
          const feature = await this.createFeatureLocation(candidate, functionalArea, ast);
          features.push(feature);
        }
      }
    }

    return features;
  }

  /**
   * Extract feature candidates from AST
   */
  private extractFeatureCandidates(ast: ASTNode): FeatureCandidate[] {
    const candidates: FeatureCandidate[] = [];

    const traverse = (node: ASTNode) => {
      // Extract features from classes
      if (
        node.type === 'ClassDeclaration' ||
        node.type === 'ClassDef' ||
        node.type === 'StructDecl'
      ) {
        candidates.push({
          name: node.name || 'Anonymous Class',
          locations: [node.location],
          score: 0.7,
          type: 'class',
        });
      }

      // Extract features from functions/methods
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'MethodDeclaration' ||
        node.type === 'FuncDecl' ||
        node.type === 'FunctionDef'
      ) {
        // Higher score for public/exported functions
        const isPublic = node.metadata?.public || node.metadata?.export;
        candidates.push({
          name: node.name || 'Anonymous Function',
          locations: [node.location],
          score: isPublic ? 0.8 : 0.5,
          type: 'function',
        });
      }

      // Extract features from modules
      if (node.type === 'Module' || node.type === 'Program') {
        const moduleName = this.extractModuleName(node.location.file);
        if (moduleName) {
          candidates.push({
            name: moduleName,
            locations: [node.location],
            score: 0.6,
            type: 'module',
          });
        }
      }

      // Extract features from API endpoints
      if (node.metadata?.endpoint || node.metadata?.route) {
        candidates.push({
          name: `API: ${node.name || 'endpoint'}`,
          locations: [node.location],
          score: 0.9,
          type: 'api-endpoint',
        });
      }

      node.children.forEach(traverse);
    };

    traverse(ast);

    // Merge duplicate features
    return this.mergeDuplicates(candidates);
  }

  /**
   * Extract module name from file path
   */
  private extractModuleName(filePath: string): string | null {
    const parts = filePath.split('/');
    const filename = parts[parts.length - 1];
    
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    // Skip index files
    if (nameWithoutExt === 'index' || nameWithoutExt === 'main') {
      return parts[parts.length - 2] || null;
    }
    
    return nameWithoutExt;
  }

  /**
   * Merge duplicate feature candidates
   */
  private mergeDuplicates(candidates: FeatureCandidate[]): FeatureCandidate[] {
    const merged = new Map<string, FeatureCandidate>();

    for (const candidate of candidates) {
      const key = candidate.name.toLowerCase();
      
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.locations.push(...candidate.locations);
        existing.score = Math.max(existing.score, candidate.score);
      } else {
        merged.set(key, { ...candidate });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Organize features by functional area
   */
  private organizeByFunctionalArea(
    candidates: FeatureCandidate[],
    architecturePatterns: ArchitecturePattern[]
  ): Map<string, FeatureCandidate[]> {
    const organized = new Map<string, FeatureCandidate[]>();

    for (const candidate of candidates) {
      const functionalArea = this.determineFunctionalArea(candidate, architecturePatterns);
      
      if (!organized.has(functionalArea)) {
        organized.set(functionalArea, []);
      }
      organized.get(functionalArea)!.push(candidate);
    }

    return organized;
  }

  /**
   * Determine functional area for a feature
   */
  private determineFunctionalArea(
    candidate: FeatureCandidate,
    architecturePatterns: ArchitecturePattern[]
  ): string {
    // Check if feature belongs to any architecture component
    for (const pattern of architecturePatterns) {
      for (const component of pattern.components) {
        for (const location of candidate.locations) {
          if (component.files.some((file) => location.file.includes(file))) {
            return component.name;
          }
        }
      }
    }

    // Fallback: determine from file path
    const firstLocation = candidate.locations[0];
    const pathParts = firstLocation.file.split('/');
    
    // Look for common directory names
    const functionalDirs = ['auth', 'user', 'payment', 'order', 'product', 'admin', 'api', 'service'];
    for (const part of pathParts) {
      if (functionalDirs.includes(part.toLowerCase())) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    }

    // Default functional area
    return 'Core';
  }

  /**
   * Create feature location with full details
   */
  private async createFeatureLocation(
    candidate: FeatureCandidate,
    functionalArea: string,
    ast: ASTNode
  ): Promise<FeatureLocation> {
    // Generate file references
    const fileReferences = await this.generateFileReferences(candidate.locations);

    // Extract entry points
    const entryPoints = this.extractEntryPoints(candidate, ast);

    // Extract code snippets
    const codeSnippets = await this.extractCodeSnippets(candidate.locations);

    // Generate description
    const description = this.generateDescription(candidate, functionalArea);

    return {
      name: candidate.name,
      description,
      functionalArea,
      files: fileReferences,
      entryPoints,
      codeSnippets,
    };
  }

  /**
   * Generate file references with line numbers
   */
  private async generateFileReferences(locations: CodeLocation[]): Promise<FileReference[]> {
    const fileMap = new Map<string, number[]>();

    // Group line numbers by file
    for (const location of locations) {
      if (!fileMap.has(location.file)) {
        fileMap.set(location.file, []);
      }
      fileMap.get(location.file)!.push(location.startLine);
      if (location.endLine !== location.startLine) {
        fileMap.get(location.file)!.push(location.endLine);
      }
    }

    // Create file references
    const references: FileReference[] = [];
    for (const [file, lineNumbers] of fileMap.entries()) {
      const uniqueLines = Array.from(new Set(lineNumbers)).sort((a, b) => a - b);
      references.push({
        path: file,
        lineNumbers: uniqueLines,
        relevance: 1.0, // Could be calculated based on various factors
      });
    }

    return references;
  }

  /**
   * Extract entry points for a feature
   */
  private extractEntryPoints(candidate: FeatureCandidate, ast: ASTNode): CodeLocation[] {
    const entryPoints: CodeLocation[] = [];

    // For API endpoints, the location itself is an entry point
    if (candidate.type === 'api-endpoint') {
      entryPoints.push(...candidate.locations);
    }

    // For classes, find public methods
    if (candidate.type === 'class') {
      for (const location of candidate.locations) {
        const node = this.findNodeAtLocation(ast, location);
        if (node) {
          const publicMethods = node.children.filter(
            (child) =>
              (child.type === 'MethodDeclaration' || child.type === 'FunctionDef') &&
              (child.metadata?.public || !child.metadata?.private)
          );
          entryPoints.push(...publicMethods.map((m) => m.location));
        }
      }
    }

    // For functions, the function itself is an entry point if exported
    if (candidate.type === 'function') {
      for (const location of candidate.locations) {
        const node = this.findNodeAtLocation(ast, location);
        if (node?.metadata?.export || node?.metadata?.public) {
          entryPoints.push(location);
        }
      }
    }

    return entryPoints;
  }

  /**
   * Extract code snippets with context
   */
  private async extractCodeSnippets(locations: CodeLocation[]): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];

    for (const location of locations) {
      try {
        const snippet = await this.extractSnippet(location);
        if (snippet) {
          snippets.push(snippet);
        }
      } catch (error) {
        console.error(`Failed to extract snippet from ${location.file}:`, error);
      }
    }

    return snippets;
  }

  /**
   * Extract a single code snippet with context
   */
  private async extractSnippet(location: CodeLocation): Promise<CodeSnippet | null> {
    try {
      const content = await fs.readFile(location.file, 'utf-8');
      const lines = content.split('\n');

      // Calculate context range
      const startLine = Math.max(0, location.startLine - 1 - this.SNIPPET_CONTEXT_LINES);
      const endLine = Math.min(lines.length, location.endLine + this.SNIPPET_CONTEXT_LINES);

      // Extract snippet
      const snippetLines = lines.slice(startLine, endLine);
      const code = snippetLines.join('\n');

      // Generate context description
      const context = this.generateSnippetContext(location, lines);

      return {
        code,
        location,
        context,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate context description for a snippet
   */
  private generateSnippetContext(location: CodeLocation, lines: string[]): string {
    const line = lines[location.startLine - 1] || '';
    
    // Try to identify what the snippet contains
    if (line.match(/class\s+\w+/)) {
      return 'Class definition';
    } else if (line.match(/function|def|fn\s+\w+/)) {
      return 'Function definition';
    } else if (line.match(/interface|type\s+\w+/)) {
      return 'Type definition';
    } else if (line.match(/import|require|from/)) {
      return 'Import statement';
    } else if (line.match(/export/)) {
      return 'Export statement';
    } else {
      return 'Code implementation';
    }
  }

  /**
   * Generate description for a feature
   */
  private generateDescription(candidate: FeatureCandidate, functionalArea: string): string {
    const typeDescriptions: Record<string, string> = {
      'class': 'A class that provides',
      'function': 'A function that handles',
      'module': 'A module that implements',
      'api-endpoint': 'An API endpoint that exposes',
    };

    const typeDesc = typeDescriptions[candidate.type] || 'A component that provides';
    return `${typeDesc} ${candidate.name} functionality in the ${functionalArea} area.`;
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
   * Search features by name or description
   */
  searchFeatures(features: FeatureLocation[], query: string): FeatureLocation[] {
    const lowerQuery = query.toLowerCase();
    
    return features.filter(
      (feature) =>
        feature.name.toLowerCase().includes(lowerQuery) ||
        feature.description.toLowerCase().includes(lowerQuery) ||
        feature.functionalArea.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get features by functional area
   */
  getFeaturesByArea(features: FeatureLocation[], area: string): FeatureLocation[] {
    return features.filter((feature) => feature.functionalArea === area);
  }

  /**
   * Get all functional areas
   */
  getFunctionalAreas(features: FeatureLocation[]): string[] {
    const areas = new Set<string>();
    features.forEach((feature) => areas.add(feature.functionalArea));
    return Array.from(areas).sort();
  }
}

export const featureLocatorService = new FeatureLocatorService();
