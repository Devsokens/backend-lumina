import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../shared/services/supabase.service';
import { AuditService } from '../../shared/services/audit.service';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { AuditAction, JwtPayload, UserRole } from '../../shared/types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Liste tous les utilisateurs de l'organisation.
   * Règle .antigravityrules : Filtrage strict par organization_id.
   */
  async findAll(organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('users')
      .select('id, email, first_name, last_name, role, phone, is_active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error('Erreur lors de la récupération des utilisateurs.');
    return data;
  }

  /**
   * Récupère un utilisateur par ID (vérifie son appartenance au tenant).
   */
  async findOne(id: string, organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('users')
      .select('id, email, first_name, last_name, role, phone, is_active, created_at')
      .eq('id', id)
      .eq('organization_id', organizationId) // Isolation multi-tenant
      .single();

    if (error || !data) throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    return data;
  }

  /**
   * Crée un nouvel utilisateur (invitation par un admin/manager).
   */
  async create(dto: CreateUserDto, organizationId: string, currentUser: JwtPayload) {
    // Vérifier que le créateur a le droit d'attribuer ce rôle
    this.checkRoleAssignmentPermission(currentUser.role, dto.role);

    const db = this.supabaseService.adminClient;

    // Vérifier que l'email n'existe pas déjà dans cette organisation
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .eq('organization_id', organizationId)
      .single();

    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé dans votre organisation.');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const { data, error } = await db
      .from('users')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        email: dto.email,
        password_hash: passwordHash,
        role: dto.role,
        first_name: dto.firstName,
        last_name: dto.lastName,
        phone: dto.phone ?? null,
        is_active: true,
      })
      .select('id, email, first_name, last_name, role, phone, is_active, created_at')
      .single();

    if (error || !data) throw new Error('Erreur lors de la création de l\'utilisateur.');

    this.logger.log(`👤 Nouvel utilisateur: ${data.email} (rôle: ${dto.role})`);
    return data;
  }

  /**
   * Met à jour un utilisateur.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    organizationId: string,
    currentUser: JwtPayload,
  ) {
    const db = this.supabaseService.adminClient;

    // Récupérer l'utilisateur pour vérifier son appartenance au tenant
    const existing = await this.findOne(id, organizationId);

    // Empêcher de modifier son propre rôle
    if (id === currentUser.sub && dto.role && dto.role !== currentUser.role) {
      throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle.');
    }

    const updatePayload: Record<string, unknown> = {};
    if (dto.firstName) updatePayload['first_name'] = dto.firstName;
    if (dto.lastName) updatePayload['last_name'] = dto.lastName;
    if (dto.phone !== undefined) updatePayload['phone'] = dto.phone;
    if (dto.role) {
      this.checkRoleAssignmentPermission(currentUser.role, dto.role);
      updatePayload['role'] = dto.role;
    }
    if (dto.password) {
      updatePayload['password_hash'] = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
    }

    const { data, error } = await db
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('id, email, first_name, last_name, role, phone, is_active')
      .single();

    if (error || !data) throw new Error('Erreur lors de la mise à jour de l\'utilisateur.');

    await this.auditService.log({
      organizationId,
      userId: currentUser.sub,
      action: AuditAction.UPDATE,
      tableName: 'users',
      recordId: id,
      oldValues: existing as Record<string, unknown>,
      newValues: updatePayload,
    });

    return data;
  }

  /**
   * Active ou désactive un utilisateur (soft delete).
   */
  async toggleActive(id: string, organizationId: string, currentUser: JwtPayload) {
    if (id === currentUser.sub) {
      throw new ForbiddenException('Vous ne pouvez pas désactiver votre propre compte.');
    }

    const user = await this.findOne(id, organizationId);
    const newStatus = !user.is_active;

    const { data, error } = await this.supabaseService.adminClient
      .from('users')
      .update({ is_active: newStatus })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('id, email, is_active')
      .single();

    if (error) throw new Error('Erreur lors de la modification du statut.');

    await this.auditService.log({
      organizationId,
      userId: currentUser.sub,
      action: AuditAction.UPDATE,
      tableName: 'users',
      recordId: id,
      oldValues: { is_active: user.is_active },
      newValues: { is_active: newStatus },
    });

    return { ...data, message: newStatus ? 'Compte activé.' : 'Compte désactivé.' };
  }

  /**
   * Change le mot de passe de l'utilisateur connecté.
   */
  async changePassword(dto: ChangePasswordDto, currentUser: JwtPayload) {
    const db = this.supabaseService.adminClient;

    const { data: user } = await db
      .from('users')
      .select('password_hash')
      .eq('id', currentUser.sub)
      .single();

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);
    await db.from('users').update({ password_hash: newHash }).eq('id', currentUser.sub);

    return { message: 'Mot de passe modifié avec succès.' };
  }

  /**
   * Vérifie qu'un utilisateur peut attribuer un rôle donné.
   * Un manager ne peut pas créer un org_admin ou super_admin.
   */
  private checkRoleAssignmentPermission(
    assignerRole: UserRole,
    targetRole: UserRole,
  ): void {
    const restrictedRoles = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

    if (
      restrictedRoles.includes(targetRole) &&
      assignerRole !== UserRole.SUPER_ADMIN &&
      assignerRole !== UserRole.ORG_ADMIN
    ) {
      throw new ForbiddenException(
        `Vous ne pouvez pas attribuer le rôle ${targetRole}.`,
      );
    }
  }
}
