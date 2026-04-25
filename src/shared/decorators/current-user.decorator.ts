import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../types';

/**
 * Décorateur @CurrentUser() — Extrait le payload JWT de la requête.
 * Usage : @CurrentUser() user: JwtPayload
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | JwtPayload[keyof JwtPayload] => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;
    return data ? user[data] : user;
  },
);
