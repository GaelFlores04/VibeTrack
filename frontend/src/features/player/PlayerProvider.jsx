import { createContext, useContext, useEffect, useRef, useState } from 'react';
const PlayerContext = createContext(null);
export const usePlayer = () => useContext(PlayerContext);
export function PlayerProvider({ children }) {
  const audio = useRef(null);
  const sequence = useRef(0);
  const [track, setTrack] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => () => { audio.current?.pause(); }, []);
  async function selectTrack(next) {
    const request = ++sequence.current;
    audio.current.pause();
    setTrack(next); setError('');
    audio.current.src = next.previewUrl;
    audio.current.load();
    try { await audio.current.play(); }
    catch { if (sequence.current === request) setError('No se pudo reproducir el preview. Reintenta desde los controles o abre la canción en iTunes.'); }
  }
  return <PlayerContext.Provider value={{ selectTrack, track }}>
    {children}
    <section className="player" aria-label="Reproductor de preview">
      <p>{track ? `${track.title} — ${track.artist}` : 'Selecciona una canción para escuchar su preview.'}</p>
      <audio ref={audio} controls preload="none" onError={() => setError('El preview no está disponible.')} aria-label="Controles del preview" />
      {track && <p><a href={track.externalUrl} target="_blank" rel="noreferrer">Ver canción en iTunes</a> · Previews provided courtesy of iTunes.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  </PlayerContext.Provider>;
}
