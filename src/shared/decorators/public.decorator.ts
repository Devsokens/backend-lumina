import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Décorateur @Public() — Marque un endpoint comme public (sans authentification JWT).
 * Usage : @Public() sur les routes de login, register, scan QR, etc.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
