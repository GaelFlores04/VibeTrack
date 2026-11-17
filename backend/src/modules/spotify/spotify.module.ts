import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpException, Inject, Module, Post, Query, Req, Res, UnauthorizedException, UseGuards, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { TASTE_SOURCES } from '../music/spotify-artists';
import { AuthModule, AuthService, WriteGuard } from '../auth/auth.module';
import { MusicModule } from '../music/music.module';
import { SpotifyService } from './spotify.service';

export class MatchTrackDto {
  @IsString() @Matches(/^deezer:\d{1,20}$/) id!: string;
  @IsString() @Length(1, 200) title!: string;
  @IsString() @Length(1, 200) artist!: string;
}
export class MatchDto { @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => MatchTrackDto) tracks!: MatchTrackDto[]; }
export class SourceDto { @IsIn(TASTE_SOURCES) source!: 'app' | 'spotify' | 'both'; }
const sourcePipe = new ValidationPipe({ expectedType: SourceDto, transform: true, whitelist: true, forbidNonWhitelisted: true });
const matchPipe = new ValidationPipe({ expectedType: MatchDto, transform: true, whitelist: true, forbidNonWhitelisted: true });

@Controller('spotify')
export class SpotifyController {
  constructor(@Inject(SpotifyService) private readonly spotify: SpotifyService, @Inject(AuthService) private readonly auth: AuthService) {}

  private async userId(req: any) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para conectar Spotify.');
    return String(user._id);
  }
  private frontend(path: string) { return new URL(path, process.env.FRONTEND_ORIGIN || 'http://localhost:5173').toString(); }

  @Get('status') async status(@Req() req: any) { return this.spotify.status(await this.userId(req)); }

  // Devuelve la URL de autorización; el navegador navega a ella (no es un redirect para poder usar la cookie de sesión).
  @Post('connect') @UseGuards(WriteGuard) @Throttle({ default: { limit: 10, ttl: 60000 } })
  async connect(@Req() req: any) { return { url: this.spotify.authorizeUrl(await this.userId(req)) }; }

  // Regreso desde Spotify. Sin cookie de sesión (SameSite=Strict): el state identifica la cuenta.
  @Get('callback') @Throttle({ default: { limit: 20, ttl: 60000 } })
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: any) {
    try {
      await this.spotify.handleCallback(typeof code === 'string' ? code : undefined, typeof state === 'string' ? state : undefined, typeof error === 'string' ? error : undefined);
      res.redirect(302, this.frontend('/cuenta?spotify=conectado'));
    } catch (failure) {
      const message = failure instanceof HttpException ? String((failure.getResponse() as any)?.message || failure.message) : 'No se pudo conectar Spotify.';
      res.redirect(302, this.frontend(`/cuenta?spotify=error&motivo=${encodeURIComponent(message.slice(0, 200))}`));
    }
  }

  // Token de acceso corto para el Web Playback SDK. No se cachea en el navegador.
  @Get('token') @Throttle({ default: { limit: 30, ttl: 60000 } })
  async token(@Req() req: any, @Res({ passthrough: true }) res: any) {
    res.setHeader('Cache-Control', 'no-store');
    return this.spotify.accessToken(await this.userId(req));
  }

  @Post('import') @UseGuards(WriteGuard) @Throttle({ default: { limit: 5, ttl: 60000 } })
  async import(@Req() req: any) { return this.spotify.importTaste(await this.userId(req)); }

  @Post('match') @UseGuards(WriteGuard) @Throttle({ default: { limit: 30, ttl: 60000 } })
  async match(@Body(matchPipe) body: MatchDto, @Req() req: any) {
    if (!Array.isArray(body?.tracks)) throw new BadRequestException('Lista de canciones no válida.');
    return this.spotify.match(await this.userId(req), body.tracks);
  }

  // Qué gustos usar al recomendar: los de la app, los de Spotify o ambos.
  @Post('source') @HttpCode(204) @UseGuards(WriteGuard) @Throttle({ default: { limit: 20, ttl: 60000 } })
  async source(@Body(sourcePipe) body: SourceDto, @Req() req: any) { await this.spotify.setTasteSource(await this.userId(req), body.source); }

  @Delete() @HttpCode(204) @UseGuards(WriteGuard)
  async disconnect(@Req() req: any) { await this.spotify.disconnect(await this.userId(req)); }
}

@Module({ imports: [AuthModule, MusicModule], controllers: [SpotifyController], providers: [SpotifyService] })
export class SpotifyModule {}
