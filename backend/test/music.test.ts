import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicService, normalizeTrack } from '../src/modules/music/music.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQuery, RecommendationsQuery } from '../src/modules/music/music.module';

test('descarta resultados que no sean canciones o no tengan un enlace seguro', () => {
  assert.equal(normalizeTrack({ kind: 'music-video' }), null);
  assert.equal(normalizeTrack({ kind: 'song', trackId: 1, trackName: 'Tema', artistName: 'Artista', trackViewUrl: 'javascript:alert(1)' }), null);
  const track = normalizeTrack({ kind: 'song', trackId: 1, trackName: 'Tema', artistName: 'Artista', trackViewUrl: 'https://music.apple.com/track/1' });
  assert.equal(track?.id, 'itunes:1');
  assert.equal(track?.previewUrl, undefined);
});
test('rechaza búsquedas vacías y páginas fuera de rango', async () => {
  assert.ok((await validate(plainToInstance(SearchQuery, { q: '   ' }))).length);
  assert.ok((await validate(plainToInstance(RecommendationsQuery, { page: '0' }))).length);
  assert.equal((await validate(plainToInstance(RecommendationsQuery, { page: '2' }))).length, 0);
});
test('agrupa consultas simultáneas y reutiliza metadatos', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(JSON.stringify({ results: [{ kind: 'song', trackId: 1, trackName: 'Tema', artistName: 'Artista', trackViewUrl: 'https://music.apple.com/track/1' }] }));
  };
  try {
    const music = new MusicService();
    const [first, second] = await Promise.all([music.search('Daft Punk'), music.search('daft punk')]);
    assert.deepEqual(first, second);
    await music.search('DAFT PUNK');
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});
test('un error externo no contamina la caché y permite reintentar', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return requests === 1 ? new Response('', { status: 503 }) : new Response(JSON.stringify({ results: [] }));
  };
  try {
    const music = new MusicService();
    await assert.rejects(music.search('prueba'));
    assert.deepEqual(await music.search('prueba'), []);
    assert.equal(requests, 2);
  } finally { globalThis.fetch = originalFetch; }
});
test('limita globalmente las consultas salientes de iTunes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }));
  try {
    const music = new MusicService();
    for (let index = 0; index < 18; index++) await music.search(`cancion ${index}`);
    await assert.rejects(music.search('otra canción'), error => (error as { getStatus(): number }).getStatus() === 429);
  } finally { globalThis.fetch = originalFetch; }
});
