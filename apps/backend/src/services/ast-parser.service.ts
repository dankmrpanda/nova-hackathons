/**
 * AST Parser Service
 * Multi-language AST parsing with fallback pattern matching
 * Requirements: 6.1, 6.2
 */

import {
  SourceFile,
  ASTNode,
  ParseResult,
  SupportedLanguage,
  CodeLocation,
  PatternAnalysis,
  DetectedPattern,
} from '@codebase-onboarding/shared';

/**
 * AST Parser Service
 * Provides multi-language AST parsing with fallback to pattern matching
 */
export class ASTParserService {
  private readonly supportedLanguages: Set<SupportedLanguage> = new Set([
    'javascript',
    'typescript',
    'python',
    'java',
    'go',
    'rust',
    'cpp',
  ]);

  /**
   * Parse multiple source files
   */
  async parseFiles(files: SourceFile[]): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    for (const file of files) {
      try {
        const result = await this.parseFile(file);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown parsing error',
          fallbackUsed: false,
          language: file.language,
        });
      }
    }

    return results;
  }

  /**
   * Parse a single source file
   */
  async parseFile(file: SourceFile): Promise<ParseResult> {
    const language = this.detectLanguage(file);

    // Try AST parsing first
    if (this.supportedLanguages.has(language)) {
      try {
        const ast = await this.parseAST(file, language);
        return {
          success: true,
          ast,
          fallbackUsed: false,
          language,
        };
      } catch (error) {
        // Fall back to pattern matching
        console.warn(`AST parsing failed for ${file.path}, using fallback`, error);
        return this.fallbackParse(file, language);
      }
    }

    // Use fallback for unsupported languages
    return this.fallbackParse(file, language);
  }

  /**
   * Detect language from file extension and content
   */
  private detectLanguage(file: SourceFile): SupportedLanguage {
    if (file.language !== 'unknown') {
      return file.language;
    }

    const ext = file.path.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, SupportedLanguage> = {
      js: 'javascript',
      jsx: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      cc: 'cpp',
      cxx: 'cpp',
      h: 'cpp',
      hpp: 'cpp',
    };

    return languageMap[ext || ''] || 'unknown';
  }

  /**
   * Parse file using AST parser
   * In production, this would use tree-sitter or language-specific parsers
   */
  private async parseAST(file: SourceFile, language: SupportedLanguage): Promise<ASTNode> {
    // This is a simplified implementation
    // In production, use tree-sitter with language-specific grammars
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.parseJavaScriptAST(file);
      case 'python':
        return this.parsePythonAST(file);
      case 'java':
        return this.parseJavaAST(file);
      case 'go':
        return this.parseGoAST(file);
      case 'rust':
        return this.parseRustAST(file);
      case 'cpp':
        return this.parseCppAST(file);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Parse JavaScript/TypeScript using regex-based approach
   * In production, use @babel/parser or typescript compiler API
   */
  private parseJavaScriptAST(file: SourceFile): ASTNode {
    const root: ASTNode = {
      type: 'Program',
      location: {
        file: file.path,
        startLine: 1,
        endLine: file.content.split('\n').length,
      },
      children: [],
      metadata: { language: file.language },
    };

    // Extract functions
    const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:async\s*)?\([^)]*\)/g;
    let match;
    let lineNumber = 1;

    const lines = file.content.split('\n');
    lines.forEach((line, index) => {
      const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:async\s*)?\([^)]*\)/);
      if (funcMatch) {
        root.children.push({
          type: 'FunctionDeclaration',
          name: funcMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: { async: line.includes('async') },
        });
      }

      // Extract classes
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        root.children.push({
          type: 'ClassDeclaration',
          name: classMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }

      // Extract imports
      const importMatch = line.match(/import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        root.children.push({
          type: 'ImportDeclaration',
          name: importMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: { source: importMatch[1] },
        });
      }
    });

    return root;
  }

  /**
   * Parse Python using regex-based approach
   * In production, use ast module or tree-sitter-python
   */
  private parsePythonAST(file: SourceFile): ASTNode {
    const root: ASTNode = {
      type: 'Module',
      location: {
        file: file.path,
        startLine: 1,
        endLine: file.content.split('\n').length,
      },
      children: [],
      metadata: { language: 'python' },
    };

    const lines = file.content.split('\n');
    lines.forEach((line, index) => {
      // Extract function definitions
      const funcMatch = line.match(/^(?:\s*)def\s+(\w+)\s*\(/);
      if (funcMatch) {
        root.children.push({
          type: 'FunctionDef',
          name: funcMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }

      // Extract class definitions
      const classMatch = line.match(/^(?:\s*)class\s+(\w+)/);
      if (classMatch) {
        root.children.push({
          type: 'ClassDef',
          name: classMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }

      // Extract imports
      const importMatch = line.match(/^(?:\s*)(?:from\s+(\S+)\s+)?import\s+(.+)/);
      if (importMatch) {
        root.children.push({
          type: 'Import',
          name: importMatch[2].split(',')[0].trim(),
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: { from: importMatch[1] },
        });
      }
    });

    return root;
  }

  /**
   * Parse Java using regex-based approach
   */
  private parseJavaAST(file: SourceFile): ASTNode {
    const root: ASTNode = {
      type: 'CompilationUnit',
      location: {
        file: file.path,
        startLine: 1,
        endLine: file.content.split('\n').length,
      },
      children: [],
      metadata: { language: 'java' },
    };

    const lines = file.content.split('\n');
    lines.forEach((line, index) => {
      // Extract class declarations
      const classMatch = line.match(/(?:public|private|protected)?\s*class\s+(\w+)/);
      if (classMatch) {
        root.children.push({
          type: 'ClassDeclaration',
          name: classMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }

      // Extract method declarations
      const methodMatch = line.match(/(?:public|private|protected)?\s+(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/);
      if (methodMatch && !line.includes('class')) {
        root.children.push({
          type: 'MethodDeclaration',
          name: methodMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }
    });

    return root;
  }

  /**
   * Parse Go using regex-based approach
   */
  private parseGoAST(file: SourceFile): ASTNode {
    const root: ASTNode = {
      type: 'File',
      location: {
        file: file.path,
        startLine: 1,
        endLine: file.content.split('\n').length,
      },
      children: [],
      metadata: { language: 'go' },
    };

    const lines = file.content.split('\n');
    lines.forEach((line, index) => {
      // Extract function declarations
      const funcMatch = line.match(/func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/);
      if (funcMatch) {
        root.children.push({
          type: 'FuncDecl',
          name: funcMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }

      // Extract type declarations
      const typeMatch = line.match(/type\s+(\w+)\s+(?:struct|interface)/);
      if (typeMatch) {
        root.children.push({
          type: 'TypeDecl',
          name: typeMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }
    });

    return root;
  }

  /**
   * Parse Rust using regex-based approach
   */
  private parseRustAST(file: SourceFile): ASTNode {
    const root: ASTNode = {
      type: 'Crate',
      location: {
        file: file.path,
        startLine: 1,
        endLine: file.content.split('\n').length,
      },
      children: [],
      metadata: { language: 'rust' },
    };

    const lines = file.content.split('\n');
    lines.forEach((line, index) => {
      // Extract function declarations
      const funcMatch = line.match(/(?:pub\s+)?fn\s+(\w+)\s*\(/);
      if (funcMatch) {
        root.children.push({
          type: 'FnDecl',
          name: funcMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: { public: line.includes('pub') },
        });
      }

      // Extract struct declarations
      const structMatch = line.match(/(?:pub\s+)?struct\s+(\w+)/);
      if (structMatch) {
        root.children.push({
          type: 'StructDecl',
          name: structMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: { public: line.includes('pub') },
        });
      }
    });

    return root;
  }

  /**
   * Parse C++ using regex-based approach
   */
  private parseCppAST(file: SourceFile): ASTNode {
    const root: ASTNode = {
      type: 'TranslationUnit',
      location: {
        file: file.path,
        startLine: 1,
        endLine: file.content.split('\n').length,
      },
      children: [],
      metadata: { language: 'cpp' },
    };

    const lines = file.content.split('\n');
    lines.forEach((line, index) => {
      // Extract class declarations
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        root.children.push({
          type: 'ClassDecl',
          name: classMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }

      // Extract function declarations
      const funcMatch = line.match(/(?:\w+)\s+(\w+)\s*\([^)]*\)\s*(?:{|;)/);
      if (funcMatch && !line.includes('class')) {
        root.children.push({
          type: 'FunctionDecl',
          name: funcMatch[1],
          location: {
            file: file.path,
            startLine: index + 1,
            endLine: index + 1,
          },
          children: [],
          metadata: {},
        });
      }
    });

    return root;
  }

  /**
   * Fallback pattern matching for unsupported languages or parsing failures
   */
  private fallbackParse(file: SourceFile, language: SupportedLanguage): ParseResult {
    const patterns = this.detectPatterns(file);

    // Convert patterns to simplified AST
    const ast: ASTNode = {
      type: 'Program',
      location: {
        file: file.path,
        startLine: 1,
        endLine: file.content.split('\n').length,
      },
      children: patterns.map((pattern) => ({
        type: pattern.type,
        name: pattern.name,
        location: pattern.locations[0] || {
          file: file.path,
          startLine: 1,
          endLine: 1,
        },
        children: [],
        metadata: { confidence: pattern.confidence, fallback: true },
      })),
      metadata: { fallback: true },
    };

    return {
      success: true,
      ast,
      fallbackUsed: true,
      language,
    };
  }

  /**
   * Detect patterns using heuristics
   */
  private detectPatterns(file: SourceFile): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = file.content.split('\n');

    // Detect function-like patterns
    lines.forEach((line, index) => {
      // Generic function pattern
      if (line.match(/\w+\s*\([^)]*\)\s*{/)) {
        const match = line.match(/(\w+)\s*\(/);
        if (match) {
          patterns.push({
            type: 'Function',
            name: match[1],
            locations: [
              {
                file: file.path,
                startLine: index + 1,
                endLine: index + 1,
              },
            ],
            confidence: 0.7,
            description: 'Function-like pattern detected',
          });
        }
      }

      // Generic class pattern
      if (line.match(/class\s+\w+/)) {
        const match = line.match(/class\s+(\w+)/);
        if (match) {
          patterns.push({
            type: 'Class',
            name: match[1],
            locations: [
              {
                file: file.path,
                startLine: index + 1,
                endLine: index + 1,
              },
            ],
            confidence: 0.8,
            description: 'Class pattern detected',
          });
        }
      }
    });

    return patterns;
  }

  /**
   * Create unified AST representation from multiple parse results
   */
  createUnifiedAST(parseResults: ParseResult[]): ASTNode {
    const root: ASTNode = {
      type: 'Repository',
      location: {
        file: '/',
        startLine: 1,
        endLine: 1,
      },
      children: parseResults
        .filter((result) => result.success && result.ast)
        .map((result) => result.ast!),
      metadata: {
        totalFiles: parseResults.length,
        successfulParses: parseResults.filter((r) => r.success).length,
        fallbacksUsed: parseResults.filter((r) => r.fallbackUsed).length,
      },
    };

    return root;
  }

  /**
   * Handle parsing errors with recovery
   */
  private handleParseError(error: Error, file: SourceFile): ParseResult {
    console.error(`Parse error in ${file.path}:`, error.message);

    return {
      success: false,
      error: `Failed to parse ${file.path}: ${error.message}`,
      fallbackUsed: false,
      language: file.language,
    };
  }
}

export const astParserService = new ASTParserService();
