import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicService } from '../src/modules/music/music.service';
import { MusicCache } from '../src/modules/music/music-cache';
const { createMusicFixture } = require('./music-fixture.cjs');

async function audioReady(batch: any) {
  for (let i = 0; batch.previewsPending && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(batch.previewsPending, false);
}

async function fixture(options: any, run: (music: MusicService, data: any) => Promise<void>) {
  const data = createMusicFixture(options);
  const previous = globalThis.fetch;
  const key = process.env.LASTFM_API_KEY;
  process.env.LASTFM_API_KEY = 'fixture-key'; globalThis.fetch = data.fetcher;
  const music = new MusicService();
  try { await run(music, data); }
  finally {
    for (const session of (music as any).sessions.values()) for (const batch of session.pages.values()) await audioReady(batch);
    globalThis.fetch = previous; if (key === undefined) delete process.env.LASTFM_API_KEY; else process.env.LASTFM_API_KEY = key; }
}

test('tres tandas consecutivas de siete con preview, sin repetidos, con un catálogo por artista', async () => {
  await fixture({}, async (music, data) => {
    const preferences = { artists: ['Artist A'], genres: [] };
    const seen = new Set();
    for (let page = 1; page <= 3; page++) {
      const batch = await music.recommendations('feliz', page, preferences, 'flow', 'account-a');
      assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
      await audioReady(batch);
      for (const track of batch.tracks) { assert.equal(track.artist, 'Artist A'); assert.ok(track.previewUrl); assert.ok(!seen.has(track.id)); seen.add(track.id); }
    }
    const apple = data.calls.filter((item: any) => item.host === 'itunes.apple.com');
    assert.equal(apple.length, 1, '21 previews se resuelven con un catálogo, no 21 búsquedas');
    const requests = data.calls.length;
    assert.equal((await music.recommendations('feliz', 2, preferences, 'flow', 'account-a')).tracks.length, 7);
    assert.equal(data.calls.length, requests, 'volver a una tanda ya preparada no llama a proveedores');
  });
});
test('la ausencia de previews no oculta canciones y los moods incorrectos siguen descartados', async () => {
  await fixture({ missing: [1, 2, 3, 4, 5], wrongMood: [6, 7, 8], emptyMood: true }, async music => {
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.tracks.length, 7);
    await audioReady(batch);
    assert.ok(batch.tracks.every(track => track.artist === 'Artist A' && ![6, 7, 8].includes(Number(track.title.split(' ').at(-1)))));
  });
});
test('invitados reciben siete y las cuentas existentes no heredan esa selección', async () => {
  await fixture({}, async music => {
    const guest = await music.recommendations('feliz', 1, null, 'same');
    assert.equal(guest.tracks.length, 7); assert.equal(guest.mode, 'discovery');
    const personal = await music.recommendations('feliz', 1, { artists: ['Artist B'], genres: [] }, 'same', 'account-b');
    assert.equal(personal.tracks.length, 7); assert.ok(personal.tracks.every(track => track.artist === 'Artist B'));
    await assert.rejects(music.recommendations('feliz', 2, { artists: ['Artist B'], genres: [] }, 'same', 'other-account'));
  });
});
test('agotamiento no produce una tanda de uno o dos ni avanza la página', async () => {
  await fixture({ count: 9, emptyMood: true }, async music => {
    const prefs = { artists: ['Artist A'], genres: [] };
    const first = await music.recommendations('feliz', 1, prefs);
    assert.equal(first.tracks.length, 7);
    const second = await music.recommendations('feliz', 2, prefs);
    assert.equal(second.tracks.length, 0); assert.notEqual(second.status, 'ready');
    assert.equal(second.nextPage, null);
    assert.deepEqual(await music.recommendations('feliz', 1, prefs), first);
  });
});
test('caída de audio conserva siete recomendaciones; solicitudes simultáneas son idempotentes', async () => {
  await fixture({}, async (music, data) => {
    data.setFailApple(true);
    const prefs = { artists: ['Artist A'], genres: [] };
    const blocked = await music.recommendations('feliz', 1, prefs);
    assert.equal(blocked.status, 'ready'); assert.equal(blocked.tracks.length, 7);
    await audioReady(blocked);
    assert.ok(blocked.tracks.every(track => track.previewStatus === 'temporary_error'));
    data.setFailApple(false);
    // Nueva sesión reutiliza metadatos públicos y puede recuperar el audio del proveedor.
    const [a, b] = await Promise.all([music.recommendations('feliz', 1, prefs, 'retry'), music.recommendations('feliz', 1, prefs, 'retry')]);
    assert.equal(a.tracks.length, 7); assert.deepEqual(a, b);
  });
});
test('sugerencias desde una letra reutilizan caché y no consumen la cuota de previews', async () => {
  await fixture({}, async (music, data) => {
    const artists = await music.artists('a');
    assert.ok(artists.length); assert.ok(artists.every(item => item.kind === 'artist'));
    const count = data.calls.length;
    await music.artists('A');
    assert.equal(data.calls.length, count);
    assert.ok((await music.suggestions('a')).some(item => item.kind === 'track'));
    assert.equal(data.calls.filter((item: any) => item.host === 'itunes.apple.com').length, 0);
  });
});

test('la primera tanda se entrega antes de que responda el proveedor de audio', async () => {
  await fixture({}, async (music, data) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    globalThis.fetch = async input => {
      if (new URL(String(input)).hostname === 'itunes.apple.com') await gate;
      return data.fetcher(input);
    };
    try {
      const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
      assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
      assert.equal(batch.previewsPending, true);
      assert.ok(batch.tracks.every(track => track.previewStatus === 'loading'));
      release(); await audioReady(batch);
      assert.ok(batch.tracks.every(track => track.previewUrl));
    } finally { release(); }
  });
});

test('estado inicial vacío no afirma conservar una tanda anterior y distingue agotamiento', async () => {
  await fixture({ count: 0 }, async music => {
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.status, 'exhausted');
    assert.deepEqual(batch.tracks, []);
    assert.doesNotMatch(batch.message || '', /conservamos|anterior|actual sigue/i);
  });
});

test('preferencias sólo de género verifican primero canciones del mood y evitan recorrer un catálogo incompatible', async () => {
  await fixture({}, async (music, data) => {
    let incompatibleChecks = 0;
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      if (url.searchParams.get('method') === 'track.getInfo' && url.searchParams.get('artist') === 'Artist A') {
        incompatibleChecks++;
        return new Response(JSON.stringify({ track: { toptags: { tag: [{ name: 'sad' }, { name: 'rock' }] } } }));
      }
      return data.fetcher(input);
    };
    const batch = await music.recommendations('feliz', 1, { artists: [], genres: ['rock'] });
    assert.equal(batch.tracks.length, 7);
    assert.ok(batch.tracks.every(track => track.artist === 'Pop Artist'));
    assert.equal(incompatibleChecks, 0);
  });
});
test('caché persistente reutiliza metadatos tras reinicio y no guarda errores', async () => {
  const stored = new Map();
  const collection = {
    findOne: async (query: any) => stored.get(query._id),
    updateOne: async (query: any, value: any) => { stored.set(query._id, value.$set); },
  };
  const database = { status: 'connected', db: { collection: () => collection } } as any;
  let calls = 0;
  const fetcher = async () => { calls++; return { title: 'Metadata', previewUrl: 'https://example.test/preview' }; };
  await new MusicCache(database).remember('public-track', 60000, fetcher);
  await new MusicCache(database).remember('public-track', 60000, fetcher);
  assert.equal(calls, 1);
  const cache = new MusicCache();
  await assert.rejects(cache.remember('failure', 60000, async () => { throw new Error('unavailable'); }));
  assert.equal(await cache.remember('failure', 60000, async () => 'recovered'), 'recovered');
});


test('continúa evaluando candidatos aunque todas las fuentes hayan terminado', async () => {
  await fixture({ count: 100, emptyMood: true, wrongMood: Array.from({ length: 90 }, (_, i) => i + 1) }, async music => {
    const prefs = { artists: ['Artist A'], genres: [] };
    let batch = await music.recommendations('feliz', 1, prefs, 'deep');
    for (let attempt = 0; batch.status === 'retry' && attempt < 4; attempt++) batch = await music.recommendations('feliz', 1, prefs, 'deep');
    assert.equal(batch.status, 'ready');
    assert.equal(batch.tracks.length, 7);
    assert.ok(batch.tracks.every(track => Number(track.title.split(' ').at(-1)) > 90));
  });
});

test('respeta totalPages aun con páginas cortas y URLs antiguas HTTP', async () => {
  await fixture({ emptyMood: true }, async (music, data) => {
    const pages: number[] = [];
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      if (url.searchParams.get('method') === 'artist.getTopTracks') {
        const page = Number(url.searchParams.get('page')); pages.push(page);
        return new Response(JSON.stringify({ toptracks: {
          '@attr': { totalPages: '2' },
          track: Array.from({ length: 4 }, (_, i) => ({ name: `Song ${(page - 1) * 4 + i + 1}`, artist: { name: 'Artist A' }, url: 'http://www.last.fm/old' })),
        } }));
      }
      return data.fetcher(input);
    };
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
    assert.deepEqual(pages, [1, 2]);
  });
});

test('detecta páginas repetidas del proveedor y termina sin reciclar canciones', async () => {
  await fixture({ emptyMood: true }, async (music, data) => {
    let pages = 0;
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      if (url.searchParams.get('method') === 'artist.getTopTracks') {
        pages++;
        return new Response(JSON.stringify({ toptracks: { '@attr': { totalPages: '100' }, track: Array.from({ length: 7 }, (_, i) => ({ name: `Song ${i + 1}`, artist: { name: 'Artist A' } })) } }));
      }
      return data.fetcher(input);
    };
    const prefs = { artists: ['Artist A'], genres: [] };
    assert.equal((await music.recommendations('feliz', 1, prefs)).status, 'ready');
    const next = await music.recommendations('feliz', 2, prefs);
    assert.equal(next.status, 'exhausted'); assert.equal(next.tracks.length, 0);
    assert.equal(pages, 2);
  });
});


test('recupera audio temporalmente fallido en la misma tanda sin cambiar canciones', async () => {
  await fixture({}, async (music, data) => {
    data.setFailApple(true);
    const prefs = { artists: ['Artist A'], genres: [] };
    const first = await music.recommendations('feliz', 1, prefs);
    await audioReady(first);
    const titles = first.tracks.map(track => track.title);
    data.setFailApple(false);
    for (const session of (music as any).sessions.values()) session.audioRetryAt.set(1, 0);
    const recovered = await music.recommendations('feliz', 1, prefs);
    await audioReady(recovered);
    assert.deepEqual(recovered.tracks.map(track => track.title), titles);
    assert.ok(recovered.tracks.every(track => track.previewUrl));
  });
});


test('volver al mismo mood con otra sesión no repite la selección de una cuenta', async () => {
  await fixture({}, async music => {
    const prefs = { artists: ['Artist A'], genres: [] };
    const first = await music.recommendations('feliz', 1, prefs, 'visit-1', 'listener');
    const second = await music.recommendations('feliz', 1, prefs, 'visit-2', 'listener');
    assert.equal(second.status, 'ready');
    const titles = new Set(first.tracks.map(track => track.title));
    assert.ok(second.tracks.every(track => !titles.has(track.title)));
    const other = await music.recommendations('feliz', 1, prefs, 'visit-2', 'another-listener');
    assert.deepEqual(other.tracks.map(track => track.title), first.tracks.map(track => track.title));
    assert.deepEqual(await music.recommendations('feliz', 1, prefs, 'visit-1', 'listener'), first);
  });
});

test('preferencias antiguas con sufijo Topic consultan al artista real', async () => {
  await fixture({ emptyMood: true }, async music => {
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A - Topic'], genres: [] });
    assert.equal(batch.status, 'ready');
    assert.ok(batch.tracks.every(track => track.artist === 'Artist A'));
  });
});

test('un artista relacionado conserva afinidad cuando sus temas llegan desde el mood', async () => {
  await fixture({ similar: ['Pop Artist'] }, async (music, data) => {
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      if (url.searchParams.get('method') === 'track.getInfo') return new Response(JSON.stringify({ track: { toptags: { tag: [{ name: 'rock' }] } } }));
      return data.fetcher(input);
    };
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.status, 'ready');
    assert.ok(batch.tracks.every(track => track.artist === 'Pop Artist'));
    assert.ok(batch.tracks.every(track => track.recommendationReason?.includes('relacionado')));
  });
});

test('artistas: coincidencia exacta primero, prefijos después, sin canales Topic ni duplicados', async () => {
  await fixture({}, async (music, data) => {
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      if (url.searchParams.get('method') === 'artist.search') return new Response(JSON.stringify({ results: { artistmatches: { artist: [
        { name: 'Other Artist', listeners: '9999999' },
        { name: 'Phoenix - Topic', listeners: '9999999' },
        { name: 'The Phoenix', listeners: '1000' },
        { name: 'Phoenix Rising', listeners: '100' },
        { name: 'Phoenix', listeners: '10' },
        { name: 'PHOENIX', listeners: '1' },
        { name: 'Phoenix Official Audio', listeners: '1' },
      ] } } }));
      return data.fetcher(input);
    };
    const results = await music.artists('phoenix');
    assert.deepEqual(results.slice(0, 3).map(item => item.name), ['Phoenix', 'Phoenix Rising', 'The Phoenix']);
    assert.ok(results.every(item => item.kind === 'artist' && !/topic|Other Artist/i.test(item.name)));
    assert.equal(results.filter(item => item.name.toLowerCase() === 'phoenix').length, 1);
  });
});
