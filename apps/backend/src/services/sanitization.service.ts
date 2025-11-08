/**
 * Sanitization Service
 * Handles sanitization of code snippets, secrets, and PII from artifacts
 * Requirements: 18.12, 30.2, 30.11, 31.2
 */

import type { FileReference, CodeSnippet, CodeLocation } from '@codebase-onboarding/shared';

// Secret patterns to detect and remove
const SECRET_PATTERNS = [
  // API Keys and tokens
  /(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key|private[_-]?key)["\s:=]+([a-zA-Z0-9_\-]{20,})/gi,
  // AWS keys
  /AKIA[0-9A-Z]{16}/g,
  // GitHub tokens
  /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  // Generic tokens
  /["\']?token["\']?\s*[:=]\s*["\']([a-zA-Z0-9_\-\.]{20,})["\']?/gi,
  // Passwords
  /["\']?password["\']?\s*[:=]\s*["\']([^"\']{8,})["\']?/gi,
  // Connection strings
  /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^\/]+/gi,
  // Private keys
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
];

// PII patterns to detect and redact
const PII_PATTERNS = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  // Phone numbers (various formats)
  { pattern: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g, replacement: '[PHONE]' },
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  // Credit card numbers
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[CREDIT_CARD]' },
  // IP addresses (be careful not to catch version numbers)
  { pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, replacement: '[IP_ADDRESS]' },
];

export interface SanitizationResult {
  sanitized: string;
  secretsFound: number;
  piiFound: number;
  codeSnippetsReplaced: number;
  isClean: boolean;
  warnings: string[];
}

export interface SanitizationOptions {
  replaceCodeSnippets?: boolean;
  detectSecrets?: boolean;
  detectPII?: boolean;
  preserveStructure?: boolean;
}

export class SanitizationService {
  /**
   * Sanitize content by removing code snippets, secrets, and PII
   */
  sanitizeContent(
    content: string,
    references: FileReference[] = [],
    options: SanitizationOptions = {}
  ): SanitizationResult {
    const {
      replaceCodeSnippets = true,
      detectSecrets = true,
      detectPII = true,
      preserveStructure = true,
    } = options;

    let sanitized = content;
    let secretsFound = 0;
    let piiFound = 0;
    let codeSnippetsReplaced = 0;
    const warnings: string[] = [];

    // Step 1: Replace code snippets with file references
    if (replaceCodeSnippets) {
      const result = this.replaceCodeSnippetsWithReferences(sanitized, references);
      sanitized = result.content;
      codeSnippetsReplaced = result.replacements;
    }

    // Step 2: Detect and remove secrets
    if (detectSecrets) {
      const result = this.detectAndRemoveSecrets(sanitized);
      sanitized = result.content;
      secretsFound = result.secretsFound;
      if (secretsFound > 0) {
        warnings.push(`Detected and removed ${secretsFound} potential secret(s)`);
      }
    }

    // Step 3: Detect and redact PII
    if (detectPII) {
      const result = this.detectAndRedactPII(sanitized);
      sanitized = result.content;
      piiFound = result.piiFound;
      if (piiFound > 0) {
        warnings.push(`Detected and redacted ${piiFound} PII instance(s)`);
      }
    }

    // Step 4: Preserve structure if needed
    if (preserveStructure) {
      sanitized = this.preserveReadability(sanitized);
    }

    const isClean = secretsFound === 0 && piiFound === 0;

    return {
      sanitized,
      secretsFound,
      piiFound,
      codeSnippetsReplaced,
      isClean,
      warnings,
    };
  }

  /**
   * Replace code snippets with file references
   */
  private replaceCodeSnippetsWithReferences(
    content: string,
    references: FileReference[]
  ): { content: string; replacements: number } {
    let result = content;
    let replacements = 0;

    // Detect code blocks (markdown style)
    const codeBlockPattern = /```[\w]*\n([\s\S]*?)```/g;
    result = result.replace(codeBlockPattern, (match, code) => {
      replacements++;
      // Try to find matching reference
      const matchingRef = this.findMatchingReference(code, references);
      if (matchingRef) {
        return this.formatFileReference(matchingRef);
      }
      return '[CODE_SNIPPET_REMOVED]';
    });

    // Detect inline code (backticks)
    const inlineCodePattern = /`([^`]{50,})`/g;
    result = result.replace(inlineCodePattern, (match, code) => {
      // Only replace longer inline code snippets
      if (code.length > 50) {
        replacements++;
        return '[CODE_REMOVED]';
      }
      return match;
    });

    return { content: result, replacements };
  }

  /**
   * Find matching file reference for code snippet
   */
  private findMatchingReference(code: string, references: FileReference[]): FileReference | null {
    // Simple heuristic: find reference with most matching lines
    let bestMatch: FileReference | null = null;
    let bestScore = 0;

    for (const ref of references) {
      const score = this.calculateMatchScore(code, ref);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ref;
      }
    }

    return bestScore > 0.5 ? bestMatch : null;
  }

  /**
   * Calculate match score between code and reference
   */
  private calculateMatchScore(code: string, reference: FileReference): number {
    // Simple scoring based on line count similarity
    const codeLines = code.split('\n').length;
    const refLines = reference.lineNumbers.length;
    
    if (refLines === 0) return 0;
    
    const ratio = Math.min(codeLines, refLines) / Math.max(codeLines, refLines);
    return ratio * reference.relevance;
  }

  /**
   * Format file reference for display
   */
  private formatFileReference(reference: FileReference): string {
    const lines = reference.lineNumbers;
    if (lines.length === 0) {
      return `[See: ${reference.path}]`;
    }
    
    const lineRange = lines.length === 1
      ? `line ${lines[0]}`
      : `lines ${Math.min(...lines)}-${Math.max(...lines)}`;
    
    return `[See: ${reference.path}, ${lineRange}]`;
  }

  /**
   * Detect and remove secrets
   */
  private detectAndRemoveSecrets(content: string): { content: string; secretsFound: number } {
    let result = content;
    let secretsFound = 0;

    for (const pattern of SECRET_PATTERNS) {
      const matches = result.match(pattern);
      if (matches) {
        secretsFound += matches.length;
        result = result.replace(pattern, '[SECRET_REMOVED]');
      }
    }

    return { content: result, secretsFound };
  }

  /**
   * Detect and redact PII
   */
  private detectAndRedactPII(content: string): { content: string; piiFound: number } {
    let result = content;
    let piiFound = 0;

    for (const { pattern, replacement } of PII_PATTERNS) {
      const matches = result.match(pattern);
      if (matches) {
        piiFound += matches.length;
        result = result.replace(pattern, replacement);
      }
    }

    return { content: result, piiFound };
  }

  /**
   * Preserve readability by cleaning up excessive replacements
   */
  private preserveReadability(content: string): string {
    let result = content;

    // Remove consecutive duplicate removals
    result = result.replace(/(\[CODE_REMOVED\]\s*){2,}/g, '[CODE_REMOVED]\n');
    result = result.replace(/(\[SECRET_REMOVED\]\s*){2,}/g, '[SECRET_REMOVED]\n');

    // Clean up excessive whitespace
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
  }

  /**
   * Validate that artifact is properly sanitized
   */
  validateSanitization(content: string): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check for remaining secrets
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        violations.push('Potential secret detected in sanitized content');
        break;
      }
    }

    // Check for remaining PII
    for (const { pattern } of PII_PATTERNS) {
      if (pattern.test(content)) {
        violations.push('Potential PII detected in sanitized content');
        break;
      }
    }

    // Check for code blocks
    if (/```[\w]*\n[\s\S]{100,}```/.test(content)) {
      violations.push('Large code block detected in sanitized content');
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Sanitize code snippet and return file reference
   */
  sanitizeCodeSnippet(snippet: CodeSnippet): FileReference {
    return {
      path: snippet.location.file,
      lineNumbers: [snippet.location.startLine, snippet.location.endLine],
      relevance: 1.0,
    };
  }

  /**
   * Sanitize multiple code snippets
   */
  sanitizeCodeSnippets(snippets: CodeSnippet[]): FileReference[] {
    return snippets.map(snippet => this.sanitizeCodeSnippet(snippet));
  }

  /**
   * Create sanitized explanation from analysis result
   */
  createSanitizedExplanation(
    explanation: string,
    codeSnippets: CodeSnippet[]
  ): { explanation: string; references: FileReference[] } {
    const references = this.sanitizeCodeSnippets(codeSnippets);
    const result = this.sanitizeContent(explanation, references);

    return {
      explanation: result.sanitized,
      references,
    };
  }
}

export const sanitizationService = new SanitizationService();
