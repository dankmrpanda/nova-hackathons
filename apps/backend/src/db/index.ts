import { Pool, PoolClient } from 'pg';
import { config } from '../config';

class Database {
  public pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Track database metrics
      if (typeof require !== 'undefined') {
        try {
          const { metricsService } = require('../services/metrics.service');
          metricsService.trackDatabase('query', duration, true);
        } catch {
          // Metrics service not available yet during initialization
        }
      }
      
      return res;
    } catch (error) {
      const duration = Date.now() - start;
      
      // Track database error metrics
      if (typeof require !== 'undefined') {
        try {
          const { metricsService } = require('../services/metrics.service');
          metricsService.trackDatabase('query', duration, false);
        } catch {
          // Metrics service not available yet during initialization
        }
      }
      
      console.error('Database query error', { text, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new Database();
export * from './redis';
