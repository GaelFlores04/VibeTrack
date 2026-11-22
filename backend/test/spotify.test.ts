import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decrypt, encrypt } from '../src/modules/spotify/spotify-crypto';
import { SpotifyService } from '../src/modules/spotify/spotify.service';

const env = { SPOTIFY_CLIENT_ID: 'client', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:5173/api/spotify/callback', JWT_SECRET: 'x'.repeat(40) };
function withEnv(run: () => Promise<void> | void) {
  return async () => {
    const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
    Object.assign(process.env, env);
    try { await run(); } finally { for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value; }
  };
}
const music: any = { importSpotifyTaste: async () => {}, forgetSpotify: () => {}, tasteSource: async () => 'both', setTasteSource: async () => {}, isrcFor: async () => 'USUM71703861' };

test('desvincular espera la importación en curso y elimina su perfil al terminar', async () => {
  let finish!: () => void, entered!: () => void;
  const blocked = new Promise<void>(resolve => { finish = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const events: string[] = [];
  const spotify: any = new SpotifyService({ ...music,
    importSpotifyTaste: async () => { entered(); await blocked; events.push('import'); },
    forgetSpotify: async () => { events.push('clear'); },
  });
  spotify.memoryLinks.set('u', { refresh: 'unused', scope: 'user-top-read', connectedAt: new Date() });
  spotify.api = async () => ({ items: [] });
  const importing = spotify.importTaste('u');
  await started;
  const disconnecting = spotify.disconnect('u');
  await assert.rejects(spotify.importTaste('u'), /desvinculando/);
  finish(); await Promise.all([importing, disconnecting]);
  assert.deepEqual(events, ['import', 'clear']);
  assert.equal(spotify.memoryLinks.has('u'), false);
  assert.equal(spotify.tokens.has('u'), false);
});

test('Spotify no confirma escrituras cuando MongoDB está desconectado', async () => {
  const spotify: any = new SpotifyService(music, { status: 'disconnected' } as any);
  await assert.rejects(spotify.saveLink('u', { scope: 'user-top-read' }), /No se pudo guardar/);
  await assert.rejects(spotify.disconnect('u'), /No se pudo desvincular/);
  assert.equal(spotify.memoryLinks.size, 0);
});

test('el token de renovación se cifra y no se puede alterar', withEnv(() => {
  const sealed = encrypt('refresh-token-secreto');
  assert.ok(!sealed.includes('refresh-token-secreto'));
  assert.equal(decrypt(sealed), 'refresh-token-secreto');
  const [v, iv, tag, data] = sealed.split('.');
  assert.throws(() => decrypt([v, iv, tag, data.slice(0, -2) + (data.endsWith('A') ? 'BB' : 'AA')].join('.')));
}));

test('la autorización usa PKCE y un state de un solo uso', withEnv(async () => {
  const spotify = new SpotifyService(music);
  const url = new URL(spotify.authorizeUrl('user-1'));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('scope')!.includes('streaming'));
  const state = url.searchParams.get('state')!;
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'streaming' })); }) as any;
  try {
    assert.equal(await spotify.handleCallback('code', state, undefined), 'user-1');
    await assert.rejects(spotify.handleCallback('code', state, undefined), /caducó/);
    assert.equal((await spotify.status('user-1')).connected, true);
    assert.equal((await spotify.accessToken('user-1')).accessToken, 'a');
  } finally { globalThis.fetch = previous; }
  assert.ok(calls >= 1);
}));

test('las canciones se emparejan con Spotify por ISRC', withEnv(async () => {
  const spotify = new SpotifyService(music);
  (spotify as any).tokens.set('u', { token: 't', expires: Date.now() + 3600000 });
  const previous = globalThis.fetch;
  const queries: string[] = [];
  globalThis.fetch = (async (input: any) => { queries.push(new URL(String(input)).searchParams.get('q')!); return new Response(JSON.stringify({ tracks: { items: [{ uri: 'spotify:track:abc' }] } })); }) as any;
  try { assert.deepEqual(await spotify.match('u', [{ id: 'deezer:1', title: 'Tusa', artist: 'KAROL G' }]), { 'deezer:1': 'spotify:track:abc' }); }
  finally { globalThis.fetch = previous; }
  assert.deepEqual(queries, ['isrc:USUM71703861']);
}));

test('la fuente de gustos elige entre la app, Spotify o ambos', async () => {
  const { MusicService } = await import('../src/modules/music/music.service');
  const music: any = new MusicService();
  const seen: any[] = [];
  music.newSession = (_slug: string, preferences: any) => { seen.push(preferences); throw new Error('stop'); };
  const app = { genres: ['rock'], artists: ['The Strokes'] };
  for (const source of ['app', 'spotify', 'both']) {
    await music.spotify.setSource('u1', source);
    await music.spotify.save('u1', ['Bad Bunny']);
    await assert.rejects(music.recommendations('feliz', 1, app, `s-${source}`, 'u1'), /stop/);
  }
  assert.deepEqual(seen[0], { genres: ['rock'], artists: ['The Strokes'] });
  assert.deepEqual(seen[1], { genres: [], artists: ['Bad Bunny'], spotifyArtists: ['Bad Bunny'], spotifyTracks: [] });
  assert.deepEqual(seen[2], { genres: ['rock'], artists: ['Bad Bunny', 'The Strokes'], spotifyArtists: ['Bad Bunny'], spotifyTracks: [] });
});

test('sólo Spotify ignora el cuestionario de VibeTrack aunque la importación esté vacía', async () => {
  const { MusicService } = await import('../src/modules/music/music.service');
  const music: any = new MusicService();
  const seen: any[] = [];
  music.newSession = (_slug: string, preferences: any) => { seen.push(preferences); throw new Error('stop'); };
  await music.spotify.setSource('u2', 'spotify');
  await assert.rejects(music.recommendations('feliz', 1, { genres: ['rock'], artists: ['The Strokes'], preferenceLevel: 4 }, 's-empty', 'u2'), /stop/);
  // Se conserva el nivel elegido; géneros y artistas del cuestionario no participan.
  assert.deepEqual(seen[0], { preferenceLevel: 4, genres: [], artists: [], spotifyArtists: [] });
});

test('importación detallada: pagina, limita concurrencia, comparte solicitudes y conserva fuentes fallidas', withEnv(async () => {
  const imported: any[] = [];
  const spotify: any = new SpotifyService({ ...music, importSpotifyTaste: async (...args: any[]) => { imported.push(args); } });
  spotify.memoryLinks.set('u', { refresh: 'unused', scope: 'user-top-read user-library-read user-follow-read user-read-recently-played', connectedAt: new Date(), expiresAt: new Date(Date.now() + 100000) });
  let active = 0, maximum = 0, failSaved = false;
  const calls: Array<{ path: string; params: any }> = [];
  spotify.api = async (_user: string, path: string, params: any) => {
    active++; maximum = Math.max(maximum, active); calls.push({ path, params });
    try {
      await new Promise(resolve => setTimeout(resolve, 2));
      if (path === '/me/tracks' && failSaved) throw new Error('temporary');
      if (path === '/me/following') return { artists: { items: [{ name: 'Followed', genres: ['jazz'] }], next: params.after ? null : 'next', cursors: { after: 'cursor' } } };
      if (path === '/me/top/artists') return { items: [{ name: 'Top', genres: ['rock'] }] };
      const name = path === '/me/tracks' ? `Saved ${params.offset}` : 'Top song';
      return { items: [{ track: { name, artists: [{ name: path === '/me/tracks' ? 'Saved artist' : 'Top' }] } }], next: path === '/me/tracks' ? 'next' : null };
    } finally { active--; }
  };
  const first = spotify.importTaste('u');
  assert.equal(spotify.importTaste('u'), first);
  const result = await first;
  assert.equal(result.sources.length, 9); assert.ok(result.sources.every((source: any) => source.status === 'ready'));
  assert.equal(calls.filter(call => call.path === '/me/tracks').length, 4);
  assert.equal(calls.filter(call => call.path === '/me/following').length, 2);
  assert.ok(maximum <= 3); assert.equal(imported.length, 1);
  assert.ok(imported[0][1].some((artist: any) => artist.name === 'Followed'));
  assert.ok(imported[0][2].some((track: any) => track.title === 'Saved 0'));
  assert.ok(imported[0][3].includes('jazz'));
  failSaved = true;
  const partial = await spotify.importTaste('u');
  assert.equal(partial.sources.find((source: any) => source.id === 'saved').status, 'unavailable');
  assert.ok(imported[1][2].some((track: any) => track.title === 'Saved 0'), 'no pierde la fuente anterior por un error');
  const before = spotify.memoryLinks.get('u').importedAt;
  spotify.api = async () => { throw new Error('outage'); };
  await assert.rejects(spotify.importTaste('u'), /Conservamos/);
  assert.equal(spotify.memoryLinks.get('u').importedAt, before);
}));

test('permisos antiguos se muestran como pendientes sin afirmar que no hay canciones guardadas', withEnv(async () => {
  const spotify: any = new SpotifyService(music);
  spotify.memoryLinks.set('u', { refresh: 'unused', scope: 'user-top-read', connectedAt: new Date(), expiresAt: new Date(Date.now() + 100000) });
  const paths: string[] = [];
  spotify.api = async (_user: string, path: string) => { paths.push(path); return { items: [] }; };
  const result = await spotify.importTaste('u');
  assert.equal(paths.length, 6);
  assert.equal(result.sources.find((source: any) => source.id === 'followed').status, 'missing-permission');
  assert.ok((await spotify.status('u')).missingScopes.includes('user-library-read'));
}));
