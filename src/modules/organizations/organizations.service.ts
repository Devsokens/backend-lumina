import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/services/supabase.service';
import { RedisService } from '../../shared/services/redis.service';
import { AuditService } from '../../shared/services/audit.service';
import { UpdateOrganizationDto, UpdateSubscriptionDto } from './dto/organization.dto';
import { AuditAction, JwtPayload, UserRole } from '../../shared/types';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Récupère l'organisation du tenant courant.
   * Règle .antigravityrules : Filtrage par organization_id OBLIGATOIRE.
   */
  async findMyOrganization(organizationId: string) {
    const cacheKey = this.redisService.buildKey(organizationId, 'organization');

    return this.redisService.getOrSet(cacheKey, async () => {
      const { data, error } = await this.supabaseService.adminClient
        .from('organizations')
        .select('id, name, sector, subscription_status, subscription_plan, settings, created_at')
        .eq('id', organizationId)
        .single();

      if (error || !data) throw new NotFoundException('Organisation introuvable.');
      return data;
    }, 3600);
  }

  /**
   * Met à jour les paramètres de l'organisation.
   */
  async updateOrganization(
    organizationId: string,
    dto: UpdateOrganizationDto,
    currentUser: JwtPayload,
  ) {
    const db = this.supabaseService.adminClient;

    // Récupérer les anciennes valeurs pour l'audit
    const { data: oldData } = await db
      .from('organizations')
      .select('name, settings')
      .eq('id', organizationId)
      .single();

    const updatePayload: Record<string, unknown> = {};
    if (dto.name) updatePayload['name'] = dto.name;
    if (dto.settings) updatePayload['settings'] = dto.settings;

    const { data, error } = await db
      .from('organizations')
      .update(updatePayload)
      .eq('id', organizationId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Impossible de mettre à jour l\'organisation.');

    // Invalider le cache de l'organisation
    await this.redisService.del(
      this.redisService.buildKey(organizationId, 'organization'),
    );

    // Logger l'audit
    await this.auditService.log({
      organizationId,
      userId: currentUser.sub,
      action: AuditAction.UPDATE,
      tableName: 'organizations',
      recordId: organizationId,
      oldValues: oldData as Record<string, unknown>,
      newValues: updatePayload,
    });

    return data;
  }

  /**
   * Met à jour le plan d'abonnement (réservé super_admin).
   */
  async updateSubscription(
    organizationId: string,
    dto: UpdateSubscriptionDto,
    currentUser: JwtPayload,
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Seul le super administrateur peut modifier les abonnements.');
    }

    const { data, error } = await this.supabaseService.adminClient
      .from('organizations')
      .update({
        subscription_status: dto.subscriptionStatus,
        subscription_plan: dto.subscriptionPlan,
      })
      .eq('id', organizationId)
      .select()
      .single();

    if (error) throw new NotFoundException('Organisation introuvable.');

    // Invalider le cache
    await this.redisService.del(
      this.redisService.buildKey(organizationId, 'organization'),
    );

    this.logger.log(`💳 Abonnement mis à jour: ${organizationId} → ${dto.subscriptionPlan}`);
    return data;
  }

  /**
   * Liste toutes les organisations (réservé super_admin).
   */
  async findAll(currentUser: JwtPayload) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Accès réservé au super administrateur.');
    }

    const { data, error } = await this.supabaseService.adminClient
      .from('organizations')
      .select('id, name, sector, subscription_status, subscription_plan, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error('Erreur lors de la récupération des organisations.');
    return data;
  }
}
