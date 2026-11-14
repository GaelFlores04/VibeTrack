import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Candidate, curatedCandidates, moodAffinity, PROFILES, rankRecommendations } from '../src/modules/music/recommendation-engine';
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
