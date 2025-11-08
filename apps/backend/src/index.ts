import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { db, getRedisClient } from './db';

const redisClient = getRedisClient();
import authRoutes from './routes/auth.routes';
import mfaRoutes from './routes/mfa.routes';
import rbacRoutes from './routes/rbac.routes';
import sessionRoutes from './routes/session.routes';
import airiaHealthRoutes from './routes/airia-health.routes';
import costRoutes from './routes/cost.routes';
import templateRoutes from './routes/template.routes';
import healthRoutes from './routes/health.routes';
import alertsRoutes from './routes/alerts.routes';
import dashboardRoutes from './routes/dashboard.routes';
import metricsRoutes from './routes/metrics.routes';
import githubIntegrationRoutes from './routes/github-integration.routes';
import analysisRoutes from './routes/analysis.routes';
import animationRoutes from './routes/animation.routes';
import { airiaHealthService } from './services/airia-health.service';
import { healthCheckService } from './services/health-check.service';
import { metricsService } from './services/metrics.service';
import { alertingService } from './services/alerting.service';
import { dashboardService } from './services/dashboard.service';
import { logger } from './services/logger.service';
import { addAiriaHealthHeaders } from './middleware/airia-readonly.middleware';
import { addCorrelationId } from './middleware/correlation.middleware';
import { logRequest } from './middleware/request-logger.middleware';
import { trackRequestMetrics } from './middleware/metrics.middleware';

const app = express();

// Middleware - order matters!
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(addCorrelationId); // Add correlation ID first
app.use(logRequest); // Log requests with correlation ID
app.use(trackRequestMetrics); // Track metrics
app.use(addAiriaHealthHeaders);

// Health check endpoints (no auth required)
app.use('/health', healthRoutes);

// Metrics endpoint (no auth required - for Prometheus)
app.use('/metrics', metricsRoutes);

// Routes
app.use('/auth', authRoutes);
app.use('/mfa', mfaRoutes);
app.use('/rbac', rbacRoutes);
app.use('/sessions', sessionRoutes);
app.use('/airia', airiaHealthRoutes);
app.use('/api/cost', costRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/github', githubIntegrationRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/animation', animationRoutes);

// Initialize observability services
async function initializeObservability() {
  try {
    // Initialize health check service with dependencies
    healthCheckService.initialize({
      dbPool: (db as any).pool,
      redisClient: redisClient.getClient(),
      airiaApiUrl: config.airia.apiUrl,
      airiaApiKey: config.airia.apiKey,
    });

    // Initialize dashboard service
    dashboardService.initialize((db as any).pool);

    // Start infrastructure metrics collection
    metricsService.startInfrastructureMetrics(60000); // Every minute

    // Start alert monitoring
    alertingService.startMonitoring(60000); // Every minute

    // Start Airia health monitoring
    airiaHealthService.startHealthCheck();

    logger.info('Observability services initialized', {
      service: 'main',
    });
  } catch (error) {
    logger.error('Failed to initialize observability services', {
      service: 'main',
    }, error as Error);
    throw error;
  }
}

// Start server
const PORT = config.port;
app.listen(PORT, async () => {
  logger.info('Backend server starting', {
    service: 'main',
    metadata: {
      port: PORT,
      environment: config.nodeEnv,
      logLevel: config.logLevel,
    },
  });

  // Initialize observability
  await initializeObservability();

  logger.info('Backend server ready', {
    service: 'main',
    metadata: { port: PORT },
  });
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`, {
    service: 'main',
  });

  try {
    // Stop monitoring services
    metricsService.stopInfrastructureMetrics();
    alertingService.stopMonitoring();
    airiaHealthService.stopHealthCheck();

    // Close database connections
    await db.close();
    await redisClient.close();

    logger.info('Graceful shutdown complete', {
      service: 'main',
    });

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      service: 'main',
    }, error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    service: 'main',
  }, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    service: 'main',
    metadata: { reason, promise },
  });
});

export default app;
