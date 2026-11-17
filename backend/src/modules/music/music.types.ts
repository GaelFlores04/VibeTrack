export interface Track {
  feedbackKey?: string;
  id: string; title: string; artist: string; album?: string; artworkUrl?: string;
  previewUrl?: string; externalUrl: string; genre?: string; durationMs?: number;
  provider?: 'itunes' | 'lastfm' | 'deezer'; lastfmUrl?: string;
  // Interno (no sale en publicTrack): identifica la grabación para consultar sus rasgos de audio.
  isrc?: string;
  previewStatus?: 'loading' | 'available' | 'unavailable' | 'not_found' | 'temporary_error';
  recommendationReason?: string;
}
export interface Suggestion { id: string; name: string; kind: 'artist' | 'track'; artist?: string; url?: string }
export interface RecommendationBatch {
  tracks: Track[]; page: number; size: 7; status: 'ready' | 'retry' | 'exhausted';
  mode: 'personalized' | 'discovery'; nextPage: number | null; message?: string;
  // Aviso persistente de la tanda (p. ej. el nivel 5 se amplió porque no había canciones para el mood).
  notice?: string;
  previewsPending?: boolean; retryAfterMs?: number;
}
export function normalizeTrack(item: Record<string, any>): Track | null {
  if (item.kind !== 'song' || !item.trackId || !item.trackName || !item.artistName || !item.trackViewUrl?.startsWith('https://')) return null;
  return {
    id: `itunes:${item.trackId}`, title: item.trackName, artist: item.artistName, album: item.collectionName,
    artworkUrl: item.artworkUrl100?.startsWith('https://') ? item.artworkUrl100 : undefined,
    previewUrl: item.previewUrl?.startsWith('https://') ? item.previewUrl : undefined,
    externalUrl: item.trackViewUrl, genre: item.primaryGenreName, provider: 'itunes', durationMs: item.trackTimeMillis,
    previewStatus: item.previewUrl?.startsWith('https://') ? 'available' : 'unavailable',
  };
}

// Las URLs de preview de Deezer van firmadas y caducan en ~15 minutos: se exponen a través
// de un endpoint propio que pide una URL fresca en cada reproducción.
export const deezerPreviewPath = (id: string | number) => `/api/music/preview/${id}`;
const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
export function normalizeDeezerTrack(item: Record<string, any>): Track | null {
  const id = Number(item?.id);
  const artist = item?.artist?.name;
  if (!Number.isSafeInteger(id) || id <= 0 || typeof item.title !== 'string' || !item.title.trim() || typeof artist !== 'string' || !artist.trim()) return null;
  if (typeof item.link !== 'string' || !item.link.startsWith('https://')) return null;
  if (item.type && item.type !== 'track') return null;
  const preview = item.readable !== false && typeof item.preview === 'string' && item.preview.startsWith('https://');
  const cover = item.album?.cover_medium;
  const isrc = typeof item.isrc === 'string' ? item.isrc.trim().toUpperCase() : '';
  return {
    id: `deezer:${id}`, title: item.title, artist, album: typeof item.album?.title === 'string' ? item.album.title : undefined,
    artworkUrl: typeof cover === 'string' && cover.startsWith('https://') ? cover : undefined,
    previewUrl: preview ? deezerPreviewPath(id) : undefined, externalUrl: item.link, provider: 'deezer',
    durationMs: Number(item.duration) > 0 ? Number(item.duration) * 1000 : undefined,
    previewStatus: preview ? 'available' : 'unavailable', isrc: ISRC.test(isrc) ? isrc : undefined,
  };
}
