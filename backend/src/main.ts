import { randomUUID } from 'node:crypto';
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  new URL(origin);
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: any, res: any, next: () => void) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.use(require('express').json({ limit: '10kb' }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? origin : [origin, 'http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true });
  app.use('/api/auth', (_req: any, res: any, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/music/recommendations', (_req: any, res: any, next: () => void) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
}
bootstrap().catch(() => { console.error('No se pudo iniciar la API. Revisa JWT_SECRET (mínimo 32 caracteres), el entorno y la conexión a MongoDB.'); process.exit(1); });
