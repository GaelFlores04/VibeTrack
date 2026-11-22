import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessMood, MOOD_MIN } from '../src/modules/music/mood-classifier';
import { Candidate, rankRecommendations } from '../src/modules/music/recommendation-engine';
import { MusicProviders } from '../src/modules/music/music.providers';
import { MusicCache } from '../src/modules/music/music-cache';
import { recordingKeys } from '../src/modules/music/track-matching';
import { analyzeLyrics } from '../src/modules/music/lyrics-lexicon';

const song = (title: string, extra: Partial<Candidate> = {}): Candidate => ({
  id: `lastfm:${title}`, title, artist: 'Artist', externalUrl: 'https://www.last.fm/', ...extra,
});

// Actual public ReccoBeats features retrieved by ISRC on 2026-11-16.
// These regressions check abstention, not an objective label for every listener.
const ambiguous = [
  song('The Game of Love', { artist: 'Daft Punk', isrc: 'USQX91300102', audio: { valence: .682, energy: .5, danceability: .712, acousticness: .825, tempo: 90.039 } }),
  song('This House is a Circus', { artist: 'Arctic Monkeys', isrc: 'GBCEL0700070', audio: { valence: .658, energy: .844, danceability: .476, acousticness: .0000181, tempo: 155.322 } }),
  song('The Grid', { artist: 'Daft Punk', isrc: 'USWD11054877', audio: { valence: .0645, energy: .53, danceability: .556, acousticness: .307, tempo: 102.018 } }),
];

test('capturas: valencia y artista favorito no bastan para certificar feliz o triste', () => {
  for (const [index, track] of ambiguous.entries()) {
    const mood = index < 2 ? 'feliz' : 'triste';
    assert.ok(assessMood(track, mood).score < MOOD_MIN, track.title);
    assert.equal(rankRecommendations([track], mood, { artists: [track.artist], genres: [] }).length, 0);
  }
});

test('audio claro con BPM basta en feliz y triste, por debajo de la evidencia emocional', () => {
  // Rasgos reales de ReccoBeats (2026-11-17), sin etiquetas emocionales en Last.fm.
  const levitating = song('Levitating', { artist: 'Dua Lipa', tags: ['pop', 'disco'], audio: { valence: .914, energy: .884, danceability: .695, acousticness: .0561, tempo: 103.014 } });
  const fixYou = song('Fix You', { artist: 'Coldplay', tags: ['rock'], audio: { valence: .124, energy: .417, danceability: .21, acousticness: .16, tempo: 138.178 } });
  assert.ok(assessMood(levitating, 'feliz').score >= MOOD_MIN);
  assert.ok(assessMood(fixYou, 'triste').score >= MOOD_MIN, 'el BPM percibido (138→69) cuenta');
  assert.ok(assessMood(levitating, 'feliz').score < assessMood({ ...levitating, tags: ['happy'] }, 'feliz').score);
  assert.equal(assessMood({ ...levitating, tags: ['sad'] }, 'feliz').score, 0, 'una etiqueta contraria sigue excluyendo');
  assert.equal(assessMood({ ...levitating, audio: { ...levitating.audio!, tempo: undefined } }, 'feliz').score, 0, 'sin BPM no hay señal clara');
  // Una pieza orquestal muy oscura y lenta ahora cuenta como triste; romántico sigue exigiendo afecto.
  const somber = song("Mythologies: X. L'Accouchement", { artist: 'Thomas Bangalter', audio: { valence: .0336, energy: .148, danceability: .149, acousticness: .895, tempo: 79.181 } });
  assert.ok(assessMood(somber, 'triste').score >= MOOD_MIN);
  assert.equal(assessMood(song('suave', { audio: { valence: .5, energy: .3, danceability: .5, acousticness: .8, tempo: 80 } }), 'romantico').score, 0);
});

test('el género, la fuente, la popularidad y repetir la fuente no prueban una emoción', () => {
  for (const tag of ['funk', 'disco', 'dance pop', 'summer', 'upbeat']) {
    const track = song(tag, { tags: [tag], moodEvidence: ['happy', 'happy', 'feel good'], listeners: 10000000 });
    assert.equal(assessMood(track, 'feliz').reason, 'insufficient-evidence');
  }
  assert.equal(assessMood(song('piano', { tags: ['piano', 'classical', 'emotional'] }), 'triste').score, 0);
});

test('romance requiere afecto y no sólo audio suave; señales contrarias dominan la curación', () => {
  const soft = { valence: .5, energy: .3, danceability: .5, acousticness: .8 };
  assert.equal(assessMood(song('neutral', { audio: soft }), 'romantico').score, 0);
  assert.ok(assessMood(song('love', { audio: soft, tags: ['romantic'] }), 'romantico').score >= MOOD_MIN);
  assert.equal(assessMood(song('conflict', { curated: true, audio: soft, tags: ['heartbreak'] }), 'romantico').score, 0);
  assert.equal(assessMood(song('wrong sound', { curated: true, audio: soft }), 'motivado').score, 0);
});

test('rechaza rasgos corruptos; distingue descanso de actividad sin etiquetas de género', () => {
  const rest = { valence: .3, energy: .12, danceability: .2, acousticness: .9 };
  assert.ok(assessMood(song('rest', { audio: rest }), 'cansado').score >= MOOD_MIN);
  assert.equal(assessMood(song('rest', { audio: rest }), 'motivado').score, 0);
  assert.equal(assessMood(song('bad', { audio: { ...rest, valence: NaN }, tags: ['sleep'] }), 'cansado').score, 0);
});

test('un arreglo alegre no oculta amenazas; las negaciones no se interpretan como bienestar', () => {
  // Texto sintético: no se reproducen letras comerciales.
  const lyrics = analyzeLyrics('The gun and the bullets bring fear to every street, we hide from the guns and the bullets tonight. '.repeat(3));
  const track = song('bright arrangement', { tags: ['happy'], audio: { valence: .9, energy: .7, danceability: .7, acousticness: .1 }, lyrics });
  assert.equal(assessMood(track, 'feliz').reason, 'opposing-lyrics');
  const negated = analyzeLyrics('I am not happy and I never smile. No te quiero y nunca estoy feliz. The days go on and on. '.repeat(3));
  assert.equal(negated?.joy, 0);
  assert.equal(negated?.love, 0);
});

test('una caída de letras no se interpreta como ausencia de contradicciones', () => {
  const track = song('pending', { tags: ['happy'], lyricsChecked: false });
  assert.equal(assessMood(track, 'feliz').reason, 'pending-lyrics');
  assert.equal(rankRecommendations([track], 'feliz').length, 0);
  assert.ok(assessMood({ ...track, lyricsChecked: true, lyrics: null }, 'feliz').score >= MOOD_MIN);
});

test('deduplica el ISRC y el ID resuelto antes de contar cupos; conserva versiones distintas', () => {
  const original = song('Original', { tags: ['happy'], isrc: 'USABC1234567' });
  const alias = song('Localized title', { tags: ['happy'], match: { ...original, id: 'deezer:1' } });
  const otherAlias = song('Another release', { tags: ['happy'], match: { ...original, id: 'deezer:1', isrc: undefined } });
  const live = song('Original (Live)', { tags: ['happy'], isrc: 'USABC1234568' });
  const result = rankRecommendations([original, alias, otherAlias, live], 'feliz');
  assert.equal(result.length, 2);
  assert.ok(result.some(track => track.title === 'Original (Live)'));
  assert.ok(recordingKeys(alias).includes('isrc:USABC1234567'));
});

test('LRCLIB no atribuye letras de otro título ni de un artista con el mismo primer nombre', async () => {
  const before = globalThis.fetch;
  const lyrics = 'happy sunshine smile joy good vibes celebrate '.repeat(8);
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    const wrongTitle = { artistName: 'The Band', trackName: 'Other', plainLyrics: lyrics };
    const wrongArtist = { artistName: 'The Other Band', trackName: 'Song', plainLyrics: lyrics };
    return new Response(JSON.stringify(url.pathname.endsWith('/get') ? wrongTitle : [wrongTitle, wrongArtist]));
  };
  try { assert.equal(await new MusicProviders(new MusicCache()).lyrics({ artist: 'The Band', title: 'Song' }), null); }
  finally { globalThis.fetch = before; }
});

test('completa un ISRC ausente en búsqueda con la ficha de la misma grabación', async () => {
  const before = globalThis.fetch;
  const calls: string[] = [];
  const item = { id: 1, title: 'Song', artist: { name: 'Artist' }, link: 'https://www.deezer.com/track/1' };
  globalThis.fetch = async input => {
    const path = new URL(String(input)).pathname; calls.push(path);
    return new Response(JSON.stringify(path === '/search' ? { data: [item] } : { ...item, isrc: 'USABC1234567' }));
  };
  try {
    const providers = new MusicProviders(new MusicCache());
    assert.equal((await providers.match({ title: 'Song', artist: 'Artist' }))?.isrc, 'USABC1234567');
    await providers.match({ title: 'Song', artist: 'Artist' });
    assert.deepEqual(calls, ['/search', '/track/1']);
  } finally { globalThis.fetch = before; }
});

test('triste: una letra claramente triste admite un sonido animado, no uno eufórico', () => {
  // Rasgos reales (ReccoBeats) de Arctic Monkeys: Do Me a Favour; letra sintética equivalente.
  const sadLyrics = analyzeLyrics('I cry alone tonight, the tears fall and I miss you, my heart is broken and lonely. '.repeat(3))!;
  const upbeat = { valence: .62, energy: .74, danceability: .5, acousticness: .1, tempo: 90 };
  assert.ok(assessMood(song('Do Me a Favour', { audio: upbeat, lyrics: sadLyrics, lyricsChecked: true }), 'triste').score >= MOOD_MIN);
  assert.equal(assessMood(song('sin letra', { audio: upbeat }), 'triste').reason, 'incompatible-audio');
  assert.equal(assessMood(song('eufórica', { audio: { ...upbeat, valence: .87 }, lyrics: sadLyrics, lyricsChecked: true }), 'triste').score, 0);
  assert.equal(assessMood(song('feliz', { audio: upbeat, lyrics: sadLyrics, lyricsChecked: true }), 'feliz').score, 0, 'sólo aplica a triste');
});
