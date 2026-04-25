import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { AuditAction } from '../types';

interface AuditLogEntry {
  organizationId: string;
  userId: string;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string;
}

/**
 * Service d'Audit — Permet aux services métier de logguer les changements
 * avec les valeurs avant/après (old_values, new_values).
 *
 * Règle .antigravityrules : Traçabilité complète de chaque modification.
 * Usage dans un service :
 *   await this.auditService.log({ organizationId, userId, action: AuditAction.UPDATE,
 *     tableName: 'products', recordId: product.id, oldValues: before, newValues: after });
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await this.supabaseService.adminClient
        .from('audit_logs')
        .insert({
          organization_id: entry.organizationId,
          user_id: entry.userId,
          action: entry.action,
          table_name: entry.tableName,
          record_id: entry.recordId,
          old_values: entry.oldValues ?? null,
          new_values: entry.newValues ?? null,
          ip_address: entry.ipAddress ?? null,
        });

      if (error) {
        this.logger.warn(`⚠️  Audit log échoué: ${error.message}`);
      }
    } catch (err) {
      // L'audit ne doit jamais faire planter l'opération principale
      this.logger.error(`💥 Erreur critique audit: ${(err as Error).message}`);
    }
  }
}
