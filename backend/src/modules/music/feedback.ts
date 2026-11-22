import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DatabaseService } from '../database/database.module';
import type { AudioFeatures, Candidate } from './recommendation-engine';
import type { Track } from './music.types';
import { matchingTitle } from './track-matching';
import { normalize } from './music-normalize';
import { GENRE_KEYS } from './genres';

const genreTags = new Set([...GENRE_KEYS.map(normalize), 'rnb', 'electronica', 'instrumental', 'alternative']);

export type Rating = 'like' | 'dislike';
export interface FeedbackEntry {
  intent?: 'mood';
  artist: string; title: string; rating: Rating; tags: string[];
  audio?: Candidate['audio']; updatedAt: number;
}
export type Feedback = Record<string, FeedbackEntry>;
export const feedbackKey = (track: Pick<Track, 'artist' | 'title'>) => createHash('sha256').update(`${normalize(track.artist)}|${matchingTitle(track.title)}`).digest('hex');

// Reemplazar una valoración revierte su efecto anterior: los clics no acumulan votos.
export class FeedbackStore {
  private memory = new Map<string, Feedback>();
  constructor(private readonly database?: DatabaseService) {}
  private key(user: string, mood: string) { return createHash('sha256').update(JSON.stringify(['feedback', user, mood])).digest('hex'); }
  private collection() {
    if (!this.database) return null;
    if (this.database.status !== 'connected') throw new ServiceUnavailableException('No se pudieron guardar tus valoraciones. Reintenta cuando vuelva la conexión.');
    return this.database.db.collection<any>('music_feedback');
  }
  async load(user: string, mood: string): Promise<Feedback> {
    const key = this.key(user, mood), collection = this.collection();
    if (!collection) return this.memory.get(key) || {};
    try { return (await collection.findOne({ _id: key }, { maxTimeMS: 1500 }))?.ratings || {}; }
    catch { throw new ServiceUnavailableException('No se pudieron consultar tus valoraciones. Reintenta.'); }
  }
  async remove(user: string, mood: string, id: string) {
    const ratings = await this.load(user, mood), entry = ratings[id];
    if (entry) await this.set(user, mood, entry, null);
  }
  async set(user: string, mood: string, track: Pick<Candidate, 'artist' | 'title' | 'tags' | 'sourceGenres' | 'genre' | 'audio'>, rating: Rating | null, intent?: 'mood') {
    const key = this.key(user, mood), id = feedbackKey(track), collection = this.collection();
    const entry: FeedbackEntry = { artist: track.artist, title: track.title, rating: rating || 'like', ...(intent ? { intent } : {}),
      tags: [...new Set([...(track.tags || []), ...(track.sourceGenres || []), track.genre || ''].map(normalize).filter(tag => genreTags.has(tag)))].slice(0, 20),
      ...(track.audio ? { audio: track.audio } : {}), updatedAt: Date.now() };
    // Hasta 2.000 canciones distintas por mood; nunca se borran dislikes para liberar espacio.
    const current = await this.load(user, mood);
    if (rating && !current[id] && Object.keys(current).length >= 2000) throw new BadRequestException('Has llegado a 2.000 valoraciones en este mood. Quita alguna antes de añadir otra.');
    if (collection) {
      try {
        await collection.updateOne({ _id: key }, rating
          ? { $set: { [`ratings.${id}`]: entry } }
          : { $unset: { [`ratings.${id}`]: '' } }, { upsert: !!rating, maxTimeMS: 1500 });
      } catch { throw new ServiceUnavailableException('No se guardó tu valoración. Reintenta.'); }
    } else {
      const next = { ...(this.memory.get(key) || current) }; if (rating) next[id] = entry; else delete next[id];
      if (!this.memory.has(key) && this.memory.size >= 1000) this.memory.delete(this.memory.keys().next().value!);
      this.memory.set(key, next);
    }
    return { key: id, rating };
  }
}

export interface FeedbackProfile {
  songs: Feedback;
  artists: Map<string, number>;
  tags: Map<string, number>;
  liked: FeedbackEntry[];
  audio: Array<{ features: AudioFeatures; count: number; sign: number }>;
}
export function feedbackProfile(songs: Feedback): FeedbackProfile {
  const artists = new Map<string, number[]>(), tags = new Map<string, number[]>();
  const audio: FeedbackProfile['audio'] = [];
  const add = (map: Map<string, number[]>, key: string, value: number) => map.set(key, [...(map.get(key) || []), value]);
  for (const entry of Object.values(songs)) {
    if (entry.intent === 'mood') continue;
    const vote = entry.rating === 'like' ? 1 : -1;
    add(artists, normalize(entry.artist), vote);
    for (const tag of new Set(entry.tags.map(normalize))) add(tags, tag, vote);
  }
  // Dos votos previos neutros atenúan la generalización; se comparan TODOS los likes y dislikes.
  const average = (map: Map<string, number[]>) => new Map([...map].map(([key, votes]) => [key, votes.reduce((sum, value) => sum + value, 0) / (votes.length + 2)]));
  for (const rating of ['like', 'dislike'] as const) {
    const signals = Object.values(songs).filter(entry => entry.intent !== 'mood' && entry.rating === rating && entry.audio);
    if (signals.length) audio.push({ features: Object.fromEntries((['valence', 'energy', 'danceability', 'acousticness'] as const).map(key => [key, signals.reduce((sum, entry) => sum + entry.audio![key], 0) / signals.length])) as unknown as AudioFeatures, count: signals.length, sign: rating === 'like' ? 1 : -1 });
  }
  return { songs, artists: average(artists), tags: average(tags), liked: Object.values(songs).filter(entry => entry.rating === 'like' && entry.intent !== 'mood'), audio };
}
export function feedbackAdjustment(track: Candidate, profile?: FeedbackProfile): number {
  if (!profile) return 0;
  // La señal específica de la canción prevalece sobre cualquier generalización.
  const exact = profile.songs[feedbackKey(track)];
  if (exact) return exact.rating === 'like' ? .3 : -1;
  const artist = profile.artists.get(normalize(track.artist)) || 0;
  const tags = [...new Set([...(track.tags || []), ...(track.sourceGenres || []), track.genre || ''].map(normalize).filter(Boolean))];
  const genre = tags.length ? tags.reduce((sum, tag) => sum + (profile.tags.get(tag) || 0), 0) / tags.length : 0;
  const similar = Math.max(0, profile.artists.get(normalize(track.relatedTo || track.via || '')) || 0);
  let audio = 0;
  if (track.audio) {
    audio = profile.audio.reduce((sum, entry) => {
      const distance = Math.sqrt((['valence', 'energy', 'danceability', 'acousticness'] as const).reduce((total, key) => total + (track.audio![key] - entry.features[key]) ** 2, 0));
      return sum + Math.max(0, 1 - distance) * entry.sign * entry.count;
    }, 0) / (profile.audio.reduce((sum, entry) => sum + entry.count, 0) + 2);
  }
  return .12 * artist + .06 * genre + .08 * similar + .04 * audio;
}
