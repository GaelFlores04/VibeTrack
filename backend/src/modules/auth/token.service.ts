import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export const ACCESS_LIFETIME = 60 * 60;
export interface SessionClaims { sub: string; jti: string; iat: number; exp: number }
@Injectable()
export class TokenService implements OnModuleInit {
  private readonly jwt = new JwtService();
  onModuleInit() { if (process.env.MONGODB_URI) void this.secret; }
  private get secret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('Configura JWT_SECRET con al menos 32 caracteres.');
    return secret;
  }
  signAsync(claims: { sub: string; jti: string }) {
    return this.jwt.signAsync(claims, {
      secret: this.secret, algorithm: 'HS256', issuer: 'vibetrack', audience: 'vibetrack-web',
      expiresIn: ACCESS_LIFETIME,
    });
  }
  async verifyAsync(token: string, forRefresh = false): Promise<SessionClaims> {
    const claims = await this.jwt.verifyAsync<SessionClaims>(token, {
      secret: this.secret, algorithms: ['HS256'], issuer: 'vibetrack', audience: 'vibetrack-web',
      ignoreExpiration: forRefresh,
    });
    const now = Date.now() / 1000;
    if (!Number.isFinite(claims.exp) || !Number.isFinite(claims.iat) || claims.iat > now + 30
      || claims.exp <= claims.iat || claims.exp - claims.iat > ACCESS_LIFETIME
      || typeof claims.sub !== 'string' || typeof claims.jti !== 'string' || !claims.jti) {
      throw new Error('Token expirado o inválido.');
    }
    return claims;
  }
}
