import { Body, CanActivate, ConflictException, Controller, Delete, ExecutionContext, ForbiddenException, Get, Inject, Injectable, Module, Post, Put, Req, Res, UnauthorizedException, UseGuards, ValidationPipe } from '@nestjs/common';
import { TokenService } from './token.service';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Schema } from 'mongoose';
import { DatabaseService } from '../database/database.module';

export const GENRES = ['pop', 'rock', 'indie', 'electronic', 'hip-hop', 'r&b', 'latin', 'jazz', 'classical', 'folk', 'metal', 'ambient'];
export class CredentialsDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(10, 128) password!: string;
}
export class RegisterDto extends CredentialsDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(2, 60) name!: string;
}
export class PreferencesDto {
  @IsArray() @ArrayMaxSize(6) @ArrayUnique() @IsIn(GENRES, { each: true }) genres!: string[];
  @IsArray() @ArrayMaxSize(5) @ArrayUnique() @IsString({ each: true }) @Length(1, 80, { each: true }) artists!: string[];
}
const preferencesSchema = new Schema({
  genres: { type: [String], enum: GENRES, default: [] }, artists: { type: [String], default: [] },
}, { _id: false });
const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, maxlength: 254 },
  name: { type: String, required: true, minlength: 2, maxlength: 60 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user'], default: 'user' },
  preferences: { type: preferencesSchema, default: null },
}, { timestamps: true });
const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
const DAYS = 7 * 24 * 60 * 60;
const cookieName = 'vibetrack_session';
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 65536, maxmem: 128 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derivePassword(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, hex] = encoded.split(':');
  const expected = Buffer.from(hex || '', 'hex');
  const actual = await derivePassword(password, salt || 'invalid-account-dummy-salt');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function publicUser(user: any) {
  return { id: String(user._id), email: user.email, name: user.name, preferences: user.preferences ? { genres: [...user.preferences.genres], artists: [...user.preferences.artists] } : null };
}
@Injectable()
export class AuthService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(TokenService) private readonly jwt: TokenService) {}
  private get users() { return this.database.db.models.User || this.database.db.model('User', userSchema); }
  private get sessions() { return this.database.db.models.Session || this.database.db.model('Session', sessionSchema); }
  async register(input: RegisterDto) {
    await this.users.init(); // El índice único evita registros duplicados incluso con peticiones simultáneas.
    try { return await this.users.create({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) }); }
    catch (error: any) { if (error?.code === 11000) throw new ConflictException('Ese correo ya está registrado.'); throw error; }
  }
  async login(input: CredentialsDto) {
    const user = await this.users.findOne({ email: input.email }).select('+passwordHash');
    const valid = await verifyPassword(input.password, user?.passwordHash || '');
    if (!user || !valid) throw new UnauthorizedException('Correo o contraseña incorrectos.');
    return user;
  }
  async issue(user: any) {
    const token = await this.jwt.signAsync({ sub: String(user._id), jti: randomBytes(24).toString('hex') });
    await this.sessions.create({ userId: user._id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + DAYS * 1000) });
    return token;
  }
  private cookie(req: any): string | undefined {
    return String(req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  }
  async current(req: any) {
    const token = this.cookie(req);
    if (!token || token.length > 4096) return null;
    let payload: { sub: string };
    try { payload = await this.jwt.verifyAsync(token); } catch { return null; }
    if (!/^[a-f0-9]{24}$/.test(payload.sub)) return null;
    const session = await this.sessions.findOne({ userId: payload.sub, tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    return session ? this.users.findById(payload.sub) : null;
  }
  async logout(req: any) {
    const token = this.cookie(req);
    if (token) await this.sessions.deleteOne({ tokenHash: tokenHash(token) });
  }
  async preferences(user: any, input: PreferencesDto | null) {
    return this.users.findByIdAndUpdate(user._id, { $set: { preferences: input } }, { new: true, runValidators: true });
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = await this.auth.current(req);
    if (!req.user) throw new UnauthorizedException('Inicia sesión para continuar.');
    return true;
  }
}
// Cabecera no simple + origen verificado: un formulario externo no puede modificar la sesión.
@Injectable()
export class WriteGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const allowed = [process.env.FRONTEND_ORIGIN || 'http://localhost:5173'];
    if (process.env.NODE_ENV !== 'production') allowed.push('http://127.0.0.1:5173');
    if (req.headers['x-vibetrack'] !== '1' || (req.headers.origin && !allowed.includes(req.headers.origin))) throw new ForbiddenException('Origen de petición no permitido.');
    return true;
  }
}
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api', maxAge: DAYS * 1000 });
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post('register') @UseGuards(WriteGuard) @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body(new ValidationPipe({ expectedType: RegisterDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) input: RegisterDto, @Res({ passthrough: true }) res: any) {
    const user = await this.auth.register(input);
    res.cookie(cookieName, await this.auth.issue(user), cookieOptions());
    return publicUser(user);
  }
  @Post('login') @UseGuards(WriteGuard) @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body(new ValidationPipe({ expectedType: CredentialsDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) input: CredentialsDto, @Res({ passthrough: true }) res: any) {
    const user = await this.auth.login(input);
    res.cookie(cookieName, await this.auth.issue(user), cookieOptions());
    return publicUser(user);
  }
  @Get('me') async me(@Req() req: any) { const user = await this.auth.current(req); return user ? publicUser(user) : null; }
  @Post('logout') @UseGuards(WriteGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    await this.auth.logout(req); res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined }); return { ok: true };
  }
  @Put('preferences') @UseGuards(WriteGuard, AuthGuard)
  async preferences(@Req() req: any, @Body(new ValidationPipe({ expectedType: PreferencesDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) input: PreferencesDto) {
    const clean = { genres: input.genres, artists: [...new Set(input.artists.map(artist => artist.trim()).filter(Boolean))] };
    return publicUser(await this.auth.preferences(req.user, clean.genres.length || clean.artists.length ? clean : null));
  }
  @Delete('preferences') @UseGuards(WriteGuard, AuthGuard)
  async clearPreferences(@Req() req: any) { return publicUser(await this.auth.preferences(req.user, null)); }
}
@Module({
  providers: [TokenService, AuthService, AuthGuard, WriteGuard], controllers: [AuthController], exports: [AuthService, AuthGuard, WriteGuard],
})
export class AuthModule {}
