import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MoodCarousel from '../src/features/moods/MoodCarousel';
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

test('el carrusel mantiene fuera del foco los slides que no se muestran', () => {
  const html = render(<MoodCarousel moods={moods} />);
  const slides = [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
  assert.equal(slides.length, 3);
  assert.doesNotMatch(slides[0], /\binert=/);
  assert.ok(slides.slice(1).every(slide => /\binert=""/.test(slide)));
  assert.match(slides[0], /href="\/recomendaciones\/feliz"/);
  assert.match(html, /aria-label="Mood anterior"/);
  assert.match(html, /aria-disabled="true"[^>]*aria-label="Mood anterior"/);
  assert.doesNotMatch(html, /<button[^>]*\sdisabled=/);
  assert.equal([...html.matchAll(/aria-pressed="true"/g)].length, 1);
  assert.match(html, /role="status">Feliz · 1 de 3/);
});

test('un catálogo vacío no deja controles de carrusel sin contenido', () => {
  assert.equal(render(<MoodCarousel moods={[]} />), '');
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
  assert.match(html, /Tu reproductor/);
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
