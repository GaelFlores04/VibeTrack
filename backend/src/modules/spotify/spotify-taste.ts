import { normalize } from '../music/music-normalize';
import { matchingTitle } from '../music/track-matching';

export interface SpotifyTasteTrack { title: string; artist: string; isrc?: string }
export interface SpotifyTasteData { artists: Array<{ name: string; genres: string[] }>; tracks: SpotifyTasteTrack[] }
export const IMPORT_SOURCES = [
  { id: 'artistsShort', label: 'Artistas del último mes', path: '/me/top/artists', params: { time_range: 'short_term', limit: '50' }, scope: 'user-top-read', weight: 1.1 },
  { id: 'artistsMedium', label: 'Artistas de los últimos seis meses', path: '/me/top/artists', params: { time_range: 'medium_term', limit: '50' }, scope: 'user-top-read', weight: 1 },
  { id: 'artistsLong', label: 'Artistas del último año', path: '/me/top/artists', params: { time_range: 'long_term', limit: '50' }, scope: 'user-top-read', weight: .7 },
  { id: 'tracksShort', label: 'Canciones del último mes', path: '/me/top/tracks', params: { time_range: 'short_term', limit: '50' }, scope: 'user-top-read', weight: 1 },
  { id: 'tracksMedium', label: 'Canciones de los últimos seis meses', path: '/me/top/tracks', params: { time_range: 'medium_term', limit: '50' }, scope: 'user-top-read', weight: .8 },
  { id: 'tracksLong', label: 'Canciones del último año', path: '/me/top/tracks', params: { time_range: 'long_term', limit: '50' }, scope: 'user-top-read', weight: .6 },
  { id: 'saved', label: 'Canciones guardadas', path: '/me/tracks', params: { limit: '50' }, scope: 'user-library-read', weight: .9, pages: 4 },
  { id: 'followed', label: 'Artistas que sigues', path: '/me/following', params: { type: 'artist', limit: '50' }, scope: 'user-follow-read', weight: 1, pages: 2 },
  { id: 'recent', label: 'Reproducciones recientes', path: '/me/player/recently-played', params: { limit: '50' }, scope: 'user-read-recently-played', weight: .25 },
] as const;
export type ImportSourceId = typeof IMPORT_SOURCES[number]['id'];
export type SpotifySnapshot = Partial<Record<ImportSourceId, SpotifyTasteData>>;
export interface ImportSourceStatus { id: ImportSourceId; label: string; status: 'ready' | 'missing-permission' | 'unavailable'; count: number; capped?: boolean }

export function collectSpotifyItems(items: any[], artistOnly: boolean): SpotifyTasteData {
  const artists = new Map<string, { name: string; genres: string[] }>(), tracks = new Map<string, SpotifyTasteTrack>();
  const addArtist = (artist: any) => {
    if (typeof artist?.name !== 'string' || !artist.name.trim()) return;
    const key = normalize(artist.name), previous = artists.get(key);
    const genres: string[] = Array.isArray(artist.genres) ? artist.genres.filter((tag: unknown) => typeof tag === 'string') : [];
    artists.set(key, { name: artist.name.trim(), genres: [...new Set([...(previous?.genres || []), ...genres])].slice(0, 20) });
  };
  for (const entry of items) {
    if (artistOnly) { addArtist(entry); continue; }
    const track = entry?.track || entry;
    if (track?.is_local || typeof track?.name !== 'string' || !track.artists?.length) continue;
    track.artists.forEach(addArtist);
    const artist = track.artists[0]?.name;
    if (typeof artist !== 'string') continue;
    const key = `${normalize(artist)}|${matchingTitle(track.name)}`;
    tracks.set(key, { title: track.name, artist, ...(typeof track.external_ids?.isrc === 'string' ? { isrc: track.external_ids.isrc } : {}) });
  }
  return { artists: [...artists.values()], tracks: [...tracks.values()] };
}

// A refreshed snapshot replaces the previous contribution. Repeated imports
// never multiply likes, plays or artist weight.
export function spotifyTasteProfile(snapshot: SpotifySnapshot) {
  const artists = new Map<string, { name: string; weight: number; genres: string[] }>();
  const tracks = new Map<string, SpotifyTasteTrack>();
  const genres = new Set<string>();
  for (const source of IMPORT_SOURCES) {
    const data = snapshot[source.id];
    data?.artists.forEach((item, index) => {
      const key = normalize(item.name), previous = artists.get(key);
      artists.set(key, { name: item.name, weight: (previous?.weight || 0) + source.weight * Math.max(.2, 1 - index / Math.max(1, data.artists.length)), genres: [...new Set([...(previous?.genres || []), ...item.genres])] });
      item.genres.forEach(genre => genres.add(genre));
    });
    data?.tracks.forEach(track => tracks.set(`${normalize(track.artist)}|${matchingTitle(track.title)}`, track));
  }
  return { artists: [...artists.values()].sort((a, b) => b.weight - a.weight).slice(0, 50), tracks: [...tracks.values()].slice(0, 400), genres: [...genres].slice(0, 80) };
}
