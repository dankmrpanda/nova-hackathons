/**
 * Metrics Middleware
 * 
 * Tracks request metrics for all API endpoints
 * 
 * Requirements: 15.2
 */

import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service';

/**
 * Middleware to track request metrics
 */
export function trackRequestMetrics(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = Date.now() - startTime;

    // Track request metrics
    metricsService.trackRequest(req.method, req.path, res.statusCode, duration);

    return originalSend.call(this, data);
  };

  next();
}
