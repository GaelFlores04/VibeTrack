export function serverConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');
  const configuredOrigin = env.FRONTEND_ORIGIN || env.RENDER_EXTERNAL_URL;
  if (production && !configuredOrigin) throw new Error('Configura FRONTEND_ORIGIN con la URL pública HTTPS.');
  const url = new URL(configuredOrigin || 'http://localhost:5173');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('FRONTEND_ORIGIN debe contener solo el origen.');
  if (production && url.protocol !== 'https:') throw new Error('FRONTEND_ORIGIN debe usar HTTPS en producción.');
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) throw new Error('TRUST_PROXY_HOPS inválido.');
  return { production, port, host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'), origin: url.origin, trustProxyHops };
}
