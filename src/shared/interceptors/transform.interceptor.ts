import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

/**
 * Intercepteur de transformation des réponses.
 * Toutes les réponses de succès sont enveloppées dans un format uniforme.
 *
 * Format standard :
 * {
 *   "success": true,
 *   "data": { ...payload },
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 *
 * Règle .antigravityrules : Structure JSON optimisée pour le parsing mobile.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
