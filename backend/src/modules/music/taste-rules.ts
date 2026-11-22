import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DatabaseService } from '../database/database.module';
import { GENRE_KEYS, GENRE_GROUPS, genreSources } from './genres';
import { normalize } from './music-normalize';
import { matchingTitle } from './track-matching';
import type { Candidate } from './recommendation-engine';

export type TasteTarget = 'song' | 'artist' | 'genre';
export type TasteAction = 'more' | 'less' | 'exclude';
export interface TasteRule { key: string; target: TasteTarget; name: string; artist?: string; action: TasteAction; updatedAt: number }
export type TasteRuleInput = Pick<TasteRule, 'target' | 'name' | 'artist' | 'action'>;
export const tasteRuleKey = (rule: Pick<TasteRule, 'target' | 'name' | 'artist'>) => createHash('sha256')
  .update(JSON.stringify([rule.target, rule.target === 'song' ? matchingTitle(rule.name) : normalize(rule.name), normalize(rule.artist || '')])).digest('hex');

// Explicit global instructions are independent of mood feedback. The most
// specific instruction wins: song > artist > genre, including exceptions.
export function ruleFor(track: Candidate, rules: TasteRule[] = []): TasteRule | undefined {
  const versions = [track, track.match].filter(Boolean) as Candidate[];
  const tags = [...(track.tags || []), ...(track.sourceGenres || []), track.genre || ''].map(normalize);
  for (const target of ['song', 'artist', 'genre'] as const) {
    const found = rules.filter(rule => rule.target === target && (target === 'song'
      ? versions.some(item => matchingTitle(item.title) === matchingTitle(rule.name) && normalize(item.artist) === normalize(rule.artist || ''))
      : target === 'artist' ? versions.some(item => normalize(item.artist) === normalize(rule.name))
        : [...genreSources(rule.name), ...(GENRE_GROUPS.find(group => group.id === rule.name)?.children.map(([id]) => id) || [])].some(tag => tags.includes(normalize(tag))) || tags.includes(normalize(rule.name))));
    if (found.length) return found.sort((a, b) => ({ exclude: 3, less: 2, more: 1 }[b.action] - { exclude: 3, less: 2, more: 1 }[a.action]))[0];
  }
}
export const ruleAdjustment = (track: Candidate, rules?: TasteRule[]) => {
  const rule = ruleFor(track, rules);
  return !rule ? 0 : rule.action === 'more' ? (rule.target === 'song' ? .35 : .2) : rule.action === 'less' ? -.3 : -1;
};

export class TasteRulesStore {
  private memory = new Map<string, Record<string, TasteRule>>();
  constructor(private readonly database?: DatabaseService) {}
  private collection() {
    if (!this.database) return null;
    if (this.database.status !== 'connected') throw new ServiceUnavailableException('No se pudieron consultar tus ajustes musicales.');
    return this.database.db.collection<any>('taste_rules');
  }
  async load(userId: string): Promise<TasteRule[]> {
    const collection = this.collection();
    try {
      const rules = collection ? (await collection.findOne({ _id: userId }, { maxTimeMS: 1500 }))?.rules : this.memory.get(userId);
      return Object.values(rules || {}) as TasteRule[];
    } catch { throw new ServiceUnavailableException('No se pudieron consultar tus ajustes musicales.'); }
  }
  async save(userId: string, input: TasteRuleInput): Promise<TasteRule> {
    const name = input.name.trim(), artist = input.target === 'song' ? input.artist?.trim() : undefined;
    if (!name || (input.target === 'song' && !artist) || (input.target === 'genre' && !GENRE_KEYS.includes(name))) throw new BadRequestException('Selecciona una canción, artista o género válido.');
    const entry = { target: input.target, name, ...(artist ? { artist } : {}), action: input.action };
    const rule: TasteRule = { ...entry, key: tasteRuleKey(entry), updatedAt: Date.now() };
    const current = await this.load(userId);
    if (current.length >= 2000 && !current.some(item => item.key === rule.key)) throw new BadRequestException('Quita algún ajuste antes de añadir más.');
    const collection = this.collection();
    try {
      if (collection) await collection.updateOne({ _id: userId }, { $set: { [`rules.${rule.key}`]: rule } }, { upsert: true, maxTimeMS: 1500 });
      else this.memory.set(userId, { ...(this.memory.get(userId) || {}), [rule.key]: rule });
    } catch { throw new ServiceUnavailableException('No se guardó el ajuste musical. Reintenta.'); }
    return rule;
  }
  async remove(userId: string, key: string) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new BadRequestException('Ajuste no válido.');
    const collection = this.collection();
    try {
      if (collection) await collection.updateOne({ _id: userId }, { $unset: { [`rules.${key}`]: '' } }, { maxTimeMS: 1500 });
      else { const rules = { ...this.memory.get(userId) }; delete rules[key]; this.memory.set(userId, rules); }
    } catch { throw new ServiceUnavailableException('No se pudo quitar el ajuste musical.'); }
  }
}
