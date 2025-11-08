import { Request, Response, NextFunction } from 'express';
import { airiaHealthService } from '../services/airia-health.service';

/**
 * Middleware to block operations that require Airia when in read-only mode
 */
export function blockIfReadOnly(req: Request, res: Response, next: NextFunction) {
  if (airiaHealthService.isReadOnlyMode()) {
    const status = airiaHealthService.getHealthStatus();
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'System is in read-only mode due to Airia unavailability',
      readOnlyMode: true,
      details: status.message,
      lastChecked: status.lastChecked,
    });
  }

  next();
}

/**
 * Middleware to add Airia health status to response headers
 */
export function addAiriaHealthHeaders(req: Request, res: Response, next: NextFunction) {
  const status = airiaHealthService.getHealthStatus();
  
  res.setHeader('X-Airia-Available', status.available.toString());
  res.setHeader('X-Read-Only-Mode', status.readOnlyMode.toString());
  
  next();
}
