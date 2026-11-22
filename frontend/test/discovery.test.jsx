import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MoodShelf from '../src/features/moods/MoodShelf';
import TrackCard from '../src/shared/components/TrackCard';
import ResourceState from '../src/shared/components/ResourceState';
import ActionLink from '../src/shared/components/ActionLink';
import ExplorePlayer from '../src/features/player/ExplorePlayer';

const moods = [
  { slug: 'feliz', name: 'Feliz' },
  { slug: 'triste', name: 'Triste' },
  { slug: 'romantico', name: 'Romántico' },
];
const render = component => renderToStaticMarkup(<MemoryRouter>{component}</MemoryRouter>);

test('el estante: cada caja es un enlace a su sesión, rotulado y descrito para lectores de pantalla', () => {
  const html = render(<MoodShelf moods={[...moods, { slug: 'motivado', name: 'Motivado' }]} />);
  const boxes = [...html.matchAll(/<a class="record-box"[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
  assert.equal(boxes.length, 4);
  assert.match(boxes[0], /href="\/recomendaciones\/feliz"/);
  assert.match(boxes[0], /<span class="box-label">Feliz<\/span>/);
  assert.match(boxes[0], /aria-describedby="box-feliz"/);
  assert.match(html, /<p class="box-tag" id="box-feliz">[^<]+<\/p>/);
  // Tres cajas por balda: la cuarta pasa a la balda de abajo.
  assert.equal([...html.matchAll(/class="shelf-plank"/g)].length, 2);
  assert.doesNotMatch(html, /<button/);
});

test('un estante sin moods lo dice y no deja enlaces vacíos', () => {
  const html = render(<MoodShelf moods={[]} />);
  assert.match(html, /El estante está vacío/);
  assert.doesNotMatch(html, /<a /);
});

const track = {
  id: 'deezer:123', title: 'Una canción <especial>', artist: 'Artista & compañía',
  externalUrl: 'https://www.deezer.com/track/123', provider: 'deezer', previewStatus: 'unavailable',
};

test('una canción sin preview explica el estado y conserva el enlace para escucharla', () => {
  const html = render(<ul><TrackCard track={track} action={{ label: 'Escuchar', icon: 'play', run() {} }} /></ul>);
  assert.match(html, /Sin preview para esta canción/);
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /href="https:\/\/www.deezer.com\/track\/123"/);
  assert.match(html, /Una canción &lt;especial&gt;/);
  assert.match(html, /Artista &amp; compañía/);
});

test('la card seleccionada conserva una acción de pausa con nombre accesible', () => {
  const html = render(<ul><TrackCard track={{ ...track, previewUrl: '/api/music/preview/123' }} current action={{ label: 'Pausar', icon: 'pause', run() {} }} /></ul>);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /aria-label="Pausar: Una canción &lt;especial&gt;"/);
  assert.match(html, /<button type="button" class="primary"/);
});

test('una pista completa de Spotify puede escucharse aunque no tenga preview', () => {
  const html = render(<ul><TrackCard track={track} canPlay action={{ label: 'Escuchar', icon: 'play', run() {} }} /></ul>);
  assert.match(html, /<button[^>]*aria-label="Escuchar:/);
  assert.doesNotMatch(html, /Sin preview para esta canción/);
});

test('los estados de carga y error anuncian el problema y permiten recuperarse', () => {
  const loading = render(<ResourceState resource={{ loading: true }}>Contenido</ResourceState>);
  assert.match(loading, /role="status"/);
  assert.doesNotMatch(loading, /Contenido/);
  const error = render(<ResourceState resource={{ error: 'Proveedor no disponible', retry() {} }} />);
  assert.match(error, /role="alert"/);
  assert.match(error, /Proveedor no disponible/);
  assert.match(error, /<button type="button">Volver a intentarlo<\/button>/);
});

test('los controles de navegación conservan enlaces reales y destinos seguros', () => {
  const external = render(<ActionLink href="https://www.deezer.com/track/123" icon="external">Deezer</ActionLink>);
  assert.match(external, /class="action-link"/);
  assert.match(external, /target="_blank" rel="noreferrer"/);
  assert.doesNotMatch(external, /<button/);
  const internal = render(<ActionLink to="/moods" icon="moods">Cambiar de mood</ActionLink>);
  assert.match(internal, /href="\/moods"/);
  assert.doesNotMatch(internal, /target="_blank"/);
});

function fakePlayer(overrides = {}) {
  return {
    track: null, queue: [], source: null, status: 'idle', engine: 'preview',
    time: { current: 0, duration: 0 }, volume: 1, error: '',
    spotify: { ready: false, uriFor() { return null; } },
    playable: item => Boolean(item?.previewUrl),
    setDocked() {}, previous() {}, next() {}, toggle() {}, seek() {}, setVolume() {}, playQueue() {},
    ...overrides,
  };
}

test('Explorar muestra el reproductor vacío sin afirmar que hay música sonando', () => {
  const html = render(<ExplorePlayer player={fakePlayer()} tracks={[]} />);
  assert.match(html, /El tocadiscos de la cabina/);
  assert.match(html, /Elige una canción de los resultados/);
  assert.match(html, /Reproductor vacío/);
  assert.match(html, /VACÍO/);
  assert.match(html, /disabled="" aria-label="Reproducir"/);
});

test('el reproductor de Explorar refleja la cola activa aunque cambie la búsqueda', () => {
  const active = { ...track, title: 'Canción en curso', previewUrl: '/api/music/preview/123' };
  const player = fakePlayer({ track: active, queue: [active], status: 'playing', time: { current: 12, duration: 30 }, source: { key: 'mood:feliz:1', path: '/recomendaciones/feliz' } });
  const html = render(<ExplorePlayer player={player} tracks={[{ ...track, id: 'otro', title: 'Otro resultado' }]} source={{ key: 'search:otra' }} />);
  assert.match(html, /Canción en curso/);
  assert.doesNotMatch(html, /Otro resultado/);
  assert.match(html, /aria-label="Pausar"/);
  assert.match(html, /value="12"/);
  assert.match(html, /href="\/recomendaciones\/feliz"/);
});
