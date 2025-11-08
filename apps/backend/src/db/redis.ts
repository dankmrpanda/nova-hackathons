import Redis from 'ioredis';

import { config } from '../config';

/**
 * Lightweight in-memory fallback implementation used when Redis is unavailable.
 * Only implements the subset of commands we actually use in the codebase.
 */
class InMemoryStore {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();

  private now() { return Date.now(); }

  private isExpired(entry: { value: string; expiresAt?: number }) {
    return entry.expiresAt !== undefined && entry.expiresAt <= this.now();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) { this.store.delete(key); return null; }
    return entry.value;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, { value });
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: this.now() + seconds * 1000 });
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) { this.store.delete(key); return false; }
    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2; // Redis convention: key does not exist
    if (!entry.expiresAt) return -1; // no expiry
    const remaining = entry.expiresAt - this.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : -2;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) : 0;
    const next = num + 1;
    await this.set(key, String(next));
    return next;
  }

  async decr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) : 0;
    const next = num - 1;
    await this.set(key, String(next));
    return next;
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map(k => this.get(k)));
  }

  async mset(keyValues: Record<string, string>): Promise<void> {
    for (const [k, v] of Object.entries(keyValues)) {
      await this.set(k, v);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    // naive glob: convert * to .*
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const now = this.now();
    const results: string[] = [];
    for (const [k, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(k);
        continue;
      }
      if (regex.test(k)) results.push(k);
    }
    return results;
  }

  async close(): Promise<void> { /* no-op */ }
  getClient(): null { return null; }
}

/**
 * Redis client for caching and session management
 */
class RedisClient {
  private client: Redis | null = null;
  private memory: InMemoryStore | null = null;
  private usingMemory = false;
  private connectionErrors = 0;
  private compat: any = null;

  constructor() {
    // Allow explicit disable via env var
    if (process.env.REDIS_DISABLED === 'true') {
      this.enableMemoryFallback('REDIS_DISABLED env var set');
      return;
    }

    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('error', (err: any) => {
        this.connectionErrors++;
        if (this.connectionErrors <= 3) {
          console.error('Redis client error:', err?.code || err?.message || err);
        }
        // Switch to memory on connection refusal
        if (!this.usingMemory && (err?.code === 'ECONNREFUSED' || /ECONNREFUSED/.test(String(err)))) {
          this.enableMemoryFallback('Connection refused');
        }
      });

      this.client.on('connect', () => {
        console.log('Redis client connected');
      });

      // Attempt initial connection, fallback if fails
      this.client.connect().catch(err => {
        console.warn('Redis initial connect failed, falling back to in-memory cache:', err?.code || err?.message);
        this.enableMemoryFallback('Initial connect failed');
      });
    } catch (err: any) {
      console.warn('Redis initialization error, falling back to in-memory cache:', err?.message);
      this.enableMemoryFallback('Initialization exception');
    }
  }

  private enableMemoryFallback(reason: string) {
    if (this.usingMemory) return;
    this.usingMemory = true;
    this.memory = new InMemoryStore();
    if (this.client) {
      try { this.client.disconnect(); } catch {}
      this.client = null;
    }
    this.compat = this.buildCompat();
    console.warn(`[redis] Using in-memory fallback (${reason}). Persistence & cross-instance cache disabled.`);
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    if (this.usingMemory && this.memory) return this.memory.get(key);
    return await (this.client as Redis).get(key);
  }

  /**
   * Set value with optional expiry
   */
  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (this.usingMemory && this.memory) {
      if (expirySeconds) return this.memory.setex(key, expirySeconds, value);
      return this.memory.set(key, value);
    }
    if (expirySeconds) {
      await (this.client as Redis).setex(key, expirySeconds, value);
    } else {
      await (this.client as Redis).set(key, value);
    }
  }

  /**
   * Set value with expiry (alias for set with expiry)
   */
  async setex(key: string, expirySeconds: number, value: string): Promise<void> {
    if (this.usingMemory && this.memory) return this.memory.setex(key, expirySeconds, value);
    await (this.client as Redis).setex(key, expirySeconds, value);
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<number> {
    if (this.usingMemory && this.memory) return this.memory.del(key);
    return await (this.client as Redis).del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.usingMemory && this.memory) return this.memory.exists(key);
    const result = await (this.client as Redis).exists(key);
    return result === 1;
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    if (this.usingMemory && this.memory) return this.memory.ttl(key);
    return await (this.client as Redis).ttl(key);
  }

  /**
   * Increment value
   */
  async incr(key: string): Promise<number> {
    if (this.usingMemory && this.memory) return this.memory.incr(key);
    return await (this.client as Redis).incr(key);
  }

  /**
   * Decrement value
   */
  async decr(key: string): Promise<number> {
    if (this.usingMemory && this.memory) return this.memory.decr(key);
    return await (this.client as Redis).decr(key);
  }

  /**
   * Get multiple keys
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    if (this.usingMemory && this.memory) return this.memory.mget(...keys);
    return await (this.client as Redis).mget(...keys);
  }

  /**
   * Set multiple keys
   */
  async mset(keyValues: Record<string, string>): Promise<void> {
    if (this.usingMemory && this.memory) return this.memory.mset(keyValues);
    const args: string[] = [];
    for (const [key, value] of Object.entries(keyValues)) {
      args.push(key, value);
    }
    await (this.client as Redis).mset(...args);
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (this.usingMemory && this.memory) return this.memory.keys(pattern);
    return await (this.client as Redis).keys(pattern);
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.usingMemory && this.memory) return this.memory.close();
    if (this.client) await (this.client as Redis).quit();
  }

  /**
   * Get raw client for advanced operations
   */
  private buildCompat() {
    if (this.usingMemory && this.memory) {
      const mem = this.memory;
      return {
        // basic ops
        get: (k: string) => mem.get(k),
        set: (k: string, v: string) => mem.set(k, v),
        setex: (k: string, s: number, v: string) => mem.setex(k, s, v),
        del: (k: string) => mem.del(k),
        exists: async (k: string) => (await mem.exists(k)) ? 1 : 0,
        ttl: (k: string) => mem.ttl(k),
        incr: (k: string) => mem.incr(k),
        decr: (k: string) => mem.decr(k),
        mget: (...keys: string[]) => mem.mget(...keys),
        mset: (obj: Record<string,string>) => mem.mset(obj),
        keys: (pattern: string) => mem.keys(pattern),
        // additional ops used elsewhere
        expire: async (k: string, seconds: number) => {
          const val = await mem.get(k);
          if (val === null) return 0;
          await mem.setex(k, seconds, val);
          return 1;
        },
        incrbyfloat: async (k: string, inc: number) => {
          const cur = await mem.get(k);
          const num = cur ? parseFloat(cur) : 0;
          const next = num + inc;
          await mem.set(k, String(next));
          return next;
        },
        ping: async () => 'PONG',
        status: 'ready',
      };
    }
    const cli = this.client as Redis;
    return {
      get: (k: string) => cli.get(k),
      set: (k: string, v: string) => cli.set(k, v),
      setex: (k: string, s: number, v: string) => cli.setex(k, s, v),
      del: (k: string) => cli.del(k),
      exists: (k: string) => cli.exists(k),
      ttl: (k: string) => cli.ttl(k),
      incr: (k: string) => cli.incr(k),
      decr: (k: string) => cli.decr(k),
      mget: (...keys: string[]) => cli.mget(...keys),
      mset: (obj: Record<string,string>) => cli.mset(...Object.entries(obj).flat()),
      keys: (pattern: string) => cli.keys(pattern),
      expire: (k: string, s: number) => cli.expire(k, s),
      incrbyfloat: (k: string, inc: number) => cli.incrbyfloat(k, inc as any),
      ping: () => cli.ping(),
      get status() { return (cli as any).status; },
    };
  }

  getClient(): any {
    if (!this.compat) this.compat = this.buildCompat();
    return this.compat;
  }
}

// Singleton instance
let redisClientInstance: RedisClient | null = null;

/**
 * Get singleton Redis client instance
 */
export function getRedisClient(): RedisClient {
  if (!redisClientInstance) {
    redisClientInstance = new RedisClient();
  }
  return redisClientInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetRedisClient(): void {
  if (redisClientInstance) {
    redisClientInstance.close();
    redisClientInstance = null;
  }
}
