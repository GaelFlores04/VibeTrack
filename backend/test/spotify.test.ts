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
  assert.deepEqual(seen[1], { genres: [], artists: ['Bad Bunny'], spotifyArtists: ['Bad Bunny'] });
  assert.deepEqual(seen[2], { genres: ['rock'], artists: ['Bad Bunny', 'The Strokes'], spotifyArtists: ['Bad Bunny'] });
});
