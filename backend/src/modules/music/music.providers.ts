import { artistKey, artistRelevance, isArtistResult } from './artist-names';
import { BadGatewayException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MusicCache } from './music-cache';
import { artistGenres, AudioFeatures, normalize, Candidate } from './recommendation-engine';
import { findPreviewMatch, matchingTitle } from './track-matching';
import { normalizeDeezerTrack, normalizeTrack, Suggestion, Track } from './music.types';
const HOUR = 3600000;
const MAX_TAG_PAGES = 30;
// Más allá de sus ~200 temas más escuchados, un artista sólo aporta rarezas sin etiquetas
// de ánimo: recorrerlas agotaba el tiempo antes de llegar a similares o a su género.
const MAX_ARTIST_PAGES = 4;
const array = (value: any): any[] => Array.isArray(value) ? value : value ? [value] : [];
const unit = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
type Waiter = { resolve: (value: AudioFeatures | null) => void; reject: (error: unknown) => void };

export class MusicProviders {
  private appleCalls: number[] = [];
  private deezerCalls: number[] = [];
  deezerBudget = 40; // Consultas por ventana de 5 s (las pruebas lo amplían).
  private featureQueue = new Map<string, Waiter[]>();
  private featureTimer?: NodeJS.Timeout;
  private lanes = new Map<string, { active: number; waiters: Array<() => void> }>();
  constructor(private readonly cache: MusicCache) {}

  private async json(url: URL, timeout = 3500) {
    // Una preview lenta no ocupa los turnos del catálogo de recomendaciones.
    let lane = this.lanes.get(url.hostname);
    if (!lane) { lane = { active: 0, waiters: [] }; this.lanes.set(url.hostname, lane); }
    if (lane.active >= 5) await new Promise<void>(resolve => lane!.waiters.push(resolve)); else lane.active++;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (response.status === 429) throw new HttpException('El proveedor pide esperar antes de otra consulta.', 429);
      if (!response.ok) throw new BadGatewayException('El proveedor musical no está disponible.');
      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException('No se pudo consultar el proveedor musical. Intenta de nuevo.');
    } finally { const next = lane.waiters.shift(); if (next) next(); else lane.active--; }
  }
  private async lastfm(method: string, parameters: Record<string, string>, ttl = HOUR) {
    if (!process.env.LASTFM_API_KEY) throw new ServiceUnavailableException('Falta configurar Last.fm.');
    return this.cache.remember(`lastfm:${method}:${JSON.stringify(parameters)}`, ttl, async () => {
      const url = new URL('https://ws.audioscrobbler.com/2.0/');
      url.search = new URLSearchParams({ method, ...parameters, api_key: process.env.LASTFM_API_KEY!, format: 'json' }).toString();
      const body = await this.json(url);
      if (Number(body.error) === 6 && ['track.getInfo', 'track.getTopTags'].includes(method)) return {};
      if (body.error) throw new BadGatewayException('Last.fm no pudo completar la consulta.');
      return body;
    });
  }
  private async apple(parameters: Record<string, string>, ttl = HOUR): Promise<Track[]> {
    return this.cache.remember(`itunes:MX:${JSON.stringify(parameters)}`, ttl, async () => {
      this.appleCalls = this.appleCalls.filter(time => Date.now() - time < 60000);
      if (this.appleCalls.length >= 18) throw new HttpException('Se alcanzó el límite temporal de previews. Espera un minuto.', 429);
      this.appleCalls.push(Date.now());
      const url = new URL('https://itunes.apple.com/search');
      url.search = new URLSearchParams({ ...parameters, entity: 'song', media: 'music', country: 'MX' }).toString();
      const body = await this.json(url);
      if (!Array.isArray(body.results)) throw new BadGatewayException('Respuesta musical no válida.');
      const tracks = body.results.map(normalizeTrack).filter((item: Track | null): item is Track => !!item);
      return [...new Map<string, Track>(tracks.map((item: Track) => [item.id, item])).values()];
    });
  }
  // Deezer: 50 consultas cada 5 s por IP. Se espera turno en lugar de fallar.
  private async deezerSlot() {
    for (;;) {
      this.deezerCalls = this.deezerCalls.filter(time => Date.now() - time < 5000);
      if (this.deezerCalls.length < this.deezerBudget) { this.deezerCalls.push(Date.now()); return; }
      await new Promise(resolve => setTimeout(resolve, 5010 - (Date.now() - this.deezerCalls[0])));
    }
  }
  // variant separa en caché usos distintos de la misma URL (p. ej. metadatos frente a preview firmado).
  private async deezer(path: string, parameters: Record<string, string> = {}, ttl = HOUR, persistent = true, variant = '') {
    return this.cache.remember(`deezer:${variant}${path}:${JSON.stringify(parameters)}`, ttl, async () => {
      await this.deezerSlot();
      const url = new URL(`https://api.deezer.com/${path}`);
      url.search = new URLSearchParams(parameters).toString();
      const body = await this.json(url);
      const code = Number(body?.error?.code);
      if (code === 4) throw new HttpException('Deezer pide esperar antes de otra consulta.', 429);
      if (code === 800) return null; // Sin datos para ese identificador.
      if (body?.error) throw new BadGatewayException('Deezer no pudo completar la consulta.');
      return body;
    }, persistent);
  }
  private async deezerSearch(term: string, limit: number, ttl: number): Promise<Track[]> {
    const body = await this.deezer('search', { q: term, limit: String(limit) }, ttl);
    if (!Array.isArray(body?.data)) throw new BadGatewayException('Respuesta musical no válida.');
    const tracks = body.data.map(normalizeDeezerTrack).filter((item: Track | null): item is Track => !!item);
    return [...new Map<string, Track>(tracks.map((item: Track) => [item.id, item])).values()];
  }
  async search(term: string): Promise<Track[]> {
    const query = term.trim().toLowerCase();
    // iTunes queda como respaldo si Deezer no responde.
    try { return await this.deezerSearch(query, 30, 10 * 60000); }
    catch { return this.apple({ term: query, limit: '30' }, 10 * 60000); }
  }
  catalog(artist: string) {
    // Una consulta trae hasta 200 temas y sus previews; sustituye la búsqueda por canción.
    return this.apple({ term: artist.trim().toLowerCase(), attribute: 'artistTerm', limit: '200' }, 6 * HOUR);
  }
  // Grabación equivalente en Deezer (preview, portada e ISRC). undefined si no hay coincidencia segura.
  async match(track: Pick<Track, 'title' | 'artist'>): Promise<Track | undefined> {
    return findPreviewMatch(track, await this.deezerSearch(`${track.artist} ${matchingTitle(track.title)}`, 10, 24 * HOUR));
  }
  async preview(track: Track, exactFallback = false): Promise<Track> {
    const source = (match: Track): Track => ({ ...match, lastfmUrl: track.externalUrl, recommendationReason: track.recommendationReason });
    let deezer: Track | undefined;
    try { deezer = await this.match(track); } catch { /* Se intenta con iTunes. */ }
    if (deezer?.previewUrl) return source(deezer);
    try {
      let match = findPreviewMatch(track, await this.catalog(track.artist));
      if (!match?.previewUrl && exactFallback) match = findPreviewMatch(track, await this.apple({ term: `${track.artist} ${track.title}`.toLowerCase(), limit: '30' }, 10 * 60000)) || match;
      return match?.previewUrl ? source(match) : { ...track, previewStatus: match || deezer ? 'unavailable' : 'not_found' };
    } catch { return { ...track, previewStatus: deezer ? 'unavailable' : 'temporary_error' }; }
  }
  // URL firmada y vigente del preview de Deezer. No se persiste: caduca en ~15 minutos.
  async previewUrl(id: string): Promise<string> {
    const body = await this.deezer(`track/${id}`, {}, 5 * 60000, false, 'preview:');
    const url = typeof body?.preview === 'string' ? body.preview : '';
    let host = '';
    try { host = new URL(url).hostname; } catch { /* URL inválida */ }
    if (!url.startsWith('https://') || !(host === 'dzcdn.net' || host.endsWith('.dzcdn.net'))) throw new NotFoundException('Preview no disponible.');
    return url;
  }

  // Rasgos de audio por ISRC (ReccoBeats). Las peticiones simultáneas se agrupan en lotes de 40.
  async features(isrc: string): Promise<AudioFeatures | null> {
    if (process.env.RECCOBEATS_ENABLED === 'false') return null;
    return this.cache.remember(`reccobeats:v2:${isrc}`, 3 * 24 * HOUR, () => new Promise<AudioFeatures | null>((resolve, reject) => {
      const waiters = this.featureQueue.get(isrc) || [];
      waiters.push({ resolve, reject });
      this.featureQueue.set(isrc, waiters);
      this.featureTimer ||= setTimeout(() => void this.flushFeatures(), 20);
    }));
  }
  private async flushFeatures() {
    const queue = new Map(this.featureQueue);
    this.featureQueue.clear(); this.featureTimer = undefined;
    const ids = [...queue.keys()];
    await Promise.all(Array.from({ length: Math.ceil(ids.length / 40) }, (_, index) => ids.slice(index * 40, index * 40 + 40)).map(async chunk => {
      try {
        const url = new URL('https://api.reccobeats.com/v1/audio-features');
        url.searchParams.set('ids', chunk.join(','));
        const body = await this.json(url, 6000);
        if (!Array.isArray(body?.content)) throw new BadGatewayException('Respuesta de rasgos de audio no válida.');
        const found = new Map<string, AudioFeatures>();
        for (const item of body.content) {
          const isrc = typeof item?.isrc === 'string' ? item.isrc.toUpperCase() : '';
          if (!isrc || found.has(isrc) || ![item.valence, item.energy, item.danceability, item.acousticness].every(unit)) continue;
          const tempo = Number(item.tempo);
          found.set(isrc, { valence: item.valence, energy: item.energy, danceability: item.danceability, acousticness: item.acousticness, ...(tempo >= 30 && tempo <= 250 ? { tempo } : {}) });
        }
        for (const id of chunk) for (const waiter of queue.get(id)!) waiter.resolve(found.get(id) || null);
      } catch (error) { for (const id of chunk) for (const waiter of queue.get(id)!) waiter.reject(error); }
    }));
  }
  async candidates(kind: 'tag' | 'artist', name: string, page: number): Promise<{ tracks: Candidate[]; nextPage: number | null; signature: string }> {
    const body = await this.lastfm(kind === 'tag' ? 'tag.getTopTracks' : 'artist.getTopTracks', { [kind]: name, page: String(page), limit: '50' });
    const container = kind === 'tag' ? body.tracks : body.toptracks;
    if (container?.track === undefined) throw new BadGatewayException('Last.fm no devolvió una lista válida.');
    const raw = array(container.track);
    const tracks: Candidate[] = raw.flatMap(item => {
      const artist = typeof item.artist === 'string' ? item.artist : item.artist?.name;
      if (typeof item.name !== 'string' || !item.name.trim() || typeof artist !== 'string' || !artist.trim()) return [];
      // Las URLs antiguas HTTP no deben hacer desaparecer canciones válidas.
      const url = `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(item.name)}`;
      return [{ id: `lastfm:${url}`, title: item.name, artist, externalUrl: url, provider: 'lastfm' as const, listeners: Math.max(0, Number(item.listeners) || 0) }];
    });
    const totalPages = Number(container['@attr']?.totalPages);
    // En tag.getTopTracks Last.fm informa totalPages muy por debajo de lo real
    // ("happy" dice 2 páginas y entrega más de 40); sólo una página corta marca el final.
    const hasMore = kind === 'tag'
      ? raw.length >= 50 && page < MAX_TAG_PAGES
      : page < MAX_ARTIST_PAGES && (Number.isFinite(totalPages) && totalPages >= 0 ? page < totalPages : raw.length >= 50);
    return { tracks, nextPage: hasMore ? page + 1 : null,
      signature: tracks.map(track => `${normalize(track.artist)}|${matchingTitle(track.title)}`).sort().join('\n') };
  }

  async info(track: Track): Promise<{ tags: string[]; listeners: number }> {
    const body = await this.lastfm('track.getInfo', { artist: track.artist, track: track.title }, 6 * HOUR);
    if (!body.track) return { tags: [], listeners: 0 };
    return { tags: array(body.track.toptags?.tag).filter(tag => typeof tag.name === 'string').map(tag => tag.name), listeners: Math.max(0, Number(body.track.listeners) || 0) };
  }
  async moodTags(track: Track): Promise<string[]> {
    const body = await this.lastfm('track.getTopTags', { artist: track.artist, track: track.title }, 6 * HOUR);
    // track.getInfo suele traer sólo géneros; esta consulta recupera etiquetas de ánimo más específicas.
    // Los recuentos están normalizados (máximo 100); un umbral de 10 descartaba señales reales como sad:8.
    return array(body.toptags?.tag).filter(tag => typeof tag.name === 'string' && Number(tag.count) >= 5).slice(0, 30).map(tag => tag.name);
  }
  async artistTags(artist: string): Promise<Array<{ name: string; count: number }>> {
    const body = await this.lastfm('artist.getTopTags', { artist }, 24 * HOUR);
    return array(body.toptags?.tag).filter(tag => typeof tag.name === 'string').map(tag => ({ name: tag.name, count: Number(tag.count) || 0 })).slice(0, 15);
  }
  async genresOf(artist: string): Promise<string[]> { return artistGenres(await this.artistTags(artist)); }
  // Metadatos de una pista de Deezer por id (para aprender de las previews que se escuchan).
  async trackById(id: string): Promise<Track | null> {
    const body = await this.deezer(`track/${id}`, {}, 24 * HOUR, true, 'meta:');
    return body ? normalizeDeezerTrack(body) : null;
  }
  async similar(artist: string): Promise<string[]> {
    const body = await this.lastfm('artist.getSimilar', { artist, limit: '8' }, 24 * HOUR);
    return array(body.similarartists?.artist).filter(item => isArtistResult(item.name) && Number(item.match) >= .25).map(item => item.name).slice(0, 8);
  }
  async artists(term: string): Promise<Suggestion[]> {
    const query = term.trim();
    const body = await this.lastfm('artist.search', { artist: query.toLowerCase(), limit: '40' }, 30 * 60000);
    const ranked = array(body.results?.artistmatches?.artist)
      .filter(item => isArtistResult(item.name))
      .map(item => ({ ...item, name: item.name.trim(), relevance: artistRelevance(item.name, query), listeners: Math.max(0, Number(item.listeners) || 0) }))
      .filter(item => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || b.listeners - a.listeners || a.name.localeCompare(b.name));
    const unique = new Map<string, Suggestion>();
    for (const item of ranked) {
      const key = artistKey(item.name);
      if (!unique.has(key)) unique.set(key, { id: item.mbid || `artist:${key}`, name: item.name, kind: 'artist', url: item.url?.startsWith('https://') ? item.url : undefined });
    }
    return [...unique.values()].slice(0, 8);
  }

  async suggestions(term: string): Promise<Suggestion[]> {
    const results = await Promise.allSettled([
      this.artists(term),
      this.lastfm('track.search', { track: term.trim().toLowerCase(), limit: '5' }, 30 * 60000),
    ]);
    if (results.every(item => item.status === 'rejected')) throw new BadGatewayException('No se pudieron cargar sugerencias. Puedes buscar con Enter.');
    const artists = results[0].status === 'fulfilled' ? results[0].value as Suggestion[] : [];
    const tracks = results[1].status === 'fulfilled' ? array((results[1].value as any).results?.trackmatches?.track) : [];
    return [...artists.slice(0, 3), ...tracks.filter(item => typeof item.name === 'string' && typeof item.artist === 'string').map(item => ({ id: `track:${normalize(item.artist)}:${matchingTitle(item.name)}`, name: item.name, artist: item.artist, kind: 'track' as const }))].slice(0, 8);
  }
}
