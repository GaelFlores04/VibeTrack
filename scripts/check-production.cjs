const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { resolve } = require('node:path');

async function main() {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const root = resolve(__dirname, '..');
  // Entorno aislado: esta prueba no usa MongoDB, cuentas ni credenciales reales.
  const child = spawn(process.execPath, ['backend/dist/main.js'], {
    cwd: root, stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      FRONTEND_ORIGIN: 'https://vibetrack.example', TRUST_PROXY_HOPS: '0', MONGODB_URI: '',
      JWT_SECRET: 'isolated-production-check-'.repeat(3), LASTFM_API_KEY: '',
      SPOTIFY_CLIENT_ID: '', SPOTIFY_CLIENT_SECRET: '' },
  });
  const stopped = once(child, 'exit');
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (child.exitCode !== null) throw new Error('El servidor de producción no pudo iniciar.');
      try { ready = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.ok(ready, 'La API no respondió a tiempo.');
    const page = await fetch(`${origin}/explorar`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-cache');
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    const html = await page.text();
    assert.match(html, /id="root"/);
    const entry = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
    assert.ok(entry);
    const asset = await fetch(origin + entry);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);
    await asset.arrayBuffer();
    const moods = await fetch(`${origin}/api/moods`);
    assert.equal((await moods.json()).length, 6);
    assert.equal((await fetch(`${origin}/api/unknown`)).status, 404);
    // Instalable en móviles: manifiesto e iconos servidos con su tipo.
    const manifest = await fetch(`${origin}/manifest.webmanifest`);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get('content-type'), /manifest\+json|json/);
    assert.ok((await manifest.json()).icons.some(icon => icon.sizes === '512x512'));
    assert.match((await fetch(`${origin}/icon-192.png`)).headers.get('content-type'), /image\/png/);
    // HTTPS: HSTS en producción y redirección 308 de lo que llegó por HTTP al proxy.
    assert.match((await fetch(`${origin}/api/health`)).headers.get('strict-transport-security') || '', /max-age=31536000/);
    const insecure = await fetch(`${origin}/moods?x=1`, { redirect: 'manual', headers: { 'x-forwarded-proto': 'http' } });
    assert.equal(insecure.status, 308);
    assert.equal(insecure.headers.get('location'), `https://127.0.0.1:${port}/moods?x=1`);
    assert.equal((await fetch(`${origin}/api/health`, { headers: { 'x-forwarded-proto': 'http' } })).status, 200, 'la salud no se redirige');
    console.log('Producción verificada: web, rutas React, API, caché, CSP, HSTS, redirección HTTPS y manifiesto; sin servicios externos.');
  } finally {
    child.kill();
    await stopped;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
