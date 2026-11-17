import { Controller, Get, Module } from '@nestjs/common';
import { PROFILES } from '../music/recommendation-engine';

export const MOODS = [
  { slug: 'feliz', name: 'Feliz', tag: 'happy' },
  { slug: 'relajado', name: 'Relajado', tag: 'chillout' },
  { slug: 'motivado', name: 'Motivado', tag: 'workout' },
  { slug: 'triste', name: 'Triste', tag: 'sad' },
  { slug: 'romantico', name: 'Romántico', tag: 'romantic' },
  { slug: 'cansado', name: 'Cansado', tag: 'ambient' },
];
@Controller('moods')
class MoodsController { @Get() list() { return MOODS.map(({ slug, name }) => ({ slug, name, description: PROFILES[slug].description })); } }
@Module({ controllers: [MoodsController] })
export class MoodsModule {}
