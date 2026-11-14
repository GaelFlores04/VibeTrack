export interface Track {
  id: string; title: string; artist: string; album?: string; artworkUrl?: string;
  previewUrl?: string; externalUrl: string; genre?: string; durationMs?: number;
  provider?: 'itunes' | 'lastfm'; lastfmUrl?: string;
  previewStatus?: 'loading' | 'available' | 'unavailable' | 'not_found' | 'temporary_error';
  recommendationReason?: string;
}
export interface Suggestion { id: string; name: string; kind: 'artist' | 'track'; artist?: string; url?: string }
export interface RecommendationBatch {
  tracks: Track[]; page: number; size: 7; status: 'ready' | 'retry' | 'exhausted';
  mode: 'personalized' | 'discovery'; nextPage: number | null; message?: string;
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
