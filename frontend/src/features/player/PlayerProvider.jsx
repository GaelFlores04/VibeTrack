import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { mutate } from '../../shared/services/api';
import { useAuth } from '../auth/AuthProvider';
import Icon from '../../shared/components/Icon';
import Disc from '../../shared/components/Disc';
import { useSpotify } from './useSpotify';

const PlayerContext = createContext(null);
export const usePlayer = () => useContext(PlayerContext);
const STORAGE_KEY = 'vibetrack:player';
const VOLUME_KEY = 'vibetrack:volume';
// Sólo campos públicos de la tarjeta: lo necesario para restaurar la cola tras recargar.
const keep = ({ id, title, artist, album, artworkUrl, previewUrl, previewStatus, durationMs, externalUrl, provider, recommendationReason }) => ({ id, title, artist, album, artworkUrl, previewUrl, previewStatus, durationMs, externalUrl, provider, recommendationReason });
const read = (storage, key) => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
const write = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); } catch { /* Almacenamiento no disponible. */ } };
export const formatTime = seconds => !Number.isFinite(seconds) || seconds < 0 ? '0:00' : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const typing = target => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName));

export function PlayerProvider({ children }) {
  const audio = useRef(null);
  const { user } = useAuth();
  const signedIn = useRef(false);
  signedIn.current = !!user;
  const saved = useRef(read(sessionStorage, STORAGE_KEY));
  const [queue, setQueue] = useState(() => saved.current?.queue || []);
  const [index, setIndex] = useState(() => saved.current?.index ?? -1);
  // source: de dónde viene la cola ({ key, label, path }) para poder volver a ella desde otra página.
  const [source, setSource] = useState(() => saved.current?.source || null);
  const [status, setStatus] = useState(() => (saved.current?.queue?.length ? 'paused' : 'idle'));
  const [time, setTime] = useState({ current: saved.current?.time || 0, duration: 0 });
  const [volume, setVolume] = useState(() => { const value = read(localStorage, VOLUME_KEY); return typeof value === 'number' && value >= 0 && value <= 1 ? value : 1; });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [lastChange, setLastChange] = useState('user');
  const [pageTitle, setPageTitle] = useState('VibeTrack');
  // Página que muestra el reproductor completo de la cola en curso: ahí el minirreproductor sobra.
  const [docked, setDocked] = useState(null);
  const endActions = useRef(new Map());
  const [endVersion, setEndVersion] = useState(0);
  const learned = useRef(new Set());
  const state = useRef({ queue, index });
  state.current = { queue, index };
  const track = queue[index] || null;
  const restoreAt = useRef(saved.current?.time || 0);
  // engine: 'preview' (audio de 30 s) o 'spotify' (canción completa con Premium).
  const [engine, setEngine] = useState('preview');
  const engineRef = useRef('preview');
  const switchEngine = value => { engineRef.current = value; setEngine(value); };
  const lastPosition = useRef(0);
  const endedRef = useRef(() => {});
  const spotify = useSpotify(!!user, ({ position, duration, paused }) => {
    if (engineRef.current !== 'spotify') return;
    // Una canción sola de Spotify termina en pausa y vuelve a 0: se pasa a la siguiente de la cola.
    if (paused && position === 0 && duration > 0 && lastPosition.current > duration - 3) { lastPosition.current = 0; endedRef.current(); return; }
    lastPosition.current = position;
    setTime({ current: position, duration });
    setStatus(current => paused ? (current === 'ended' ? current : 'paused') : 'playing');
  });
  const spotifyRef = useRef(spotify);
  spotifyRef.current = spotify;
  const playable = useCallback(item => Boolean(item?.previewUrl || (spotifyRef.current.ready && spotifyRef.current.uriFor(item?.id))), []);

  const learn = next => {
    // Una señal por canción y visita para el perfil de gusto (sólo con sesión iniciada).
    if (signedIn.current && next.id?.startsWith('deezer:') && !learned.current.has(next.id)) { learned.current.add(next.id); mutate('/music/plays', 'POST', { id: next.id }).catch(() => {}); }
  };
  const start = useCallback(async (list, position, change = 'user') => {
    const next = list[position];
    if (!next || !audio.current) return;
    const sp = spotifyRef.current;
    const uri = sp.ready ? sp.uriFor(next.id) : null;
    if (uri) {
      setIndex(position); setLastChange(change); setError(''); setStatus('loading');
      audio.current.pause(); restoreAt.current = 0; lastPosition.current = 0;
      switchEngine('spotify'); setTime({ current: 0, duration: (next.durationMs || 0) / 1000 });
      try { await sp.play(uri); learn(next); return; }
      catch (err) { if (!next.previewUrl) { setStatus('paused'); setError(err.message); return; } setError(err.message + ' Suena el preview.'); }
    }
    if (!next.previewUrl) return;
    if (engineRef.current === 'spotify') { sp.pause(); switchEngine('preview'); }
    setIndex(position); setLastChange(change); if (!uri) setError(''); setStatus('loading');
    restoreAt.current = 0;
    audio.current.src = next.previewUrl;
    audio.current.load();
    try {
      await audio.current.play();
      learn(next);
    } catch (err) {
      if (err?.name === 'AbortError') return; // Otra canción reemplazó a esta.
      setStatus('paused');
      setError(err?.name === 'NotAllowedError' ? 'Pulsa reproducir para empezar.' : 'No se pudo reproducir el preview.');
    }
  }, []);

  // Busca la siguiente canción con preview en la dirección indicada (las que aún no lo tienen se saltan).
  const step = useCallback((direction, change = 'user') => {
    const { queue: list, index: position } = state.current;
    for (let next = position + direction; next >= 0 && next < list.length; next += direction) {
      if (playable(list[next])) { void start(list, next, change); return true; }
    }
    return false;
  }, [start, playable]);

  const playQueue = useCallback(async (tracks, startTrack, origin) => {
    const list = tracks.map(keep);
    const position = Math.max(0, list.findIndex(item => item.id === startTrack?.id));
    setQueue(list); setSource(origin || null);
    // Con Spotify listo, primero se buscan las canciones completas (una consulta por tanda).
    if (spotifyRef.current.ready) await spotifyRef.current.match(list).catch(() => {});
    void start(list, playable(list[position]) ? position : list.findIndex(playable));
  }, [start, playable]);

  // Las previews de una tanda llegan después que las tarjetas: se actualiza la cola sin cortar lo que suena.
  const syncQueue = useCallback((key, tracks) => {
    if (!key || source?.key !== key) return;
    const currentId = state.current.queue[state.current.index]?.id;
    const list = tracks.map(keep);
    if (list.length === state.current.queue.length && list.every((item, i) => item.id === state.current.queue[i].id && item.previewUrl === state.current.queue[i].previewUrl)) return;
    setQueue(list);
    if (spotifyRef.current.ready) spotifyRef.current.match(list).catch(() => {});
    const position = list.findIndex(item => item.id === currentId);
    if (position >= 0) setIndex(position);
  }, [source?.key]);

  const toggle = useCallback(() => {
    const element = audio.current;
    if (!element || !track) return;
    if (engineRef.current === 'spotify') { if (status === 'playing') spotifyRef.current.pause(); else spotifyRef.current.resume(); return; }
    if (!element.src || element.src !== new URL(track.previewUrl, location.href).href) { void start(queue, index); return; }
    if (element.paused) element.play().catch(() => setError('No se pudo reproducir el preview.')); else element.pause();
  }, [track, queue, index, start, status]);
  const pause = useCallback(() => { if (engineRef.current === 'spotify') spotifyRef.current.pause(); else if (audio.current && !audio.current.paused) audio.current.pause(); }, []);
  const seek = useCallback(seconds => {
    if (!Number.isFinite(seconds)) return;
    if (engineRef.current === 'spotify') { spotifyRef.current.seek(seconds); lastPosition.current = seconds; setTime(value => ({ ...value, current: seconds })); return; }
    if (audio.current) { audio.current.currentTime = seconds; setTime(value => ({ ...value, current: seconds })); }
  }, []);
  const close = useCallback(() => { audio.current?.pause(); if (engineRef.current === 'spotify') { spotifyRef.current.pause(); switchEngine('preview'); } audio.current?.removeAttribute('src'); setQueue([]); setIndex(-1); setSource(null); setStatus('idle'); setExpanded(false); setError(''); }, []);

  // Acción al terminar la cola (p. ej. "Otras 7 canciones"): la registra la página dueña de la cola mientras está montada.
  const registerEndAction = useCallback((key, action) => {
    endActions.current.set(key, action); setEndVersion(value => value + 1);
    return () => { if (endActions.current.get(key) === action) { endActions.current.delete(key); setEndVersion(value => value + 1); } };
  }, []);
  const endAction = source ? endActions.current.get(source.key) : undefined;

  function ended() {
    if (step(1, 'auto')) return;
    setStatus('ended');
    setExpanded(true);
  }
  endedRef.current = ended;

  // El SDK sólo avisa en los cambios: mientras suena se consulta la posición dos veces por segundo.
  useEffect(() => {
    if (engine !== 'spotify' || status !== 'playing') return undefined;
    const timer = setInterval(() => { void spotifyRef.current.poll(); }, 500);
    return () => clearInterval(timer);
  }, [engine, status]);

  useEffect(() => { if (audio.current) audio.current.volume = volume; spotifyRef.current.setVolume(volume); write(localStorage, VOLUME_KEY, volume); }, [volume, spotify.ready]);
  // Restaurar tras recargar: la cola vuelve en pausa (los navegadores no permiten reanudar el audio solos).
  useEffect(() => {
    if (!audio.current || !track?.previewUrl || audio.current.src || engineRef.current !== 'preview') return;
    audio.current.preload = 'metadata';
    audio.current.src = track.previewUrl;
  }, [track]);
  useEffect(() => {
    if (!queue.length) { try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ } return; }
    write(sessionStorage, STORAGE_KEY, { queue, index, source, time: Math.floor(time.current) });
  }, [queue, index, source, Math.floor(time.current / 5)]);

  // Título de la pestaña: la canción en curso delante del nombre de la página.
  useEffect(() => {
    document.title = track && status === 'playing' ? `▶ ${track.title} — ${track.artist} | VibeTrack` : pageTitle;
  }, [track, status, pageTitle]);

  // Teclas multimedia del sistema, auriculares y pantalla de bloqueo.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = track && 'MediaMetadata' in window ? new MediaMetadata({ title: track.title, artist: track.artist, album: track.album || '', artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: '250x250' }] : [] }) : null;
    const handlers = { play: toggle, pause: toggle, previoustrack: () => step(-1), nexttrack: () => step(1), seekto: details => seek(details.seekTime) };
    for (const [action, handler] of Object.entries(handlers)) { try { session.setActionHandler(action, track ? handler : null); } catch { /* Acción no soportada. */ } }
  }, [track, toggle, step, seek]);
  useEffect(() => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = status === 'playing' ? 'playing' : track ? 'paused' : 'none'; }, [status, track]);

  // Atajos: Espacio pausa/continúa; Mayús + flechas cambian de canción. No interfieren al escribir.
  useEffect(() => {
    function onKey(event) {
      if (!track || typing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Space' || event.key === 'k') { event.preventDefault(); toggle(); }
      else if (event.shiftKey && event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      else if (event.shiftKey && event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [track, toggle, step]);

  const value = useMemo(() => ({
    track, queue, index, status, source, lastChange, time, volume, error, engine, spotify, playable, playQueue, syncQueue, toggle, pause, seek, setVolume, next: () => step(1), previous: () => step(-1), registerEndAction, setPageTitle, setDocked,
    isCurrent: id => track?.id === id,
  }), [track, queue, index, status, source, lastChange, time, volume, error, engine, spotify, playable, playQueue, syncQueue, toggle, pause, seek, step, registerEndAction]);

  return <PlayerContext.Provider value={value}>
    {children}
    <audio ref={audio} preload="none" hidden
      onPlay={() => setStatus('playing')} onPause={() => { if (engineRef.current === 'preview') setStatus(current => current === 'ended' ? current : 'paused'); }}
      onTimeUpdate={event => engineRef.current === 'preview' && setTime({ current: event.currentTarget.currentTime, duration: event.currentTarget.duration })}
      onLoadedMetadata={event => { const element = event.currentTarget; if (restoreAt.current && restoreAt.current < element.duration) { element.currentTime = restoreAt.current; restoreAt.current = 0; } setTime({ current: element.currentTime, duration: element.duration }); }}
      onEnded={ended}
      onError={event => { if (!track || !event.currentTarget.getAttribute('src')) return; setError('Este preview no está disponible; pasamos a la siguiente.'); if (!step(1, 'auto')) setStatus('paused'); }} />
    {track && docked !== source?.key && <MiniPlayer {...{ track, queue, index, status, time, volume, setVolume, error, expanded, setExpanded, source, endAction, endVersion, toggle, seek, close, start, step, engine, playable }} />}
  </PlayerContext.Provider>;
}

function MiniPlayer({ track, queue, index, status, time, volume, setVolume, error, expanded, setExpanded, source, endAction, toggle, seek, close, start, step, engine, playable }) {
  const location = useLocation();
  const playing = status === 'playing' || status === 'loading';
  const away = source?.path && `${location.pathname}${location.search}` !== source.path;
  const hasPrevious = queue.slice(0, index).some(playable);
  const hasNext = queue.slice(index + 1).some(playable);
  return <section className="mini-player" aria-label="Reproductor">
    <div className="mini-shell">
    {expanded && <div className="mini-queue" id="player-queue">
      <h2>Cola · {source?.label || 'Reproduciendo'}</h2>
      <ol>{queue.map((item, position) => <li key={item.id} aria-current={position === index ? 'true' : undefined}>
        <button type="button" disabled={!playable(item)} onClick={() => start(queue, position)}>
          <Disc track={item} size={36} />
          <span className="q-text"><span>{item.title}</span><small>{item.artist}{playable(item) ? '' : ' · sin preview'}</small></span>
        </button>
      </li>)}</ol>
      {status === 'ended' && <p role="status">Fin de la cola. {endAction ? <button type="button" className="primary" onClick={() => { setExpanded(false); endAction.run(); }}>{endAction.label}</button> : away && <Link to={source.path}>Volver a {source.label}</Link>}</p>}
      <label className="mini-volume"><Icon name="volume" /> Volumen <input type="range" min="0" max="1" step="0.05" value={volume} style={{ '--fill': `${volume * 100}%` }} onChange={event => setVolume(Number(event.target.value))} /></label>
      <p className="mini-hint">Atajos: Espacio pausa o continúa · Mayús + flechas cambia de canción.</p>
    </div>}
    <div className="mini-bar">
      <Disc track={track} size={48} />
      <div className="mini-meta">
        <strong>{track.title}</strong>
        <span>{track.artist}{engine === 'spotify' && ' · completa en Spotify'}</span>
      </div>
      <div className="mini-controls">
        <button type="button" className="icon" onClick={() => step(-1)} disabled={!hasPrevious} aria-label="Canción anterior"><Icon name="previous" /></button>
        <button type="button" className="icon primary" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}><Icon name={playing ? 'pause' : 'play'} /></button>
        <button type="button" className="icon" onClick={() => step(1)} disabled={!hasNext} aria-label="Canción siguiente"><Icon name="next" /></button>
      </div>
      <div className="mini-progress lcd-text">
        <span>{formatTime(time.current)}</span>
        <input type="range" min="0" max={Number.isFinite(time.duration) ? time.duration : 30} step="0.5" value={Math.min(time.current, Number.isFinite(time.duration) ? time.duration : 30)} style={{ '--fill': `${Math.min(100, (time.current / (Number.isFinite(time.duration) && time.duration ? time.duration : 30)) * 100)}%` }} onChange={event => seek(Number(event.target.value))} aria-label="Posición en la canción" aria-valuetext={`${formatTime(time.current)} de ${formatTime(time.duration)}`} />
        <span>{formatTime(time.duration)}</span>
      </div>
      <div className="mini-extra">
        {away && <Link to={source.path}><Icon name="back" size={16} /> Volver a {source.label}</Link>}
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="player-queue"><Icon name="queue" size={18} /> {index + 1}/{queue.length}<span className="visually-hidden"> en la cola</span></button>
        <a href={track.externalUrl} target="_blank" rel="noreferrer">{track.provider === 'itunes' ? 'iTunes' : 'Deezer'}</a>
        <button type="button" className="icon" onClick={close} aria-label="Cerrar reproductor"><Icon name="close" /></button>
      </div>
    </div>
    {error && <p className="mini-error" role="alert">{error}</p>}
    </div>
  </section>;
}
