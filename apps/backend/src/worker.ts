/**
 * Worker Process for Background Jobs
 * Processes queued analysis sessions and other async tasks
 */

import { config } from './config';
import { getRedisClient } from './db/redis';
import { sessionService } from './services/session.service';
import { sessionQueueService } from './services/session-queue.service';

let isShuttingDown = false;
let processingCount = 0;

/**
 * Process pending sessions from the queue
 */
async function processQueue() {
  if (isShuttingDown) {
    return;
  }

  try {
    processingCount++;

    // Check for pending sessions across all tenants
    const redis = getRedisClient();
    
    // Get list of tenants with pending sessions
    const tenantsWithQueue = await redis.get('queue:tenants') || '[]';
    const tenantIds = JSON.parse(tenantsWithQueue);

    for (const tenantId of tenantIds) {
      if (isShuttingDown) break;

      // Get next session in queue
      const queueEntry = await sessionQueueService.getNextInQueue(tenantId);
      
      if (queueEntry) {
        console.log(`Processing queued session for user ${queueEntry.userId}`);
        
        try {
          // Process the session
          // Note: This is a placeholder - actual session processing would happen here
          await sessionQueueService.removeFromQueue(queueEntry.id);
          console.log(`Completed processing for queue entry ${queueEntry.id}`);
        } catch (error) {
          console.error(`Error processing queue entry ${queueEntry.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in queue processing:', error);
  } finally {
    processingCount--;
  }
}

/**
 * Main worker loop
 */
async function startWorker() {
  console.log('Worker process starting...');
  console.log('Environment:', config.nodeEnv);

  // Wait for Redis connection
  const redis = getRedisClient();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('Worker connected to Redis');

  // Start processing loop
  const intervalMs = 5000; // Process queue every 5 seconds
  
  const interval = setInterval(async () => {
    if (!isShuttingDown && processingCount === 0) {
      await processQueue();
    }
  }, intervalMs);

  console.log(`Worker ready - polling every ${intervalMs}ms`);

  // Graceful shutdown handlers
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    isShuttingDown = true;
    clearInterval(interval);
    
    // Wait for current processing to complete
    const checkProcessing = setInterval(() => {
      if (processingCount === 0) {
        clearInterval(checkProcessing);
        console.log('Worker shutdown complete');
        process.exit(0);
      }
    }, 100);

    // Force exit after 30 seconds
    setTimeout(() => {
      console.log('Forcing worker shutdown');
      process.exit(1);
    }, 30000);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    isShuttingDown = true;
    clearInterval(interval);
    process.exit(0);
  });

  // Health check endpoint for Docker
  const http = require('http');
  const healthServer = http.createServer((req: any, res: any) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        processing: processingCount,
        shutting_down: isShuttingDown
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const healthPort = parseInt(process.env.HEALTH_PORT || '3001', 10);
  healthServer.listen(healthPort, () => {
    console.log(`Worker health check listening on port ${healthPort}`);
  });
}

// Start the worker
startWorker().catch((error) => {
  console.error('Fatal error starting worker:', error);
  process.exit(1);
});
