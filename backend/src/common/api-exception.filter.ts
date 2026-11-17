import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export function redactError(value: string) {
  return value.replace(/(?:https?|mongodb(?:\+srv)?):\/\/[^\s]+/gi, '[URL omitida]')
    .replace(/(?:password|token|cookie|api_key|secret)\s*[:=]\s*[^\s,;]+/gi, '[secreto omitido]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token omitido]');
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();
    const requestId = request.requestId || randomUUID();
    const invalidJson = (exception as any)?.type === 'entity.parse.failed';
    const tooLarge = (exception as any)?.type === 'entity.too.large';
    const status = invalidJson ? 400 : tooLarge ? 413 : exception instanceof HttpException ? exception.getStatus() : 500;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const detail = typeof body === 'string' ? body : (body as { message?: unknown } | null)?.message;
    const message = invalidJson ? 'Cuerpo de la petición no válido.' : tooLarge ? 'La petición es demasiado grande.'
      : status >= 500 ? 'Servicio temporalmente no disponible.' : detail || 'Error interno del servidor.';
    if (status >= 500) {
      const error = exception instanceof Error ? exception : new Error('Error no controlado.');
      this.logger.error(`[${requestId}] ${redactError(error.message)}`, redactError(error.stack || ''));
    }
    response.setHeader('X-Request-Id', requestId);
    if (status === 429) response.setHeader('Retry-After', '60');
    response.status(status).json({ statusCode: status, message, requestId });
  }
}
