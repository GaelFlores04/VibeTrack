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
  (music as any).providers.deezerBudget = 1e9;
  try { await run(music, data); }
  finally {
    for (const session of (music as any).sessions.values()) for (const batch of session.pages.values()) await audioReady(batch);
    globalThis.fetch = previous; if (key === undefined) delete process.env.LASTFM_API_KEY; else process.env.LASTFM_API_KEY = key; }
}

test('likes afinan las tandas nuevas sin cambiar la actual; todos los temas mostrados se clasifican', async () => {
  await fixture({}, async music => {
    const preferences = { artists: ['Artist A'], genres: [] };
    const first = await music.recommendations('feliz', 1, preferences, 'feedback', 'listener');
    assert.equal(first.status, 'ready'); await audioReady(first);
    const original = first.tracks.map(song => song.id);
    const sessions = (music as any).sessions;
    const session = [...sessions.values()][0] as any;
    assert.ok([...session.feedbackTracks.values()].every((song: any) => song.metadataChecked));
    const liked = first.tracks[0], disliked = first.tracks.find(song => song.artist !== liked.artist)!;
    assert.ok(disliked);
    await music.rate('listener', 'feliz', liked.id, 'like');
    await music.rate('listener', 'feliz', disliked.id, 'dislike');
    assert.equal(await music.recommendations('feliz', 1, preferences, 'feedback', 'listener'), first);
    assert.deepEqual(first.tracks.map(song => song.id), original);
    const next = await music.recommendations('feliz', 2, preferences, 'feedback', 'listener');
    assert.equal(next.status, 'ready'); assert.equal(next.tracks.length, 7);
    assert.ok(session.sources.some((source: any) => source.kind === 'artist' && source.name === liked.artist), 'el artista valorado participa en las fuentes futuras');
    assert.ok(session.sources.some((source: any) => source.mood));
    assert.equal(Object.keys(await music.ratings('listener', 'feliz')).length, 2);
  });
});

test('consulta favoritos antes de esperar la expansión de similares', async () => {
  await fixture({}, async music => {
    const service = music as any;
    let favoriteStarted = false;
    const candidates = service.providers.candidates.bind(service.providers);
    service.providers.candidates = (...args: any[]) => {
      if (args[0] === 'artist' && args[1] === 'Artist A') favoriteStarted = true;
      return candidates(...args);
    };
    const related = service.addRelated.bind(service);
    service.addRelated = (...args: any[]) => {
      assert.ok(favoriteStarted, 'el catálogo favorito no espera las consultas de similares');
      return related(...args);
    };
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [], preferenceLevel: 3 }, 'parallel', 'account');
    assert.equal(batch.status, 'ready');
    assert.ok(batch.tracks.filter(track => track.artist === 'Artist A').length >= 3);
  });
});

test('tres tandas consecutivas de siete con preview, sin repetidos, con un catálogo por artista', async () => {
  await fixture({}, async (music, data) => {
    const preferences = { artists: ['Artist A'], genres: [] };
    const seen = new Set();
    for (let page = 1; page <= 3; page++) {
      const batch = await music.recommendations('feliz', page, preferences, 'flow', 'account-a');
      assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
      await audioReady(batch);
      assert.ok(batch.tracks.filter(track => track.artist === 'Artist A').length >= 3, 'tus artistas pesan más');
      for (const track of batch.tracks) { assert.ok(track.artist === 'Artist A' || /^(Para descubrir|Una sorpresa|Porque escuchas)/.test(track.recommendationReason || '')); assert.match(track.previewUrl || '', /^\/api\/music\/preview\/\d+$/); assert.ok(!seen.has(track.id)); seen.add(track.id); }
    }
    assert.equal(data.calls.filter((item: any) => item.host === 'itunes.apple.com').length, 0, 'Deezer resuelve los previews; iTunes es sólo respaldo');
    const deezerSearches = data.calls.filter((item: any) => item.host === 'api.deezer.com').length;
    assert.ok(deezerSearches <= 60, `la coincidencia de clasificación se reutiliza para el preview (${deezerSearches} búsquedas)`);
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
    assert.equal(personal.tracks.length, 7); assert.ok(personal.tracks.filter(track => track.artist === 'Artist B').length >= 3);
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
  await fixture({ deezerDown: true }, async (music, data) => {
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
    music.random = () => 0; // Sin variación: aísla el efecto del historial por cuenta.
    const prefs = { artists: ['Artist A'], genres: [] };
    const first = await music.recommendations('feliz', 1, prefs, 'visit-1', 'listener');
    const second = await music.recommendations('feliz', 1, prefs, 'visit-2', 'listener');
    assert.equal(second.status, 'ready');
    const titles = new Set(first.tracks.map(track => `${track.artist}|${track.title}`));
    assert.ok(second.tracks.every(track => !titles.has(`${track.artist}|${track.title}`)));
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
      const tags = [{ name: url.searchParams.get('artist') === 'Pop Artist' ? 'happy' : 'sad', count: 100 }, { name: 'rock', count: 100 }];
      if (url.searchParams.get('method') === 'track.getInfo') return new Response(JSON.stringify({ track: { toptags: { tag: tags } } }));
      if (url.searchParams.get('method') === 'track.getTopTags') return new Response(JSON.stringify({ toptags: { tag: tags } }));
      return data.fetcher(input);
    };
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.status, 'ready');
    assert.ok(batch.tracks.every(track => track.artist === 'Pop Artist'));
    assert.ok(batch.tracks.every(track => track.recommendationReason?.includes('similar a Artist A')));
  });
});

test('artistas: coincidencia exacta primero, luego por popularidad, sin canales Topic ni duplicados', async () => {
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
    assert.deepEqual(results.slice(0, 3).map(item => item.name), ['Phoenix', 'The Phoenix', 'Phoenix Rising']); // Tras la exacta decide la popularidad.
    assert.ok(results.every(item => item.kind === 'artist' && !/topic|Other Artist/i.test(item.name)));
    assert.equal(results.filter(item => item.name.toLowerCase() === 'phoenix').length, 1);
  });
});

test('cuentas con las mismas preferencias no reciben siempre la misma primera tanda', async () => {
  await fixture({}, async music => {
    const prefs = { artists: [], genres: ['rock'] };
    const lists = new Set<string>();
    for (const account of ['uno', 'dos', 'tres']) {
      const batch = await music.recommendations('feliz', 1, prefs, 'visit', account);
      assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
      lists.add(batch.tracks.map(track => track.title).join('|'));
    }
    assert.ok(lists.size > 1, 'la variación por sesión cambia el orden entre temas de afinidad equivalente');
  });
});

test('el historial por cuenta sobrevive a un reinicio y no depende de las preferencias', async () => {
  const stored = new Map();
  const collection = {
    createIndex: async () => 'ok',
    findOne: async (query: any) => stored.get(query._id),
    updateOne: async (query: any, value: any) => { stored.set(query._id, { _id: query._id, ...value.$set }); },
    deleteOne: async (query: any) => { stored.delete(query._id); },
  };
  const database = { status: 'connected', db: { collection: () => collection } } as any;
  const data = createMusicFixture({});
  const previous = globalThis.fetch;
  const key = process.env.LASTFM_API_KEY;
  process.env.LASTFM_API_KEY = 'fixture-key'; globalThis.fetch = data.fetcher;
  try {
    const service = new MusicService(undefined, database);
    (service as any).providers.deezerBudget = 1e9;
    const first = await service.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] }, 'a', 'listener');
    await new Promise(resolve => setTimeout(resolve, 10));
    await audioReady(first);
    const restarted = new MusicService(undefined, database);
    (restarted as any).providers.deezerBudget = 1e9;
    const second = await restarted.recommendations('feliz', 1, { artists: ['Artist A'], genres: ['rock'] }, 'b', 'listener');
    await audioReady(second);
    assert.equal(second.status, 'ready');
    const titles = new Set(first.tracks.map(track => `${track.artist}|${track.title}`));
    assert.ok(second.tracks.every(track => !titles.has(`${track.artist}|${track.title}`)));
  } finally { globalThis.fetch = previous; if (key === undefined) delete process.env.LASTFM_API_KEY; else process.env.LASTFM_API_KEY = key; }
});

test('si el historial cubre todo el catálogo compatible, reinicia el ciclo en lugar de quedarse vacío', async () => {
  await fixture({ count: 9, emptyMood: true }, async music => {
    const prefs = { artists: ['Artist A'], genres: [] };
    assert.equal((await music.recommendations('feliz', 1, prefs, 'a', 'listener')).tracks.length, 7);
    const again = await music.recommendations('feliz', 1, prefs, 'b', 'listener');
    assert.equal(again.status, 'ready'); assert.equal(again.tracks.length, 7);
  });
});

test('los tags siguen paginando aunque Last.fm informe un totalPages menor al real', async () => {
  await fixture({}, async (music, data) => {
    const pages: number[] = [];
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      if (url.searchParams.get('method') === 'tag.getTopTracks') {
        const page = Number(url.searchParams.get('page')); pages.push(page);
        const track = page > 3 ? [] : Array.from({ length: 50 }, (_, i) => ({ name: `Tag ${page}-${i}`, artist: { name: `Band ${i}` } }));
        return new Response(JSON.stringify({ tracks: { '@attr': { totalPages: '1' }, track } }));
      }
      return data.fetcher(input);
    };
    const providers = (music as any).providers;
    assert.equal((await providers.candidates('tag', 'happy', 1)).nextPage, 2);
    assert.equal((await providers.candidates('tag', 'happy', 3)).nextPage, 4);
    assert.equal((await providers.candidates('tag', 'happy', 4)).nextPage, null);
  });
});

function styleFetcher(data: any, artistHits: number) {
  return async (input: any) => {
    const url = new URL(String(input));
    const method = url.searchParams.get('method');
    if (method === 'artist.getTopTags') return new Response(JSON.stringify({ toptags: { tag: [{ name: 'rock', count: 100 }, { name: 'british', count: 40 }] } }));
    if (method === 'track.getInfo' || method === 'track.getTopTags') {
      const index = Number((url.searchParams.get('track') || '').split(' ').at(-1));
      const wrong = url.searchParams.get('artist') === 'Artist A' && index > artistHits;
      const tags = (wrong ? ['sad', 'rock'] : ['happy', 'rock']).map(name => ({ name, count: 100 }));
      return new Response(JSON.stringify(method === 'track.getInfo' ? { track: { listeners: '100000', toptags: { tag: tags } } } : { toptags: { tag: tags } }));
    }
    return data.fetcher(input);
  };
}

test('si el artista no encaja con el mood, recomienda temas del mood de su mismo género', async () => {
  await fixture({}, async (music, data) => {
    globalThis.fetch = styleFetcher(data, 0);
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
    assert.ok(batch.tracks.every(track => track.artist !== 'Artist A'), 'nunca rescata temas del artista contrarios al mood');
    assert.ok(batch.tracks.every(track => track.recommendationReason === 'Del mismo estilo que Artist A, para este mood.'));
  });
});

test('el respaldo por estilo sólo completa: los temas del artista que sí encajan van primero', async () => {
  await fixture({}, async (music, data) => {
    globalThis.fetch = styleFetcher(data, 3);
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
    const own = batch.tracks.filter(track => track.artist === 'Artist A');
    assert.equal(own.length, 3);
    assert.ok(own.every(track => track.recommendationReason === 'De uno de tus artistas, para este mood.'));
  });
});

function untaggedFetcher(data: any) {
  return async (input: any) => {
    const url = new URL(String(input));
    const method = url.searchParams.get('method');
    // Last.fm sólo conoce el género: ninguna etiqueta de ánimo.
    if (method === 'track.getInfo') return new Response(JSON.stringify({ track: { listeners: '1000', toptags: { tag: [{ name: 'rock' }] } } }));
    if (method === 'track.getTopTags') return new Response(JSON.stringify({ toptags: { tag: [{ name: 'rock', count: 100 }] } }));
    return data.fetcher(input);
  };
}
test('sin evidencia emocional no rellena feliz o triste con audio ambiguo; conserva motivado', async () => {
  const audio = (item: any) => item.index % 2 ? { valence: .9, energy: .8 } : { valence: .1, energy: .3 };
  await fixture({ emptyMood: true, audio }, async (music, data) => {
    globalThis.fetch = untaggedFetcher(data);
    for (const mood of ['feliz', 'triste']) {
      const batch = await music.recommendations(mood, 1, { artists: ['Artist A'], genres: [] });
      assert.equal(batch.status, 'exhausted');
      assert.equal(batch.tracks.length, 0, 'no inventa seguridad para completar siete');
    }
    const active = await music.recommendations('motivado', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(active.status, 'ready');
    assert.ok(active.tracks.every(track => Number(track.title.split(' ').at(-1)) % 2 === 1));
  });
});

test('sin ReccoBeats ni Deezer la clasificación vuelve a las etiquetas de Last.fm', async () => {
  await fixture({ deezerDown: true }, async music => {
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] });
    assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
  });
});

test('la clasificación no consulta letras: una caída de LRCLIB no afecta las tandas', async () => {
  await fixture({}, async (music, data) => {
    let lyricCalls = 0;
    globalThis.fetch = async input => new URL(String(input)).hostname === 'lrclib.net'
      ? (lyricCalls++, new Response('', { status: 503 })) : data.fetcher(input);
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] }, 'no-lyrics');
    assert.equal(batch.status, 'ready');
    assert.equal(batch.tracks.length, 7);
    assert.equal(lyricCalls, 0);
  });
});

test('no consulta letras de un catálogo cuyo audio ya contradice el mood', async () => {
  await fixture({ count: 12, emptyMood: true, audio: () => ({ valence: .1, energy: .2 }) }, async (music, data) => {
    const result = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [] }, 'prune-audio');
    assert.equal(result.tracks.length, 0);
    assert.equal(data.calls.filter((call: any) => call.host === 'lrclib.net').length, 0);
  });
});

test('dos ediciones con títulos diferentes y el mismo ISRC no se repiten entre tandas', async () => {
  await fixture({}, async (music, data) => {
    globalThis.fetch = async input => {
      const response = await data.fetcher(input);
      if (new URL(String(input)).hostname !== 'api.deezer.com') return response;
      const body = await response.json();
      for (const track of body.data || []) track.isrc = `QZFIX${String(Math.floor(track.id / 2)).padStart(7, '0')}`;
      return new Response(JSON.stringify(body));
    };
    const recordings = new Set<string>();
    for (const page of [1, 2]) {
      const batch = await music.recommendations('feliz', page, { artists: ['Artist A'], genres: [] }, 'recordings');
      assert.equal(batch.status, 'ready'); await audioReady(batch);
      for (const track of batch.tracks) {
        assert.ok(track.isrc);
        assert.ok(!recordings.has(track.isrc), `grabación repetida: ${track.title}`);
        recordings.add(track.isrc);
      }
    }
    assert.equal(recordings.size, 14);
  });
});

test('el perfil de gusto aprende de las previews escuchadas y persiste tras reinicio', async () => {
  const stored = new Map();
  const collection = {
    createIndex: async () => 'ok',
    findOne: async (query: any) => stored.get(query._id),
    updateOne: async (query: any, value: any) => { stored.set(query._id, { _id: query._id, ...value.$set }); },
  };
  const other = { createIndex: async () => 'ok', findOne: async () => null, updateOne: async () => ({}) };
  const database = { status: 'connected', db: { collection: (name: string) => name === 'taste_profiles' ? collection : other } } as any;
  const data = createMusicFixture({ audio: () => ({ valence: .7, energy: .8, tempo: 128 }) });
  const previous = globalThis.fetch;
  const key = process.env.LASTFM_API_KEY;
  process.env.LASTFM_API_KEY = 'fixture-key';
  globalThis.fetch = async (input: any) => {
    const url = new URL(String(input));
    if (url.searchParams.get('method') === 'artist.getTopTags') return new Response(JSON.stringify({ toptags: { tag: [{ name: 'garage rock', count: 100 }, { name: 'indie', count: 60 }] } }));
    return data.fetcher(input);
  };
  try {
    const music = new MusicService(undefined, database);
    (music as any).providers.deezerBudget = 1e9;
    await music.recordPlay('listener', '1001'); // Artist B, Song 1
    await new Promise(resolve => setTimeout(resolve, 10));
    const saved = [...stored.values()][0];
    assert.ok(saved, 'se guarda en MongoDB');
    assert.ok(saved.tags['garage rock'] > 0 && saved.artists['artist b'] > 0);
    assert.ok(saved.audio.n > 0 && Math.abs(saved.audio.energy / saved.audio.n - .8) < 1e-9);
    assert.equal(saved.history, undefined, 'sólo agregados, sin historial de reproducciones');
    const restarted = new MusicService(undefined, database);
    const profile = await (restarted as any).taste.load(stored.keys().next().value);
    assert.ok(profile.tags['garage rock'] > 0);
  } finally { globalThis.fetch = previous; if (key === undefined) delete process.env.LASTFM_API_KEY; else process.env.LASTFM_API_KEY = key; }
});

test('letras: se consultan en LRCLIB y sólo se cachea el perfil, nunca la letra', async () => {
  const stored = new Map();
  const collection = { createIndex: async () => 'ok', findOne: async (q: any) => stored.get(q._id), updateOne: async (q: any, v: any) => { stored.set(q._id, v.$set); } };
  const database = { status: 'connected', db: { collection: () => collection } } as any;
  const previous = globalThis.fetch;
  const secret = 'Me dejaste y ya me olvidé, otra persona te tiene, no vuelvas, sin ti bailando, tusa en la pista, ' +
    'me dejaste otra vez, no vuelvas, no te quiero, ya te superé, sin ti la noche sigue, perreo y adiós, olvidarte bailando.';
  let calls = 0;
  globalThis.fetch = (async (input: any) => {
    const url = new URL(String(input));
    if (url.hostname !== 'lrclib.net') throw new Error('red no permitida');
    calls++;
    return new Response(JSON.stringify({ artistName: 'Artista', trackName: 'Tema', instrumental: false, plainLyrics: secret }));
  }) as any;
  try {
    const providers = (new MusicService(undefined, database) as any).providers;
    const profile = await providers.lyrics({ artist: 'Artista', title: 'Tema (feat. Otro)' });
    assert.ok(profile.heartbreak >= .45);
    await providers.lyrics({ artist: 'Artista', title: 'Tema (feat. Otro)' });
    assert.equal(calls, 1, 'la segunda vez sale de caché');
    const cached = JSON.stringify([...stored.values()]);
    assert.ok(!cached.includes('olvidé') && !cached.includes('olvide') && !cached.includes('tusa'), 'la letra no se guarda');
  } finally { globalThis.fetch = previous; }
});

test('favoritos con poco rendimiento para el mood siguen llenando su cupo a tiempo', async () => {
  // Sólo 1 de cada 10 temas de Artist A es alegre; el resto del catálogo sí encaja. Con latencia real
  // de red, revisar pocos favoritos por ronda dejaba la tanda sin ellos al llegar a los 7 s.
  await fixture({ similar: ['Artist B'] }, async (music, data) => {
    globalThis.fetch = async input => {
      await new Promise(resolve => setTimeout(resolve, 80));
      const url = new URL(String(input));
      const method = url.searchParams.get('method');
      if (method === 'track.getInfo' || method === 'track.getTopTags') {
        const index = Number((url.searchParams.get('track') || '').split(' ').at(-1));
        const happy = url.searchParams.get('artist') !== 'Artist A' || index % 10 === 0;
        const tags = [{ name: happy ? 'happy' : 'sad', count: 100 }, { name: 'rock', count: 100 }];
        return new Response(JSON.stringify(method === 'track.getInfo' ? { track: { listeners: '100000', toptags: { tag: tags } } } : { toptags: { tag: tags } }));
      }
      return data.fetcher(input);
    };
    music.random = () => .5; // Orden determinista: la prueba mide el esfuerzo de búsqueda, no la variación.
    const started = Date.now();
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [], preferenceLevel: 3 }, 'low-yield', 'account');
    const elapsed = Date.now() - started;
    assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
    assert.equal(batch.tracks.filter(track => track.artist === 'Artist A').length, 4, 'Equilibrado: 4 de tus favoritos');
    assert.ok(elapsed < 7000, `no necesita esperar al límite de 7 s (${elapsed} ms)`);
  });
});

test('artistas: sólo el artista o banda principal, sin colaboraciones que lo sustituyan', async () => {
  const before = globalThis.fetch, key = process.env.LASTFM_API_KEY;
  process.env.LASTFM_API_KEY = 'fixture-key';
  const results: Record<string, Array<[string, number]>> = {
    daft: [['Daft Punk & Pharrell Williams', 300000], ['Daft Punk', 5000000], ['Daft Punk feat. Julian Casablancas', 90000], ['The Weeknd, Daft Punk', 81894], ['Daft Punk - Stardust', 15179]],
    simon: [['Simon & Garfunkel', 3000000], ['Simon', 1200]],
    earth: [['Earth, Wind & Fire', 3110856], ['Earth Wind', 264], ['Earth Wind and Fire', 142324], ['Earth, Wind & Fire, The Emotions', 23811]],
    drake: [['Drake', 6000000], ['Drake Bell', 400000], ['Drake & Future', 50000]],
    mumford: [['Mumford', 2215], ['Mumford & Sons', 2754324], ['Mumford And Sons', 228389], ['Marcus Mumford', 144619], ['Mumford & Sons & Hozier', 3551]],
    'bad bunny': [['Bad Bunny feat. Jhay Cortez', 150000], ['Bad Bunny x Rosalía', 90000]],
  };
  globalThis.fetch = async input => {
    const term = new URL(String(input)).searchParams.get('artist') || '';
    return new Response(JSON.stringify({ results: { artistmatches: { artist: (results[term] || []).map(([name, listeners]) => ({ name, listeners: String(listeners), mbid: '' })) } } }));
  };
  try {
    const providers = new (require('../src/modules/music/music.providers').MusicProviders)(new MusicCache());
    const names = async (term: string) => (await providers.artists(term)).map((item: any) => item.name);
    assert.deepEqual(await names('daft'), ['Daft Punk'], 'las colaboraciones no aparecen junto al original');
    assert.deepEqual(await names('simon'), ['Simon & Garfunkel'], 'un dúo real con & se conserva; un nombre truncado poco escuchado no');
    assert.deepEqual(await names('drake'), ['Drake', 'Drake Bell'], 'otro artista que sólo comparte palabra se conserva');
    assert.deepEqual(await names('mumford'), ['Mumford & Sons', 'Marcus Mumford'], 'sin duplicados por and/& ni colaboraciones');
    assert.deepEqual(await names('earth'), ['Earth, Wind & Fire']);
    assert.deepEqual(await names('bad bunny'), ['Bad Bunny'], 'si sólo aparecen colaboraciones, se ofrece el artista principal');
  } finally { globalThis.fetch = before; if (key === undefined) delete process.env.LASTFM_API_KEY; else process.env.LASTFM_API_KEY = key; }
});

test('nivel 5 sin canciones para el mood: amplía a artistas parecidos y lo avisa', async () => {
  // Todo el catálogo de Artist A es triste (no encaja con feliz); Pop Artist, desde el mood, sí.
  await fixture({ wrongMood: Array.from({ length: 60 }, (_, i) => i + 1), similar: ['Pop Artist'] }, async (music, data) => {
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      const method = url.searchParams.get('method');
      if ((method === 'track.getInfo' || method === 'track.getTopTags') && url.searchParams.get('artist') !== 'Artist A') {
        const tags = [{ name: 'happy', count: 100 }, { name: 'pop', count: 100 }];
        return new Response(JSON.stringify(method === 'track.getInfo' ? { track: { listeners: '100000', toptags: { tag: tags } } } : { toptags: { tag: tags } }));
      }
      return data.fetcher(input);
    };
    const started = Date.now();
    const batch = await music.recommendations('feliz', 1, { artists: ['Artist A'], genres: [], preferenceLevel: 5 }, 'strict', 'account');
    assert.equal(batch.status, 'ready'); assert.equal(batch.tracks.length, 7);
    assert.match(batch.notice || '', /añadimos artistas parecidos/);
    assert.ok(batch.tracks.every(track => track.artist !== 'Artist A'));
    assert.ok(Date.now() - started < 5000, 'no espera al límite de tiempo para rendirse');
  });
});
