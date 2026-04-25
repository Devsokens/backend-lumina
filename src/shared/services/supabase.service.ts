import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service Supabase — Point d'accès unique à la base de données.
 * Règle .antigravityrules : Single Source of Truth pour les connexions DB.
 *
 * Deux clients sont exposés :
 * - `client` (anon) : pour les opérations respectant la RLS (lecture publique).
 * - `adminClient` (service_role) : pour les opérations admin (bypass RLS).
 *   À utiliser avec EXTRÊME précaution — uniquement dans les services admin.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);

  private _client: SupabaseClient;
  private _adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>('supabase.url');
    const anonKey = this.configService.get<string>('supabase.anonKey');
    const serviceRoleKey = this.configService.get<string>('supabase.serviceRoleKey');

    if (!url || !anonKey || !serviceRoleKey) {
      this.logger.error('❌ Variables Supabase manquantes dans .env');
      throw new Error('Supabase configuration is incomplete. Check SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
    }

    // Client standard — respecte la Row Level Security
    this._client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Client admin — bypass RLS pour les opérations système
    this._adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this.logger.log('✅ Supabase connecté');
  }

  /** Client public (RLS actif) */
  get client(): SupabaseClient {
    return this._client;
  }

  /** Client admin (bypass RLS) — À utiliser uniquement pour les opérations système */
  get adminClient(): SupabaseClient {
    return this._adminClient;
  }
}
