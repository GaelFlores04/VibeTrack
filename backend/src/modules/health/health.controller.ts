import { Controller, Get, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  @Get()
  health() {
    return { status: 'ok', database: this.database.status, providers: { itunes: 'not_checked', lastfm: process.env.LASTFM_API_KEY ? 'configured' : 'not_configured' } };
  }
}
