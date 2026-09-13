import Redis from "ioredis";
import { logger } from "../lib/logger";

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
}

export interface IQueueService {
  enqueue(queueName: string, payload: unknown): Promise<boolean>;
  dequeue(queueName: string): Promise<unknown | null>;
}

export interface IRateLimitService {
  isRateLimited(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ limited: boolean; remaining: number }>;
}

export interface IRealtimeService {
  publish(channel: string, event: unknown): Promise<boolean>;
}

class InMemoryFallbackService
  implements ICacheService, IQueueService, IRateLimitService, IRealtimeService
{
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private queues = new Map<string, string[]>();
  private rateLimits = new Map<string, { count: number; resetAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return entry.value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<boolean> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value: JSON.stringify(value), expiresAt });
    return true;
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async enqueue(queueName: string, payload: unknown): Promise<boolean> {
    const queue = this.queues.get(queueName) || [];
    queue.push(JSON.stringify(payload));
    this.queues.set(queueName, queue);
    return true;
  }

  async dequeue(queueName: string): Promise<unknown | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) return null;
    const raw = queue.shift();
    return raw ? JSON.parse(raw) : null;
  }

  async isRateLimited(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ limited: boolean; remaining: number }> {
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { limited: false, remaining: limit - 1 };
    }

    if (entry.count >= limit) {
      return { limited: true, remaining: 0 };
    }

    entry.count += 1;
    return { limited: false, remaining: limit - entry.count };
  }

  async publish(_channel: string, _event: unknown): Promise<boolean> {
    return true;
  }
}

export class RedisInfrastructure
  implements ICacheService, IQueueService, IRateLimitService, IRealtimeService
{
  private client: Redis | null = null;
  private fallback = new InMemoryFallbackService();
  private isConnected = false;

  constructor(redisUrl = process.env.REDIS_URL) {
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        });

        this.client.on("connect", () => {
          this.isConnected = true;
          logger.info("Redis client connected successfully");
        });

        this.client.on("error", (err) => {
          this.isConnected = false;
          logger.warn({ err }, "Redis client encountered error, using fallback");
        });
      } catch (err) {
        logger.warn({ err }, "Failed to initialize ioredis client, using fallback");
      }
    }
  }

  get configured(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
      const res = await this.client.ping();
      return res === "PONG";
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      return this.fallback.get<T>(key);
    }
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return this.fallback.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return this.fallback.set(key, value, ttlSeconds);
    }
    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, "EX", ttlSeconds);
      return true;
    } catch {
      return this.fallback.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return this.fallback.del(key);
    }
    try {
      await this.client.del(key);
      return true;
    } catch {
      return this.fallback.del(key);
    }
  }

  async enqueue(queueName: string, payload: unknown): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return this.fallback.enqueue(queueName, payload);
    }
    try {
      await this.client.rpush(`queue:${queueName}`, JSON.stringify(payload));
      return true;
    } catch {
      return this.fallback.enqueue(queueName, payload);
    }
  }

  async dequeue(queueName: string): Promise<unknown | null> {
    if (!this.client || !this.isConnected) {
      return this.fallback.dequeue(queueName);
    }
    try {
      const raw = await this.client.lpop(`queue:${queueName}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return this.fallback.dequeue(queueName);
    }
  }

  async isRateLimited(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ limited: boolean; remaining: number }> {
    if (!this.client || !this.isConnected) {
      return this.fallback.isRateLimited(key, limit, windowSeconds);
    }
    try {
      const redisKey = `ratelimit:${key}`;
      const current = await this.client.incr(redisKey);
      if (current === 1) {
        await this.client.expire(redisKey, windowSeconds);
      }
      if (current > limit) {
        return { limited: true, remaining: 0 };
      }
      return { limited: false, remaining: limit - current };
    } catch {
      return this.fallback.isRateLimited(key, limit, windowSeconds);
    }
  }

  async publish(channel: string, event: unknown): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return this.fallback.publish(channel, event);
    }
    try {
      await this.client.publish(channel, JSON.stringify(event));
      return true;
    } catch {
      return this.fallback.publish(channel, event);
    }
  }
}

export const redisCoordinator = new RedisInfrastructure();
export const cacheService: ICacheService = redisCoordinator;
export const queueService: IQueueService = redisCoordinator;
export const rateLimitService: IRateLimitService = redisCoordinator;
export const realtimeService: IRealtimeService = redisCoordinator;