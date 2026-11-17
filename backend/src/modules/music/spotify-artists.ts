import type { DatabaseService } from '../database/database.module';

// De dónde salen tus gustos al recomendar: lo configurado en la app, lo que escuchas en Spotify o ambos.
export type TasteSource = 'app' | 'spotify' | 'both';
export const TASTE_SOURCES: TasteSource[] = ['app', 'spotify', 'both'];
interface Settings { names: string[]; source: TasteSource }

// Artistas más escuchados en Spotify de cada cuenta (sólo nombres) y la fuente de gustos elegida.
// Los escribe el módulo de Spotify y los usa el recomendador. Documento: spotify_links/{userId}.
export class SpotifyArtistsStore {
  private memory = new Map<string, Settings & { expires: number }>();
  constructor(private readonly database?: DatabaseService) {}

  private collection() {
    if (this.database?.status !== 'connected') return null;
    try { return this.database.db.collection<any>('spotify_links'); } catch { return null; }
  }
  private remember(userId: string, value: Settings) { this.memory.set(userId, { ...value, expires: Date.now() + 10 * 60000 }); }

  async load(userId: string): Promise<Settings> {
    const cached = this.memory.get(userId);
    if (cached && cached.expires > Date.now()) return { names: cached.names, source: cached.source };
    let value: Settings = { names: [], source: 'both' };
    const collection = this.collection();
    if (collection) {
      try {
        const doc = await collection.findOne({ _id: userId }, { projection: { topArtists: 1, tasteSource: 1 }, maxTimeMS: 300 });
        value = {
          names: Array.isArray(doc?.topArtists) ? doc.topArtists.filter((item: unknown): item is string => typeof item === 'string') : [],
          source: TASTE_SOURCES.includes(doc?.tasteSource) ? doc.tasteSource : 'both',
        };
      } catch { /* Sin datos de Spotify se recomienda con el resto del perfil. */ }
    } else if (cached) value = { names: cached.names, source: cached.source };
    this.remember(userId, value);
    return value;
  }

  async save(userId: string, names: string[]) {
    const current = await this.load(userId);
    this.remember(userId, { ...current, names });
    const collection = this.collection();
    if (collection) await collection.updateOne({ _id: userId }, { $set: { topArtists: names, importedAt: new Date() } }, { upsert: true, maxTimeMS: 500 }).catch(() => {});
  }

  async setSource(userId: string, source: TasteSource) {
    const current = await this.load(userId);
    this.remember(userId, { ...current, source });
    const collection = this.collection();
    if (collection) await collection.updateOne({ _id: userId }, { $set: { tasteSource: source } }, { upsert: true, maxTimeMS: 500 });
  }

  forget(userId: string) { this.memory.delete(userId); }
}
