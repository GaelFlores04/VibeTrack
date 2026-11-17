import { IMPORT_SOURCES, ImportSourceStatus, SpotifySnapshot, collectSpotifyItems, spotifyTasteProfile } from './spotify-taste';
import { BadRequestException, HttpException, Inject, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.module';
import { MusicService } from '../music/music.service';
import { normalize } from '../music/recommendation-engine';
import { matchingTitle } from '../music/track-matching';
import { decrypt, encrypt } from './spotify-crypto';

// Permisos mínimos: reproducir en el navegador (Web Playback SDK) y leer lo que más escuchas.
export const SPOTIFY_SCOPES = [
  'streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state', 'user-read-playback-state',
  'user-top-read', 'user-read-recently-played', 'user-follow-read', 'user-library-read',
];
const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
// Spotify caduca el token de renovación a los seis meses de la autorización original.
const LINK_LIFETIME = 182 * 24 * 60 * 60000;

interface Link { refresh: string; scope: string; connectedAt: Date; expiresAt: Date; importedAt?: Date; topArtists?: string[]; tasteSnapshot?: SpotifySnapshot; importSources?: ImportSourceStatus[] }
interface MatchInput { id: string; title: string; artist: string }

@Injectable()
export class SpotifyService {
  // OAuth en curso: state → cuenta y verificador PKCE. La cookie de sesión no viaja en el regreso
  // desde accounts.spotify.com (SameSite=Strict), así que el state identifica a la cuenta.
  private pending = new Map<string, { userId: string; verifier: string; expires: number }>();
  private tokens = new Map<string, { token: string; expires: number }>();
  private memoryLinks = new Map<string, Link>();
  private imports = new Map<string, Promise<any>>();
  private disconnecting = new Set<string>();
  private uris = new Map<string, { uri: string | null; expires: number }>();

  constructor(
    @Inject(MusicService) private readonly music: MusicService,
    @Optional() @Inject(DatabaseService) private readonly database?: DatabaseService,
  ) {}

  configured() { return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REDIRECT_URI); }
  private ensureConfigured() { if (!this.configured()) throw new ServiceUnavailableException('Spotify no está configurado en este servidor.'); }

  private collection() {
    if (this.database?.status !== 'connected') return null;
    try { return this.database.db.collection<any>('spotify_links'); } catch { return null; }
  }
  private async getLink(userId: string): Promise<Link | null> {
    const collection = this.collection();
    if (!collection) return this.memoryLinks.get(userId) || null;
    const doc = await collection.findOne({ _id: userId, refresh: { $exists: true } }, { maxTimeMS: 500 });
    return doc ? { refresh: doc.refresh, scope: doc.scope, connectedAt: doc.connectedAt, expiresAt: doc.expiresAt, importedAt: doc.importedAt, topArtists: doc.topArtists, tasteSnapshot: doc.tasteSnapshot, importSources: doc.importSources } : null;
  }
  private async saveLink(userId: string, link: Partial<Link>) {
    const collection = this.collection();
    if (this.database && !collection) throw new ServiceUnavailableException('No se pudo guardar la conexión con Spotify. Reintenta en unos segundos.');
    if (!collection) { this.memoryLinks.set(userId, { ...(this.memoryLinks.get(userId) as Link), ...link }); return; }
    await collection.updateOne({ _id: userId }, { $set: link }, { upsert: true, maxTimeMS: 500 });
  }

  authorizeUrl(userId: string): string {
    this.ensureConfigured();
    for (const [state, value] of this.pending) if (value.expires < Date.now()) this.pending.delete(state);
    if (this.pending.size > 500) throw new HttpException('Demasiadas conexiones en curso. Inténtalo en unos minutos.', 429);
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    this.pending.set(state, { userId, verifier, expires: Date.now() + 10 * 60000 });
    const url = new URL(`${ACCOUNTS}/authorize`);
    url.search = new URLSearchParams({
      response_type: 'code', client_id: process.env.SPOTIFY_CLIENT_ID!, scope: SPOTIFY_SCOPES.join(' '),
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!, state,
      code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    }).toString();
    return url.toString();
  }

  private async tokenRequest(body: Record<string, string>) {
    const response = await fetch(`${ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(8000),
    });
    const data: any = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  // Regreso desde Spotify: canjea el código, guarda el token de renovación cifrado e importa gustos.
  async handleCallback(code: string | undefined, state: string | undefined, error: string | undefined): Promise<string> {
    this.ensureConfigured();
    const pending = state ? this.pending.get(state) : undefined;
    if (state) this.pending.delete(state);
    if (!pending || pending.expires < Date.now()) throw new BadRequestException('La conexión con Spotify caducó. Vuelve a intentarlo.');
    if (error || !code) throw new BadRequestException(error === 'access_denied' ? 'Cancelaste la conexión con Spotify.' : 'Spotify no autorizó la conexión.');
    const result = await this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: process.env.SPOTIFY_REDIRECT_URI!, code_verifier: pending.verifier });
    if (!result.ok || typeof result.data.refresh_token !== 'string') {
      // Una cuenta fuera de la lista de usuarios autorizados de la app (modo desarrollo) falla aquí o al usar la API.
      throw new BadRequestException('Spotify rechazó la conexión. Si la app está en modo desarrollo, tu cuenta debe estar entre sus usuarios autorizados.');
    }
    await this.imports.get(pending.userId)?.catch(() => {});
    const now = Date.now();
    await this.saveLink(pending.userId, { refresh: encrypt(result.data.refresh_token), scope: String(result.data.scope || ''), connectedAt: new Date(now), expiresAt: new Date(now + LINK_LIFETIME) });
    this.tokens.set(pending.userId, { token: result.data.access_token, expires: now + (Number(result.data.expires_in) || 3600) * 1000 });
    void this.importTaste(pending.userId).catch(() => {});
    return pending.userId;
  }

  // Token de acceso corto para el navegador (Web Playback SDK). El de renovación nunca sale del servidor.
  async accessToken(userId: string): Promise<{ accessToken: string; expiresIn: number }> {
    this.ensureConfigured();
    const cached = this.tokens.get(userId);
    if (cached && cached.expires - Date.now() > 60000) return { accessToken: cached.token, expiresIn: Math.floor((cached.expires - Date.now()) / 1000) };
    const link = await this.getLink(userId);
    if (!link) throw new UnauthorizedException('Conecta tu cuenta de Spotify.');
    const result = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(link.refresh) });
    if (!result.ok) {
      if (result.data?.error === 'invalid_grant') { await this.clearLink(userId); throw new UnauthorizedException('La conexión con Spotify caducó. Vuelve a conectarla.'); }
      throw new HttpException('Spotify no respondió. Inténtalo en unos segundos.', result.status === 429 ? 429 : 502);
    }
    // Spotify puede rotar el token de renovación: se guarda el nuevo.
    if (typeof result.data.refresh_token === 'string') await this.saveLink(userId, { refresh: encrypt(result.data.refresh_token) });
    const expires = Date.now() + (Number(result.data.expires_in) || 3600) * 1000;
    this.tokens.set(userId, { token: result.data.access_token, expires });
    return { accessToken: result.data.access_token, expiresIn: Math.floor((expires - Date.now()) / 1000) };
  }

  private async api(userId: string, path: string, params: Record<string, string> = {}) {
    const { accessToken } = await this.accessToken(userId);
    const url = new URL(`${API}${path}`);
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) });
    if (response.status === 429) throw new HttpException('Spotify pide esperar antes de otra consulta.', 429);
    if (response.status === 401) { this.tokens.delete(userId); throw new UnauthorizedException('Vuelve a conectar Spotify.'); }
    if (response.status === 403) throw new HttpException('Spotify no permite esta cuenta. En modo desarrollo debe estar entre los usuarios autorizados de la app.', 403);
    if (!response.ok) throw new HttpException('Spotify no respondió.', 502);
    return response.json() as Promise<any>;
  }

  async status(userId: string) {
    const link = this.configured() ? await this.getLink(userId) : null;
    return {
      configured: this.configured(), connected: !!link,
      connectedAt: link?.connectedAt || null, expiresAt: link?.expiresAt || null,
      importedAt: link?.importedAt || null, topArtists: link?.topArtists || [],
      tasteSource: await this.music.tasteSource(userId),
      importSources: link?.importSources || [],
      topTracks: link?.tasteSnapshot ? spotifyTasteProfile(link.tasteSnapshot).tracks.slice(0, 10) : [],
      missingScopes: link ? ['user-top-read', 'user-read-recently-played', 'user-follow-read', 'user-library-read'].filter(scope => !link.scope.split(' ').includes(scope)) : [],
    };
  }

  setTasteSource(userId: string, source: 'app' | 'spotify' | 'both') { return this.music.setTasteSource(userId, source); }

  async disconnect(userId: string) {
    this.disconnecting.add(userId);
    try {
      await this.imports.get(userId)?.catch(() => {});
      await this.clearLink(userId);
    } finally { this.disconnecting.delete(userId); }
  }
  private async clearLink(userId: string) {
    const collection = this.collection();
    if (this.database && !collection) throw new ServiceUnavailableException('No se pudo desvincular Spotify. Reintenta en unos segundos.');
    if (collection) await collection.deleteOne({ _id: userId }, { maxTimeMS: 500 });
    this.tokens.delete(userId); this.memoryLinks.delete(userId);
    await this.music.forgetSpotify(userId);
  }

  // At most three source requests at once. Concurrent refreshes share one import.
  importTaste(userId: string) {
    if (this.disconnecting.has(userId)) return Promise.reject(new UnauthorizedException('Spotify se está desvinculando.'));
    const existing = this.imports.get(userId);
    if (existing) return existing;
    const request = this.importSnapshot(userId).finally(() => this.imports.delete(userId));
    this.imports.set(userId, request);
    return request;
  }
  private async importSnapshot(userId: string) {
    const link = await this.getLink(userId);
    if (!link) throw new UnauthorizedException('Conecta Spotify antes de importar tus gustos.');
    const snapshot: SpotifySnapshot = { ...link.tasteSnapshot };
    const statuses: ImportSourceStatus[] = [];
    const scopes = new Set(link.scope.split(' '));
    for (let offset = 0; offset < IMPORT_SOURCES.length; offset += 3) {
      await Promise.all(IMPORT_SOURCES.slice(offset, offset + 3).map(async source => {
        if (!scopes.has(source.scope)) {
          statuses.push({ id: source.id, label: source.label, status: 'missing-permission', count: 0 }); return;
        }
        try {
          const items: any[] = [];
          let after: string | undefined, capped = false;
          const pages = 'pages' in source ? source.pages : 1;
          for (let page = 0; page < pages; page++) {
            const params: Record<string, string> = { ...source.params };
            if (source.id === 'saved') params.offset = String(page * 50);
            if (after) params.after = after;
            const result = await this.api(userId, source.path, params);
            const container = source.id === 'followed' ? result.artists : result;
            if (!Array.isArray(container?.items)) throw new Error('Invalid Spotify page');
            items.push(...container.items);
            capped = !!container.next;
            if (!container.next) break;
            after = container.cursors?.after;
            if (source.id === 'followed' && !after) break;
          }
          snapshot[source.id] = collectSpotifyItems(items, source.path.endsWith('/artists') || source.id === 'followed');
          statuses.push({ id: source.id, label: source.label, status: 'ready', count: items.length, capped });
        } catch {
          // Preserve the last successful source, but make its stale state visible.
          statuses.push({ id: source.id, label: source.label, status: 'unavailable', count: 0 });
        }
      }));
    }
    if (!statuses.some(source => source.status === 'ready')) throw new ServiceUnavailableException('No se pudo actualizar Spotify. Conservamos la importación anterior. Revisa los permisos en Vinculaciones y reintenta.');
    if (!(await this.getLink(userId))) throw new UnauthorizedException('La conexión con Spotify caducó durante la importación.');
    const profile = spotifyTasteProfile(snapshot);
    await this.music.importSpotifyTaste(userId, profile.artists, profile.tracks, profile.genres);
    if (!(await this.getLink(userId))) {
      await this.music.forgetSpotify(userId);
      throw new UnauthorizedException('La conexión con Spotify caducó durante la importación.');
    }
    const ordered = IMPORT_SOURCES.map(source => statuses.find(item => item.id === source.id)!);
    await this.saveLink(userId, { tasteSnapshot: snapshot, importSources: ordered, importedAt: new Date(), topArtists: profile.artists.map(item => item.name) });
    return { artists: profile.artists.slice(0, 10).map(item => item.name), sources: ordered, tracks: profile.tracks.length };
  }

  // URI de Spotify para cada canción: por ISRC (misma grabación) y, si no, por título y artista.
  async match(userId: string, tracks: MatchInput[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    await Promise.all(tracks.map(async track => {
      const isrc = await this.music.isrcFor(track.id);
      const key = isrc ? `isrc:${isrc}` : `q:${normalize(track.artist)}|${matchingTitle(track.title)}`;
      const cached = this.uris.get(key);
      if (cached && cached.expires > Date.now()) { result[track.id] = cached.uri; return; }
      let uri: string | null = null;
      try {
        const same = (item: any) => matchingTitle(item?.name || '') === matchingTitle(track.title)
          && (item?.artists || []).some((artist: any) => normalize(artist?.name || '') === normalize(track.artist));
        if (isrc) {
          const body = await this.api(userId, '/search', { q: `isrc:${isrc}`, type: 'track', limit: '1' });
          uri = body?.tracks?.items?.[0]?.uri || null;
        }
        if (!uri) {
          const title = track.title.replace(/\s*[([](?:feat\.?|ft\.?|with)\b[^)\]]*[)\]]/gi, '').trim();
          const body = await this.api(userId, '/search', { q: `track:${title} artist:${track.artist}`, type: 'track', limit: '5' });
          uri = (body?.tracks?.items || []).find(same)?.uri || null;
        }
        this.uris.set(key, { uri, expires: Date.now() + 24 * 3600000 });
        if (this.uris.size > 3000) this.uris.delete(this.uris.keys().next().value!);
      } catch (error) {
        if (error instanceof HttpException && [401, 403, 429].includes(error.getStatus())) throw error;
      }
      result[track.id] = uri;
    }));
    return result;
  }
}
