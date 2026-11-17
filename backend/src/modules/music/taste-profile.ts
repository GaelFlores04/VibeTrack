import type { DatabaseService } from '../database/database.module';
import { AudioFeatures, normalize, Taste } from './recommendation-engine';

const TTL = 180 * 24 * 60 * 60000;
const MAX_ENTRIES = 60;
// Cada nueva señal resta un poco de peso a las anteriores: el perfil sigue tus gustos recientes.
const DECAY = .97;
type AudioSum = Record<'valence' | 'energy' | 'danceability' | 'acousticness', number> & { tempo: number; tempoN: number; n: number };
export interface StoredTaste { artists: Record<string, number>; tags: Record<string, number>; audio?: AudioSum }
export interface TasteSignal { artist: string; tags?: Array<{ name: string; count: number }>; audio?: AudioFeatures | null; weight: number }

const empty = (): StoredTaste => ({ artists: {}, tags: {} });
function top(record: Record<string, number>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value > .01).sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES));
}
export function audioCentroid(sum?: AudioSum): AudioFeatures | undefined {
  if (!sum?.n) return undefined;
  return {
    valence: sum.valence / sum.n, energy: sum.energy / sum.n, danceability: sum.danceability / sum.n, acousticness: sum.acousticness / sum.n,
    ...(sum.tempoN ? { tempo: sum.tempo / sum.tempoN } : {}),
  };
}
export function addAudio(sum: AudioSum | undefined, audio: AudioFeatures, weight: number): AudioSum {
  const base = sum || { valence: 0, energy: 0, danceability: 0, acousticness: 0, tempo: 0, tempoN: 0, n: 0 };
  return {
    valence: base.valence + weight * audio.valence, energy: base.energy + weight * audio.energy,
    danceability: base.danceability + weight * audio.danceability, acousticness: base.acousticness + weight * audio.acousticness,
    tempo: base.tempo + (audio.tempo ? weight * audio.tempo : 0), tempoN: base.tempoN + (audio.tempo ? weight : 0), n: base.n + weight,
  };
}
// Suma dos perfiles (p. ej. el aprendido en la app y el importado de Spotify).
export function mergeTaste(a: StoredTaste, b: StoredTaste): StoredTaste {
  const sum = (x: Record<string, number>, y: Record<string, number>) => {
    const out = { ...x };
    for (const [key, value] of Object.entries(y)) out[key] = (out[key] || 0) + value;
    return top(out);
  };
  const audio = !a.audio ? b.audio : !b.audio ? a.audio : Object.fromEntries(Object.keys(a.audio).map(key => [key, (a.audio as any)[key] + (b.audio as any)[key]])) as AudioSum;
  return { artists: sum(a.artists, b.artists), tags: sum(a.tags, b.tags), ...(audio ? { audio } : {}) };
}
export function toTaste(stored: StoredTaste): Taste {
  return { tags: stored.tags, artists: stored.artists, audio: audioCentroid(stored.audio) };
}

// Perfil de gusto por cuenta. Sólo guarda agregados (pesos de artistas y etiquetas y el promedio
// de rasgos de audio), nunca un historial de reproducciones. Clave derivada de la cuenta.
export class TasteStore {
  private memory = new Map<string, { value: StoredTaste; expires: number }>();
  private indexed = false;
  constructor(private readonly database?: DatabaseService) {}

  private collection() {
    if (this.database?.status !== 'connected') return null;
    try {
      const collection = this.database.db.collection<any>('taste_profiles');
      if (!this.indexed) {
        this.indexed = true;
        void collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => { this.indexed = false; });
      }
      return collection;
    } catch { return null; }
  }

  async load(key: string): Promise<StoredTaste> {
    const cached = this.memory.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    let value = empty();
    const collection = this.collection();
    if (collection) {
      try {
        const stored = await collection.findOne({ _id: key, expiresAt: { $gt: new Date() } }, { maxTimeMS: 300 });
        if (stored) value = { artists: stored.artists || {}, tags: stored.tags || {}, audio: stored.audio || undefined };
      } catch { /* Sin perfil guardado la recomendación sigue funcionando. */ }
    }
    this.remember(key, value);
    return value;
  }

  async record(key: string, signals: TasteSignal[]) {
    if (!signals.length) return;
    const current = await this.load(key);
    const artists: Record<string, number> = {}, tags: Record<string, number> = {};
    for (const [name, value] of Object.entries(current.artists)) artists[name] = value * DECAY;
    for (const [name, value] of Object.entries(current.tags)) tags[name] = value * DECAY;
    let audio = current.audio;
    for (const signal of signals) {
      const artist = normalize(signal.artist);
      if (artist) artists[artist] = Math.min(1, (artists[artist] || 0) + .25 * signal.weight);
      for (const tag of signal.tags || []) {
        const name = normalize(tag.name);
        if (name && name !== artist && tag.count >= 10) tags[name] = Math.min(1, (tags[name] || 0) + .3 * signal.weight * tag.count / 100);
      }
      if (signal.audio) audio = addAudio(audio, signal.audio, signal.weight);
    }
    // El promedio de audio se reescala para que señales antiguas no lo congelen.
    if (audio && audio.n > 40) { const factor = 40 / audio.n; audio = { ...audio, valence: audio.valence * factor, energy: audio.energy * factor, danceability: audio.danceability * factor, acousticness: audio.acousticness * factor, tempo: audio.tempo * factor, tempoN: audio.tempoN * factor, n: 40 }; }
    const value: StoredTaste = { artists: top(artists), tags: top(tags), audio };
    this.remember(key, value);
    const collection = this.collection();
    if (collection) void collection.updateOne({ _id: key }, { $set: { ...value, expiresAt: new Date(Date.now() + TTL) } }, { upsert: true, maxTimeMS: 300 }).catch(() => {});
  }

  async replace(key: string, signals: TasteSignal[]) {
    const artists: Record<string, number> = {}, tags: Record<string, number> = {};
    for (const signal of signals) {
      artists[normalize(signal.artist)] = Math.min(1, signal.weight);
      for (const tag of signal.tags || []) tags[normalize(tag.name)] = Math.max(tags[normalize(tag.name)] || 0, Math.min(1, signal.weight * tag.count / 100));
    }
    const value = { artists: top(artists), tags: top(tags) };
    const collection = this.collection();
    if (collection) await collection.updateOne({ _id: key }, { $set: { ...value, expiresAt: new Date(Date.now() + TTL) }, $unset: { audio: '' } }, { upsert: true, maxTimeMS: 1000 });
    this.remember(key, value);
  }

  async remove(key: string) {
    const collection = this.collection();
    if (collection) await collection.deleteOne({ _id: key }, { maxTimeMS: 1000 });
    this.memory.delete(key);
  }

  private remember(key: string, value: StoredTaste) {
    this.memory.delete(key);
    if (this.memory.size >= 1000) this.memory.delete(this.memory.keys().next().value!);
    this.memory.set(key, { value, expires: Date.now() + 10 * 60000 });
  }
}
