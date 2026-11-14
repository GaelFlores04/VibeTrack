import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.module';

// Sólo metadatos públicos: nunca audio, credenciales, preferencias o tandas personales.
@Injectable()
export class MusicCache implements OnModuleInit {
  private entries = new Map<string, { expires: number; value: unknown }>();
  private pending = new Map<string, Promise<any>>();
  constructor(@Optional() @Inject(DatabaseService) private readonly database?: DatabaseService) {}
  async onModuleInit() {
    if (this.database?.status === 'connected') {
      try { await this.database.db.collection('music_cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); } catch { /* La caché en memoria sigue disponible. */ }
    }
  }
  async remember<T>(key: string, ttl: number, fetcher: () => Promise<T>, persistent = true): Promise<T> {
    const id = createHash('sha256').update(`v3:${key}`).digest('hex');
    const cached = this.entries.get(id);
    if (cached && cached.expires > Date.now()) return cached.value as T;
    const pending = this.pending.get(id);
    if (pending) return pending;
    const request = (async () => {
      const collection = persistent && this.database?.status === 'connected' ? this.database.db.collection<any>('music_cache') : null;
      if (collection) {
        try {
          const stored = await collection.findOne({ _id: id, expiresAt: { $gt: new Date() } }, { maxTimeMS: 250 });
          if (stored) { this.put(id, stored.value, stored.expiresAt.getTime()); return stored.value as T; }
        } catch { /* Un fallo de caché no impide consultar el proveedor. */ }
      }
      const value = await fetcher();
      const expires = Date.now() + ttl;
      this.put(id, value, expires);
      if (collection) void collection.updateOne({ _id: id }, { $set: { value, expiresAt: new Date(expires) } }, { upsert: true, maxTimeMS: 250 }).catch(() => {});
      return value;
    })();
    this.pending.set(id, request);
    try { return await request; } finally { this.pending.delete(id); }
  }
  private put(key: string, value: unknown, expires: number) {
    if (this.entries.size >= 1500) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires });
  }
}
