/**
 * Correlation ID Middleware
 * 
 * Adds correlation IDs to requests for distributed tracing
 * 
 * Requirements: 15.1
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to requests
 */
export function addCorrelationId(req: Request, res: Response, next: NextFunction): void {
  // Use existing correlation ID from header or generate new one
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();
  
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  
  next();
}
