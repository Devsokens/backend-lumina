import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard JWT Global — Protège toutes les routes par défaut.
 * Les routes marquées @Public() sont exemptées.
 *
 * Ordre d'exécution des Guards :
 * 1. JwtAuthGuard  → vérifie le token
 * 2. TenantGuard   → injecte l'organization_id
 * 3. RolesGuard    → vérifie le rôle
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Vérifie si la route est marquée @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        'Token invalide ou expiré. Veuillez vous reconnecter.',
      );
    }
    return user;
  }
}
