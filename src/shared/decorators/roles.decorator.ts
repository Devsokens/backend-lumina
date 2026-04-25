import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../types';

export const ROLES_KEY = 'roles';

/**
 * Décorateur @Roles() — Définit les rôles autorisés pour un endpoint.
 * Usage : @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
