import { artistKey, artistRelevance, isArtistResult } from './artist-names';
import { BadGatewayException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { MusicCache } from './music-cache';
import { normalize, Candidate } from './recommendation-engine';
import { findPreviewMatch, matchingTitle } from './track-matching';
import { normalizeTrack, Suggestion, Track } from './music.types';
const HOUR = 3600000;
const array = (value: any): any[] => Array.isArray(value) ? value : value ? [value] : [];

export class MusicProviders {
  private appleCalls: number[] = [];
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
  search(term: string) { return this.apple({ term: term.trim().toLowerCase(), limit: '30' }, 10 * 60000); }
  catalog(artist: string) {
    // Una consulta trae hasta 200 temas y sus previews; sustituye la búsqueda por canción.
    return this.apple({ term: artist.trim().toLowerCase(), attribute: 'artistTerm', limit: '200' }, 6 * HOUR);
  }
  async preview(track: Track, exactFallback = false): Promise<Track> {
    try {
      let match = findPreviewMatch(track, await this.catalog(track.artist));
      if (!match?.previewUrl && exactFallback) match = findPreviewMatch(track, await this.search(`${track.artist} ${track.title}`)) || match;
      return match?.previewUrl ? { ...match, lastfmUrl: track.externalUrl, recommendationReason: track.recommendationReason } : { ...track, previewStatus: match ? 'unavailable' : 'not_found' };
    } catch { return { ...track, previewStatus: 'temporary_error' }; }
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
    const hasMore = Number.isFinite(totalPages) && totalPages >= 0
      ? page < totalPages : raw.length >= 50;
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
    return array(body.toptags?.tag).filter(tag => typeof tag.name === 'string' && Number(tag.count) >= 10).slice(0, 30).map(tag => tag.name);
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
