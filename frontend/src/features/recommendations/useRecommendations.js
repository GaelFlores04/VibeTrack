import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../shared/services/api';
export function useRecommendations(mood) {
  const [session] = useState(() => crypto.randomUUID());
  const [state, setState] = useState({ batch: null, loading: true, message: '', error: '', nextPage: 1, exhausted: false });
  const request = useRef(null);
  const pollTimer = useRef(null);
  const load = useCallback(async page => {
    request.current?.abort();
    clearTimeout(pollTimer.current);
    const controller = new AbortController(); request.current = controller;
    setState(previous => ({ ...previous, loading: true, message: '', error: '' }));
    try {
      let result;
      // Continuar el mismo cursor permite evaluar más candidatos sin perder la tanda visible.
      for (let attempt = 0; attempt < 4; attempt++) {
        result = await api(`/music/recommendations/${encodeURIComponent(mood)}?session=${session}&page=${page}`, controller.signal);
        if (controller.signal.aborted) return;
        if (result.status !== 'retry' || attempt === 3) break;
        setState(previous => ({ ...previous, batch: previous.batch?.status === 'ready' ? previous.batch : result.tracks.length ? result : previous.batch, message: 'Buscando más coincidencias para completar las 7 canciones…' }));
        await new Promise((resolve, reject) => {
          const stop = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
          const timer = setTimeout(() => { controller.signal.removeEventListener('abort', stop); resolve(); }, Math.min(15000, Math.max(1000, result.retryAfterMs || 1000)));
          controller.signal.addEventListener('abort', stop, { once: true });
        });
      }
      if (controller.signal.aborted) return;
      if (result.status === 'ready' && result.tracks.length === 7) {
        setState({ batch: result, loading: false, message: '', error: '', nextPage: result.nextPage, exhausted: result.nextPage === null });
        // La selección ya está visible; sólo se actualiza la disponibilidad de audio.
        const pollAudio = (remaining = 8) => {
          if (!remaining || controller.signal.aborted) return;
          pollTimer.current = setTimeout(async () => {
            try {
              const updated = await api(`/music/recommendations/${encodeURIComponent(mood)}?session=${session}&page=${page}`, controller.signal);
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
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error.message, nextPage: page }));
    }
  }, [mood, session]);
  useEffect(() => { void load(1); return () => { request.current?.abort(); clearTimeout(pollTimer.current); }; }, [load]);
  return { ...state, refreshAudio: () => { if (!state.loading && state.batch) void load(state.batch.page); }, next: () => { if (!state.loading && state.nextPage) void load(state.nextPage); } };
}
