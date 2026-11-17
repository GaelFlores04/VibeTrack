import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../shared/services/api';

// La sesión de descubrimiento sobrevive a recargar la página (sessionStorage, por pestaña):
// así F5 o "Atrás" vuelven a la misma tanda en lugar de empezar otra.
function sessionFor(mood, owner) {
  const key = `vibetrack:session:${owner}:${mood}`;
  try { const stored = sessionStorage.getItem(key); if (stored && /^[a-zA-Z0-9-]{1,64}$/.test(stored)) return stored; } catch { /* */ }
  const id = crypto.randomUUID();
  try { sessionStorage.setItem(key, id); } catch { /* Sin almacenamiento: la sesión dura lo que la página. */ }
  return id;
}
const wait = (ms, signal) => new Promise((resolve, reject) => {
  const stop = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, ms);
  signal.addEventListener('abort', stop, { once: true });
});

export function useRecommendations(mood, { owner = 'guest', initialPage = 1 } = {}) {
  const session = useRef(null);
  session.current ||= sessionFor(mood, owner);
  const [state, setState] = useState({ batch: null, loading: true, message: '', error: '', nextPage: initialPage, exhausted: false, maxPage: 0 });
  const request = useRef(null);
  const pollTimer = useRef(null);
  const url = page => `/music/recommendations/${encodeURIComponent(mood)}?session=${session.current}&page=${page}`;

  const load = useCallback(async page => {
    request.current?.abort();
    clearTimeout(pollTimer.current);
    const controller = new AbortController(); request.current = controller;
    setState(previous => ({ ...previous, loading: true, message: '', error: '' }));
    try {
      let result;
      // Continuar el mismo cursor permite evaluar más candidatos sin perder la tanda visible.
      for (let attempt = 0; attempt < 4; attempt++) {
        result = await api(url(page), controller.signal);
        if (controller.signal.aborted) return;
        if (result.status !== 'retry' || attempt === 3) break;
        setState(previous => ({ ...previous, batch: previous.batch?.status === 'ready' ? previous.batch : result.tracks.length ? result : previous.batch, message: 'Buscando más coincidencias para completar las 7 canciones…' }));
        await wait(Math.min(15000, Math.max(1000, result.retryAfterMs || 1000)), controller.signal);
      }
      if (controller.signal.aborted) return;
      if (result.status === 'ready' && result.tracks.length === 7) {
        setState(previous => ({ batch: result, loading: false, message: '', error: '', nextPage: result.nextPage, exhausted: result.nextPage === null, maxPage: Math.max(previous.maxPage, result.page) }));
        // La selección ya está visible; sólo se actualiza la disponibilidad de audio.
        const pollAudio = (remaining = 8) => {
          if (!remaining || controller.signal.aborted) return;
          pollTimer.current = setTimeout(async () => {
            try {
              const updated = await api(url(page), controller.signal);
              if (controller.signal.aborted) return;
              setState(previous => previous.batch?.page === page ? { ...previous, batch: updated } : previous);
              if (updated.previewsPending) pollAudio(remaining - 1);
            } catch { /* Las tarjetas permanecen visibles; el usuario puede actualizar el audio. */ }
          }, 1500);
        };
        if (result.previewsPending) pollAudio();
      } else {
        setState(previous => ({ ...previous, batch: previous.batch?.status === 'ready' ? previous.batch : result.tracks.length ? result : previous.batch, loading: false, message: result.message, nextPage: page, exhausted: result.status === 'exhausted' }));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      // La tanda pedida ya no existe en el servidor (reinicio o sesión caducada): se vuelve a la primera.
      if (error.status === 400 && page > 1) { void load(1); return; }
      setState(previous => ({ ...previous, loading: false, error: error.message, nextPage: page }));
    }
  }, [mood]);

  useEffect(() => { void load(Math.max(1, initialPage)); return () => { request.current?.abort(); clearTimeout(pollTimer.current); }; }, [load]);
  const current = state.batch?.status === 'ready' ? state.batch.page : 0;
  return {
    ...state,
    page: current,
    refreshAudio: () => { if (!state.loading && state.batch) void load(state.batch.page); },
    // Las tandas ya preparadas se recuperan al instante; la siguiente nueva se prepara en el servidor.
    next: () => { if (state.loading) return; if (current && current < state.maxPage) void load(current + 1); else if (state.nextPage) void load(state.nextPage); },
    previous: () => { if (!state.loading && current > 1) void load(current - 1); },
    hasNewer: current > 0 && current < state.maxPage,
  };
}
