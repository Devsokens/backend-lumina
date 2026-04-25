import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

/**
 * Filtre d'exceptions global — Uniformise toutes les réponses d'erreur de l'API.
 * Toutes les erreurs retournent un format JSON cohérent.
 *
 * Format standard :
 * {
 *   "statusCode": 400,
 *   "message": "Email invalide",
 *   "error": "Bad Request",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "path": "/api/auth/login"
 * }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res['message'] as string | string[]) ?? exception.message;
        error = (res['error'] as string) ?? exception.name;
      } else {
        message = exceptionResponse as string;
        error = exception.name;
      }
    } else {
      // Erreur inconnue (ex: crash DB, erreur réseau)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Une erreur interne est survenue. Veuillez réessayer.';
      error = 'Internal Server Error';

      this.logger.error(
        `💥 Erreur non gérée sur ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log toutes les erreurs 5xx en production
    if (statusCode >= 500) {
      this.logger.error(
        `[${statusCode}] ${request.method} ${request.url}`,
        JSON.stringify(errorResponse),
      );
    }

    response.status(statusCode).json(errorResponse);
  }
}
