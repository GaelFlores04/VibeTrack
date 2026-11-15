import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { randomUUID } from 'node:crypto';
export function configureHttp(app: INestApplication, production = process.env.NODE_ENV === 'production') {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: any, res: any, next: () => void) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    strictTransportSecurity: production ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use(compression());
  app.use(require('express').json({ limit: '10kb' }));
}
