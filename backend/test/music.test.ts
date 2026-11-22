import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicService, normalizeTrack } from '../src/modules/music/music.service';
import { normalizeDeezerTrack } from '../src/modules/music/music.types';
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
const deezerItem = { id: 7, type: 'track', title: 'Tema', link: 'https://www.deezer.com/track/7', preview: 'https://cdnt-preview.dzcdn.net/7.mp3', isrc: 'usabc1234567', artist: { name: 'Artista' }, album: { title: 'Disco', cover_medium: 'https://e-cdns-images.dzcdn.net/c.jpg' } };
test('normaliza Deezer: preview mediante el endpoint propio y descarta enlaces inseguros', () => {
  const track = normalizeDeezerTrack(deezerItem);
  assert.equal(track?.id, 'deezer:7'); assert.equal(track?.previewUrl, '/api/music/preview/7'); assert.equal(track?.isrc, 'USABC1234567');
  assert.equal(normalizeDeezerTrack({ ...deezerItem, link: 'javascript:alert(1)' }), null);
  assert.equal(normalizeDeezerTrack({ ...deezerItem, readable: false })?.previewUrl, undefined);
  assert.equal(normalizeDeezerTrack({ ...deezerItem, isrc: 'no válido' })?.isrc, undefined);
});
test('la URL firmada del preview sólo se acepta desde la CDN de Deezer', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => new Response(JSON.stringify(String(input).includes('/track/1') ? deezerItem : { ...deezerItem, preview: 'https://evil.example/x.mp3' }));
  try {
    const music = new MusicService();
    assert.equal(await music.previewUrl('1'), deezerItem.preview);
    await assert.rejects(music.previewUrl('2'), (error: any) => error.getStatus() === 404);
  } finally { globalThis.fetch = originalFetch; }
});
test('si Deezer no responde, la búsqueda usa iTunes como respaldo', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => new URL(String(input)).hostname === 'api.deezer.com'
    ? new Response('', { status: 503 })
    : new Response(JSON.stringify({ results: [{ kind: 'song', trackId: 1, trackName: 'Tema', artistName: 'Artista', trackViewUrl: 'https://music.apple.com/track/1' }] }));
  try { assert.equal((await new MusicService().search('tema'))[0].id, 'itunes:1'); }
  finally { globalThis.fetch = originalFetch; }
});
test('agrupa consultas simultáneas y reutiliza metadatos', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(JSON.stringify({ data: [deezerItem] }));
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
    // Primero fallan Deezer y su respaldo iTunes; después Deezer responde.
    return requests <= 2 ? new Response('', { status: 503 }) : new Response(JSON.stringify({ data: [] }));
  };
  try {
    const music = new MusicService();
    await assert.rejects(music.search('prueba'));
    assert.deepEqual(await music.search('prueba'), []);
    assert.equal(requests, 3);
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
