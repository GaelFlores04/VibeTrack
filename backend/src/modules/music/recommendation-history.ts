import type { DatabaseService } from '../database/database.module';

const TTL = 7 * 24 * 60 * 60000;
const LIMIT = 350;

// Canciones ya mostradas por cuenta y mood. Sólo guarda identidades públicas
// (artista|título) bajo una clave derivada; sobrevive reinicios si MongoDB está disponible.
export class RecommendationHistory {
  private memory = new Map<string, { seen: string[]; expires: number }>();
  private indexed = false;
  constructor(private readonly database?: DatabaseService) {}

  private collection() {
    if (this.database?.status !== 'connected') return null;
    try {
      const collection = this.database.db.collection<any>('recommendation_history');
      if (!this.indexed) {
        this.indexed = true;
        void collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => { this.indexed = false; });
      }
      return collection;
    } catch { return null; }
  }

  async load(key: string): Promise<string[]> {
    const cached = this.memory.get(key);
    if (cached && cached.expires > Date.now()) return cached.seen;
    const collection = this.collection();
    if (!collection) return [];
    try {
      const stored = await collection.findOne({ _id: key, expiresAt: { $gt: new Date() } }, { maxTimeMS: 300 });
      const seen = Array.isArray(stored?.seen) ? stored.seen.filter((item: unknown): item is string => typeof item === 'string') : [];
      this.remember(key, seen);
      return seen;
    } catch { return []; /* Sin historial la recomendación sigue funcionando. */ }
  }

  async add(key: string, ids: string[]) {
    const seen = [...new Set([...await this.load(key), ...ids])].slice(-LIMIT);
    this.remember(key, seen);
    const collection = this.collection();
    if (collection) void collection.updateOne({ _id: key }, { $set: { seen, expiresAt: new Date(Date.now() + TTL) } }, { upsert: true, maxTimeMS: 300 }).catch(() => {});
  }

  async clear(key: string) {
    this.memory.delete(key);
    const collection = this.collection();
    if (collection) void collection.deleteOne({ _id: key }, { maxTimeMS: 300 }).catch(() => {});
  }

  private remember(key: string, seen: string[]) {
    for (const [id, value] of this.memory) if (value.expires <= Date.now()) this.memory.delete(id);
    this.memory.delete(key);
    if (this.memory.size >= 1000) this.memory.delete(this.memory.keys().next().value!);
    this.memory.set(key, { seen, expires: Date.now() + TTL });
  }
}
