import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Service Redis — Gestion centralisée du cache.
 * Règle .antigravityrules : Cache obligatoire pour les données à lecture fréquente.
 *
 * Pattern de cache : organization_id est TOUJOURS inclus dans la clé
 * pour garantir l'isolation multi-tenant.
 * Exemple : `lumina:org_123:menu:products`
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private defaultTtl: number;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.defaultTtl = this.configService.get<number>('redis.ttl') ?? 3600;

    this.client = new Redis({
      host: this.configService.get<string>('redis.host') ?? 'localhost',
      port: this.configService.get<number>('redis.port') ?? 6379,
      password: this.configService.get<string>('redis.password') || undefined,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => this.logger.log('✅ Redis connecté'));
    this.client.on('error', (err) => this.logger.error(`❌ Redis erreur: ${err.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Construit une clé de cache namespaced par organisation.
   * Garantit l'isolation multi-tenant des données en cache.
   */
  buildKey(organizationId: string, ...parts: string[]): string {
    return `lumina:${organizationId}:${parts.join(':')}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      this.logger.warn(`Redis GET failed for key ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttl ?? this.defaultTtl, serialized);
    } catch (err) {
      this.logger.warn(`Redis SET failed for key ${key}: ${(err as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.logger.warn(`Redis DEL failed for keys: ${(err as Error).message}`);
    }
  }

  /**
   * Invalide tous les caches d'une organisation.
   * À appeler lors d'une mise à jour critique (ex: modification du menu).
   */
  async invalidateOrganization(organizationId: string): Promise<void> {
    try {
      const pattern = `lumina:${organizationId}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.log(`🗑️  Cache invalidé pour org ${organizationId} (${keys.length} clés)`);
      }
    } catch (err) {
      this.logger.warn(`Redis INVALIDATE failed for org ${organizationId}: ${(err as Error).message}`);
    }
  }

  /**
   * Pattern Cache-Aside : retourne le cache ou exécute la factory et met en cache.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const data = await factory();
    await this.set(key, data, ttl);
    return data;
  }
}
