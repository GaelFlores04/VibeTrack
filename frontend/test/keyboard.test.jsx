import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { act, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { focusableElements, installKeyboardNavigation } from '../src/shared/keyboardNavigation';
import MoodShelf from '../src/features/moods/MoodShelf';
import Autocomplete from '../src/shared/components/Autocomplete';
import { MiniPlayer } from '../src/features/player/PlayerProvider';
import PlayerStage from '../src/features/player/PlayerStage';
import PlaybackDisc from '../src/shared/components/PlaybackDisc';

function fixture(markup, positions = {}) {
  const dom = new JSDOM(`<body>${markup}</body>`, { url: 'http://localhost/', pretendToBeVisual: true });
  const { document, HTMLElement } = dom.window;
  const animations = [];
  HTMLElement.prototype.animate = function (keyframes, options) {
    const animation = {
      element: this, keyframes, options, playState: 'running', currentTime: 0,
      play() { this.playState = 'running'; },
      pause() { this.playState = 'paused'; },
      cancel() { this.playState = 'idle'; },
    };
    animations.push(animation);
    return animation;
  };
  // jsdom no hace layout: las coordenadas de cada caso representan el grid renderizado.
  HTMLElement.prototype.getBoundingClientRect = function () {
    const [left, top] = positions[this.id] || [0, 0];
    return { left, top, width: 80, height: 44, right: left + 80, bottom: top + 44 };
  };
  HTMLElement.prototype.getClientRects = function () { return [this.getBoundingClientRect()]; };
  HTMLElement.prototype.scrollIntoView = function () {};
  HTMLElement.prototype.scrollTo = function ({ left }) { this.scrollLeft = left; };
  const remove = installKeyboardNavigation(document);
  return {
    dom, document, animations,
    focus(id) { document.getElementById(id).focus(); },
    key(key, options = {}) {
      const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
      document.activeElement.dispatchEvent(event);
      return event;
    },
    close() { remove(); dom.window.close(); },
  };
}

async function mount(component, setup = () => {}) {
  const f = fixture('<div id="root"></div>');
  setup(f);
  const previous = { window: globalThis.window, document: globalThis.document, ResizeObserver: globalThis.ResizeObserver, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = f.dom.window;
  globalThis.document = f.document;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(f.document.getElementById('root'));
  await act(async () => root.render(<MemoryRouter>{component}</MemoryRouter>));
  return {
    ...f,
    async unmount() {
      await act(async () => root.unmount());
      globalThis.window = previous.window;
      globalThis.document = previous.document;
      globalThis.ResizeObserver = previous.ResizeObserver;
      globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
      f.close();
    },
  };
}

test('las flechas recorren un menú y Tab conserva la salida nativa del grupo', () => {
  const f = fixture('<nav data-keyboard-group="linear"><a id="a" href="/">Inicio</a><a id="b" href="/moods">Moods</a><button id="c">Cuenta</button></nav>');
  try {
    f.focus('a');
    assert.equal(f.key('ArrowRight').defaultPrevented, true);
    assert.equal(f.document.activeElement.id, 'b');
    f.key('End');
    assert.equal(f.document.activeElement.id, 'c');
    f.key('ArrowDown');
    assert.equal(f.document.activeElement.id, 'a');
    f.key('Home');
    assert.equal(f.document.activeElement.id, 'a');
    assert.equal(f.key('Tab').defaultPrevented, false);
    assert.equal(f.key('ArrowRight', { shiftKey: true }).defaultPrevented, false);
  } finally { f.close(); }
});

test('el foco omite controles deshabilitados, inertes y ocultos', () => {
  const f = fixture('<div data-keyboard-group="linear"><button id="a">A</button><button disabled>Deshabilitado</button><fieldset disabled><button>Dentro de fieldset</button></fieldset><div inert><a href="/">Inerte</a></div><div hidden><button>Oculto</button></div><div aria-hidden="true"><button>Oculto accesible</button></div><button tabindex="-1">Fuera de Tab</button><button style="display:none">Sin display</button><button id="b">B</button></div>');
  try {
    assert.deepEqual(focusableElements(f.document).map(element => element.id), ['a', 'b']);
    f.focus('a'); f.key('ArrowRight');
    assert.equal(f.document.activeElement.id, 'b');
  } finally { f.close(); }
});

test('las flechas siguen las columnas reales de un grid sin activar las cards', () => {
  const f = fixture('<div data-keyboard-group="grid"><button id="a">A</button><button id="b">B</button><button id="c">C</button><button id="d">D</button></div>', { a: [0, 0], b: [120, 0], c: [0, 80], d: [120, 80] });
  let clicks = 0;
  f.document.addEventListener('click', () => clicks++);
  try {
    f.focus('a'); f.key('ArrowDown');
    assert.equal(f.document.activeElement.id, 'c');
    f.key('ArrowRight');
    assert.equal(f.document.activeElement.id, 'd');
    f.key('ArrowUp');
    assert.equal(f.document.activeElement.id, 'b');
    assert.equal(clicks, 0);
  } finally { f.close(); }
});

test('texto, combobox, radios y progreso conservan sus teclas nativas', () => {
  const f = fixture('<input id="text" value="música"><input id="combo" role="combobox"><input id="range" type="range"><input id="radio" type="radio"><textarea id="area">Texto</textarea><button>Siguiente</button>');
  try {
    for (const id of ['text', 'combo', 'range', 'radio', 'area']) {
      f.focus(id);
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Home', 'End']) {
        assert.equal(f.key(key).defaultPrevented, false, `${id}: ${key}`);
        assert.equal(f.document.activeElement.id, id);
      }
    }
  } finally { f.close(); }
});

test('los géneros se recorren con flechas sin marcar casillas automáticamente', () => {
  const f = fixture('<fieldset data-keyboard-group="grid"><input id="a" type="checkbox"><input id="b" type="checkbox"></fieldset>', { a: [0, 0], b: [120, 0] });
  try {
    f.focus('a'); f.key('ArrowRight');
    assert.equal(f.document.activeElement.id, 'b');
    assert.equal(f.document.getElementById('a').checked, false);
    assert.equal(f.document.getElementById('b').checked, false);
    assert.equal(f.key(' ').defaultPrevented, false);
  } finally { f.close(); }
});

test('un widget puede consumir flechas sin que el manejador global le quite el foco', () => {
  const f = fixture('<button id="a">Widget</button><button id="b">Otro</button>');
  try {
    f.document.getElementById('a').addEventListener('keydown', event => event.preventDefault());
    f.focus('a'); f.key('ArrowRight');
    assert.equal(f.document.activeElement.id, 'a');
  } finally { f.close(); }
});

test('el estante se recorre con flechas dentro de cada balda', async () => {
  const f = await mount(<MoodShelf moods={[{ slug: 'feliz', name: 'Feliz' }, { slug: 'triste', name: 'Triste' }, { slug: 'relajado', name: 'Relajado' }]} />);
  try {
    const boxes = [...f.document.querySelectorAll('a.record-box')];
    boxes[0].focus();
    await act(async () => { f.key('ArrowRight'); });
    assert.equal(f.document.activeElement, boxes[1]);
    await act(async () => { f.key('End'); });
    assert.equal(f.document.activeElement, boxes[2]);
    await act(async () => { f.key('Home'); });
    assert.equal(f.document.activeElement, boxes[0]);
  } finally {
    await f.unmount();
  }
});

test('las sugerencias se seleccionan con flechas y Enter y se cierran con Escape', async () => {
  const previousFetch = globalThis.fetch;
  const suggestions = [{ id: 'a', kind: 'artist', name: 'Artista A' }, { id: 'b', kind: 'artist', name: 'Artista B' }];
  globalThis.fetch = async () => ({ ok: true, json: async () => suggestions });
  let selected = null;
  const f = await mount(<Autocomplete label="Artista" value="keyboard-fixture" onChange={() => {}} onSelect={item => { selected = item; }} endpoint="/music/artists" />);
  try {
    const input = f.document.querySelector('input');
    await act(async () => input.focus());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 260)); });
    await act(async () => { f.key('ArrowDown'); });
    assert.match(input.getAttribute('aria-activedescendant'), /option-0$/);
    await act(async () => { f.key('Escape'); });
    assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.equal(f.document.activeElement, input);
    await act(async () => { f.key('ArrowDown'); });
    await act(async () => { f.key('ArrowDown'); });
    await act(async () => { f.key('ArrowDown'); });
    await act(async () => { f.key('Enter'); });
    assert.equal(selected.id, 'b');
    assert.equal(input.getAttribute('aria-expanded'), 'false');
  } finally {
    await f.unmount();
    globalThis.fetch = previousFetch;
  }
});

test('la cola abierta por teclado recibe el foco y Escape lo devuelve a su botón', async () => {
  const queue = [{ id: 'a', title: 'Primera', artist: 'Artista', previewUrl: '/a' }, { id: 'b', title: 'Segunda', artist: 'Artista', previewUrl: '/b' }];
  function QueueFixture() {
    const [expanded, setExpanded] = useState(false);
    return <MiniPlayer track={queue[0]} queue={queue} index={0} status="paused" time={{ current: 0, duration: 30 }} volume={1} setVolume={() => {}} expanded={expanded} setExpanded={setExpanded} source={{ key: 'test', path: '/' }} toggle={() => {}} seek={() => {}} close={() => {}} start={() => {}} step={() => {}} engine="preview" playable={track => !!track.previewUrl} />;
  }
  const f = await mount(<QueueFixture />);
  try {
    const toggle = f.document.querySelector('[aria-controls="player-queue"]');
    toggle.focus();
    await act(async () => toggle.dispatchEvent(new f.dom.window.MouseEvent('click', { bubbles: true, detail: 0 })));
    assert.equal(f.document.activeElement.textContent.includes('Primera'), true);
    await act(async () => { f.key('ArrowDown'); });
    assert.equal(f.document.activeElement.textContent.includes('Segunda'), true);
    await act(async () => { f.key('Escape'); });
    assert.equal(f.document.querySelector('#player-queue'), null);
    assert.equal(f.document.activeElement, toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  } finally { await f.unmount(); }
});

test('la escena deja de girar fuera de pantalla o en una pestaña oculta', async () => {
  const previousObserver = globalThis.IntersectionObserver;
  let visibility;
  let disconnected = false;
  globalThis.IntersectionObserver = class {
    constructor(callback) { visibility = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  const track = { id: 'a', title: 'Música', artist: 'Artista', previewUrl: '/a' };
  const f = await mount(<PlayerStage tracks={[track]} selected={track} playing reduced={false} onPick={() => {}} label="Reproductor" />);
  try {
    assert.ok(f.document.querySelector('.is-spinning'));
    await act(async () => visibility([{ isIntersecting: false }]));
    assert.equal(f.document.querySelector('.is-spinning'), null);
    await act(async () => visibility([{ isIntersecting: true }]));
    assert.ok(f.document.querySelector('.is-spinning'));
    Object.defineProperty(f.document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => f.document.dispatchEvent(new f.dom.window.Event('visibilitychange')));
    assert.equal(f.document.querySelector('.is-spinning'), null);
  } finally {
    await f.unmount();
    globalThis.IntersectionObserver = previousObserver;
  }
  assert.equal(disconnected, true);
});

test('la portada del mini permanece estable al reproducir, pausar y cargar', async () => {
  const track = { id: 'a', title: 'Primera', artist: 'Artista', previewUrl: '/a' };
  function MiniFixture() {
    const [status, setStatus] = useState('paused');
    return <>
      <button id="play-test" onClick={() => setStatus('playing')}>Sonando</button>
      <button id="pause-test" onClick={() => setStatus('paused')}>Pausa</button>
      <button id="loading-test" onClick={() => setStatus('loading')}>Cargando</button>
      <MiniPlayer track={track} queue={[track]} index={0} status={status} time={{ current: 0, duration: 30 }} volume={1} setVolume={() => {}} expanded={false} setExpanded={() => {}} source={{ key: 'test', path: '/' }} toggle={() => {}} seek={() => {}} close={() => {}} start={() => {}} step={() => {}} engine="preview" playable={track => !!track.previewUrl} />
    </>;
  }
  const f = await mount(<MiniFixture />);
  try {
    const artwork = f.document.querySelector('.mini-artwork');
    assert.ok(artwork.querySelector('.disc'));
    for (const state of ['play-test', 'loading-test', 'pause-test']) {
      await act(async () => f.document.getElementById(state).click());
      assert.equal(f.document.querySelector('.mini-artwork'), artwork);
      assert.equal(f.animations.filter(animation => animation.element === artwork).length, 0);
    }
  } finally { await f.unmount(); }
});

test('la miniatura compartida de la barra respeta cambios de movimiento reducido', async () => {
  const track = { id: 'a', title: 'Canción', artist: 'Artista', previewUrl: '/a' };
  let updatePreference;
  const media = { matches: false, addEventListener(_event, update) { updatePreference = update; }, removeEventListener() {} };
  const f = await mount(<PlaybackDisc track={track} size={60} playing />, f => { f.dom.window.matchMedia = () => media; });
  try {
    assert.equal(f.animations[0].playState, 'running');
    assert.equal(f.document.querySelector('.playback-disc').style.getPropertyValue('--size'), '60px');
    media.matches = true;
    await act(async () => updatePreference());
    assert.equal(f.animations[0].playState, 'idle');
    assert.ok(f.document.querySelector('.playback-disc .disc'));
    media.matches = false;
    await act(async () => updatePreference());
    assert.equal(f.animations.length, 2);
    assert.equal(f.animations[1].playState, 'running');
  } finally { await f.unmount(); }
});

test('el disco conserva una caja visible al quedar dentro del contenedor de animación', async () => {
  const track = { id: 'a', title: 'Canción', artist: 'Artista', artworkUrl: 'https://example.test/cover.jpg', previewUrl: '/a' };
  const f = await mount(<PlaybackDisc track={track} size={60} />);
  try {
    const stylesheet = f.document.createElement('style');
    stylesheet.textContent = readFileSync(new URL('../src/styles/studio.css', import.meta.url), 'utf8');
    f.document.head.append(stylesheet);
    const wrapper = f.document.querySelector('.playback-disc');
    const disc = wrapper.querySelector('.disc');
    assert.equal(f.dom.window.getComputedStyle(wrapper).display, 'block');
    assert.equal(f.dom.window.getComputedStyle(disc).display, 'block', 'un span inline ignora ancho y alto y desaparece con una portada absoluta');
    assert.equal(disc.style.getPropertyValue('--size'), '60px');
    assert.equal(disc.querySelector('img').getAttribute('src'), track.artworkUrl);
  } finally { await f.unmount(); }
});
