// @ts-nocheck
/**
 * Metrics Routes
 * 
 * Provides endpoints for metrics export (Prometheus format)
 * 
 * Requirements: 15.2
 */

import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metrics.service';
import { logger } from '../services/logger.service';

const router = Router();

/**
 * GET /metrics
 * Export metrics in Prometheus format
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const metrics = metricsService.getMetrics();
    const lines: string[] = [];

    // Convert metrics to Prometheus format
    for (const [name, metricList] of metrics.entries()) {
      if (metricList.length === 0) continue;

      const latestMetric = metricList[metricList.length - 1];
      const metricName = name.replace(/\./g, '_');

      // Add help text
      lines.push(`# HELP ${metricName} ${name}`);
      lines.push(`# TYPE ${metricName} ${latestMetric.type}`);

      // Add metric value with tags
      const tags = latestMetric.tags
        ? Object.entries(latestMetric.tags)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')
        : '';

      const tagString = tags ? `{${tags}}` : '';
      lines.push(`${metricName}${tagString} ${latestMetric.value}`);
    }

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n'));
  } catch (error) {
    logger.error('Failed to export metrics', {
      service: 'metrics',
    }, error as Error);

    res.status(500).send('# Error exporting metrics\n');
  }
});

/**
 * GET /metrics/json
 * Export metrics in JSON format
 */
router.get('/json', async (_req: Request, res: Response) => {
  try {
    const metrics = metricsService.getMetrics();
    const result: any = {};

    for (const [name, metricList] of metrics.entries()) {
      result[name] = metricList.map(m => ({
        type: m.type,
        value: m.value,
        timestamp: m.timestamp,
        tags: m.tags,
        unit: m.unit,
      }));
    }

    res.json({
      metrics: result,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to export metrics as JSON', {
      service: 'metrics',
    }, error as Error);

    res.status(500).json({
      error: 'Failed to export metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

