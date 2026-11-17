import { publicTrack } from './track.dto';
import { BadRequestException, Body, Delete, HttpCode, Logger, Post, Res, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Controller, Get, Inject, Module, Param, Query, Req, ValidationPipe } from '@nestjs/common';
import { AuthModule, AuthService, WriteGuard } from '../auth/auth.module';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { MusicService } from './music.service';
import { MusicCache } from './music-cache';
import { GENRE_GROUPS } from './genres';
import { PROFILES } from './recommendation-engine';
import { TasteRuleInput } from './taste-rules';

export class TasteRuleDto implements TasteRuleInput {
  @IsIn(['song', 'artist', 'genre']) target!: TasteRuleInput['target'];
  @IsIn(['more', 'less', 'exclude']) action!: TasteRuleInput['action'];
  @IsString() @Length(1, 200) name!: string;
  @IsOptional() @IsString() @Length(1, 120) artist?: string;
}

export class SearchQuery { @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(2, 100) q!: string; }
export class PlayDto { @IsString() @Matches(/^deezer:\d{1,20}$/) id!: string; }
export class FeedbackDto {
  @IsString() @Length(1, 200) trackId!: string;
  @IsIn(Object.keys(PROFILES)) mood!: string;
  @IsIn(['like', 'dislike', null]) rating!: 'like' | 'dislike' | null;
}
export class SuggestionQuery { @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(1, 100) q!: string; }
export class RecommendationsQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9-]{1,64}$/) session?: string;
}
// El DTO explícito permite validar también con el runner tsx (sin metadata emitida).
const searchPipe = new ValidationPipe({ expectedType: SearchQuery, transform: true, whitelist: true, forbidNonWhitelisted: true });
const recommendationsPipe = new ValidationPipe({ expectedType: RecommendationsQuery, transform: true, whitelist: true, forbidNonWhitelisted: true });
@Controller('music')
export class MusicController {
  constructor(@Inject(MusicService) private readonly music: MusicService, @Inject(AuthService) private readonly auth: AuthService) {}
  @Get('genres') genres() { return GENRE_GROUPS; }
  @Get('taste-rules') async tasteRules(@Req() req: any) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para consultar tus ajustes.');
    return this.music.tasteRules(String(user._id));
  }
  @Post('taste-rules') @UseGuards(WriteGuard)
  async saveTasteRule(@Req() req: any, @Body(new ValidationPipe({ expectedType: TasteRuleDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) body: TasteRuleDto) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para guardar tus ajustes.');
    return this.music.saveTasteRule(String(user._id), body);
  }
  @Delete('taste-rules/:key') @HttpCode(204) @UseGuards(WriteGuard)
  async removeTasteRule(@Req() req: any, @Param('key') key: string) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para cambiar tus ajustes.');
    await this.music.removeTasteRule(String(user._id), key);
  }
  @Get('feedback/:mood/history') async ratingHistory(@Param('mood') mood: string, @Req() req: any) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para consultar tus valoraciones.');
    return this.music.ratingHistory(String(user._id), mood);
  }
  @Delete('feedback/:mood/:key') @HttpCode(204) @UseGuards(WriteGuard)
  async removeRating(@Param('mood') mood: string, @Param('key') key: string, @Req() req: any) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para cambiar tus valoraciones.');
    await this.music.removeRating(String(user._id), mood, key);
  }
  @Get('feedback/:mood') async ratings(@Param('mood') mood: string, @Req() req: any) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para consultar tus valoraciones.');
    return this.music.ratings(String(user._id), mood);
  }
  @Post('feedback') @UseGuards(WriteGuard) @Throttle({ default: { limit: 60, ttl: 60000 } })
  async rate(@Body(new ValidationPipe({ expectedType: FeedbackDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) body: FeedbackDto, @Req() req: any) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para guardar tus valoraciones.');
    return this.music.rate(String(user._id), body.mood, body.trackId, body.rating);
  }
  @Get('search') async search(@Query(searchPipe) query: SearchQuery) { return (await this.music.search(query.q.trim())).map(publicTrack); }
  @Get('artists') artists(@Query(new ValidationPipe({ expectedType: SuggestionQuery, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: SuggestionQuery) { return this.music.artists(query.q); }
  @Get('suggestions') suggestions(@Query(new ValidationPipe({ expectedType: SuggestionQuery, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: SuggestionQuery) { return this.music.suggestions(query.q); }
  // Redirige a una URL firmada recién emitida por Deezer; las de las tarjetas nunca caducan.
  @Get('preview/:id') @Throttle({ default: { limit: 120, ttl: 60000 } })
  async preview(@Param('id') id: string, @Res() res: any) {
    if (!/^\d{1,20}$/.test(id)) throw new BadRequestException('Identificador de preview no válido.');
    const url = await this.music.previewUrl(id);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.redirect(302, url);
  }
  // Aprende de las previews que escuchas (sólo cuentas). Guarda agregados, no un historial.
  @Post('plays') @HttpCode(204) @UseGuards(WriteGuard) @Throttle({ default: { limit: 30, ttl: 60000 } })
  async play(@Body(new ValidationPipe({ expectedType: PlayDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) body: PlayDto, @Req() req: any) {
    const user = await this.auth.current(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para personalizar.');
    await this.music.recordPlay(String(user._id), body.id.slice('deezer:'.length)).catch(() => {});
  }
  @Get('recommendations/:mood') async recommendations(@Param('mood') mood: string, @Query(recommendationsPipe) query: RecommendationsQuery, @Req() req: any) {
    let user;
    try { user = await this.auth.current(req); }
    catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      new Logger('MusicController').warn('Sesión no disponible: se usa selección de invitado.');
    }
    const result = await this.music.recommendations(mood, query.page, user?.preferences, query.session, user ? String(user._id) : 'guest');
    return { ...result, tracks: result.tracks.map(publicTrack) };
  }
}
@Module({ imports: [AuthModule], controllers: [MusicController], providers: [MusicService, MusicCache], exports: [MusicService] })
export class MusicModule {}
