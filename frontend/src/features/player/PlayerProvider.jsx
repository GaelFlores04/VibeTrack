import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { mutate } from '../../shared/services/api';
const PlayerContext = createContext(null);
export const usePlayer = () => useContext(PlayerContext);
export function PlayerProvider({ children }) {
  const audio = useRef(null);
  const sequence = useRef(0);
  const queue = useRef([]);
  const position = useRef(-1);
  const [queueState, setQueueState] = useState({ index: -1, length: 0, next: null });
  const [track, setTrack] = useState(null);
  const [error, setError] = useState('');
  // Una señal por canción y visita; sin sesión la API responde 401 y se ignora.
  const learned = useRef(new Set());
  useEffect(() => () => { audio.current?.pause(); }, []);
  async function selectTrack(next, tracks = queue.current) {
    if (!next?.previewUrl) return;
    queue.current = tracks.filter(item => item.previewUrl);
    position.current = queue.current.findIndex(item => item.id === next.id);
    setQueueState({ index: position.current, length: queue.current.length, next: queue.current[position.current + 1] });
    const request = ++sequence.current;
    audio.current.pause();
    setTrack(next); setError('');
    audio.current.src = next.previewUrl;
    audio.current.load();
    try {
      await audio.current.play();
      if (next.id?.startsWith('deezer:') && !learned.current.has(next.id)) { learned.current.add(next.id); mutate('/music/plays', 'POST', { id: next.id }).catch(() => {}); }
    }
    catch { if (sequence.current === request) setError('No se pudo reproducir el preview. Reintenta desde los controles o abre la canción en su página.'); }
  }
  function step(direction) {
    const next = queue.current[position.current + direction];
    if (next) void selectTrack(next);
  }
  return <PlayerContext.Provider value={{ selectTrack, track }}>
    {children}
    <section className="player" aria-label="Reproductor de preview">
      <p>{track ? `${track.title} — ${track.artist}` : 'Selecciona una canción para escuchar su preview.'}</p>
      <audio ref={audio} controls preload="none" onEnded={() => step(1)} onError={() => setError('El preview no está disponible.')} aria-label="Controles del preview" />
      <div className="actions"><button disabled={queueState.index <= 0} onClick={() => step(-1)}>Anterior</button><button disabled={queueState.index < 0 || queueState.index >= queueState.length - 1} onClick={() => step(1)}>Siguiente</button></div>
      {queueState.index >= 0 && <p>{queueState.index + 1} de {queueState.length} previews. {queueState.next ? `Sigue: ${queueState.next.title} — ${queueState.next.artist}` : 'Fin de la tanda.'}</p>}
      {track && <p><a href={track.externalUrl} target="_blank" rel="noreferrer">Ver canción en {track.provider === 'itunes' ? 'iTunes' : 'Deezer'}</a> · {track.provider === 'itunes' ? 'Previews provided courtesy of iTunes.' : 'Previews de Deezer.'}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  </PlayerContext.Provider>;
}
