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
