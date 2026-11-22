import type { Track } from './music.types';
import { feedbackKey } from './feedback';

// Lista positiva: los metadatos del ranking nunca salen del servidor.
export function publicTrack(track: Track): Track {
  return {
    feedbackKey: feedbackKey(track),
    id: track.id, title: track.title, artist: track.artist, album: track.album,
    artworkUrl: track.artworkUrl, previewUrl: track.previewUrl, previewStatus: track.previewStatus,
    externalUrl: track.externalUrl, lastfmUrl: track.lastfmUrl, genre: track.genre,
    durationMs: track.durationMs, recommendationReason: track.recommendationReason, provider: track.provider,
  };
}
