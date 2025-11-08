/**
 * Request Logging Middleware
 * 
 * Logs all API requests with structured logging
 * 
 * Requirements: 15.1, 15.8
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.service';

/**
 * Middleware to log API requests
 */
export function logRequest(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Extract user context from request (set by auth middleware)
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.tenantId;

  // Log request start
  logger.info('API request started', {
    correlationId: req.correlationId,
    userId,
    tenantId,
    action: `${req.method} ${req.path}`,
    metadata: {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = Date.now() - startTime;

    // Log request completion
    logger.info('API request completed', {
      correlationId: req.correlationId,
      userId,
      tenantId,
      action: `${req.method} ${req.path}`,
      duration,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseSize: data ? Buffer.byteLength(JSON.stringify(data)) : 0,
      },
    });

    return originalSend.call(this, data);
  };

  next();
}
