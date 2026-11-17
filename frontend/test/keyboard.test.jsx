import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { focusableElements, installKeyboardNavigation } from '../src/shared/keyboardNavigation';
import MoodCarousel from '../src/features/moods/MoodCarousel';
import Autocomplete from '../src/shared/components/Autocomplete';
import { MiniPlayer } from '../src/features/player/PlayerProvider';

function fixture(markup, positions = {}) {
  const dom = new JSDOM(`<body>${markup}</body>`, { url: 'http://localhost/', pretendToBeVisual: true });
  const { document, HTMLElement } = dom.window;
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
    dom, document,
    focus(id) { document.getElementById(id).focus(); },
    key(key, options = {}) {
      const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
      document.activeElement.dispatchEvent(event);
      return event;
    },
    close() { remove(); dom.window.close(); },
  };
}

async function mount(component) {
  const f = fixture('<div id="root"></div>');
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

test('el carrusel cambia de slide con flechas y conserva el foco fuera del slide inerte', async () => {
  const f = await mount(<MoodCarousel moods={[{ slug: 'feliz', name: 'Feliz' }, { slug: 'triste', name: 'Triste' }]} />);
  try {
    const viewport = f.document.querySelector('.carousel-viewport');
    Object.defineProperty(viewport, 'clientWidth', { value: 320 });
    f.document.querySelector('.mood-slide a').focus();
    await act(async () => { f.key('ArrowRight'); });
    assert.equal(viewport.scrollLeft, 320);
    assert.equal(f.document.activeElement.getAttribute('aria-label'), 'Ver Triste');
    assert.equal(f.document.querySelectorAll('.mood-slide')[0].hasAttribute('inert'), true);
    assert.equal(f.document.querySelector('[aria-pressed="true"]').getAttribute('aria-label'), 'Ver Triste');
    await act(async () => { f.key('Home'); });
    assert.equal(viewport.scrollLeft, 0);
    assert.equal(f.document.activeElement.getAttribute('aria-label'), 'Ver Feliz');
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
