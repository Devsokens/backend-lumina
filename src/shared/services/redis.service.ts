import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Service Redis — Gestion centralisée du cache.
 * Règle .antigravityrules : Cache obligatoire pour les données à lecture fréquente.
 *
 * Pattern de cache : organization_id est TOUJOURS inclus dans la clé
 * pour garantir l'isolation multi-tenant.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private defaultTtl: number;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.defaultTtl = this.configService.get<number>('redis.ttl') ?? 3600;

    this.client = new Redis({
      host: this.configService.get<string>('redis.host') ?? 'localhost',
      port: this.configService.get<number>('redis.port') ?? 6379,
      password: this.configService.get<string>('redis.password') || undefined,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 times to avoid log spam in production
        return Math.min(times * 50, 2000);
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('✅ Redis connecté');
    });

    this.client.on('error', (err) => {
      if (this.isConnected) {
        this.logger.error(`❌ Redis erreur: ${err.message}`);
        this.isConnected = false;
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  buildKey(organizationId: string, ...parts: string[]): string {
    return `lumina:${organizationId}:${parts.join(':')}`;
  }

  private isReady(): boolean {
    return this.client && this.client.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isReady()) return null;
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      if (!this.isReady()) return;
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttl ?? this.defaultTtl, serialized);
    } catch {
      // Silent error
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (!this.isReady() || keys.length === 0) return;
      await this.client.del(...keys);
    } catch {
      // Silent error
    }
  }

  async invalidateOrganization(organizationId: string): Promise<void> {
    try {
      if (!this.isReady()) return;
      const pattern = `lumina:${organizationId}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // Silent error
    }
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const data = await factory();
    await this.set(key, data, ttl);
    return data;
  }
}
