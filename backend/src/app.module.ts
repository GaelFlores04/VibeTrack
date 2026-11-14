import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './modules/database/database.module';
import { HealthController } from './modules/health/health.controller';
import { MoodsModule } from './modules/moods/moods.module';
import { MusicModule } from './modules/music/music.module';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]), DatabaseModule, MoodsModule, MusicModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
