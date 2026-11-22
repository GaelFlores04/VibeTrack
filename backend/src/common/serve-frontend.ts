import type { INestApplication } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import helmet from 'helmet';

export function serveFrontend(app: INestApplication, directory = resolve(__dirname, '../../../frontend/dist'), required = false) {
  const index = join(directory, 'index.html');
  if (!existsSync(index)) {
    if (required) throw new Error('Falta compilar el frontend con npm run build.');
    return false;
  }
  const policy = helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
      scriptSrc: ["'self'", 'https://sdk.scdn.co'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://*.spotify.com', 'wss://*.spotify.com', 'https://*.scdn.co', 'https://*.spotifycdn.com'],
      frameSrc: ['https://sdk.scdn.co', 'https://open.spotify.com'], workerSrc: ["'self'", 'blob:'],
      formAction: ["'self'"],
    },
  });
  const files = require('express').static(directory, {
    index: false, dotfiles: 'ignore',
    setHeaders(res: any, file: string) {
      const versioned = file.startsWith(join(directory, 'assets') + sep) && /-[\w-]{8,}\.[^.]+$/.test(file);
      res.setHeader('Cache-Control', versioned ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });
  app.use((req: any, res: any, next: () => void) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    policy(req, res, () => files(req, res, () => {
      if (!['GET', 'HEAD'].includes(req.method) || extname(req.path) || req.path.split('/').some((part: string) => part.startsWith('.')) || !req.accepts('html')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    }));
  });
  return true;
}
