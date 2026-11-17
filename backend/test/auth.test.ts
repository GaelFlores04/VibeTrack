import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthModule, hashPassword, publicUser, verifyPassword } from '../src/modules/auth/auth.module';
import { TokenService } from '../src/modules/auth/token.service';
import { DatabaseService } from '../src/modules/database/database.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';

test('contraseñas con salt propio, verificación y salida pública sin hash', async () => {
  const hash = await hashPassword('a password with spaces');
  assert.notEqual(hash, await hashPassword('a password with spaces'));
  assert.ok(await verifyPassword('a password with spaces', hash));
  assert.equal(await verifyPassword('wrong password', hash), false);
  assert.equal(await verifyPassword('no account', ''), false);
  assert.equal('passwordHash' in publicUser({ _id: 'x', name: 'Name', email: 'a@b.com', passwordHash: hash, preferences: null }), false);
});
test('JWT verifica firma, expiración, algoritmo, emisor y audiencia sin aceptar none', async () => {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  const jwt = new TokenService();
  const token = await jwt.signAsync({ sub: 'a'.repeat(24), jti: 'test' });
  assert.equal((await jwt.verifyAsync(token)).sub, 'a'.repeat(24));
  await assert.rejects(jwt.verifyAsync(`${token.slice(0, -10)}WRONG`));
  const sign = (claims: any, alg = 'HS256') => {
    const content = `${Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
    return `${content}.${createHmac('sha256', process.env.JWT_SECRET!).update(content).digest('base64url')}`;
  };
  const now = Math.floor(Date.now() / 1000);
  const base = { sub: 'a'.repeat(24), jti: 'id', iss: 'vibetrack', aud: 'vibetrack-web', iat: now, exp: now + 60 };
  for (const claims of [{ ...base, exp: now - 1 }, { ...base, iss: 'other' }, { ...base, aud: 'other' }, { ...base, iat: now + 120 }, { ...base, exp: 'tomorrow' }]) await assert.rejects(jwt.verifyAsync(sign(claims)));
  await assert.rejects(jwt.verifyAsync(sign(base, 'none')));
  await assert.rejects(jwt.verifyAsync(sign(base, 'HS512')));
});

// Repositorio aislado: prueba HTTP real con AuthService/JWT reales, sin tocar cuentas de Atlas.
function memoryDatabase() {
  const users: any[] = []; const sessions: any[] = [];
  const User = {
    init: async () => {},
    create: async (input: any) => {
      if (users.some(user => user.email === input.email)) throw { code: 11000 };
      const user = { ...input, _id: randomBytes(12).toString('hex'), preferences: null }; users.push(user); return user;
    },
    findOne: (query: any) => ({ select: async () => users.find(user => user.email === query.email) || null }),
    findById: async (id: string) => users.find(user => user._id === id) || null,
    findByIdAndUpdate: async (id: string, update: any) => { const user = users.find(item => item._id === id); Object.assign(user, update.$set); return user; },
  };
  const Session = {
    updateOne: async (query: any, update: any) => {
      const item = sessions.find(session => session.userId === query.userId && session.tokenHash === query.tokenHash && session.expiresAt > query.expiresAt.$gt);
      if (item) Object.assign(item, update.$set);
      return { matchedCount: item ? 1 : 0 };
    },
    find: (query: any) => ({ sort: () => ({ skip: (offset: number) => ({ select: async () => sessions.filter(item => item.userId === query.userId).slice().reverse().slice(offset) }) }) }),
    deleteMany: async (query: any) => { for (let i = sessions.length - 1; i >= 0; i--) if (query._id?.$in.includes(sessions[i]._id) || query.userId === sessions[i].userId) sessions.splice(i, 1); },
    create: async (input: any) => { input._id = randomBytes(12).toString('hex'); sessions.push(input); return input; },
    findOne: async (query: any) => sessions.find(session => session.userId === query.userId && session.tokenHash === query.tokenHash && session.expiresAt > query.expiresAt.$gt) || null,
    deleteOne: async (query: any) => { const index = sessions.findIndex(session => session.tokenHash === query.tokenHash); if (index >= 0) sessions.splice(index, 1); },
  };
  return { db: { models: { User, Session } }, users, sessions };
}

test('rutas HTTP en memoria: registro, login, preferencias aisladas, validación, CSRF y logout revocable', { timeout: 15000 }, async () => {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  const database = memoryDatabase();
  // DatabaseModule es global en producción; aquí reemplazamos únicamente la persistencia.
  const { Global } = await import('@nestjs/common');
  @Global() @Module({ providers: [{ provide: DatabaseService, useValue: database }], exports: [DatabaseService] }) class TestDatabase {}
  @Module({ imports: [TestDatabase, AuthModule] }) class TestApp {}
  const app = await NestFactory.create(TestApp, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  // IncomingMessage/ServerResponse reales, sin abrir conexiones TCP bloqueadas por el sandbox.
  const request = (path: string, method = 'GET', body?: any, cookie?: string, extraHeaders: any = {}): Promise<Response> => new Promise((resolve, reject) => {
    const bytes: Buffer[] = [];
    const socket = new Duplex({ read() {}, write(chunk, _encoding, done) { bytes.push(Buffer.from(chunk)); done(); } });
    const req = new IncomingMessage(socket as any);
    const text = body ? JSON.stringify(body) : '';
    req.method = method; req.url = `/api/auth/${path}`;
    req.headers = Object.fromEntries(Object.entries({ 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(text)), 'X-VibeTrack': '1', ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }).map(([key, value]) => [key.toLowerCase(), value as string]));
    let sent = false;
    req._read = () => { if (!sent) { sent = true; if (text) req.push(Buffer.from(text)); req.push(null); } };
    const res = new ServerResponse(req);
    res.on('error', reject);
    res.write = ((chunk: any) => { bytes.push(Buffer.from(chunk)); return true; }) as any;
    res.end = ((chunk: any) => {
      if (chunk) bytes.push(Buffer.from(chunk));
      const bodyText = Buffer.concat(bytes).toString();
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.getHeaders())) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(key, String(item));
      resolve(new Response(bodyText, { status: res.statusCode, headers })); socket.destroy();
      return res;
    }) as any;
    app.getHttpAdapter().getInstance().handle(req, res);
  });
  const credentials = { email: 'Student@Example.com', password: 'example-password-123', name: 'Student' };
  try {
    assert.equal(await (await request('me')).json().catch(() => null), null);
    assert.equal((await request('register', 'POST', credentials, undefined, { 'X-VibeTrack': '' })).status, 403);
    assert.equal((await request('register', 'POST', credentials, undefined, { Origin: 'https://other.example' })).status, 403);
    assert.equal((await request('register', 'POST', { ...credentials, password: 'short' })).status, 400);
    assert.equal((await request('register', 'POST', { ...credentials, role: 'admin' })).status, 400);
    const response = await request('register', 'POST', credentials);
    assert.equal(response.status, 201);
    const cookieHeader = response.headers.get('set-cookie')!;
    assert.match(cookieHeader, /HttpOnly/i); assert.match(cookieHeader, /SameSite=Strict/i);
    const cookie = cookieHeader.split(';')[0];
    const registered = await response.json().catch(() => null);
    assert.equal(registered.email, 'student@example.com');
    assert.equal(registered.preferences, null);
    assert.ok(!JSON.stringify(registered).includes('password'));
    assert.notEqual(database.users[0].passwordHash, credentials.password);
    assert.ok(!database.sessions[0].tokenHash.includes(cookie.split('=')[1]));
    assert.equal((await request('register', 'POST', credentials)).status, 409);
    assert.equal((await request('preferences', 'PUT', { genres: ['pop'], artists: [] })).status, 401);
    assert.equal((await request('preferences', 'PUT', { genres: ['invented'], artists: [] }, cookie)).status, 400);
    assert.equal((await request('preferences', 'PUT', { genres: ['pop'], artists: [], userId: 'someone-else' }, cookie)).status, 400);
    assert.equal((await request('preferences', 'PUT', { genres: ['rock', 'pop'], artists: [' Daft Punk '] }, cookie)).status, 200);
    assert.deepEqual((await (await request('me', 'GET', undefined, cookie)).json().catch(() => null)).preferences, { genres: ['rock', 'pop'], artists: ['Daft Punk'], preferenceLevel: 3 });
    for (const preferenceLevel of [0, 6, 2.5, '5']) assert.equal((await request('preferences', 'PUT', { genres: [], artists: [], preferenceLevel }, cookie)).status, 400);
    assert.equal((await request('preferences', 'PUT', { genres: [], artists: [], preferenceLevel: 5 }, cookie)).status, 200);
    assert.equal((await (await request('me', 'GET', undefined, cookie)).json()).preferences.preferenceLevel, 5);
    const second = await request('register', 'POST', { ...credentials, email: 'other@example.com' });
    const otherCookie = second.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await (await request('me', 'GET', undefined, otherCookie)).json().catch(() => null)).preferences, null);
    assert.equal((await request('login', 'POST', { email: credentials.email, password: 'wrong-password' })).status, 401);
    const login = await request('login', 'POST', { email: credentials.email, password: credentials.password });
    assert.equal(login.status, 201);
    const loginCookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.ok((await (await request('me', 'GET', undefined, loginCookie)).json().catch(() => null)).preferences);
    await request('preferences', 'DELETE', undefined, loginCookie);
    assert.equal((await (await request('me', 'GET', undefined, loginCookie)).json().catch(() => null)).preferences, null);
    await request('logout', 'POST', undefined, loginCookie);
    assert.equal(await (await request('me', 'GET', undefined, loginCookie)).json().catch(() => null), null);
    assert.equal((await request('preferences', 'PUT', { genres: ['rock'], artists: [] }, loginCookie)).status, 401);
    let latestCookie = '';
    for (let i = 0; i < 6; i++) {
      const loginResponse = await request('login', 'POST', { email: credentials.email, password: credentials.password });
      assert.equal(loginResponse.status, 201);
      latestCookie = loginResponse.headers.get('set-cookie')!.split(';')[0];
    }
    assert.equal(database.sessions.filter(item => item.userId === registered.id).length, 5);
    assert.equal(await (await request('me', 'GET', undefined, cookie)).json().catch(() => null), null);
    assert.equal((await request('logout-all', 'POST', undefined, latestCookie)).status, 201);
    assert.equal(database.sessions.filter(item => item.userId === registered.id).length, 0);
    assert.equal((await request('logout-all', 'POST')).status, 401);
    const revoked = await request('refresh', 'POST', undefined, latestCookie);
    assert.equal(await revoked.json().catch(() => null), null);
    assert.match(revoked.headers.get('set-cookie') || '', /vibetrack_session=;.*Expires=Thu, 01 Jan 1970/, 'la cookie revocada se borra del navegador');
    assert.equal((await request('refresh', 'POST')).headers.get('set-cookie'), null, 'sin cookie no se envía Set-Cookie');
    const fresh = await request('login', 'POST', { email: credentials.email, password: credentials.password });
    const refreshCookie = fresh.headers.get('set-cookie')!.split(';')[0];
    const refreshed = await request('refresh', 'POST', undefined, refreshCookie);
    assert.equal((await refreshed.json()).id, registered.id);
    assert.match(refreshed.headers.get('set-cookie')!, /HttpOnly/);
    const realNow = Date.now;
    const started = realNow();
    try {
      Date.now = () => started + 50 * 60000;
      const rotated = await request('refresh', 'POST', undefined, refreshCookie);
      const rotatedCookie = rotated.headers.get('set-cookie')!.split(';')[0];
      assert.notEqual(rotatedCookie, refreshCookie);
      assert.equal(await (await request('me', 'GET', undefined, refreshCookie)).json().catch(() => null), null);
      assert.equal((await (await request('me', 'GET', undefined, rotatedCookie)).json()).id, registered.id);
      for (const session of database.sessions) session.expiresAt = new Date(0);
      Date.now = () => started + 8 * 24 * 60 * 60000;
      assert.equal(await (await request('refresh', 'POST', undefined, rotatedCookie)).json().catch(() => null), null);
    } finally { Date.now = realNow; }


    for (let i = 0; i < 5; i++) assert.equal((await request('login', 'POST', { email: 'missing@example.com', password: 'wrong-password' })).status, 401);
    assert.equal((await request('login', 'POST', { email: 'missing@example.com', password: 'wrong-password' })).status, 429);

  } finally { await app.close(); }
});
