import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import SongFeedback from '../src/features/recommendations/SongFeedback';
import { useSongFeedback } from '../src/features/recommendations/useSongFeedback';
import GenrePicker from '../src/features/auth/GenrePicker';
import FeedbackHistory from '../src/features/auth/FeedbackHistory';
import PreferenceLevel from '../src/features/auth/PreferenceLevel';
import TasteRules from '../src/features/auth/TasteRules';
import { GENRE_GROUPS, GENRE_KEYS } from '../../backend/src/modules/music/genres';
import { installKeyboardNavigation } from '../src/shared/keyboardNavigation';

async function mount(component, fetcher) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, act: globalThis.IS_REACT_ACT_ENVIRONMENT, raf: globalThis.requestAnimationFrame };
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.fetch = fetcher; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = callback => callback();
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 100, height: 44 }]; };
  const cleanupKeyboard = installKeyboardNavigation(dom.window.document);
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  await act(async () => root.render(<MemoryRouter>{component}</MemoryRouter>));
  return { document: dom.window.document, window: dom.window,
    async close() {
      await act(async () => root.unmount()); cleanupKeyboard(); dom.window.close();
      globalThis.window = previous.window; globalThis.document = previous.document; globalThis.fetch = previous.fetch;
      globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act; globalThis.requestAnimationFrame = previous.raf;
    },
  };
}
function type(f, input, value) {
  Object.getOwnPropertyDescriptor(f.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new f.window.Event('input', { bubbles: true }));
}
const ok = data => ({ ok: true, json: async () => data });

test('preferencias: busca subgéneros, conserva seleccionados y permite quitar al alcanzar doce', async () => {
  function Fixture() {
    const [selected, setSelected] = useState([...GENRE_KEYS.slice(0, 11), 'shoegaze']);
    return <GenrePicker selected={selected} onChange={setSelected} />;
  }
  const f = await mount(<Fixture />, async () => ok(GENRE_GROUPS));
  try {
    const input = f.document.querySelector('input[type="search"]');
    await act(async () => type(f, input, 'shoegaze'));
    assert.equal(f.document.querySelectorAll('.genre-groups details').length, 1);
    assert.equal(f.document.querySelector('details').open, true);
    const selected = [...f.document.querySelectorAll('.genre-options input')].find(element => element.closest('label').textContent === 'Shoegaze');
    const other = [...f.document.querySelectorAll('.genre-options input')].find(element => element !== selected);
    assert.equal(selected.checked, true); assert.equal(selected.disabled, false); assert.equal(other.disabled, true);
    await act(async () => selected.click());
    assert.equal(other.disabled, false);
    assert.match(f.document.querySelector('.genre-count').textContent, /11\/12/);
  } finally { await f.close(); }
});

test('likes: voto exclusivo y reversible por mood, conserva audio y revierte ante fallo', async () => {
  const writes = []; let fail = false;
  const track = { id: 'deezer:42', feedbackKey: 'song-key', title: 'Una canción' };
  function Fixture() {
    const feedback = useSongFeedback('feliz', 'account');
    return <><audio /><SongFeedback track={track} feedback={feedback} /><p role="status">{feedback.message}</p><p role="alert">{feedback.error}</p></>;
  }
  const f = await mount(<Fixture />, async (url, options) => {
    if (!options.method) return ok({});
    writes.push(JSON.parse(options.body));
    return { ok: !fail, status: fail ? 503 : 201, json: async () => fail ? { message: 'No se guardó. Reintenta.' } : {} };
  });
  try {
    const [like, dislike] = f.document.querySelectorAll('.song-feedback button');
    const audio = f.document.querySelector('audio');
    await act(async () => like.click());
    assert.equal(like.getAttribute('aria-pressed'), 'true');
    assert.equal(dislike.getAttribute('aria-pressed'), 'false');
    await act(async () => dislike.click());
    assert.equal(like.getAttribute('aria-pressed'), 'false');
    assert.equal(dislike.getAttribute('aria-pressed'), 'true');
    fail = true;
    await act(async () => like.click());
    assert.equal(dislike.getAttribute('aria-pressed'), 'true');
    assert.match(f.document.querySelector('[role="alert"]').textContent, /No se guardó/);
    fail = false;
    await act(async () => dislike.click());
    assert.equal(dislike.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(writes.map(write => write.rating), ['like', 'dislike', 'like', null]);
    assert.ok(writes.every(write => write.mood === 'feliz' && write.trackId === track.id));
    assert.equal(f.document.querySelector('audio'), audio);
    like.focus();
    await act(async () => like.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    assert.equal(f.document.activeElement, dislike);
  } finally { await f.close(); }
});

test('likes: una consulta fallida bloquea cambios hasta recuperar las valoraciones', async () => {
  let fail = true;
  function Fixture() {
    const feedback = useSongFeedback('feliz', 'account');
    return <><SongFeedback track={{ id: 'deezer:1', feedbackKey: 'song-key', title: 'Primera' }} feedback={feedback} /><button onClick={feedback.retry}>Reintentar</button></>;
  }
  const f = await mount(<Fixture />, async () => ({ ok: !fail, status: 503, json: async () => fail ? { message: 'Sin conexión' } : { 'song-key': 'like' } }));
  try {
    assert.equal(f.document.querySelector('.song-feedback button').disabled, true);
    fail = false;
    await act(async () => [...f.document.querySelectorAll('button')].at(-1).click());
    assert.equal(f.document.querySelector('.song-feedback button').disabled, false);
    assert.equal(f.document.querySelector('.song-feedback button').getAttribute('aria-pressed'), 'true');
  } finally { await f.close(); }
});

test('historial: permite encontrar y quitar dislikes que ya no aparecen en tandas', async () => {
  const calls = [];
  const entries = [{ key: 'saved-song', title: 'Descartada', artist: 'Artista', rating: 'dislike' }];
  const f = await mount(<FeedbackHistory />, async (url, options) => { calls.push([url, options.method]); return ok(options.method ? null : entries); });
  try {
    assert.match(f.document.querySelector('li').textContent, /No encaja con el mood/);
    const button = f.document.querySelector('li button');
    await act(async () => button.dispatchEvent(new f.window.MouseEvent('click', { bubbles: true, detail: 0 })));
    assert.ok(calls.some(([url, method]) => method === 'DELETE' && url.endsWith('/feedback/feliz/saved-song')));
    assert.equal(f.document.querySelector('li'), null);
    assert.equal(f.document.activeElement.type, 'search');
    assert.match(f.document.body.textContent, /Valoración de Descartada quitada/);
  } finally { await f.close(); }
});

test('nivel de preferencia ofrece cinco radios con descripción y selección exclusiva', async () => {
  function Fixture() { const [value, setValue] = useState(3); return <PreferenceLevel value={value} onChange={setValue} />; }
  const f = await mount(<Fixture />, async () => ok([]));
  try {
    const radios = f.document.querySelectorAll('input[type="radio"]');
    assert.equal(radios.length, 5); assert.equal(radios[2].checked, true);
    await act(async () => radios[4].click());
    assert.equal(radios[4].checked, true); assert.equal(radios[2].checked, false);
    assert.match(f.document.querySelector('.hint').textContent, /lo avisamos y añadimos artistas parecidos/);
    assert.equal(new Set([...radios].map(radio => radio.name)).size, 1);
  } finally { await f.close(); }
});

test('gustos y mood escriben por separado sin cambiar ni desmontar el audio', async () => {
  const writes = [];
  const track = { id: 'deezer:42', title: 'Song', artist: 'Artist', feedbackKey: 'song-key' };
  function Fixture() { const feedback = useSongFeedback('feliz', 'user'); return <><audio /><SongFeedback track={track} feedback={feedback} /></>; }
  const f = await mount(<Fixture />, async (url, options) => {
    if (!options.method) return ok(url.endsWith('/taste-rules') ? [] : {});
    const body = options.body ? JSON.parse(options.body) : null; writes.push({ url, body, method: options.method });
    return ok(url.endsWith('/taste-rules') ? { ...body, key: 'rule-key' } : {});
  });
  try {
    const audio = f.document.querySelector('audio');
    for (const button of f.document.querySelectorAll('.song-feedback button')) assert.ok(button.getAttribute('aria-label').startsWith(button.textContent));
    await act(async () => f.document.querySelector('.song-feedback button').click());
    const likeArtist = [...f.document.querySelectorAll('.song-taste button')].find(button => button.textContent.includes('Me gusta el artista'));
    await act(async () => likeArtist.click());
    assert.equal(writes[0].body.mood, 'feliz');
    assert.deepEqual(writes[1].body, { target: 'artist', name: 'Artist', action: 'more' });
    assert.equal(likeArtist.getAttribute('aria-pressed'), 'true');
    await act(async () => likeArtist.click());
    assert.equal(writes[2].method, 'DELETE');
    assert.equal(f.document.querySelector('audio'), audio);
    assert.equal(f.document.querySelector('.song-feedback button').getAttribute('aria-pressed'), 'true');
  } finally { await f.close(); }
});

test('ajustes detallados permiten cambiar y quitar una exclusión guardada', async () => {
  const entry = { key: 'saved', target: 'song', name: 'Track', artist: 'Artist', action: 'exclude' };
  const writes = [];
  const f = await mount(<TasteRules />, async (url, options) => {
    if (!options.method) return ok(url.endsWith('/genres') ? GENRE_GROUPS : [entry]);
    writes.push(options.method); return ok(options.method === 'POST' ? { ...entry, ...JSON.parse(options.body) } : null);
  });
  try {
    const select = f.document.querySelector('.taste-rule-list select');
    await act(async () => { select.value = 'more'; select.dispatchEvent(new f.window.Event('change', { bubbles: true })); });
    assert.equal(select.value, 'more');
    await act(async () => f.document.querySelector('.taste-rule-list button').click());
    assert.deepEqual(writes, ['POST', 'DELETE']); assert.equal(f.document.querySelector('.taste-rule-list li'), null);
  } finally { await f.close(); }
});
