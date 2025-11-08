import { Pool, PoolConfig } from 'pg';

/**
 * Database connection pool configuration
 * Implements connection pooling for optimal database performance
 */

const poolConfig: PoolConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'onboarding_agent',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  
  // Connection pool settings
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  
  // Connection timeout
  connectionTimeoutMillis: 5000,
  
  // Idle timeout - close idle connections after 30 seconds
  idleTimeoutMillis: 30000,
  
  // Statement timeout - cancel queries after 30 seconds
  statement_timeout: 30000,
  
  // Keep alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
  } : false,
};

// Create the connection pool
export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Handle pool connection
pool.on('connect', (client) => {
  console.log('New database connection established');
});

// Handle pool removal
pool.on('remove', (client) => {
  console.log('Database connection removed from pool');
});

/**
 * Get pool statistics
 */
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Graceful shutdown - close all connections
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database connection pool closed');
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database pool...');
  await closePool();
  process.exit(0);
});
