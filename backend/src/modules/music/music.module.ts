import { Controller, Get, Inject, Module, Param, Query, ValidationPipe } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { MusicService } from './music.service';

export class SearchQuery { @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(2, 100) q!: string; }
export class RecommendationsQuery { @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1; }
// El DTO explícito permite validar también con el runner tsx (sin metadata emitida).
const searchPipe = new ValidationPipe({ expectedType: SearchQuery, transform: true, whitelist: true, forbidNonWhitelisted: true });
const recommendationsPipe = new ValidationPipe({ expectedType: RecommendationsQuery, transform: true, whitelist: true, forbidNonWhitelisted: true });
@Controller('music')
export class MusicController {
  constructor(@Inject(MusicService) private readonly music: MusicService) {}
  @Get('search') search(@Query(searchPipe) query: SearchQuery) { return this.music.search(query.q.trim()); }
  @Get('recommendations/:mood') recommendations(@Param('mood') mood: string, @Query(recommendationsPipe) query: RecommendationsQuery) { return this.music.recommendations(mood, query.page); }
}
@Module({ controllers: [MusicController], providers: [MusicService] })
export class MusicModule {}
