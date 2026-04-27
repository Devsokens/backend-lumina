import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './services/supabase.service';
import { RedisService } from './services/redis.service';
import { AuditService } from './services/audit.service';
import { WhatsappService } from './services/whatsapp.service';

/**
 * Module Partagé Global — Exporté dans toute l'application.
 * @Global() garantit que tous les modules fils y ont accès
 * sans avoir besoin de le ré-importer.
 *
 * Règle .antigravityrules : Single Source of Truth.
 * Aucun autre module ne doit instancier SupabaseService ou RedisService.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseService, RedisService, AuditService, WhatsappService],
  exports: [SupabaseService, RedisService, AuditService, WhatsappService],
})
export class SharedModule {}
