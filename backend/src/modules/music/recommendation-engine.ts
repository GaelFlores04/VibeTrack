import { moodAffinity, perceivedTempo, PROFILES, MOOD_MIN } from './mood-classifier';
export { assessMood, audioMatch, lyricVeto, moodAffinity, perceivedTempo, PROFILES, tempoMatch } from './mood-classifier';
import { matchingTitle, recordingKeys } from './track-matching';
import type { Track } from './music.types';
import type { LyricProfile } from './lyrics-lexicon';
import { GENRE_GROUPS, GENRE_KEYS } from './genres';
import { normalize } from './music-normalize';
import { feedbackAdjustment, feedbackKey, FeedbackProfile } from './feedback';
import { ruleFor, ruleAdjustment, TasteRule } from './taste-rules';
export { GENRE_KEYS } from './genres';
export { normalize } from './music-normalize';

// styleOf: géneros deducidos de los artistas elegidos (género -> artista). Sólo sirve de
// respaldo cuando las canciones del artista y de sus similares no bastan para el mood.
// taste: perfil aprendido (etiquetas, artistas escuchados y sonido promedio). surprise: esta tanda
// incluye una sorpresa. Ninguno de los dos cambia qué es favorito: sólo afinan los descubrimientos.
// spotifyArtists: los más escuchados en Spotify (ya incluidos en artists); sólo cambia el motivo mostrado.
export interface Preferences { genres: string[]; artists: string[]; preferenceLevel?: number; rules?: TasteRule[]; spotifyTracks?: Array<{ title: string; artist: string }>; spotifyArtists?: string[]; styleOf?: Record<string, string>; taste?: Taste; surprise?: boolean; feedback?: FeedbackProfile }
export interface Taste { tags: Record<string, number>; artists?: Record<string, number>; audio?: AudioFeatures }
// Rasgos de audio (ReccoBeats, escala 0-1) que describen cómo suena la grabación.
export interface AudioFeatures { valence: number; energy: number; danceability: number; acousticness: number; tempo?: number }
export interface Candidate extends Track {
  audio?: AudioFeatures; match?: Track; audioChecked?: boolean;
  // Perfil de la letra (diccionario local). La letra en sí nunca se guarda.
  lyrics?: LyricProfile | null; lyricsChecked?: boolean;
  tags?: string[]; listeners?: number; curated?: boolean; familiarity?: number; energy?: number;
  moodEvidence?: string[]; recommendationReason?: string;
  sourceGenres?: string[]; relatedTo?: string; metadataChecked?: boolean; retryAt?: number;
  // Ya se pidieron sus etiquetas detalladas (track.getTopTags): no se repite la consulta.
  moodTagsChecked?: boolean;
  // Artista favorito desde el que se llegó a este descubrimiento (similar de un similar).
  via?: string;
}
export function curatedCandidates(slug: string): Candidate[] {
  return PROFILES[slug].seeds.map(([title, artist, genre, energy], index) => {
    const url = `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(title)}`;
    return { id: `lastfm:${url}`, title, artist, genre, energy, externalUrl: url, provider: 'lastfm', curated: true, familiarity: .95 - index * .035, tags: [genre] };
  });
}
const hasTag = (tags: string[], term: string) => tags.some(tag => normalize(tag) === normalize(term));
const key = (track: Track) => `${normalize(track.artist)}|${matchingTitle(track.title)}`;
export function genreMatches(genre: string, tags: string[]) {
  const aliases: Record<string, string[]> = { electronic: ['electronic', 'electronica', 'dance', 'house', 'downtempo'], 'hip-hop': ['hip hop', 'hip-hop', 'rap'], 'r&b': ['r&b', 'rnb', 'soul'], latin: ['latin', 'latino', 'reggaeton', 'latin pop'], classical: ['classical', 'piano', 'instrumental'], indie: ['indie', 'indie pop', 'indie rock'], pop: ['pop', 'dance pop'], rock: ['rock', 'alternative rock', 'soft rock', 'alternative', 'britpop'] };
  const children = GENRE_GROUPS.find(group => group.id === genre)?.children.map(([id]) => id) || [];
  return [...(aliases[genre] || [genre]), ...children].some(alias => hasTag(tags, alias));
}
export const preferenceLevel = (preferences?: Preferences | null) => Number.isInteger(preferences?.preferenceLevel) && preferences!.preferenceLevel! >= 1 && preferences!.preferenceLevel! <= 5 ? preferences!.preferenceLevel! : 3;
export const hasPreferences = (preferences?: Preferences | null) => Boolean(preferences && (preferences.genres.length || preferences.artists.length || preferences.rules?.some(rule => rule.action === 'more') || preferences.spotifyTracks?.length));
// Conjuntos normalizados de tus artistas y canciones importadas, calculados una vez por lista (las
// listas se comparten entre copias de preferencias). Antes cada comprobación recorría y normalizaba
// la lista entera: con 50 artistas y cientos de canciones de Spotify dominaba el tiempo de la tanda.
const artistSets = new WeakMap<string[], Set<string>>();
const trackSets = new WeakMap<object[], Set<string>>();
const artistSet = (artists: string[]) => {
  let set = artistSets.get(artists);
  if (!set) { set = new Set(artists.map(normalize)); artistSets.set(artists, set); }
  return set;
};
const spotifyTrack = (track: Track, tracks?: Array<{ title: string; artist: string }>) => {
  if (!tracks?.length) return false;
  let set = trackSets.get(tracks);
  if (!set) { set = new Set(tracks.map(item => key(item as Track))); trackSets.set(tracks, set); }
  return set.has(key(track));
};
export function directlyPreferred(track: Candidate, preferences?: Preferences | null): boolean {
  if (!preferences) return false;
  const rule = ruleFor(track, preferences.rules);
  if (rule?.action === 'exclude') return false;
  if (rule?.action === 'more') return true;
  return artistSet(preferences.artists).has(normalize(track.artist))
    || preferences.genres.some(genre => genreMatches(genre, trackGenreTags(track)))
    || spotifyTrack(track, preferences.spotifyTracks);
}
export function personalAffinity(track: Candidate, preferences?: Preferences | null): number {
  const rule = ruleFor(track, preferences?.rules);
  if (rule?.action === 'more') return rule.target === 'genre' ? .65 : 1;
  if (spotifyTrack(track, preferences?.spotifyTracks)) return 1;
  if (!hasPreferences(preferences)) return 0;
  const artists = artistSet(preferences!.artists);
  if (artists.has(normalize(track.artist))) return 1;
  if (track.relatedTo && artists.has(normalize(track.relatedTo))) return .8;
  if (track.via && artists.has(normalize(track.via))) return .7;
  if (preferences!.genres.some(genre => genreMatches(genre, trackGenreTags(track)))) return .65;
  if (styleArtist(track, preferences)) return .5;
  return 0;
}
const trackGenreTags = (track: Candidate) => [...(track.tags || []), ...(track.sourceGenres || []), track.genre || ''];
// Artista elegido cuyo estilo (género) comparte la canción, si aplica el respaldo.
function styleArtist(track: Candidate, preferences?: Preferences | null): string | undefined {
  const genre = Object.keys(preferences?.styleOf || {}).find(item => genreMatches(item, trackGenreTags(track)));
  return genre ? preferences!.styleOf![genre] : undefined;
}
// Géneros dominantes de un artista a partir de sus etiquetas de Last.fm (normalizadas a 100).
export function artistGenres(tags: Array<{ name: string; count: number }>, limit = 1, minCount = 40): string[] {
  const found: string[] = [];
  for (const tag of [...tags].sort((a, b) => b.count - a.count)) {
    if (tag.count < minCount) break;
    const genre = GENRE_KEYS.find(item => genreMatches(item, [tag.name]));
    if (genre && !found.includes(genre)) found.push(genre);
    if (found.length === limit) break;
  }
  return found;
}
// Peso de la variación por sesión: reordena candidatos de afinidad parecida entre visitas.
const JITTER = .06;
// Las preferencias orientan, no encierran: cada tanda mezcla favoritos, cercanos y descubrimientos.
export type Bucket = 'favorite' | 'near' | 'discovery';
export function bucketOf(track: Candidate, preferences?: Preferences | null): Bucket {
  const personal = personalAffinity(track, preferences);
  return personal >= 1 ? 'favorite' : personal > 0 ? 'near' : 'discovery';
}
// Para 7: 4 de tus artistas, 2 cercanos (similares, tus géneros o su estilo) y 1 para descubrir.
// Sin artistas elegidos: 5 de tus géneros y 2 para descubrir. Si un grupo no alcanza, otro completa.
export function quotas(preferences: Preferences | null | undefined, limit = 7): Record<Bucket, number> {
  // Con artistas: 4 favoritos, 2 cercanos, 1 descubrimiento (o la sorpresa). Sólo géneros: 5 y 2.
  const level = preferenceLevel(preferences);
  const favorite = preferences?.artists.length || preferences?.spotifyTracks?.length || preferences?.rules?.some(rule => rule.target !== 'genre' && rule.action === 'more') ? Math.round(limit * [0, 0, 2 / 7, 4 / 7, 6 / 7, 1][level]) : 0;
  const discovery = Math.min(limit - favorite, Math.round(limit * (favorite ? [0, 5 / 7, 2 / 7, 1 / 7, 0, 0][level] : [0, 5 / 7, 3 / 7, 2 / 7, 1 / 7, 0][level])));
  return { favorite, near: Math.max(0, limit - favorite - discovery), discovery };
}
// Géneros vecinos: un descubrimiento cercano a lo que escuchas tiene más probabilidad de gustar.
const ADJACENT: Record<string, string[]> = {
  pop: ['r&b', 'electronic', 'latin', 'indie'], rock: ['indie', 'metal', 'folk', 'pop'], indie: ['rock', 'pop', 'folk', 'electronic'],
  electronic: ['pop', 'hip-hop', 'ambient'], 'hip-hop': ['r&b', 'pop', 'electronic', 'latin'], 'r&b': ['hip-hop', 'pop', 'jazz'],
  latin: ['pop', 'hip-hop', 'r&b'], jazz: ['r&b', 'classical', 'folk'], classical: ['ambient', 'jazz'], folk: ['indie', 'rock', 'jazz'],
  metal: ['rock'], ambient: ['classical', 'electronic'], reggae: ['latin', 'hip-hop'], blues: ['rock', 'jazz'], country: ['folk', 'pop'], soundtrack: ['classical', 'ambient'],
};
const GENRE_LABEL: Record<string, string> = Object.fromEntries(GENRE_GROUPS.map(group => [group.id, group.label.toLocaleLowerCase()]));
function nearbyGenre(track: Candidate, preferences?: Preferences | null): string | undefined {
  const own = [...(preferences?.genres || []), ...Object.keys(preferences?.styleOf || {})].map(id => GENRE_GROUPS.find(group => group.children.some(([child]) => child === id))?.id || id);
  return GENRE_GROUPS.map(group => group.id).find(genre => genreMatches(genre, trackGenreTags(track)) && !own.includes(genre) && own.some(item => ADJACENT[item]?.includes(genre)));
}
// Parecido con lo que escuchas: etiquetas compartidas con tu perfil y cercanía de sonido.
export function tasteSimilarity(track: Candidate, taste?: Taste): number {
  if (!taste) return 0;
  const parts: number[] = [];
  const weights = Object.values(taste.tags).sort((a, b) => b - a).slice(0, 3);
  if (weights.length) {
    const reference = weights.reduce((sum, value) => sum + value, 0);
    const matched = [...new Set(trackGenreTags(track).map(normalize).filter(Boolean))].map(tag => taste.tags[tag] || 0).sort((a, b) => b - a).slice(0, 3);
    parts.push(Math.min(1, matched.reduce((sum, value) => sum + value, 0) / reference));
  }
  if (taste.audio && track.audio) {
    const a = taste.audio, b = track.audio;
    const diffs = [a.valence - b.valence, a.energy - b.energy, a.danceability - b.danceability, a.acousticness - b.acousticness];
    const tempoA = perceivedTempo(a), tempoB = perceivedTempo(b);
    if (tempoA && tempoB) diffs.push((tempoA - tempoB) / 120);
    const distance = Math.sqrt(diffs.reduce((sum, value) => sum + value * value, 0) / diffs.length);
    parts.push(Math.max(0, 1 - distance / .35));
  }
  const artist = taste.artists?.[normalize(track.artist)] || 0;
  const base = parts.length ? parts.reduce((sum, value) => sum + value, 0) / parts.length : 0;
  return Math.min(1, base + .3 * artist);
}
// Popularidad intermedia: ni el éxito que todos conocen ni lo inencontrable. Óptimo entre ~30 mil y
// ~800 mil oyentes en Last.fm; 1.8 M ya resta a la mitad y desde ~4 M o con mil oyentes ronda 0.
export function novelty(listeners?: number): number {
  if (!listeners) return .5;
  const level = Math.log10(listeners);
  if (level > 5.9) return Math.max(0, 1 - 1.5 * (level - 5.9));
  if (level < 4.5) return Math.max(0, 1 - (4.5 - level) / 1.5);
  return 1;
}
// Una sorpresa debe encajar de sobra con el mood aunque se aleje de tu gusto.
export const SURPRISE_MIN = .85;
// User taste changes ordering only after the same mood gate for everyone.
export function moodFit(item: Candidate, slug: string, _preferences?: Preferences | null): number {
  return moodAffinity(item, slug);
}
function eligibleFor(item: Candidate, slug: string, preferences?: Preferences | null) {
  if (ruleFor(item, preferences?.rules)?.action === 'exclude') return false;
  if (preferenceLevel(preferences) === 5 && !directlyPreferred(item, preferences)) return false;
  const songs = preferences?.feedback?.songs;
  if (songs?.[feedbackKey(item)]?.rating === 'dislike'
    || (item.match && songs?.[feedbackKey(item.match)]?.rating === 'dislike')) return false;
  const affinity = moodFit(item, slug, preferences);
  return affinity >= MOOD_MIN;
}
// Grupos que aún no llegan a su cupo con las candidatas ya clasificadas.
// Cuántas canciones compatibles faltan en cada grupo para llegar a su cupo.
export function quotaGap(candidates: Candidate[], slug: string, preferences?: Preferences | null, limit = 7): Record<Bucket, number> {
  const gap: Record<Bucket, number> = { favorite: 0, near: 0, discovery: 0 };
  if (!hasPreferences(preferences)) return gap;
  const target = quotas(preferences, limit);
  const counts: Record<Bucket, number> = { favorite: 0, near: 0, discovery: 0 };
  for (const item of candidates) if (eligibleFor(item, slug, preferences)) counts[bucketOf(item, preferences)]++;
  for (const bucket of Object.keys(target) as Bucket[]) gap[bucket] = Math.max(0, target[bucket] - counts[bucket]);
  return gap;
}
export function quotaShortfall(candidates: Candidate[], slug: string, preferences?: Preferences | null, limit = 7): Bucket[] {
  const gap = quotaGap(candidates, slug, preferences, limit);
  return (Object.keys(gap) as Bucket[]).filter(bucket => gap[bucket] > 0);
}
export function rankRecommendations(candidates: Candidate[], slug: string, preferences?: Preferences | null, limit = 7, jitter?: (track: Candidate) => number): Candidate[] {
  const unique = new Map<string, Candidate>();
  for (const item of candidates) {
    const previous = unique.get(key(item));
    unique.set(key(item), previous ? { ...item, ...previous, tags: [...new Set([...(previous.tags || []), ...(item.tags || [])])], moodEvidence: [...new Set([...(previous.moodEvidence || []), ...(item.moodEvidence || [])])], listeners: Math.max(previous.listeners || 0, item.listeners || 0) } : item);
  }
  const recordings = new Set<string>();
  const eligible = [...unique.values()].filter(item => eligibleFor(item, slug, preferences)).filter(item => {
    const aliases = recordingKeys(item);
    if (aliases.some(alias => recordings.has(alias))) return false;
    aliases.forEach(alias => recordings.add(alias));
    return true;
  }).map(item => ({
    ...item, genre: item.genre || GENRE_KEYS.find(genre => genreMatches(genre, item.tags || [])),
  }));
  const maxListeners = Math.max(1, ...eligible.map(item => item.listeners || 0));
  const personalized = hasPreferences(preferences);
  const scored = eligible.map(track => {
    const popularity = track.listeners ? Math.log1p(track.listeners) / Math.log1p(maxListeners) : track.familiarity || .1;
    const affinity = moodFit(track, slug, preferences);
    const bucket = bucketOf(track, preferences);
    const nearby = personalized && bucket === 'discovery' ? nearbyGenre(track, preferences) : undefined;
    const taste = bucket === 'discovery' ? tasteSimilarity(track, preferences?.taste) : 0;
    const fresh = novelty(track.listeners);
    const variation = jitter ? JITTER * jitter(track) : 0;
    const feedbackTrack = track.match && preferences?.feedback?.songs[feedbackKey(track.match)]
      ? { ...track, title: track.match.title, artist: track.match.artist } : track;
    // Descubrimientos: afinidad con tu gusto y popularidad intermedia pesan más que el éxito masivo.
    const score = (!personalized ? .6 * affinity + .4 * popularity
      : bucket === 'discovery' ? .3 * affinity + .35 * Math.max(taste, nearby ? .5 : 0) + .25 * fresh + (track.via ? .1 : 0)
      // Cercanos: mitad popularidad, mitad novedad. Favoritos: sus temas conocidos primero.
      : (.2 + .4 * (preferenceLevel(preferences) - 1) / 2) * personalAffinity(track, preferences) + .25 * affinity + .15 * (bucket === 'near' ? .5 * popularity + .5 * fresh : popularity)) + variation + feedbackAdjustment(feedbackTrack, preferences?.feedback) + ruleAdjustment(track, preferences?.rules);
    // Sorpresa: encaja de sobra con el mood, se aleja de tu gusto y no es un éxito masivo.
    const surprise = personalized && bucket === 'discovery' && affinity >= SURPRISE_MIN && taste < .35 && !nearby && !track.via
      ? .5 * affinity + .35 * fresh + variation : -1;
    const chosenGenre = preferences?.genres.some(genre => genreMatches(genre, trackGenreTags(track)));
    const reason = !personalized ? track.curated ? 'Selección conocida para este mood.' : 'Afinidad de etiquetas y popularidad en Last.fm.'
      : bucket === 'favorite' ? (preferences?.spotifyArtists?.some(name => normalize(name) === normalize(track.artist)) ? 'De lo que más escuchas en Spotify, para este mood.' : 'De uno de tus artistas, para este mood.')
      : track.relatedTo ? `Artista similar a ${track.relatedTo}, para este mood.`
      : track.via && bucket === 'near' ? `Porque escuchas ${track.via}: un artista cercano por descubrir.`
      : chosenGenre ? 'De tus géneros, para este mood.'
      : bucket === 'near' ? `Del mismo estilo que ${styleArtist(track, preferences)}, para este mood.`
      : track.via ? `Porque escuchas ${track.via}: un artista cercano por descubrir.`
      : nearby ? `Para descubrir: ${GENRE_LABEL[nearby]}, cerca de lo que escuchas.`
      : taste >= .5 ? 'Para descubrir: suena parecido a lo que escuchas.'
      : 'Para descubrir: encaja muy bien con este mood.';
    return { track: { ...track, recommendationReason: reason }, score, bucket, surprise };
  });
  scored.sort((a, b) => b.score - a.score || key(a.track).localeCompare(key(b.track)));
  // 1) Elegir el conjunto: cupos por grupo y límites por artista; si falta, se relajan.
  let pool = scored;
  if (personalized) {
    const chosen: typeof scored = [];
    const perArtist = new Map<string, number>();
    const take = (item: typeof scored[number], cap: boolean) => {
      const artist = normalize(item.track.artist);
      // Tus artistas pueden llenar su cupo completo; el resto, 2 por artista para que haya variedad.
      const max = item.bucket === 'favorite' ? Math.max(3, quotas(preferences, limit).favorite) : 2;
      if (chosen.length >= limit || chosen.includes(item) || (cap && (perArtist.get(artist) || 0) >= max)) return;
      chosen.push(item); perArtist.set(artist, (perArtist.get(artist) || 0) + 1);
    };
    const target = quotas(preferences, limit);
    // De vez en cuando uno de los descubrimientos es una sorpresa: algo distinto a lo habitual.
    if (preferences?.surprise && target.discovery) {
      const pick = scored.filter(item => item.surprise >= 0).sort((a, b) => b.surprise - a.surprise)[0];
      if (pick) { take(pick, true); pick.track.recommendationReason = 'Una sorpresa: algo distinto a lo habitual que encaja con este mood.'; target.discovery--; }
    }
    for (const bucket of ['favorite', 'near', 'discovery'] as Bucket[]) {
      const before = chosen.length;
      for (const item of scored) { if (chosen.length - before >= target[bucket]) break; if (item.bucket === bucket) take(item, true); }
    }
    // Si un grupo no alcanza su cupo completan primero tus artistas y los cercanos; los
    // descubrimientos llegan como mucho a 3 salvo que no haya nada más que encaje.
    for (const item of scored) if (item.bucket !== 'discovery') take(item, true);
    for (const item of scored) if (item.bucket === 'discovery' && chosen.filter(entry => entry.bucket === 'discovery').length < 3) take(item, true);
    for (const item of scored) if (item.bucket !== 'discovery') take(item, false);
    for (const item of scored) take(item, false);
    pool = chosen;
  }
  if (!personalized && Object.keys(preferences?.feedback?.songs || {}).length) {
    const counts = new Map<string, number>();
    const varied = pool.filter(item => {
      const artist = normalize(item.track.artist), count = counts.get(artist) || 0;
      counts.set(artist, count + 1); return count < 2;
    });
    pool = [...varied.slice(0, limit), ...pool.filter(item => !varied.includes(item)).slice(0, Math.max(0, limit - varied.length))];
  }
  // 2) Ordenar con flujo: espaciar artistas y suavizar saltos de género e intensidad.
  const selected: Candidate[] = [];
  const remaining = [...pool];
  while (remaining.length && selected.length < limit) {
    const previous = selected.at(-1);
    const scoreWithFlow = (item: typeof scored[number]) => {
      if (!previous) return item.score;
      const recentArtist = selected.slice(-2).some(track => normalize(track.artist) === normalize(item.track.artist));
      const genre = previous.genre && item.track.genre && normalize(previous.genre) === normalize(item.track.genre) ? .06 : 0;
      const energyGap = Math.abs((previous.energy ?? PROFILES[slug].energy) - (item.track.energy ?? PROFILES[slug].energy));
      const before = previous.audio && perceivedTempo(previous.audio), after = item.track.audio && perceivedTempo(item.track.audio);
      const tempoGap = before && after ? Math.min(.08, Math.abs(before - after) / 400) : 0;
      return item.score + genre - .15 * energyGap - tempoGap - (recentArtist ? .4 : 0);
    };
    remaining.sort((a, b) => scoreWithFlow(b) - scoreWithFlow(a) || key(a.track).localeCompare(key(b.track)));
    selected.push(remaining.shift()!.track);
  }
  return selected;
}
