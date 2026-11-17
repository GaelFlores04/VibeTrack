import type { AudioFeatures, Candidate } from './recommendation-engine';
import type { LyricTheme } from './lyrics-lexicon';
import { normalize } from './music-normalize';

type AudioRange = Partial<Record<'valence' | 'energy' | 'danceability' | 'acousticness', [number, number]>>;
// tempo: BPM percibidos (ver perceivedTempo). Señal suave: resta afinidad, nunca descarta por sí sola.
// falloff: tolerancia por rasgo (por defecto .25). darkMinEnergy: energía mínima si la canción es oscura (valence < .3).
type MoodProfile = { tags: string[]; positive: string[]; negative: string[]; energy: number; audio: AudioRange; tempo: [number, number]; falloff?: Partial<Record<keyof AudioRange, number>>; darkMinEnergy?: number; description: string; seeds: Array<[string, string, string, number]> };
export const PROFILES: Record<string, MoodProfile> = {
  feliz: {
    audio: { valence: [.55, 1], energy: [.45, 1], danceability: [.45, 1] }, tempo: [88, 170],
    tags: ['happy', 'feel good', 'upbeat'], positive: ['happy', 'feel good', 'joyful', 'cheerful', 'happiness'], negative: ['sad', 'sadcore', 'depressing', 'melancholic', 'melancholy', 'heartbreak', 'angry', 'aggressive', 'dark ambient', 'funeral'], energy: .75,
    description: 'Alegre y luminoso; prioriza temas animados y evita señales claramente melancólicas.',
    seeds: [['Happy', 'Pharrell Williams', 'pop', .8], ['Get Lucky', 'Daft Punk', 'electronic', .7], ['September', 'Earth, Wind & Fire', 'funk', .8], ['Walking on Sunshine', 'Katrina & The Waves', 'pop', .85], ["CAN’T STOP THE FEELING!", 'Justin Timberlake', 'pop', .85], ['Levitating', 'Dua Lipa', 'pop', .75]],
  },
  relajado: {
    audio: { energy: [.1, .55], valence: [.2, .85] }, tempo: [55, 120],
    tags: ['chillout', 'chill', 'mellow'], positive: ['chillout', 'chill', 'relax', 'relaxing', 'mellow', 'peaceful'], negative: ['aggressive', 'angry', 'workout', 'tense'], energy: .3,
    description: 'Tranquilo para acompañar actividades, con voces suaves y ritmos moderados.',
    seeds: [['Dreams', 'Fleetwood Mac', 'rock', .4], ['Better Together', 'Jack Johnson', 'folk', .3], ['Sunset Lover', 'Petit Biscuit', 'electronic', .3], ['Sunday Morning', 'Maroon 5', 'pop', .4], ['Banana Pancakes', 'Jack Johnson', 'folk', .25], ['Come Away With Me', 'Norah Jones', 'jazz', .2]],
  },
  motivado: {
    // Motivar exige energía de verdad: oscuro y a medio gas es melancolía (Lurk, Dealer), no impulso.
    audio: { energy: [.65, 1], danceability: [.4, 1] }, tempo: [80, 195], falloff: { energy: .1 }, darkMinEnergy: .75,
    tags: ['workout', 'energetic', 'motivational'], positive: ['workout', 'motivational', 'motivation', 'energetic', 'upbeat', 'power', 'running'], negative: ['sleep', 'sleepy', 'sad', 'depressing'], energy: .9,
    description: 'Impulso y energía para moverte; evita canciones de descanso o tristeza.',
    seeds: [['Lose Yourself', 'Eminem', 'hip-hop', .85], ['Stronger', 'Kanye West', 'hip-hop', .85], ["Don't Stop Me Now", 'Queen', 'rock', .9], ['Eye of the Tiger', 'Survivor', 'rock', .85], ['Titanium', 'David Guetta', 'electronic', .9], ['Till I Collapse', 'Eminem', 'hip-hop', .95]],
  },
  triste: {
    // Triste = negativo y sin empuje. Valence baja con energía alta es tensión (Derezzed: e .62) y
    // con mucho ritmo es baile (Doin' It Right: danceability .80); ninguna de las dos es tristeza.
    audio: { valence: [0, .38], energy: [0, .5], danceability: [0, .68] }, tempo: [50, 100],
    tags: ['sad', 'melancholic', 'melancholy'], positive: ['sad', 'melancholic', 'melancholy', 'heartbreak', 'depressing', 'sadness'], negative: ['happy', 'party', 'feel good', 'comedy'], energy: .3,
    description: 'Acompaña la tristeza con temas melancólicos; no intenta cambiarla por música de fiesta.',
    seeds: [['Someone Like You', 'Adele', 'pop', .25], ['The Night We Met', 'Lord Huron', 'indie', .2], ['Fix You', 'Coldplay', 'rock', .45], ['Someone You Loved', 'Lewis Capaldi', 'pop', .3], ['Everybody Hurts', 'R.E.M.', 'rock', .3], ['Nothing Compares 2 U', 'Sinéad O’Connor', 'pop', .25]],
  },
  romantico: {
    audio: { valence: [.25, .85], energy: [.15, .65], danceability: [.25, .8] }, tempo: [55, 115],
    tags: ['romantic', 'love songs'], positive: ['romantic', 'love songs', 'romance', 'wedding'], negative: ['heartbreak', 'breakup', 'angry', 'aggressive', 'depressing'], energy: .35,
    description: 'Afecto y cercanía; evita priorizar canciones de ruptura aunque lleven la etiqueta love.',
    seeds: [['All of Me', 'John Legend', 'r&b', .3], ['Perfect', 'Ed Sheeran', 'pop', .3], ['At Last', 'Etta James', 'jazz', .3], ['Just the Way You Are', 'Bruno Mars', 'pop', .5], ["Can't Help Falling in Love", 'Elvis Presley', 'pop', .2], ['Until I Found You', 'Stephen Sanchez', 'pop', .35]],
  },
  cansado: {
    audio: { energy: [0, .32], valence: [0, .65], danceability: [0, .6] }, tempo: [45, 95],
    tags: ['sleep', 'calm', 'soothing'], positive: ['sleep', 'sleepy', 'calm', 'peaceful', 'soothing'], negative: ['workout', 'energetic', 'party', 'aggressive', 'tense'], energy: .12,
    description: 'Descanso con estímulos suaves y piano; se diferencia de relajado por su menor intensidad.',
    seeds: [['River Flows in You', 'Yiruma', 'classical', .15], ['Nuvole Bianche', 'Ludovico Einaudi', 'classical', .2], ["Don't Know Why", 'Norah Jones', 'jazz', .2], ['Ocean Eyes', 'Billie Eilish', 'pop', .15], ['Weightless', 'Marconi Union', 'ambient', .05], ['Sunrise', 'Norah Jones', 'jazz', .2]],
  },
};
const hasTag = (tags: string[], term: string) => tags.some(tag => normalize(tag) === normalize(term));
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
// Letra: veta lo que contradice el mood y matiza lo que encaja; nunca rescata un tema que no suena al mood.
// El desamor movido (p. ej. Tusa) sólo cabe en motivado: queda fuera de feliz, triste (por audio) y romántico.
const LYRIC_RULES: Record<string, { veto: LyricTheme[]; boost: LyricTheme[]; ratio: number }> = {
  feliz: { veto: ['heartbreak', 'sadness', 'threat', 'substance'], boost: ['joy', 'party'], ratio: 1 },
  triste: { veto: ['party', 'joy'], boost: ['heartbreak', 'sadness'], ratio: 1 },
  romantico: { veto: ['heartbreak', 'threat'], boost: ['love'], ratio: .8 },
  // El desamor movido sí cabe en motivado; una letra de tristeza no.
  motivado: { veto: ['sadness'], boost: ['motivation', 'party'], ratio: 1 },
  relajado: { veto: ['threat'], boost: ['love'], ratio: 1 },
  cansado: { veto: ['party', 'threat'], boost: [], ratio: 1 },
};
const LYRIC_VETO_MIN = .45;
export function lyricVeto(track: Candidate, slug: string): boolean {
  const lyrics = track.lyrics, rules = LYRIC_RULES[slug];
  if (!lyrics || !rules) return false;
  // "Lo que encaja" se compara contra joy en feliz; la fiesta no salva al desamor.
  const support = slug === 'feliz' ? lyrics.joy : Math.max(0, ...rules.boost.map(theme => lyrics[theme]));
  return rules.veto.some(theme => lyrics[theme] >= LYRIC_VETO_MIN && lyrics[theme] >= support * rules.ratio);
}
// Señal de audio clara, BPM percibido incluido: basta sin etiqueta emocional en feliz y triste.
// Calibrado con rasgos reales de ReccoBeats (2026-11-17): Levitating, Happy, September, Uptown Funk
// y Dancing Queen pasan; The Game of Love (90 BPM) y This House is a Circus (bailabilidad .48), no.
// Triste: Fix You (138→69), The Night We Met, Everybody Hurts, Skinny Love y Pearls pasan.
const CLEAR_AUDIO: Record<string, (features: AudioFeatures, bpm: number) => boolean> = {
  feliz: (f, bpm) => f.valence >= .65 && f.energy >= .55 && f.danceability >= .5 && bpm >= 98 && bpm <= 170,
  triste: (f, bpm) => f.valence <= .3 && f.energy <= .45 && bpm >= 55 && bpm <= 95,
};
export function clearAudio(features: AudioFeatures, slug: string): boolean {
  const bpm = perceivedTempo(features);
  return bpm !== undefined && !!CLEAR_AUDIO[slug]?.(features, bpm);
}
// Letra claramente triste: tristeza o desamor ≥ .45 y por encima de la alegría.
export function lyricSadness(track: Candidate): boolean {
  const lyrics = track.lyrics;
  if (!lyrics) return false;
  const sad = Math.max(lyrics.sadness || 0, lyrics.heartbreak || 0);
  return sad >= .45 && sad >= 1.5 * (lyrics.joy || 0);
}
// Version the decision policy independently of cached provider metadata.
// 4: la letra deja de consultarse; sólo audio y etiquetas.
// 5: audio claro con BPM basta en feliz/triste; la letra sólo opina si está disponible al momento.
// 6: en triste, una letra claramente triste admite un sonido animado no eufórico.
export const MOOD_POLICY_VERSION = 6;
export const MOOD_MIN = .8;
export interface MoodAssessment {
  score: number;
  reason: 'compatible' | 'opposing-tags' | 'opposing-lyrics' | 'incompatible-audio' | 'insufficient-evidence' | 'pending-lyrics';
  evidence: Array<'track-tags' | 'lyrics' | 'audio' | 'curation'>;
}

// Scores are policy strengths, not calibrated probabilities. Genre, popularity,
// artist similarity and search-source tags cannot establish a song's emotion.
export function assessMood(track: Candidate, slug: string): MoodAssessment {
  const profile = PROFILES[slug];
  const evidence: MoodAssessment['evidence'] = [];
  const reject = (reason: MoodAssessment['reason']): MoodAssessment => ({ score: 0, reason, evidence });
  if (!profile) return reject('insufficient-evidence');
  const tags = track.tags || [];
  if (profile.negative.some(term => hasTag(tags, term))) return reject('opposing-tags');
  if (lyricVeto(track, slug)) return reject('opposing-lyrics');
  // A timeout is not proof that the lyrics contain no contradiction.
  if (track.lyricsChecked === false) return reject('pending-lyrics');
  // "love" is useful context with matching sound, but too broad as a lone tag.
  const hits = profile.positive.filter(term => hasTag(tags, term)).length
    + Number(slug === 'romantico' && !!track.audio && hasTag(tags, 'love'));
  const themes = slug === 'feliz' ? ['joy'] : slug === 'triste' ? ['heartbreak', 'sadness']
    : slug === 'romantico' ? ['love'] : slug === 'motivado' ? ['motivation'] : [];
  const lyricSupport = Math.max(0, ...themes.map(theme => track.lyrics?.[theme as LyricTheme] || 0));
  if (hits) evidence.push('track-tags');
  if (lyricSupport >= .45) evidence.push('lyrics');
  if (track.curated) evidence.push('curation');
  const semantic = evidence.length > 0;
  if (track.audio) {
    const values = ['valence', 'energy', 'danceability', 'acousticness'] as const;
    if (values.some(name => !Number.isFinite(track.audio![name]) || track.audio![name] < 0 || track.audio![name] > 1)) return reject('incompatible-audio');
    const fit = audioMatch(track.audio, slug);
    // Tristeza en la letra con sonido animado (indie rock como The Strokes): basta una letra
    // claramente triste si el sonido no es eufórico. Medido en 60 temas de The Strokes y Arctic
    // Monkeys (2026-11-17): admite "Do Me a Favour" o "12:51"; "Machu Picchu" (valence .87), no.
    if (fit < .8 && slug === 'triste' && lyricSadness(track) && track.audio.valence <= .65) {
      return { score: .81, reason: 'compatible', evidence: [...evidence, 'lyrics'] };
    }
    // Neither curation nor a favorite artist overrides contradictory sound.
    if (fit < .8) return reject('incompatible-audio');
    evidence.push('audio');
    // Valence/arousal cannot distinguish sadness from tension, or affection
    // from quietness. These moods require song-specific semantic evidence.
    if (['feliz', 'triste', 'romantico'].includes(slug) && !semantic) {
      // Sin etiqueta ni letra, sólo un audio inequívoco (rasgos + BPM) la admite, por debajo de
      // las que sí tienen evidencia emocional.
      if (!clearAudio(track.audio, slug)) return reject('insufficient-evidence');
      return { score: .82, reason: 'compatible', evidence };
    }
    if (!semantic && fit < .9) return reject('insufficient-evidence');
    return { score: Math.min(1, .8 + .12 * fit + .04 * hits + .04 * lyricSupport), reason: 'compatible', evidence };
  }
  if (track.curated) return { score: 1, reason: 'compatible', evidence };
  // A direct emotional track tag is usable when audio is unavailable. Lyrics
  // alone describe a story, not the arrangement, and cannot qualify a song.
  if (!hits) return reject('insufficient-evidence');
  return { score: Math.min(.94, .8 + .02 * hits + .04 * lyricSupport), reason: 'compatible', evidence };
}
export function moodAffinity(track: Candidate, slug: string): number {
  return assessMood(track, slug).score;
}
