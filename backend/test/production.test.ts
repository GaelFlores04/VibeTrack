import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureHttp } from '../src/common/http-security';
import { serverConfig } from '../src/common/server-config';
import { serveFrontend } from '../src/common/serve-frontend';

test('producción valida HTTPS, escucha pública y proxy explícito; desarrollo conserva loopback', () => {
  assert.equal(serverConfig({}).host, '127.0.0.1');
  const config = serverConfig({ NODE_ENV: 'production', RENDER_EXTERNAL_URL: 'https://vibetrack.example', PORT: '10000', TRUST_PROXY_HOPS: '1' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 10000);
  assert.equal(config.origin, 'https://vibetrack.example');
  assert.equal(config.trustProxyHops, 1);
  assert.equal(serverConfig({ FRONTEND_ORIGIN: 'https://example.test', RENDER_EXTERNAL_URL: 'https://another.test' }).origin, 'https://example.test');
  for (const value of ['https://example.test/path', 'https://user:pass@example.test', 'ftp://example.test', 'https://example.test?key=x']) assert.throws(() => serverConfig({ FRONTEND_ORIGIN: value }));
  assert.throws(() => serverConfig({ NODE_ENV: 'production' }));
  assert.throws(() => serverConfig({ NODE_ENV: 'production', FRONTEND_ORIGIN: 'http://example.test' }));
  assert.throws(() => serverConfig({ PORT: '0' }));
  assert.throws(() => serverConfig({ TRUST_PROXY_HOPS: 'true' }));
});

@Controller('ping') class PingController { @Get() get() { return { ok: true }; } }
@Module({ controllers: [PingController] }) class SampleModule {}

test('una URL sirve React y API, conserva rutas profundas y aplica CSP/caché/compresión', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vibetrack-production-'));
  await mkdir(join(directory, 'assets'));
  const html = '<!doctype html><html lang="es"><title>VibeTrack</title><div id="root"></div></html>';
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets', 'app-abcdefgh.js'), 'const music = "vibetrack";\n'.repeat(300));
  await writeFile(join(directory, 'robots.txt'), 'User-agent: *\nAllow: /');
  const app = await NestFactory.create(SampleModule, { logger: false, bodyParser: false });
  configureHttp(app, true);
  serveFrontend(app, directory, true);
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  try {
    for (const path of ['/', '/explorar?q=music', '/recomendaciones/feliz', '/cuenta']) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), html);
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      assert.match(response.headers.get('content-security-policy')!, /script-src 'self' https:\/\/sdk.scdn.co/);
      assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
    }
    const asset = await fetch(origin + '/assets/app-abcdefgh.js', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.match(asset.headers.get('cache-control')!, /max-age=31536000, immutable/);
    assert.equal(asset.headers.get('content-encoding'), 'gzip');
    assert.match(asset.headers.get('content-type')!, /javascript/);
    await asset.arrayBuffer();
    const api = await fetch(origin + '/api/ping');
    assert.deepEqual(await api.json(), { ok: true });
    assert.match(api.headers.get('content-security-policy')!, /default-src 'none'/);
    for (const path of ['/api/missing', '/assets/missing.js', '/.env']) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 404, path);
      assert.notEqual(await response.text(), html, path);
    }
    const robots = await fetch(origin + '/robots.txt');
    assert.equal(robots.headers.get('cache-control'), 'no-cache');
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('producción falla de forma explícita si falta la web compilada', async () => {
  const app = await NestFactory.create(SampleModule, { logger: false, bodyParser: false });
  const directory = await mkdtemp(join(tmpdir(), 'vibetrack-empty-build-'));
  try {
    assert.equal(serveFrontend(app, directory), false);
    assert.throws(() => serveFrontend(app, directory, true), /Falta compilar/);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
