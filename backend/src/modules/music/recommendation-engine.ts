import { matchingTitle } from './track-matching';
import type { Track } from './music.types';

export interface Preferences { genres: string[]; artists: string[] }
export interface Candidate extends Track {
  tags?: string[]; listeners?: number; curated?: boolean; familiarity?: number; energy?: number;
  moodEvidence?: string[]; recommendationReason?: string;
  sourceGenres?: string[]; relatedTo?: string; metadataChecked?: boolean; retryAt?: number;
}
export const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
type MoodProfile = { tags: string[]; positive: string[]; negative: string[]; energy: number; description: string; seeds: Array<[string, string, string, number]> };
export const PROFILES: Record<string, MoodProfile> = {
  feliz: {
    tags: ['happy', 'feel good'], positive: ['happy', 'feel good', 'upbeat', 'summer', 'funk', 'disco', 'dance pop'], negative: ['sad', 'depressing', 'melancholy', 'dark ambient', 'funeral'], energy: .75,
    description: 'Alegre y luminoso; prioriza temas animados y evita señales claramente melancólicas.',
    seeds: [['Happy', 'Pharrell Williams', 'pop', .8], ['Get Lucky', 'Daft Punk', 'electronic', .7], ['September', 'Earth, Wind & Fire', 'funk', .8], ['Walking on Sunshine', 'Katrina & The Waves', 'pop', .85], ["CAN’T STOP THE FEELING!", 'Justin Timberlake', 'pop', .85], ['Levitating', 'Dua Lipa', 'pop', .75]],
  },
  relajado: {
    tags: ['chillout', 'chill'], positive: ['chillout', 'chill', 'relax', 'relaxing', 'mellow', 'downtempo', 'acoustic', 'bossa nova'], negative: ['metal', 'hardcore', 'aggressive', 'workout'], energy: .3,
    description: 'Tranquilo para acompañar actividades, con voces suaves y ritmos moderados.',
    seeds: [['Dreams', 'Fleetwood Mac', 'rock', .4], ['Better Together', 'Jack Johnson', 'folk', .3], ['Sunset Lover', 'Petit Biscuit', 'electronic', .3], ['Sunday Morning', 'Maroon 5', 'pop', .4], ['Banana Pancakes', 'Jack Johnson', 'folk', .25], ['Come Away With Me', 'Norah Jones', 'jazz', .2]],
  },
  motivado: {
    tags: ['workout', 'motivational'], positive: ['workout', 'motivational', 'motivation', 'energetic', 'upbeat', 'power', 'running'], negative: ['sleep', 'sleepy', 'ambient', 'sad', 'depressing'], energy: .9,
    description: 'Impulso y energía para moverte; evita canciones de descanso o tristeza.',
    seeds: [['Lose Yourself', 'Eminem', 'hip-hop', .85], ['Stronger', 'Kanye West', 'hip-hop', .85], ["Don't Stop Me Now", 'Queen', 'rock', .9], ['Eye of the Tiger', 'Survivor', 'rock', .85], ['Titanium', 'David Guetta', 'electronic', .9], ['Till I Collapse', 'Eminem', 'hip-hop', .95]],
  },
  triste: {
    tags: ['sad', 'melancholic'], positive: ['sad', 'melancholic', 'melancholy', 'heartbreak', 'depressing', 'emotional'], negative: ['happy', 'party', 'feel good', 'comedy'], energy: .3,
    description: 'Acompaña la tristeza con temas melancólicos; no intenta cambiarla por música de fiesta.',
    seeds: [['Someone Like You', 'Adele', 'pop', .25], ['The Night We Met', 'Lord Huron', 'indie', .2], ['Fix You', 'Coldplay', 'rock', .45], ['Someone You Loved', 'Lewis Capaldi', 'pop', .3], ['Everybody Hurts', 'R.E.M.', 'rock', .3], ['Nothing Compares 2 U', 'Sinéad O’Connor', 'pop', .25]],
  },
  romantico: {
    tags: ['romantic', 'love songs'], positive: ['romantic', 'love songs', 'love', 'romance', 'wedding'], negative: ['heartbreak', 'breakup', 'angry', 'aggressive', 'depressing'], energy: .35,
    description: 'Afecto y cercanía; evita priorizar canciones de ruptura aunque lleven la etiqueta love.',
    seeds: [['All of Me', 'John Legend', 'r&b', .3], ['Perfect', 'Ed Sheeran', 'pop', .3], ['At Last', 'Etta James', 'jazz', .3], ['Just the Way You Are', 'Bruno Mars', 'pop', .5], ["Can't Help Falling in Love", 'Elvis Presley', 'pop', .2], ['Until I Found You', 'Stephen Sanchez', 'pop', .35]],
  },
  cansado: {
    tags: ['sleep', 'calm'], positive: ['sleep', 'sleepy', 'calm', 'peaceful', 'piano', 'ambient', 'soft', 'soothing'], negative: ['workout', 'energetic', 'party', 'metal', 'hardcore'], energy: .12,
    description: 'Descanso con estímulos suaves y piano; se diferencia de relajado por su menor intensidad.',
    seeds: [['River Flows in You', 'Yiruma', 'classical', .15], ['Nuvole Bianche', 'Ludovico Einaudi', 'classical', .2], ["Don't Know Why", 'Norah Jones', 'jazz', .2], ['Ocean Eyes', 'Billie Eilish', 'pop', .15], ['Weightless', 'Marconi Union', 'ambient', .05], ['Sunrise', 'Norah Jones', 'jazz', .2]],
  },
};
export function curatedCandidates(slug: string): Candidate[] {
  return PROFILES[slug].seeds.map(([title, artist, genre, energy], index) => {
    const url = `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(title)}`;
    return { id: `lastfm:${url}`, title, artist, genre, energy, externalUrl: url, provider: 'lastfm', curated: true, familiarity: .95 - index * .035, tags: [genre] };
  });
}
const hasTag = (tags: string[], term: string) => tags.some(tag => normalize(tag) === normalize(term));
const key = (track: Track) => `${normalize(track.artist)}|${matchingTitle(track.title)}`;
export function moodAffinity(track: Candidate, slug: string): number {
  const profile = PROFILES[slug];
  const tags = track.tags || [];
  if (profile.negative.some(term => hasTag(tags, term))) return 0;
  if (track.curated) return 1;
  const hits = profile.positive.filter(term => hasTag(tags, term)).length;
  // Sólo etiquetas específicas del mood cuentan como evidencia; artista/género nunca la heredan.
  const evidence = new Set((track.moodEvidence || []).filter(tag => profile.tags.includes(tag))).size;
  return hits ? Math.min(1, .65 + .1 * hits + .05 * evidence) : evidence ? .7 + .05 * Math.min(2, evidence) : 0;
}
export function genreMatches(genre: string, tags: string[]) {
  const aliases: Record<string, string[]> = { electronic: ['electronic', 'electronica', 'dance', 'house', 'downtempo'], 'hip-hop': ['hip hop', 'hip-hop', 'rap'], 'r&b': ['r&b', 'rnb', 'soul'], latin: ['latin', 'latino', 'reggaeton', 'latin pop'], classical: ['classical', 'piano', 'instrumental'], indie: ['indie', 'indie pop', 'indie rock'], pop: ['pop', 'dance pop'], rock: ['rock', 'alternative rock', 'soft rock'] };
  return (aliases[genre] || [genre]).some(alias => hasTag(tags, alias));
}
export const hasPreferences = (preferences?: Preferences | null) => Boolean(preferences && (preferences.genres.length || preferences.artists.length));
export function personalAffinity(track: Candidate, preferences?: Preferences | null): number {
  if (!hasPreferences(preferences)) return 0;
  if (preferences!.artists.some(artist => normalize(artist) === normalize(track.artist))) return 1;
  if (track.relatedTo && preferences!.artists.some(artist => normalize(artist) === normalize(track.relatedTo!))) return .8;
  if (preferences!.genres.some(genre => genreMatches(genre, [...(track.tags || []), ...(track.sourceGenres || []), track.genre || '']))) return .65;
  return 0;
}
export function rankRecommendations(candidates: Candidate[], slug: string, preferences?: Preferences | null, limit = 7): Candidate[] {
  const unique = new Map<string, Candidate>();
  for (const item of candidates) {
    const previous = unique.get(key(item));
    unique.set(key(item), previous ? { ...item, ...previous, tags: [...new Set([...(previous.tags || []), ...(item.tags || [])])], moodEvidence: [...new Set([...(previous.moodEvidence || []), ...(item.moodEvidence || [])])], listeners: Math.max(previous.listeners || 0, item.listeners || 0) } : item);
  }
  const eligible = [...unique.values()].filter(item => moodAffinity(item, slug) >= .65 && (!hasPreferences(preferences) || personalAffinity(item, preferences) > 0)).map(item => ({
    ...item, genre: item.genre || ['pop', 'rock', 'indie', 'electronic', 'hip-hop', 'r&b', 'latin', 'jazz', 'classical', 'folk', 'metal', 'ambient'].find(genre => genreMatches(genre, item.tags || [])),
  }));
  const maxListeners = Math.max(1, ...eligible.map(item => item.listeners || 0));
  const personalized = hasPreferences(preferences);
  const scored = eligible.map(track => {
    const popularity = track.listeners ? Math.log1p(track.listeners) / Math.log1p(maxListeners) : track.familiarity || .1;
    const artist = preferences?.artists.some(item => normalize(item) === normalize(track.artist)) ? 1 : 0;
    const affinity = moodAffinity(track, slug);
    const score = personalized ? .7 * personalAffinity(track, preferences) + .28 * affinity + .02 * popularity : .6 * affinity + .4 * popularity;
    return { track: { ...track, recommendationReason: personalized ? artist ? 'De uno de tus artistas, para este mood.' : track.relatedTo ? `Artista relacionado con ${track.relatedTo}, para este mood.` : 'De tus géneros, para este mood.' : track.curated ? 'Selección conocida para este mood.' : 'Afinidad de etiquetas y popularidad en Last.fm.' }, score };
  });
  const selected: Candidate[] = [];
  while (scored.length && selected.length < limit) {
    const previous = selected.at(-1);
    const scoreWithFlow = (item: typeof scored[number]) => {
      if (!previous) return item.score;
      const recentArtist = selected.slice(-2).some(track => normalize(track.artist) === normalize(item.track.artist));
      const genre = previous.genre && item.track.genre && normalize(previous.genre) === normalize(item.track.genre) ? .06 : 0;
      const energyGap = Math.abs((previous.energy ?? PROFILES[slug].energy) - (item.track.energy ?? PROFILES[slug].energy));
      return item.score + genre - .15 * energyGap - (recentArtist ? .4 : 0);
    };
    scored.sort((a, b) => scoreWithFlow(b) - scoreWithFlow(a) || key(a.track).localeCompare(key(b.track)));
    selected.push(scored.shift()!.track);
  }
  return selected;
}
