import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload, UserRole } from '../types';

/**
 * Guard des Rôles — Vérifie que l'utilisateur possède l'un des rôles requis.
 * Doit être appliqué APRÈS le JwtAuthGuard.
 *
 * Hiérarchie des rôles (du plus permissif au plus restreint) :
 * super_admin > org_admin > manager > cashier/waiter/stock_manager/kitchen_staff/event_scanner
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Définit quels rôles peuvent accéder aux ressources d'autres rôles.
   * Ex : org_admin peut tout ce que manager peut faire.
   */
  private readonly ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
    [UserRole.SUPER_ADMIN]: Object.values(UserRole) as UserRole[],
    [UserRole.ORG_ADMIN]: [
      UserRole.ORG_ADMIN,
      UserRole.MANAGER,
      UserRole.CASHIER,
      UserRole.WAITER,
      UserRole.KITCHEN_STAFF,
      UserRole.STOCK_MANAGER,
      UserRole.EVENT_SCANNER,
    ],
    [UserRole.MANAGER]: [
      UserRole.MANAGER,
      UserRole.CASHIER,
      UserRole.WAITER,
      UserRole.KITCHEN_STAFF,
      UserRole.STOCK_MANAGER,
      UserRole.EVENT_SCANNER,
    ],
    [UserRole.CASHIER]: [UserRole.CASHIER],
    [UserRole.WAITER]: [UserRole.WAITER],
    [UserRole.KITCHEN_STAFF]: [UserRole.KITCHEN_STAFF],
    [UserRole.STOCK_MANAGER]: [UserRole.STOCK_MANAGER],
    [UserRole.EVENT_SCANNER]: [UserRole.EVENT_SCANNER],
  };

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Route publique → pas de vérification de rôle
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Récupère les rôles requis définis par @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Aucun rôle requis → tout utilisateur authentifié est autorisé
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user: JwtPayload }>();
    const user = request.user;

    // Vérifie si le rôle de l'utilisateur couvre l'un des rôles requis
    const userAccessibleRoles = this.ROLE_HIERARCHY[user.role] ?? [];
    const hasPermission = requiredRoles.some((role) =>
      userAccessibleRoles.includes(role),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Accès refusé. Rôle requis : ${requiredRoles.join(' ou ')}. Votre rôle : ${user.role}.`,
      );
    }

    return true;
  }
}
