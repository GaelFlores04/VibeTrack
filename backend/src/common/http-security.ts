import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { randomUUID } from 'node:crypto';
// Detrás del proxy de Render (o cualquier otro que termine TLS), una petición que llegó por HTTP se
// redirige a HTTPS con 308 (conserva método y cuerpo). Sólo se confía en la cabecera explícita del
// proxy: las comprobaciones internas de salud llegan sin ella y no se redirigen.
export function httpsRedirect(production: boolean) {
  return (req: any, res: any, next: () => void) => {
    const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const host = String(req.headers.host || '');
    if (!production || forwarded !== 'http' || req.path === '/api/health' || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return next();
    res.redirect(308, `https://${host}${req.originalUrl || req.url}`);
  };
}
export function configureHttp(app: INestApplication, production = process.env.NODE_ENV === 'production') {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(httpsRedirect(production));
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
