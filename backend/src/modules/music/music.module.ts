import { publicTrack } from './track.dto';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Controller, Get, Inject, Module, Param, Query, Req, ValidationPipe } from '@nestjs/common';
import { AuthModule, AuthService } from '../auth/auth.module';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { MusicService } from './music.service';
import { MusicCache } from './music-cache';

export class SearchQuery { @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(2, 100) q!: string; }
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
  @Get('search') async search(@Query(searchPipe) query: SearchQuery) { return (await this.music.search(query.q.trim())).map(publicTrack); }
  @Get('artists') artists(@Query(new ValidationPipe({ expectedType: SuggestionQuery, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: SuggestionQuery) { return this.music.artists(query.q); }
  @Get('suggestions') suggestions(@Query(new ValidationPipe({ expectedType: SuggestionQuery, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: SuggestionQuery) { return this.music.suggestions(query.q); }
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
@Module({ imports: [AuthModule], controllers: [MusicController], providers: [MusicService, MusicCache] })
export class MusicModule {}
