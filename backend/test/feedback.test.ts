import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeedbackStore, feedbackKey, feedbackProfile, feedbackAdjustment, Feedback } from '../src/modules/music/feedback';
import { Candidate, genreMatches, rankRecommendations } from '../src/modules/music/recommendation-engine';
import { GENRE_GROUPS, GENRE_KEYS } from '../src/modules/music/genres';
import { PreferencesDto } from '../src/modules/auth/auth.module';
import { FeedbackDto, MusicController } from '../src/modules/music/music.module';
import { MusicService } from '../src/modules/music/music.service';

const track = (title: string, artist = 'Artista', tags = ['happy', 'rock']): Candidate => ({ id: `lastfm:${title}`, title, artist, tags, listeners: 100, externalUrl: 'https://www.last.fm/' });
const feedback = (entries: Array<[Candidate, 'like' | 'dislike']>): Feedback => Object.fromEntries(entries.map(([song, rating]) => [feedbackKey(song), { title: song.title, artist: song.artist, tags: song.tags || [], rating, updatedAt: 1 }]));

test('taxonomía única: subgéneros precisos, familias amplias y preferencias antiguas válidas', async () => {
  assert.ok(GENRE_KEYS.length > 70);
  assert.equal(new Set(GENRE_KEYS).size, GENRE_KEYS.length);
  assert.equal(GENRE_GROUPS.length, 16);
  assert.equal(genreMatches('rock', ['progressive rock']), true);
  assert.equal(genreMatches('shoegaze', ['indie']), false);
  assert.equal(genreMatches('shoegaze', ['shoegaze']), true);
  assert.equal((await validate(plainToInstance(PreferencesDto, { genres: ['rock', 'shoegaze', 'neo-soul', 'bachata'], artists: [] }))).length, 0);
  assert.ok((await validate(plainToInstance(PreferencesDto, { genres: GENRE_KEYS.slice(0, 13), artists: [] }))).length);
  assert.ok((await validate(plainToInstance(PreferencesDto, { genres: ['inventado'], artists: [] }))).length);
});

test('voto único reversible, aislado por cuenta y mood; clics repetidos no multiplican señales', async () => {
  const store = new FeedbackStore(), song = track('Una canción');
  await store.set('a', 'feliz', song, 'like');
  await store.set('a', 'feliz', song, 'like');
  assert.equal(Object.keys(await store.load('a', 'feliz')).length, 1);
  assert.deepEqual(await store.load('b', 'feliz'), {});
  assert.deepEqual(await store.load('a', 'triste'), {});
  await store.set('a', 'feliz', song, 'dislike');
  assert.equal((await store.load('a', 'feliz'))[feedbackKey(song)].rating, 'dislike');
  await store.set('a', 'feliz', song, null);
  assert.deepEqual(await store.load('a', 'feliz'), {});
  await Promise.all([store.set('a', 'feliz', song, 'like'), store.set('a', 'feliz', track('Otra'), 'like')]);
  assert.equal(Object.keys(await store.load('a', 'feliz')).length, 2);
});

test('votos persisten tras reinicio con actualizaciones atómicas; fallo de Mongo no simula éxito', async () => {
  const docs = new Map<string, any>();
  const collection = {
    findOne: async ({ _id }: any) => structuredClone(docs.get(_id)),
    updateOne: async ({ _id }: any, update: any) => {
      const doc = docs.get(_id) || { ratings: {} };
      for (const [path, entry] of Object.entries(update.$set || {})) doc.ratings[path.split('.')[1]] = entry;
      for (const path of Object.keys(update.$unset || {})) delete doc.ratings[path.split('.')[1]];
      docs.set(_id, doc);
    },
  };
  const database = { status: 'connected', db: { collection: () => collection } } as any;
  const song = track('Persistente');
  await new FeedbackStore(database).set('a', 'feliz', song, 'like');
  const restarted = new FeedbackStore(database);
  assert.equal((await restarted.load('a', 'feliz'))[feedbackKey(song)].rating, 'like');
  await restarted.set('a', 'feliz', song, null);
  assert.deepEqual(await new FeedbackStore(database).load('a', 'feliz'), {});
  database.status = 'disconnected';
  await assert.rejects(restarted.set('a', 'feliz', song, 'like'), /No se pudieron guardar/);
});

test('historial permite quitar un dislike guardado aunque hayan caducado todas las sesiones', async () => {
  const music: any = new MusicService(), song = track('Ya descartada');
  await music.feedback.set('a', 'feliz', song, 'dislike');
  music.sessions.clear();
  const [entry] = await music.ratingHistory('a', 'feliz');
  assert.equal(entry.title, song.title); assert.equal(entry.rating, 'dislike');
  await music.removeRating('b', 'feliz', entry.key);
  assert.equal((await music.ratingHistory('a', 'feliz')).length, 1, 'otra cuenta no puede borrarla');
  await music.removeRating('a', 'feliz', entry.key);
  assert.deepEqual(await music.ratings('a', 'feliz'), {});
  await music.removeRating('a', 'feliz', entry.key);
  await assert.rejects(music.removeRating('a', 'feliz', '$set'), /no válida/);
});

test('una tanda parcial mostrada también permite valorar sus canciones sin conceder acceso a otras cuentas', async () => {
  const music: any = new MusicService(), song = track('Parcial');
  const session = music.newSession('feliz');
  Object.assign(session, { owner: 'a', mood: 'feliz' });
  session.feedbackTracks.set(feedbackKey(song), song); music.sessions.set('partial', session);
  assert.equal(session.pages.size, 0);
  await music.rate('a', 'feliz', song.id, 'like');
  assert.equal((await music.ratings('a', 'feliz'))[feedbackKey(song)], 'like');
  await assert.rejects(music.rate('b', 'feliz', song.id, 'like'), /caducó/);
});

test('solicitudes simultáneas no vuelven a mezclar preferencias de app y Spotify', async () => {
  const music: any = new MusicService();
  await music.spotify.setSource('a', 'both'); await music.spotify.save('a', ['Spotify Artist']);
  let calls = 0;
  music.buildBatch = async (session: any, _mood: string, page: number, preferences: any) => {
    calls++; assert.deepEqual(preferences.spotifyArtists, ['Spotify Artist']);
    await new Promise(resolve => setTimeout(resolve, 10));
    const batch = { page, tracks: [], status: 'ready' }; session.pages.set(page, batch); return batch;
  };
  const args = ['feliz', 1, { genres: ['rock'], artists: ['App Artist'] }, 'same', 'a'];
  const [a, b] = await Promise.all([music.recommendations(...args), music.recommendations(...args)]);
  assert.equal(a, b); assert.equal(calls, 1); assert.equal(music.sessions.size, 1);
});

test('dislike de canción prevalece sobre artista favorito, pero no veta sus demás canciones', () => {
  const rejected = track('No esta'), liked = track('Sí esta'), other = track('Otra del artista');
  const profile = feedbackProfile(feedback([[rejected, 'dislike'], [liked, 'like']]));
  const result = rankRecommendations([rejected, liked, other], 'feliz', { artists: ['Artista'], genres: ['rock'], feedback: profile });
  assert.ok(!result.some(song => song.title === rejected.title));
  assert.ok(result.some(song => song.title === other.title));
  assert.equal(result[0].title, liked.title);
  assert.equal(profile.artists.get('artista'), 0);
  assert.equal(feedbackKey(rejected), feedbackKey({ ...rejected, id: 'deezer:99', title: 'No esta (Remastered 2020)' }));
});

test('like específico vence al saldo negativo de su género y artista; otros likes conservan su peso', () => {
  const exception = track('Excepción'), anotherTaste = track('Otro gusto', 'Otro artista', ['happy', 'jazz']);
  const votes = feedback([[exception, 'like'], [anotherTaste, 'like'], ...Array.from({ length: 6 }, (_, index): [Candidate, 'dislike'] => [track(`Descartada ${index}`), 'dislike'])]);
  const profile = feedbackProfile(votes);
  assert.ok(profile.artists.get('artista')! < 0);
  assert.equal(feedbackAdjustment(exception, profile), .3);
  assert.equal(feedbackAdjustment(anotherTaste, profile), .3);
  assert.ok(feedbackAdjustment(track('Sin valorar'), profile) < 0);
  assert.ok(rankRecommendations([exception, anotherTaste], 'feliz', { genres: [], artists: [], feedback: profile }).length === 2);
  assert.equal(rankRecommendations([track('Mood contrario', 'Artista', ['sad'])], 'feliz', { genres: [], artists: [], feedback: feedbackProfile(feedback([[track('Mood contrario', 'Artista', ['sad']), 'like']])) }).length, 0);
});

test('aprendizaje acotado: favorece artistas, similares y géneros sin llenar la tanda de un artista', () => {
  const profile = feedbackProfile(feedback([[track('Like'), 'like']]));
  assert.ok(feedbackAdjustment(track('Nueva'), profile) > feedbackAdjustment(track('Sin relación', 'Lejano', ['happy', 'jazz']), profile));
  assert.ok(feedbackAdjustment({ ...track('Similar', 'Nuevo'), relatedTo: 'Artista' }, profile) > 0);
  const pool = [...Array.from({ length: 12 }, (_, index) => track(`Favorita ${index}`)), ...Array.from({ length: 12 }, (_, index) => track(`Descubrimiento ${index}`, `Nuevo ${index}`, ['happy', 'jazz']))];
  const result = rankRecommendations(pool, 'feliz', { genres: [], artists: [], feedback: profile });
  assert.equal(result.length, 7);
  assert.ok(result.filter(song => song.artist === 'Artista').length <= 2);
  assert.ok(result.some(song => song.artist !== 'Artista'));
  assert.deepEqual(profile.songs, feedback([[track('Like'), 'like']]));
});

test('servicio acepta sólo canciones de tandas propias; guardar no invalida ni cambia la tanda', async () => {
  const music: any = new MusicService(), song = track('Propia');
  const batch = { tracks: [song], page: 1, size: 7, status: 'ready', mode: 'discovery' };
  const session = music.newSession('feliz');
  Object.assign(session, { owner: 'a', mood: 'feliz' });
  session.pages.set(1, batch); session.feedbackTracks.set(feedbackKey(song), song); music.sessions.set('test', session);
  await assert.rejects(music.rate('b', 'feliz', song.id, 'like'), /caducó/);
  await assert.rejects(music.rate('a', 'triste', song.id, 'like'), /caducó/);
  await assert.rejects(music.rate('a', 'feliz', 'inventada', 'like'), /caducó/);
  await music.rate('a', 'feliz', song.id, 'like');
  assert.equal((await music.ratings('a', 'feliz'))[feedbackKey(song)], 'like');
  assert.equal(session.pages.get(1), batch);
  assert.deepEqual(batch.tracks, [song]);
  await music.rate('a', 'feliz', song.id, null);
  assert.deepEqual(await music.ratings('a', 'feliz'), {});
});

test('frontera de escritura: autentica y valida mood, voto y campos permitidos', async () => {
  const controller = new MusicController({} as any, { current: async () => null } as any);
  await assert.rejects(controller.rate({ trackId: 'x', mood: 'feliz', rating: 'like' }, {}), /Inicia sesión/);
  await assert.rejects(controller.ratings('feliz', {}), /Inicia sesión/);
  for (const body of [{ trackId: '', mood: 'feliz', rating: 'like' }, { trackId: 'x', mood: 'otro', rating: 'like' }, { trackId: 'x', mood: 'feliz', rating: 1 }, { trackId: 'x', mood: 'feliz' }, { trackId: 'x', mood: 'feliz', rating: 'like', userId: 'b' }]) {
    assert.ok((await validate(plainToInstance(FeedbackDto, body), { whitelist: true, forbidNonWhitelisted: true })).length > 0);
  }
  assert.equal((await validate(plainToInstance(FeedbackDto, { trackId: 'x', mood: 'feliz', rating: null }))).length, 0);
});
