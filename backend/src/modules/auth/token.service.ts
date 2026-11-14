import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const header = encode({ alg: 'HS256', typ: 'JWT' });
const lifetime = 7 * 24 * 60 * 60;
// JWT HS256 exclusivamente: no se negocian algoritmos ni se aceptan claves del token.
@Injectable()
export class TokenService implements OnModuleInit {
  onModuleInit() { if (process.env.MONGODB_URI) void this.secret; }
  private get secret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('Configura JWT_SECRET con al menos 32 caracteres.');
    return secret;
  }
  private signature(content: string) { return createHmac('sha256', this.secret).update(content).digest(); }
  async signAsync(claims: { sub: string; jti: string }) {
    const now = Math.floor(Date.now() / 1000);
    const content = `${header}.${encode({ ...claims, iss: 'vibetrack', aud: 'vibetrack-web', iat: now, exp: now + lifetime })}`;
    return `${content}.${this.signature(content).toString('base64url')}`;
  }
  async verifyAsync(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== header || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Token inválido.');
    const actual = Buffer.from(parts[2], 'base64url');
    const expected = this.signature(`${parts[0]}.${parts[1]}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Firma inválida.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const now = Date.now() / 1000;
    if (claims.iss !== 'vibetrack' || claims.aud !== 'vibetrack-web' || !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 30 || claims.exp - claims.iat > lifetime || typeof claims.sub !== 'string' || typeof claims.jti !== 'string') throw new Error('Token expirado o inválido.');
    return claims as { sub: string; jti: string };
  }
}
