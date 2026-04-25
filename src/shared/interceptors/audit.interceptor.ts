import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SupabaseService } from '../services/supabase.service';
import { AuditAction, JwtPayload } from '../types';
import { Request } from 'express';

/**
 * Intercepteur d'Audit — Logue automatiquement les actions de modification.
 *
 * Règle .antigravityrules : "Chaque action UPDATE/DELETE doit être logguée
 * dans audit_logs avec l'ID utilisateur et l'ancienne valeur."
 *
 * Cet intercepteur capture l'action HTTP et crée une entrée d'audit.
 * Pour les données avant/après, les services métier doivent appeler
 * AuditService.log() directement lorsqu'ils ont accès aux anciennes valeurs.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  // Mapping méthode HTTP → action d'audit
  private readonly HTTP_TO_AUDIT: Record<string, AuditAction | null> = {
    POST: AuditAction.INSERT,
    PUT: AuditAction.UPDATE,
    PATCH: AuditAction.UPDATE,
    DELETE: AuditAction.DELETE,
  };

  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    const action = this.HTTP_TO_AUDIT[request.method];

    // Seuls POST, PUT, PATCH, DELETE sont audités
    if (!action || !request.user) {
      return next.handle();
    }

    const { sub: userId, organizationId } = request.user;
    const ip = (request.headers['x-forwarded-for'] as string) ?? request.ip ?? 'unknown';

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.supabaseService.adminClient.from('audit_logs').insert({
            organization_id: organizationId,
            user_id: userId,
            action,
            table_name: this.extractTableName(request.url),
            ip_address: ip,
            old_values: null, // Rempli par AuditService.log() si nécessaire
            new_values: null,
          });
        } catch (err) {
          // L'échec d'audit ne doit JAMAIS bloquer la réponse principale
          this.logger.warn(`⚠️  Échec de l'audit log: ${(err as Error).message}`);
        }
      }),
    );
  }

  /** Extrait le nom de la table depuis l'URL (ex: /api/products/123 → products) */
  private extractTableName(url: string): string {
    const segments = url.split('/').filter(Boolean);
    // Ignore le préfixe 'api', prend le premier segment suivant
    const apiIndex = segments.indexOf('api');
    return segments[apiIndex + 1] ?? 'unknown';
  }
}
