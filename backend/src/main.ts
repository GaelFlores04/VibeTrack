import { configureHttp } from './common/http-security';
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { serverConfig } from './common/server-config';
import { serveFrontend } from './common/serve-frontend';

async function bootstrap() {
  const config = serverConfig();
  const { origin, production } = config;
  process.env.FRONTEND_ORIGIN = origin;
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxyHops);
  configureHttp(app);
  serveFrontend(app, undefined, production);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: production ? origin : [origin, 'http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true });
  app.use('/api/auth', (_req: any, res: any, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/spotify', (_req: any, res: any, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/music/recommendations', (_req: any, res: any, next: () => void) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
}
bootstrap().catch(() => { console.error('No se pudo iniciar VibeTrack. Revisa la compilación, FRONTEND_ORIGIN, JWT_SECRET (mínimo 32 caracteres), PORT y MongoDB.'); process.exit(1); });
