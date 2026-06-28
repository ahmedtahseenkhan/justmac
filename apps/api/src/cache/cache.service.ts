import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Thin cache abstraction. Uses Redis when REDIS_URL is set; otherwise falls back
 * to an in-process Map so the API runs with zero infra during local dev.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private mem = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
        this.redis.on("error", (e) => this.logger.warn(`Redis error, using memory fallback: ${e.message}`));
        void this.redis.connect().catch(() => {
          this.logger.warn("Redis connect failed; using in-memory cache.");
          this.redis = null;
        });
      } catch {
        this.redis = null;
      }
    } else {
      this.logger.log("REDIS_URL not set; using in-memory cache.");
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.redis) {
      try {
        return await this.redis.get(key);
      } catch {
        /* fall through to memory */
      }
    }
    const hit = this.mem.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.mem.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set(key, value, "EX", ttlSeconds);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    this.mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }
}
