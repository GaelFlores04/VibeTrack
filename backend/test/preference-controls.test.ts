import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Candidate, rankRecommendations, quotas, directlyPreferred } from '../src/modules/music/recommendation-engine';
import { TasteRulesStore, ruleFor, TasteRule } from '../src/modules/music/taste-rules';
import { feedbackKey, feedbackProfile, FeedbackStore } from '../src/modules/music/feedback';
import { MusicService } from '../src/modules/music/music.service';
import { TasteStore } from '../src/modules/music/taste-profile';
import { spotifyTasteProfile, collectSpotifyItems } from '../src/modules/spotify/spotify-taste';
import { ValidationPipe } from '@nestjs/common';
import { MusicController, TasteRuleDto } from '../src/modules/music/music.module';

const song = (title: string, options: Partial<Candidate> = {}): Candidate => ({ id: title, title, artist: 'Mine', tags: ['happy', 'rock'], externalUrl: 'https://www.last.fm', ...options });
const rule = (target: TasteRule['target'], name: string, action: TasteRule['action'], artist?: string): TasteRule => ({ key: `${target}:${name}`, target, name, action, artist, updatedAt: 1 });

test('ajustes: autenticación, DTO estricto y propietario de sesión para leer, guardar y quitar', async () => {
  const input = { target: 'artist', name: 'Mine', action: 'more' } as const;
  const guest = new MusicController({} as any, { current: async () => null } as any);
  await assert.rejects(guest.tasteRules({}), /Inicia sesión/);
  await assert.rejects(guest.saveTasteRule({}, input), /Inicia sesión/);
  await assert.rejects(guest.removeTasteRule({}, 'key'), /Inicia sesión/);
  const pipe = new ValidationPipe({ expectedType: TasteRuleDto, transform: true, whitelist: true, forbidNonWhitelisted: true });
  for (const invalid of [{ ...input, userId: 'other' }, { ...input, target: 'playlist' }, { ...input, action: 'anything' }, { ...input, name: '' }]) {
    await assert.rejects(pipe.transform(invalid, { type: 'body' }));
  }
  const calls: string[] = [];
  const controller = new MusicController({
    tasteRules: async (id: string) => { calls.push(id); return []; },
    saveTasteRule: async (id: string) => { calls.push(id); return {}; },
    removeTasteRule: async (id: string) => { calls.push(id); },
  } as any, { current: async () => ({ _id: 'session-owner' }) } as any);
  await controller.tasteRules({}); await controller.saveTasteRule({}, input); await controller.removeTasteRule({}, 'key');
  assert.deepEqual(calls, ['session-owner', 'session-owner', 'session-owner']);
});

test('los cinco niveles cambian la mezcla; estricto no rellena con similares ni artistas ajenos', () => {
  const pool = [
    ...Array.from({ length: 10 }, (_, i) => song(`own ${i}`)),
    ...Array.from({ length: 10 }, (_, i) => song(`near ${i}`, { artist: `Near ${i}`, relatedTo: 'Mine' })),
    ...Array.from({ length: 10 }, (_, i) => song(`new ${i}`, { artist: `New ${i}`, tags: ['happy', 'jazz'] })),
  ];
  for (const level of [1, 2, 3, 4, 5]) {
    const preferences = { artists: ['Mine'], genres: [], preferenceLevel: level };
    const selected = rankRecommendations(pool, 'feliz', preferences);
    assert.equal(selected.length, 7);
    const target = quotas(preferences);
    assert.equal(selected.filter(track => track.title.startsWith('own')).length, target.favorite);
    assert.equal(selected.filter(track => track.title.startsWith('new')).length, target.discovery);
  }
  const preferences = { artists: ['Mine'], genres: [], preferenceLevel: 5 };
  assert.equal(rankRecommendations(pool.filter(track => track.artist !== 'Mine'), 'feliz', preferences).length, 0);
  assert.equal(rankRecommendations([song('wrong', { tags: ['sad'] })], 'feliz', preferences).length, 0);
  assert.equal(rankRecommendations(pool, 'feliz', { artists: [], genres: [], preferenceLevel: 5 }).length, 0);
});

test('una canción permite excepciones al artista y un artista al género; menos nunca es un veto', () => {
  const rules = [rule('genre', 'rock', 'exclude'), rule('artist', 'Mine', 'more'), rule('song', 'No', 'exclude', 'Mine')];
  assert.equal(ruleFor(song('Yes'), rules)?.action, 'more');
  assert.equal(rankRecommendations([song('Yes'), song('No')], 'feliz', { artists: [], genres: [], rules }).length, 1);
  const artistExcluded = [rule('artist', 'Mine', 'exclude'), rule('song', 'Exception', 'more', 'Mine')];
  const selected = rankRecommendations([song('Exception'), song('Other')], 'feliz', { artists: ['Mine'], genres: [], rules: artistExcluded, preferenceLevel: 5 });
  assert.deepEqual(selected.map(track => track.title), ['Exception']);
  assert.ok(directlyPreferred(song('Less'), { artists: ['Mine'], genres: [], rules: [rule('song', 'Less', 'less', 'Mine')] }));
  const disliked = song('Exception');
  const feedback = feedbackProfile({ [feedbackKey(disliked)]: { artist: 'Mine', title: 'Exception', tags: [], rating: 'dislike', updatedAt: 1 } });
  assert.equal(rankRecommendations([disliked], 'feliz', { artists: [], genres: [], rules: artistExcluded, feedback }).length, 0);
});

test('ajustes globales son reversibles, aislados, persistentes y no simulan escrituras fallidas', async () => {
  const documents = new Map();
  const collection = { findOne: async (q: any) => documents.get(q._id), updateOne: async (q: any, update: any) => {
    const doc = documents.get(q._id) || { rules: {} };
    for (const [key, value] of Object.entries(update.$set || {})) doc.rules[key.slice(6)] = value;
    for (const key of Object.keys(update.$unset || {})) delete doc.rules[key.slice(6)];
    documents.set(q._id, doc);
  } };
  const db: any = { status: 'connected', db: { collection: () => collection } };
  const store = new TasteRulesStore(db);
  const saved = await store.save('a', { target: 'song', name: 'Track', artist: 'Artist', action: 'exclude' });
  assert.equal((await new TasteRulesStore(db).load('a'))[0].action, 'exclude');
  assert.deepEqual(await store.load('b'), []);
  await store.save('a', { target: 'song', name: 'Track', artist: 'Artist', action: 'more' });
  assert.equal((await store.load('a')).length, 1);
  await store.remove('b', saved.key); assert.equal((await store.load('a')).length, 1);
  await store.remove('a', saved.key); assert.deepEqual(await store.load('a'), []);
  collection.updateOne = async () => { throw new Error('database unavailable'); };
  await assert.rejects(store.save('a', { target: 'artist', name: 'Artist', action: 'less' }), /No se guardó/);
});

test('valorar el mood no equivale a preferir su artista o género', async () => {
  const store = new FeedbackStore();
  await store.set('a', 'feliz', song('Mood fit'), 'like', 'mood');
  const profile = feedbackProfile(await store.load('a', 'feliz'));
  assert.equal(profile.artists.size, 0); assert.equal(profile.tags.size, 0); assert.equal(profile.liked.length, 0);
  assert.equal(Object.keys(profile.songs).length, 1);
});

test('Spotify importa canciones y géneros sin multiplicar la señal al actualizar', async () => {
  const data = collectSpotifyItems([{ name: 'Song', artists: [{ name: 'Mine', genres: ['rock'] }], external_ids: { isrc: 'USABC1234567' } }], false);
  const snapshot = { tracksShort: data, saved: data };
  const profile = spotifyTasteProfile(snapshot);
  assert.equal(profile.tracks.length, 1); assert.deepEqual(profile.genres, ['rock']);
  assert.deepEqual(spotifyTasteProfile(snapshot), profile);
  const store = new TasteStore();
  const signals = [{ artist: 'Mine', weight: 1, tags: [{ name: 'rock', count: 100 }] }];
  await store.replace('a', signals); const once = await store.load('a');
  await store.replace('a', signals); assert.deepEqual(await store.load('a'), once);
  const music: any = new MusicService();
  await music.spotify.save('a', ['Mine'], data.tracks, ['rock']);
  await music.spotify.setSource('a', 'spotify');
  music.newSession = (_slug: string, prefs: any) => { assert.equal(prefs.preferenceLevel, 5); assert.equal(prefs.spotifyTracks.length, 1); assert.deepEqual(prefs.genres, ['rock']); throw new Error('captured'); };
  await assert.rejects(music.recommendations('feliz', 1, { artists: ['Other'], genres: ['jazz'], preferenceLevel: 5 }, 'test', 'a'), /captured/);
});
