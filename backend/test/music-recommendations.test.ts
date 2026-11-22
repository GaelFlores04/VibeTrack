import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Track } from '../src/modules/music/music.service';
import { findPreviewMatch } from '../src/modules/music/track-matching';

const source = { title: 'Get Lucky', artist: 'Daft Punk' };
const track = (overrides: Partial<Track> = {}): Track => ({ id: 'itunes:1', ...source, externalUrl: 'https://music.apple.com/track/1', ...overrides });
test('elige el artista correcto y prioriza una coincidencia con preview', () => {
  const match = findPreviewMatch(source, [track({ artist: 'Tribute Band', previewUrl: 'https://audio.example/wrong' }), track(), track({ id: 'itunes:2', previewUrl: 'https://audio.example/right' })]);
  assert.equal(match?.id, 'itunes:2');
});

test('tolera acentos, puntuación, créditos y remasters sin confundir versiones distintas', () => {
  assert.ok(findPreviewMatch({ title: 'Canción', artist: 'Beyoncé' }, [track({ title: 'Cancion (Remastered 2020)', artist: 'Beyonce' })]));
  assert.ok(findPreviewMatch(source, [track({ title: 'Get Lucky (feat. Pharrell Williams)' })]));
  for (const title of ['Get Lucky (Live)', 'Get Lucky - Remix', 'Get Lucky (Acoustic)', 'Get Lucky (Radio Edit)', 'Get Lucky Again']) {
    assert.equal(findPreviewMatch(source, [track({ title })]), undefined);
  }
  assert.equal(findPreviewMatch(source, [track({ album: 'Live at Wembley' })]), undefined);
});

