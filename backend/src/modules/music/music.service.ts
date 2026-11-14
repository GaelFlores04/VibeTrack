import { BadGatewayException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MOODS } from '../moods/moods.module';

export interface Track {
  id: string; title: string; artist: string; album?: string; artworkUrl?: string;
  previewUrl?: string; externalUrl: string; genre?: string;
}
export function normalizeTrack(item: Record<string, any>): Track | null {
  if (item.kind !== 'song' || !item.trackId || !item.trackName || !item.artistName || !item.trackViewUrl?.startsWith('https://')) return null;
  return {
    id: `itunes:${item.trackId}`, title: item.trackName, artist: item.artistName, album: item.collectionName,
    artworkUrl: item.artworkUrl100?.startsWith('https://') ? item.artworkUrl100 : undefined,
    previewUrl: item.previewUrl?.startsWith('https://') ? item.previewUrl : undefined,
    externalUrl: item.trackViewUrl, genre: item.primaryGenreName,
  };
}

@Injectable()
export class MusicService {
  private cache = new Map<string, { expires: number; tracks: Track[] }>();
  private pending = new Map<string, Promise<Track[]>>();
  private calls: number[] = [];

  async search(term: string): Promise<Track[]> {
    const key = term.trim().toLocaleLowerCase();
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.tracks;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.fetchSearch(term);
    this.pending.set(key, request);
    try {
      const tracks = await request;
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: Date.now() + 600000, tracks });
      return tracks;
    } finally { this.pending.delete(key); }
  }

  private async fetchSearch(term: string) {
    this.calls = this.calls.filter(time => Date.now() - time < 60000);
    if (this.calls.length >= 18) throw new HttpException('Límite temporal del proveedor. Espera un minuto y vuelve a intentar.', 429);
    this.calls.push(Date.now());
    const url = new URL('https://itunes.apple.com/search');
    url.search = new URLSearchParams({ term, entity: 'song', media: 'music', country: 'MX', limit: '12' }).toString();
    const body = await this.fetchJson(url);
    if (!Array.isArray(body.results)) throw new BadGatewayException('Respuesta musical no válida.');
    const tracks = body.results.map(normalizeTrack).filter((track: Track | null): track is Track => track !== null);
    return [...new Map<string, Track>(tracks.map((track: Track) => [track.id, track])).values()];
  }

  async recommendations(slug: string, page: number) {
    const mood = MOODS.find(item => item.slug === slug);
    if (!mood) throw new NotFoundException('Mood no encontrado.');
    if (!process.env.LASTFM_API_KEY) throw new ServiceUnavailableException('Las recomendaciones por mood aún requieren configurar LASTFM_API_KEY. Puedes usar Explorar para buscar canciones.');
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.search = new URLSearchParams({ method: 'tag.gettoptracks', tag: mood.tag, api_key: process.env.LASTFM_API_KEY, format: 'json', limit: '12', page: String(page) }).toString();
    const body = await this.fetchJson(url);
    if (body.error || !Array.isArray(body.tracks?.track)) throw new BadGatewayException('Last.fm no pudo entregar recomendaciones.');
    // Se conservan los enlaces de Last.fm; el enriquecimiento con iTunes se implementará por coincidencia exacta.
    return body.tracks.track.filter((item: any) => item.url?.startsWith('https://')).map((item: any) => ({
      id: `lastfm:${item.url}`, title: item.name, artist: item.artist.name, externalUrl: item.url,
    }));
  }

  private async fetchJson(url: URL) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.status === 429) throw new HttpException('El proveedor pide esperar antes de otra consulta.', 429);
      if (!response.ok) throw new BadGatewayException('El proveedor musical no está disponible.');
      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException('No se pudo consultar el proveedor musical. Intenta de nuevo.');
    }
  }
}
