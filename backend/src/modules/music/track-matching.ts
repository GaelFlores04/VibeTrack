import type { Track } from './music.types';

function normalize(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function withoutFeatures(value: string) {
  return value.replace(/\s*[([]?\s*\b(?:feat\.?|ft\.?|featuring)\s+.*$/i, '').trim();
}

export function matchingTitle(value: string) {
  // Un remaster conserva la grabación; live/remix/acoustic/edit siguen siendo versiones distintas.
  return normalize(withoutFeatures(value)
    .replace(/\s*[([](?:from\s+|original (?:motion picture|soundtrack|song)\b)[^\])]*[)\]]/gi, '')
    .replace(/\s*[([](?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?[)\]]/gi, '')
    .replace(/\s*[-–—]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?$/i, ''));
}

export function findPreviewMatch(source: Pick<Track, 'title' | 'artist'>, candidates: Track[]): Track | undefined {
  const title = matchingTitle(source.title);
  const artist = normalize(withoutFeatures(source.artist));
  const matches = candidates.filter(candidate => {
    if (!title || !artist || matchingTitle(candidate.title) !== title || normalize(withoutFeatures(candidate.artist)) !== artist) return false;
    // Algunos catálogos etiquetan la versión solamente en el álbum.
    const alternateAlbum = /\b(?:karaoke|tribute|live at|live from|live in|live on)\b|\(live\)| - live\b/i;
    return !alternateAlbum.test(candidate.album || '') || alternateAlbum.test(source.title);
  });
  return matches.sort((a, b) => Number(!!b.previewUrl) - Number(!!a.previewUrl)
    || Number(normalize(b.title) === normalize(source.title)) - Number(normalize(a.title) === normalize(source.title)))[0];
}
