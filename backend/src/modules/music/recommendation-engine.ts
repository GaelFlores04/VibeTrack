import { matchingTitle } from './track-matching';
import type { Track } from './music.types';
import type { LyricProfile, LyricTheme } from './lyrics-lexicon';

// styleOf: géneros deducidos de los artistas elegidos (género -> artista). Sólo sirve de
// respaldo cuando las canciones del artista y de sus similares no bastan para el mood.
// taste: perfil aprendido (etiquetas, artistas escuchados y sonido promedio). surprise: esta tanda
// incluye una sorpresa. Ninguno de los dos cambia qué es favorito: sólo afinan los descubrimientos.
// spotifyArtists: los más escuchados en Spotify (ya incluidos en artists); sólo cambia el motivo mostrado.
export interface Preferences { genres: string[]; artists: string[]; spotifyArtists?: string[]; styleOf?: Record<string, string>; taste?: Taste; surprise?: boolean }
export interface Taste { tags: Record<string, number>; artists?: Record<string, number>; audio?: AudioFeatures }
export const GENRE_KEYS = ['pop', 'rock', 'indie', 'electronic', 'hip-hop', 'r&b', 'latin', 'jazz', 'classical', 'folk', 'metal', 'ambient'];
// Rasgos de audio (ReccoBeats, escala 0-1) que describen cómo suena la grabación.
export interface AudioFeatures { valence: number; energy: number; danceability: number; acousticness: number; tempo?: number }
export interface Candidate extends Track {
  audio?: AudioFeatures; match?: Track; audioChecked?: boolean;
  // Perfil de la letra (diccionario local). La letra en sí nunca se guarda.
  lyrics?: LyricProfile | null; lyricsChecked?: boolean;
  tags?: string[]; listeners?: number; curated?: boolean; familiarity?: number; energy?: number;
  moodEvidence?: string[]; recommendationReason?: string;
  sourceGenres?: string[]; relatedTo?: string; metadataChecked?: boolean; retryAt?: number;
  // Artista favorito desde el que se llegó a este descubrimiento (similar de un similar).
  via?: string;
}
export const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
type AudioRange = Partial<Record<'valence' | 'energy' | 'danceability' | 'acousticness', [number, number]>>;
// tempo: BPM percibidos (ver perceivedTempo). Señal suave: resta afinidad, nunca descarta por sí sola.
// falloff: tolerancia por rasgo (por defecto .25). darkMinEnergy: energía mínima si la canción es oscura (valence < .3).
type MoodProfile = { tags: string[]; positive: string[]; negative: string[]; energy: number; audio: AudioRange; tempo: [number, number]; falloff?: Partial<Record<keyof AudioRange, number>>; darkMinEnergy?: number; description: string; seeds: Array<[string, string, string, number]> };
export const PROFILES: Record<string, MoodProfile> = {
  feliz: {
    audio: { valence: [.55, 1], energy: [.45, 1], danceability: [.45, 1] }, tempo: [88, 170],
    tags: ['happy', 'feel good', 'upbeat'], positive: ['happy', 'feel good', 'upbeat', 'summer', 'funk', 'disco', 'dance pop'], negative: ['sad', 'depressing', 'melancholy', 'dark ambient', 'funeral'], energy: .75,
    description: 'Alegre y luminoso; prioriza temas animados y evita señales claramente melancólicas.',
    seeds: [['Happy', 'Pharrell Williams', 'pop', .8], ['Get Lucky', 'Daft Punk', 'electronic', .7], ['September', 'Earth, Wind & Fire', 'funk', .8], ['Walking on Sunshine', 'Katrina & The Waves', 'pop', .85], ["CAN’T STOP THE FEELING!", 'Justin Timberlake', 'pop', .85], ['Levitating', 'Dua Lipa', 'pop', .75]],
  },
  relajado: {
    audio: { energy: [.1, .55], valence: [.2, .85] }, tempo: [55, 120],
    tags: ['chillout', 'chill', 'mellow'], positive: ['chillout', 'chill', 'relax', 'relaxing', 'mellow', 'downtempo', 'acoustic', 'bossa nova'], negative: ['metal', 'hardcore', 'aggressive', 'workout'], energy: .3,
    description: 'Tranquilo para acompañar actividades, con voces suaves y ritmos moderados.',
    seeds: [['Dreams', 'Fleetwood Mac', 'rock', .4], ['Better Together', 'Jack Johnson', 'folk', .3], ['Sunset Lover', 'Petit Biscuit', 'electronic', .3], ['Sunday Morning', 'Maroon 5', 'pop', .4], ['Banana Pancakes', 'Jack Johnson', 'folk', .25], ['Come Away With Me', 'Norah Jones', 'jazz', .2]],
  },
  motivado: {
    // Motivar exige energía de verdad: oscuro y a medio gas es melancolía (Lurk, Dealer), no impulso.
    audio: { energy: [.65, 1], danceability: [.4, 1] }, tempo: [80, 195], falloff: { energy: .1 }, darkMinEnergy: .75,
    tags: ['workout', 'energetic', 'motivational'], positive: ['workout', 'motivational', 'motivation', 'energetic', 'upbeat', 'power', 'running'], negative: ['sleep', 'sleepy', 'ambient', 'sad', 'depressing'], energy: .9,
    description: 'Impulso y energía para moverte; evita canciones de descanso o tristeza.',
    seeds: [['Lose Yourself', 'Eminem', 'hip-hop', .85], ['Stronger', 'Kanye West', 'hip-hop', .85], ["Don't Stop Me Now", 'Queen', 'rock', .9], ['Eye of the Tiger', 'Survivor', 'rock', .85], ['Titanium', 'David Guetta', 'electronic', .9], ['Till I Collapse', 'Eminem', 'hip-hop', .95]],
  },
  triste: {
    // Triste = negativo y sin empuje. Valence baja con energía alta es tensión (Derezzed: e .62) y
    // con mucho ritmo es baile (Doin' It Right: danceability .80); ninguna de las dos es tristeza.
    audio: { valence: [0, .38], energy: [0, .5], danceability: [0, .68] }, tempo: [50, 100],
    tags: ['sad', 'melancholic', 'melancholy'], positive: ['sad', 'melancholic', 'melancholy', 'heartbreak', 'depressing', 'emotional'], negative: ['happy', 'party', 'feel good', 'comedy'], energy: .3,
    description: 'Acompaña la tristeza con temas melancólicos; no intenta cambiarla por música de fiesta.',
    seeds: [['Someone Like You', 'Adele', 'pop', .25], ['The Night We Met', 'Lord Huron', 'indie', .2], ['Fix You', 'Coldplay', 'rock', .45], ['Someone You Loved', 'Lewis Capaldi', 'pop', .3], ['Everybody Hurts', 'R.E.M.', 'rock', .3], ['Nothing Compares 2 U', 'Sinéad O’Connor', 'pop', .25]],
  },
  romantico: {
    audio: { valence: [.25, .85], energy: [.15, .65], danceability: [.25, .8] }, tempo: [55, 115],
    tags: ['romantic', 'love songs'], positive: ['romantic', 'love songs', 'love', 'romance', 'wedding'], negative: ['heartbreak', 'breakup', 'angry', 'aggressive', 'depressing'], energy: .35,
    description: 'Afecto y cercanía; evita priorizar canciones de ruptura aunque lleven la etiqueta love.',
    seeds: [['All of Me', 'John Legend', 'r&b', .3], ['Perfect', 'Ed Sheeran', 'pop', .3], ['At Last', 'Etta James', 'jazz', .3], ['Just the Way You Are', 'Bruno Mars', 'pop', .5], ["Can't Help Falling in Love", 'Elvis Presley', 'pop', .2], ['Until I Found You', 'Stephen Sanchez', 'pop', .35]],
  },
  cansado: {
    audio: { energy: [0, .32], valence: [0, .65], danceability: [0, .6] }, tempo: [45, 95],
    tags: ['sleep', 'calm', 'soothing'], positive: ['sleep', 'sleepy', 'calm', 'peaceful', 'piano', 'ambient', 'soft', 'soothing'], negative: ['workout', 'energetic', 'party', 'metal', 'hardcore'], energy: .12,
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
// 1 dentro del rango del mood; decae con la distancia y llega a 0 a .25 fuera de él.
// Los detectores suelen contar el doble (o la mitad) del pulso que se siente: Fix You marca 138
// pero se percibe a ~69; Lose Yourself marca 171 y se siente a ~86. La energía desambigua.
export function perceivedTempo(features: AudioFeatures): number | undefined {
  const tempo = features.tempo;
  if (!tempo || !Number.isFinite(tempo)) return undefined;
  if (tempo > 165 && features.energy < .8) return tempo / 2;
  if (tempo > 110 && features.energy < .5) return tempo / 2;
  if (tempo < 70 && features.energy > .7) return tempo * 2;
  return tempo;
}
export function tempoMatch(features: AudioFeatures, slug: string): number {
  const bpm = perceivedTempo(features);
  if (bpm === undefined) return 1;
  const [min, max] = PROFILES[slug].tempo;
  const distance = bpm < min ? min - bpm : bpm > max ? bpm - max : 0;
  return Math.max(.6, 1 - distance / 30);
}
export function audioMatch(features: AudioFeatures, slug: string): number {
  let score = 1;
  const profile = PROFILES[slug];
  for (const [name, [min, max]] of Object.entries(profile.audio) as Array<[keyof AudioRange, [number, number]]>) {
    const value = features[name];
    const distance = value < min ? min - value : value > max ? value - max : 0;
    score *= Math.max(0, 1 - distance / (profile.falloff?.[name] ?? .25));
  }
  // Oscura y con energía media no es este mood (Lose Yourself, oscura pero a .74, sí lo es).
  if (profile.darkMinEnergy && features.valence < .3) score *= Math.max(0, 1 - Math.max(0, profile.darkMinEnergy - features.energy) / .1);
  return score * tempoMatch(features, slug);
}
export function moodAffinity(track: Candidate, slug: string): number {
  const profile = PROFILES[slug];
  const tags = track.tags || [];
  if (profile.negative.some(term => hasTag(tags, term))) return 0;
  if (track.curated) return 1;
  const hits = profile.positive.filter(term => hasTag(tags, term)).length;
  // Sólo etiquetas específicas del mood cuentan como evidencia; artista/género nunca la heredan.
  const evidence = new Set((track.moodEvidence || []).filter(tag => profile.tags.includes(tag))).size;
  const tagged = hits ? Math.min(1, .65 + .1 * hits + .05 * evidence) : evidence ? .7 + .05 * Math.min(2, evidence) : 0;
  if (!track.audio) return tagged;
  // El sonido decide cuando nadie etiquetó la canción y corrige etiquetas que lo contradicen.
  const audio = audioMatch(track.audio, slug);
  // Sin etiquetas, el audio solo debe encajar con claridad; con etiquetas ambas señales se promedian.
  const byAudio = audio >= .8 ? .65 + .35 * (audio - .8) / .2 : 0;
  return lyricAdjust(track, slug, tagged ? Math.max(byAudio, .5 * tagged + .5 * audio) : byAudio);
}

// Letra: veta lo que contradice el mood y matiza lo que encaja; nunca rescata un tema que no suena al mood.
// El desamor movido (p. ej. Tusa) sólo cabe en motivado: queda fuera de feliz, triste (por audio) y romántico.
const LYRIC_RULES: Record<string, { veto: LyricTheme[]; boost: LyricTheme[]; ratio: number }> = {
  feliz: { veto: ['heartbreak', 'sadness'], boost: ['joy', 'party'], ratio: 1 },
  triste: { veto: ['party', 'joy'], boost: ['heartbreak', 'sadness'], ratio: 1 },
  romantico: { veto: ['heartbreak'], boost: ['love'], ratio: .8 },
  // El desamor movido sí cabe en motivado; una letra de tristeza no.
  motivado: { veto: ['sadness'], boost: ['motivation', 'party'], ratio: 1 },
  relajado: { veto: [], boost: ['love'], ratio: 1 },
  cansado: { veto: ['party'], boost: [], ratio: 1 },
};
const LYRIC_VETO_MIN = .45;
export function lyricVeto(track: Candidate, slug: string): boolean {
  const lyrics = track.lyrics, rules = LYRIC_RULES[slug];
  if (!lyrics || !rules) return false;
  // "Lo que encaja" se compara contra joy en feliz; la fiesta no salva al desamor.
  const support = slug === 'feliz' ? lyrics.joy : Math.max(0, ...rules.boost.map(theme => lyrics[theme]));
  return rules.veto.some(theme => lyrics[theme] >= LYRIC_VETO_MIN && lyrics[theme] >= support * rules.ratio);
}
function lyricAdjust(track: Candidate, slug: string, fit: number): number {
  if (!track.lyrics || fit <= 0) return fit;
  if (lyricVeto(track, slug)) return 0;
  const boost = Math.max(0, ...(LYRIC_RULES[slug]?.boost || []).map(theme => track.lyrics![theme]));
  return Math.min(1, fit + .06 * boost);
}
export function genreMatches(genre: string, tags: string[]) {
  const aliases: Record<string, string[]> = { electronic: ['electronic', 'electronica', 'dance', 'house', 'downtempo'], 'hip-hop': ['hip hop', 'hip-hop', 'rap'], 'r&b': ['r&b', 'rnb', 'soul'], latin: ['latin', 'latino', 'reggaeton', 'latin pop'], classical: ['classical', 'piano', 'instrumental'], indie: ['indie', 'indie pop', 'indie rock'], pop: ['pop', 'dance pop'], rock: ['rock', 'alternative rock', 'soft rock', 'alternative', 'britpop'] };
  return (aliases[genre] || [genre]).some(alias => hasTag(tags, alias));
}
export const hasPreferences = (preferences?: Preferences | null) => Boolean(preferences && (preferences.genres.length || preferences.artists.length));
export function personalAffinity(track: Candidate, preferences?: Preferences | null): number {
  if (!hasPreferences(preferences)) return 0;
  if (preferences!.artists.some(artist => normalize(artist) === normalize(track.artist))) return 1;
  if (track.relatedTo && preferences!.artists.some(artist => normalize(artist) === normalize(track.relatedTo!))) return .8;
  if (track.via && preferences!.artists.some(artist => normalize(artist) === normalize(track.via!))) return .7;
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
const JITTER = .15;
// Las preferencias orientan, no encierran: cada tanda mezcla favoritos, cercanos y descubrimientos.
export type Bucket = 'favorite' | 'near' | 'discovery';
export function bucketOf(track: Candidate, preferences?: Preferences | null): Bucket {
  const personal = personalAffinity(track, preferences);
  return personal >= 1 ? 'favorite' : personal > 0 ? 'near' : 'discovery';
}
// Para 7: 3 de tus artistas, 2 cercanos (similares, tus géneros o su estilo) y 2 para descubrir.
// Sin artistas elegidos: 5 de tus géneros y 2 para descubrir. Si un grupo no alcanza, otro completa.
export function quotas(preferences: Preferences | null | undefined, limit = 7): Record<Bucket, number> {
  // Con artistas: 4 favoritos, 2 cercanos, 1 descubrimiento (o la sorpresa). Sólo géneros: 5 y 2.
  const favorite = preferences?.artists.length ? Math.round(limit * .57) : 0;
  const discovery = favorite ? 1 : Math.min(2, Math.max(1, Math.round(limit * .28)));
  return { favorite, near: Math.max(0, limit - favorite - discovery), discovery };
}
// Un descubrimiento debe encajar claramente con el mood, no sólo pasar el umbral.
export const DISCOVERY_MIN = .8;
// Géneros vecinos: un descubrimiento cercano a lo que escuchas tiene más probabilidad de gustar.
const ADJACENT: Record<string, string[]> = {
  pop: ['r&b', 'electronic', 'latin', 'indie'], rock: ['indie', 'metal', 'folk', 'pop'], indie: ['rock', 'pop', 'folk', 'electronic'],
  electronic: ['pop', 'hip-hop', 'ambient'], 'hip-hop': ['r&b', 'pop', 'electronic', 'latin'], 'r&b': ['hip-hop', 'pop', 'jazz'],
  latin: ['pop', 'hip-hop', 'r&b'], jazz: ['r&b', 'classical', 'folk'], classical: ['ambient', 'jazz'], folk: ['indie', 'rock', 'jazz'],
  metal: ['rock'], ambient: ['classical', 'electronic'],
};
const GENRE_LABEL: Record<string, string> = { pop: 'pop', rock: 'rock', indie: 'indie', electronic: 'electrónica', 'hip-hop': 'hip-hop', 'r&b': 'R&B', latin: 'música latina', jazz: 'jazz', classical: 'clásica', folk: 'folk', metal: 'metal', ambient: 'ambient' };
function nearbyGenre(track: Candidate, preferences?: Preferences | null): string | undefined {
  const own = [...(preferences?.genres || []), ...Object.keys(preferences?.styleOf || {})];
  return GENRE_KEYS.find(genre => genreMatches(genre, trackGenreTags(track)) && !own.includes(genre) && own.some(item => ADJACENT[item]?.includes(genre)));
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
// Margen para tus artistas: si su audio encaja bastante con el mood, entran aunque no lleguen al umbral
// de una canción desconocida. Una etiqueta contraria explícita sigue excluyendo.
export const FAVORITE_AUDIO_MIN = .6;
export function moodFit(item: Candidate, slug: string, preferences?: Preferences | null): number {
  const affinity = moodAffinity(item, slug);
  if (affinity >= .65 || !item.audio || personalAffinity(item, preferences) < 1) return affinity;
  if (lyricVeto(item, slug)) return 0; // El margen de favoritos no salta el veto de la letra.
  if (PROFILES[slug].negative.some(term => hasTag(item.tags || [], term))) return affinity;
  return audioMatch(item.audio, slug) >= FAVORITE_AUDIO_MIN ? .65 : affinity;
}
function eligibleFor(item: Candidate, slug: string, preferences?: Preferences | null) {
  const affinity = moodFit(item, slug, preferences);
  return affinity >= .65 && (!hasPreferences(preferences) || bucketOf(item, preferences) !== 'discovery' || affinity >= DISCOVERY_MIN);
}
// Grupos que aún no llegan a su cupo con las candidatas ya clasificadas.
export function quotaShortfall(candidates: Candidate[], slug: string, preferences?: Preferences | null, limit = 7): Bucket[] {
  if (!hasPreferences(preferences)) return [];
  const target = quotas(preferences, limit);
  const counts: Record<Bucket, number> = { favorite: 0, near: 0, discovery: 0 };
  for (const item of candidates) if (eligibleFor(item, slug, preferences)) counts[bucketOf(item, preferences)]++;
  return (Object.keys(target) as Bucket[]).filter(bucket => counts[bucket] < target[bucket]);
}
export function rankRecommendations(candidates: Candidate[], slug: string, preferences?: Preferences | null, limit = 7, jitter?: (track: Candidate) => number): Candidate[] {
  const unique = new Map<string, Candidate>();
  for (const item of candidates) {
    const previous = unique.get(key(item));
    unique.set(key(item), previous ? { ...item, ...previous, tags: [...new Set([...(previous.tags || []), ...(item.tags || [])])], moodEvidence: [...new Set([...(previous.moodEvidence || []), ...(item.moodEvidence || [])])], listeners: Math.max(previous.listeners || 0, item.listeners || 0) } : item);
  }
  const eligible = [...unique.values()].filter(item => eligibleFor(item, slug, preferences)).map(item => ({
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
    // Descubrimientos: afinidad con tu gusto y popularidad intermedia pesan más que el éxito masivo.
    const score = (!personalized ? .6 * affinity + .4 * popularity
      : bucket === 'discovery' ? .3 * affinity + .35 * Math.max(taste, nearby ? .5 : 0) + .25 * fresh + (track.via ? .1 : 0)
      // Cercanos: mitad popularidad, mitad novedad. Favoritos: sus temas conocidos primero.
      : .6 * personalAffinity(track, preferences) + .25 * affinity + .15 * (bucket === 'near' ? .5 * popularity + .5 * fresh : popularity)) + variation;
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
  // 1) Elegir el conjunto: cupos por grupo, máximo 3 temas por artista; si falta, se relaja.
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
