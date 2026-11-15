import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artistGenres, audioMatch, Candidate, novelty, perceivedTempo, tasteSimilarity, tempoMatch, curatedCandidates, moodAffinity, PROFILES, rankRecommendations } from '../src/modules/music/recommendation-engine';
const candidate = (title: string, options: Partial<Candidate> = {}): Candidate => ({ id: title, title, artist: `${title} artist`, externalUrl: 'https://www.last.fm/', tags: ['happy'], listeners: 100, ...options });

test('invitados y cuentas sin cuestionario reciben la misma selección conocida por mood', () => {
  for (const slug of Object.keys(PROFILES)) {
    const pool = curatedCandidates(slug);
    const guest = rankRecommendations(pool, slug);
    assert.ok(guest.length >= 6);
    assert.deepEqual(rankRecommendations(pool, slug, null), guest);
    assert.deepEqual(rankRecommendations(pool, slug, { genres: [], artists: [] }), guest);
    assert.ok(guest.every(track => track.curated && moodAffinity(track, slug) === 1));
  }
});
test('sin gustos prioriza popularidad medida entre candidatos con la misma afinidad', () => {
  const result = rankRecommendations([candidate('niche', { listeners: 10 }), candidate('popular', { listeners: 5000000 })], 'feliz');
  assert.equal(result[0].title, 'popular');
});
test('las preferencias cambian el orden pero nunca rescatan temas contrarios al mood', () => {
  const pool = [candidate('popular', { listeners: 500000 }), candidate('favorite', { artist: 'My Artist', tags: ['happy', 'rock'], listeners: 100000 }), candidate('wrong mood', { artist: 'My Artist', tags: ['sad', 'rock'], listeners: 10000000 })];
  assert.equal(rankRecommendations(pool, 'feliz')[0].title, 'popular');
  const personal = rankRecommendations(pool, 'feliz', { genres: ['rock'], artists: ['My Artist'] });
  assert.equal(personal[0].title, 'favorite');
  assert.ok(!personal.some(track => track.title === 'wrong mood'));
  assert.equal(rankRecommendations(pool, 'feliz')[0].title, 'popular'); // No modifica el pool ni contamina otra cuenta.
});
test('sólo las fuentes específicas del mood aportan evidencia, no un género arbitrario', () => {
  assert.equal(moodAffinity(candidate('uncertain', { tags: [], moodEvidence: ['rock'] }), 'feliz'), 0);
  assert.ok(moodAffinity(candidate('corroborated', { tags: [], moodEvidence: ['happy', 'feel good'] }), 'feliz') >= .79);
  assert.equal(moodAffinity(candidate('duplicate source', { tags: [], moodEvidence: ['happy', 'happy'] }), 'feliz'), .75);
});
test('distingue descanso, relajación, tristeza y romance con exclusiones por mood', () => {
  assert.equal(moodAffinity(candidate('party', { tags: ['workout', 'energetic'] }), 'cansado'), 0);
  assert.equal(moodAffinity(candidate('sleep', { tags: ['sleep', 'ambient'] }), 'motivado'), 0);
  assert.equal(moodAffinity(candidate('breakup', { tags: ['love', 'heartbreak'] }), 'romantico'), 0);
  assert.equal(moodAffinity(candidate('happy', { tags: ['happy'] }), 'triste'), 0);
  assert.ok(moodAffinity(candidate('sleep', { tags: ['sleep', 'ambient'] }), 'cansado') > 0);
  assert.equal(moodAffinity(candidate('sleep', { tags: ['sleep', 'ambient'] }), 'relajado'), 0);
});
test('el flujo espacia artistas y deduplica títulos aunque cambien acentos o IDs', () => {
  const pool = [candidate('A', { artist: 'Same', listeners: 1000 }), candidate('B', { artist: 'Same', listeners: 900 }), candidate('C', { listeners: 800 }), candidate('D', { listeners: 700 }), candidate('Á', { artist: 'Same', id: 'duplicate' })];
  const result = rankRecommendations(pool, 'feliz');
  assert.equal(result.length, 4);
  assert.equal(result[0].artist, 'Same');
  assert.notEqual(result[1].artist, 'Same');
  assert.notEqual(result[2].artist, 'Same');
});
test('deduce el género del artista y lo usa como respaldo por debajo de artista y similares', () => {
  assert.deepEqual(artistGenres([{ name: 'rock', count: 100 }, { name: 'alternative', count: 93 }, { name: 'indie', count: 21 }, { name: 'pop', count: 4 }]), ['rock', 'indie']);
  assert.deepEqual(artistGenres([{ name: 'Reggaeton', count: 100 }, { name: 'trap', count: 74 }]), ['latin']);
  const preferences = { genres: [], artists: ['Mine'], styleOf: { rock: 'Mine' } };
  const pool = [
    candidate('style', { artist: 'Stranger', tags: ['happy', 'feel good', 'rock'], listeners: 9000000 }),
    candidate('similar', { artist: 'Friend', relatedTo: 'Mine', tags: ['happy'], listeners: 10 }),
    candidate('own', { artist: 'Mine', tags: ['happy'], listeners: 10 }),
    candidate('other genre', { artist: 'Nobody', tags: ['happy', 'feel good', 'jazz'] }),
  ];
  const result = rankRecommendations(pool, 'feliz', preferences);
  assert.deepEqual(result.slice(0, 3).map(track => track.title), ['own', 'similar', 'style']);
  assert.equal(result[2].recommendationReason, 'Del mismo estilo que Mine, para este mood.');
  const plain = rankRecommendations(pool, 'feliz', { genres: [], artists: ['Mine'] });
  assert.equal(plain.find(track => track.title === 'style')?.recommendationReason, 'Para descubrir: encaja muy bien con este mood.', 'sin estilo conocido pasa a ser descubrimiento');
});
test('los rasgos de audio clasifican temas sin etiquetas y corrigen etiquetas contradictorias', () => {
  const sadSound = { valence: .12, energy: .42, danceability: .2, acousticness: .2 };
  const happySound = { valence: .96, energy: .76, danceability: .66, acousticness: .3 };
  // "Fix You": sin etiqueta de tristeza en Last.fm, pero suena triste.
  assert.ok(moodAffinity(candidate('fix you', { tags: ['rock'], audio: sadSound }), 'triste') >= .9);
  assert.equal(moodAffinity(candidate('fix you', { tags: ['rock'], audio: sadSound }), 'feliz'), 0);
  // Etiquetado "happy" por ironía o error, pero el sonido es triste: se descarta.
  assert.ok(moodAffinity(candidate('mislabel', { tags: ['happy'], audio: sadSound }), 'feliz') < .65);
  assert.ok(moodAffinity(candidate('agree', { tags: ['happy'], audio: happySound }), 'feliz') >= .9);
  // Una etiqueta negativa explícita sigue excluyendo.
  assert.equal(moodAffinity(candidate('neg', { tags: ['sad'], audio: happySound }), 'feliz'), 0);
  assert.equal(audioMatch({ valence: .05, energy: .05, danceability: .3, acousticness: .99 }, 'cansado'), 1);
  assert.equal(audioMatch({ valence: .05, energy: .05, danceability: .3, acousticness: .99 }, 'motivado'), 0);
});
test('las preferencias orientan sin encerrar: cupos de favoritos, cercanos y descubrimientos', () => {
  const pool: Candidate[] = [
    ...Array.from({ length: 10 }, (_, i) => candidate(`fav ${i}`, { artist: 'Mine', tags: ['happy', 'rock'], listeners: 1000 })),
    ...Array.from({ length: 10 }, (_, i) => candidate(`near ${i}`, { artist: `Friend ${i}`, relatedTo: 'Mine', tags: ['happy'], listeners: 1000 })),
    ...Array.from({ length: 10 }, (_, i) => candidate(`folk ${i}`, { artist: `Folk ${i}`, tags: ['happy', 'feel good', 'folk'], listeners: 5000 })),
    ...Array.from({ length: 10 }, (_, i) => candidate(`jazz ${i}`, { artist: `Jazz ${i}`, tags: ['happy', 'feel good', 'jazz'], listeners: 5000 })),
    candidate('weak', { artist: 'Weak', tags: [], moodEvidence: ['happy'], listeners: 9000000 }),
  ];
  const prefs = { genres: ['rock'], artists: ['Mine'] };
  const result = rankRecommendations(pool, 'feliz', prefs);
  const count = (prefix: string) => result.filter(track => track.title.startsWith(prefix)).length;
  assert.equal(result.length, 7);
  assert.equal(count('fav'), 3); assert.equal(count('near'), 2);
  assert.equal(count('folk') + count('jazz'), 2);
  assert.equal(count('folk'), 2, 'el descubrimiento prefiere un género vecino (rock → folk)');
  assert.ok(result.filter(track => track.title.startsWith('folk')).every(track => track.recommendationReason === 'Para descubrir: folk, cerca de lo que escuchas.'));
  assert.ok(!result.some(track => track.title === 'weak'), 'un descubrimiento debe encajar claramente con el mood');
  // Si no hay descubrimientos ni cercanos, tus artistas completan la tanda.
  assert.equal(rankRecommendations(pool.filter(track => track.title.startsWith('fav')), 'feliz', prefs).length, 7);
});
test('bailable no es triste y lo alegre exige ritmo', () => {
  const doinItRight = { valence: .19, energy: .45, danceability: .8, acousticness: .39 };
  assert.equal(moodAffinity(candidate('doin it right', { tags: ['electronic'], audio: doinItRight }), 'triste'), 0);
  const fixYou = { valence: .12, energy: .42, danceability: .21, acousticness: .16 };
  assert.ok(moodAffinity(candidate('fix you', { tags: ['rock'], audio: fixYou }), 'triste') >= .9);
});
test('tempo percibido: corrige el doble/mitad del detector y calibra con canciones reales', () => {
  const f = (tempo: number, energy: number, valence = .5, danceability = .5) => ({ tempo, energy, valence, danceability, acousticness: .3 });
  assert.equal(perceivedTempo(f(138, .42)), 69);    // Fix You
  assert.equal(perceivedTempo(f(171, .74)), 85.5);  // Lose Yourself
  assert.equal(perceivedTempo(f(171, .85)), 171);   // Till I Collapse: energía alta, se queda
  assert.equal(perceivedTempo(f(160, .76)), 160);   // Happy
  assert.equal(perceivedTempo(f(198, .65)), 99);    // Aruarian Dance
  // Valores medidos con ReccoBeats (tempo, energy): todas las referencias caen en el rango de su mood.
  const references: Record<string, Array<[number, number]>> = {
    feliz: [[160, .76], [110, .95], [126, .83], [116, .81], [113, .83], [103, .88], [156, .87], [128, .71]],
    triste: [[135, .34], [138, .42], [94, .38], [174, .44], [124, .10], [144, .43], [122, .28]],
    cansado: [[146, .29], [130, .05], [71, .22], [88, .20], [145, .36]],
    relajado: [[120, .49], [110, .34], [81, .13], [91, .53], [112, .63], [77, .41], [114, .38], [198, .65]],
    romantico: [[122, .25], [95, .45], [176, .35], [100, .31], [109, .84], [101, .51]],
    motivado: [[171, .74], [104, .72], [109, .73], [126, .79], [171, .85], [125, .78], [133, .89], [154, .91]],
  };
  for (const [mood, songs] of Object.entries(references)) for (const [tempo, energy] of songs) assert.equal(tempoMatch(f(tempo, energy), mood), 1, `${mood} ${tempo}/${energy}`);
  // Derezzed (120 BPM, energía .62) queda fuera del pulso triste; Is This It (96) queda justo bajo el alegre.
  assert.ok(tempoMatch(f(120, .62), 'triste') < 1);
  assert.ok(tempoMatch(f(96, .68), 'feliz') < 1);
  // Señal suave: el tempo resta, pero nunca descarta por sí solo.
  assert.equal(tempoMatch(f(40, .1), 'feliz'), .6);
});
test('descubrimientos: afines a tu gusto y de popularidad intermedia antes que el éxito masivo', () => {
  assert.equal(novelty(200000), 1);
  assert.ok(novelty(8000000) < .2, 'un mega-éxito no es un descubrimiento');
  assert.ok(novelty(800) < .2, 'algo inencontrable tampoco');
  const taste = { tags: { 'garage rock': 1, 'post punk': .8, indie: .6 }, audio: { valence: .6, energy: .8, danceability: .55, acousticness: .05, tempo: 140 } };
  const close = candidate('close', { artist: 'Close', tags: ['happy', 'feel good', 'garage rock', 'post-punk'], listeners: 150000, audio: { valence: .65, energy: .82, danceability: .5, acousticness: .08, tempo: 138 } });
  const hit = candidate('hit', { artist: 'Hit', tags: ['happy', 'feel good', 'dance pop'], listeners: 9000000, audio: { valence: .9, energy: .7, danceability: .85, acousticness: .1, tempo: 118 } });
  assert.ok(tasteSimilarity(close, taste) > .8);
  assert.ok(tasteSimilarity(hit, taste) < .5);
  const prefs = { genres: [], artists: ['Mine'], taste };
  const pool = [...Array.from({ length: 5 }, (_, i) => candidate(`fav ${i}`, { artist: 'Mine', tags: ['happy'] })), close, hit];
  const result = rankRecommendations(pool, 'feliz', prefs).map(track => track.title);
  assert.ok(result.includes('close'));
  const reason = rankRecommendations(pool, 'feliz', prefs).find(track => track.title === 'close')?.recommendationReason;
  assert.equal(reason, 'Para descubrir: suena parecido a lo que escuchas.');
});
test('la sorpresa ocasional: distinta a tu gusto, muy acorde al mood y no un mega-éxito', () => {
  const taste = { tags: { 'garage rock': 1 }, audio: { valence: .6, energy: .8, danceability: .55, acousticness: .05 } };
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => candidate(`fav ${i}`, { artist: 'Mine', tags: ['happy'] })),
    candidate('afro', { artist: 'Afro Band', tags: ['happy', 'feel good', 'upbeat', 'afrobeat'], listeners: 90000, audio: { valence: .95, energy: .7, danceability: .9, acousticness: .4 } }),
    candidate('mega', { artist: 'Mega', tags: ['happy', 'feel good', 'upbeat', 'pop'], listeners: 20000000, audio: { valence: .95, energy: .7, danceability: .9, acousticness: .4 } }),
  ];
  const without = rankRecommendations(pool, 'feliz', { genres: [], artists: ['Mine'], taste });
  assert.ok(!without.some(track => track.recommendationReason?.startsWith('Una sorpresa')));
  const withSurprise = rankRecommendations(pool, 'feliz', { genres: [], artists: ['Mine'], taste, surprise: true });
  const surprise = withSurprise.find(track => track.recommendationReason?.startsWith('Una sorpresa'));
  assert.equal(surprise?.title, 'afro');
});
