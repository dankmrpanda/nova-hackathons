/**
 * Structured Logging Service
 * 
 * Provides centralized logging with:
 * - Standard fields (timestamp, level, service, userId, tenantId, sessionId)
 * - Correlation IDs for request tracing
 * - Configurable log levels
 * - Redaction of sensitive data
 * 
 * Requirements: 15.1, 15.8
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
};

export interface LogContext {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  correlationId?: string;
  service?: string;
  action?: string;
  duration?: number;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  correlationId?: string;
  action?: string;
  duration?: number;
  cost?: number;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class LoggerService {
  private currentLogLevel: LogLevel;
  private serviceName: string;

  constructor() {
    // Initialize with default, will be updated when setLogLevel is called
    this.currentLogLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
    this.serviceName = 'codebase-onboarding-agent';
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toLowerCase();
    if (Object.values(LogLevel).includes(normalized as LogLevel)) {
      return normalized as LogLevel;
    }
    return LogLevel.INFO;
  }

  /**
   * Check if a log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.currentLogLevel];
  }

  /**
   * Redact sensitive data from metadata
   */
  private redactSensitiveData(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const redacted = { ...metadata };
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
      'code',
      'authorization',
      'cookie',
      'sessionToken',
    ];

    const redactObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      if (Array.isArray(obj)) {
        return obj.map(redactObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = redactObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return redactObject(redacted);
  }

  /**
   * Format and emit a structured log
   */
  private emit(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: context?.service || this.serviceName,
      userId: context?.userId,
      tenantId: context?.tenantId,
      sessionId: context?.sessionId,
      correlationId: context?.correlationId,
      action: context?.action,
      duration: context?.duration,
      cost: context?.cost,
      metadata: this.redactSensitiveData(context?.metadata),
    };

    if (error) {
      log.error = {
        message: error.message,
        stack: level === LogLevel.DEBUG ? error.stack : undefined,
        code: (error as any).code,
      };
    }

    // Output as JSON for log aggregation
    console.log(JSON.stringify(log));
  }

  /**
   * Log error level message
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.emit(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: LogContext): void {
    this.emit(LogLevel.WARN, message, context);
  }

  /**
   * Log info level message
   */
  info(message: string, context?: LogContext): void {
    this.emit(LogLevel.INFO, message, context);
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: LogContext): void {
    this.emit(LogLevel.DEBUG, message, context);
  }

  /**
   * Create a child logger with default context
   */
  child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
    this.info('Log level changed', { metadata: { newLevel: level } });
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }
}

/**
 * Child logger with default context
 */
class ChildLogger {
  constructor(
    private parent: LoggerService,
    private defaultContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return {
      ...this.defaultContext,
      ...context,
      metadata: {
        ...this.defaultContext.metadata,
        ...context?.metadata,
      },
    };
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = new LoggerService();
