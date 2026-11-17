import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { derivePassword, hashPassword, validatePassword, verifyPassword } from '../src/modules/auth/password.service';
import { Roles, RolesGuard } from '../src/modules/auth/roles.guard';
import { publicTrack } from '../src/modules/music/track.dto';
import { ApiExceptionFilter, redactError } from '../src/common/api-exception.filter';

test('scrypt versionado conserva compatibilidad con hashes anteriores', async () => {
  const salt = randomBytes(16).toString('hex');
  const legacy = `${salt}:${(await derivePassword('legacy-password', salt, 65536)).toString('hex')}`;
  assert.ok(await verifyPassword('legacy-password', legacy));
  assert.match(await hashPassword('a strong passphrase'), /^scrypt-v2:32768:8:1:/);
  assert.equal(await verifyPassword('password', 'unsupported:hash'), false);
  assert.throws(() => validatePassword('password123', 'a@example.com'));
  assert.throws(() => validatePassword('a@example.com-pass', 'a@example.com'));
});

test('cola de contraseñas rechaza saturación sin iniciar derivaciones ilimitadas', async () => {
  const results = await Promise.allSettled(Array.from({ length: 11 }, () => hashPassword('test-password')));
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.getStatus(), 429);
});

test('roles distinguen sesión ausente de permiso insuficiente', () => {
  @Roles('admin') class AdminResource {}
  const guard = new RolesGuard();
  const context = (user?: any) => ({ getClass: () => AdminResource, getHandler: () => function handler() {}, switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;
  assert.throws(() => guard.canActivate(context()), (error: any) => error.getStatus() === 401);
  assert.throws(() => guard.canActivate(context({ role: 'user' })), (error: any) => error.getStatus() === 403);
  assert.equal(guard.canActivate(context({ role: 'admin' })), true);
});

test('salida pública no revela campos del motor ni muta candidatos', () => {
  const source = { id: 'x', title: 'Song', artist: 'Artist', externalUrl: 'https://example.test', tags: ['happy'], listeners: 10, metadataChecked: true, relatedTo: 'Private', retryAt: 1 };
  const result = publicTrack(source);
  for (const key of ['tags', 'listeners', 'metadataChecked', 'relatedTo', 'retryAt']) assert.ok(!(key in result));
  assert.deepEqual(source.tags, ['happy']);
});

test('errores JSON no revelan el cuerpo y devuelven requestId', () => {
  const headers = new Map(); let output: any;
  const response = { setHeader: (key: string, value: string) => headers.set(key, value), status: () => ({ json: (value: any) => { output = value; } }) };
  new ApiExceptionFilter().catch({ type: 'entity.parse.failed', message: 'secret body' }, { switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => response }) } as any);
  assert.equal(output.statusCode, 400);
  assert.equal(output.message, 'Cuerpo de la petición no válido.');
  assert.equal(headers.get('X-Request-Id'), output.requestId);
  assert.doesNotMatch(redactError('fetch https://example.test/?api_key=hidden password=hidden'), /hidden/);
});


test('JWT corto: refresh verifica firma y limita duración aun aceptando expiración', async () => {
  const { TokenService, ACCESS_LIFETIME } = await import('../src/modules/auth/token.service');
  const { JwtService } = await import('@nestjs/jwt');
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  const service = new TokenService();
  const token = await service.signAsync({ sub: 'account', jti: 'session' });
  const payload = await service.verifyAsync(token);
  assert.equal(payload.exp - payload.iat, ACCESS_LIFETIME);
  const expired = new JwtService().sign({ sub: 'account', jti: 'session', iat: Math.floor(Date.now() / 1000) - 7200 }, {
    secret: process.env.JWT_SECRET, algorithm: 'HS256', issuer: 'vibetrack', audience: 'vibetrack-web', expiresIn: 3600,
  });
  await assert.rejects(service.verifyAsync(expired));
  assert.equal((await service.verifyAsync(expired, true)).jti, 'session');
  await assert.rejects(service.verifyAsync(expired + 'invalid', true));
});


test('recomendaciones públicas toleran base caída al comprobar una cookie vieja', async () => {
  const { MusicController } = await import('../src/modules/music/music.module');
  const { ServiceUnavailableException } = await import('@nestjs/common');
  let account: string | undefined;
  const music = { recommendations: async (_mood: string, _page: number, _prefs: any, _session: any, userId: string) => {
    account = userId; return { tracks: [], status: 'exhausted' };
  } };
  const auth = { current: async () => { throw new ServiceUnavailableException(); } };
  const result = await new MusicController(music as any, auth as any).recommendations('feliz', { page: 1 }, {});
  assert.equal(account, 'guest');
  assert.deepEqual(result.tracks, []);
});
