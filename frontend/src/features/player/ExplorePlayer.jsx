import { useEffect, useRef } from 'react';
import PlayerStage from './PlayerStage';
import { formatTime } from './PlayerProvider';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import Icon from '../../shared/components/Icon';
import ActionLink from '../../shared/components/ActionLink';

export default function ExplorePlayer({ player, tracks = [], source }) {
  const reduced = useReducedMotion();
  const controls = useRef(null);
  const selected = player.track || tracks[0] || null;
  const queue = player.track ? player.queue : tracks;
  const loaded = Boolean(player.track);
  const playing = loaded && player.status === 'playing';
  const current = loaded ? player.time.current : 0;
  const full = loaded ? player.engine === 'spotify' : player.spotify.ready && player.spotify.uriFor(selected?.id);
  const duration = loaded && Number.isFinite(player.time.duration) && player.time.duration > 0
    ? player.time.duration : full ? (selected?.durationMs || 30000) / 1000 : 30;
  const playable = player.playable(selected);
  const index = queue.findIndex(track => track.id === selected?.id);
  const previous = queue.slice(0, index).some(player.playable);
  const next = queue.slice(index + 1).some(player.playable);
  // Una búsqueda puede traer 30 resultados: la pila muestra hasta 7 discos alrededor del actual.
  const sceneTracks = selected ? [selected, ...queue.slice(index + 1), ...queue.slice(0, index)].slice(0, 7) : [];
  const state = !selected ? 'VACÍO' : !playable ? 'SIN AUDIO' : !loaded ? 'LISTO' : player.status === 'loading' ? 'CARGANDO' : playing ? 'PLAY' : 'PAUSA';

  useEffect(() => {
    // La barra compacta vuelve cuando los controles grandes salen de la pantalla.
    if (!controls.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      player.setDocked(entry.isIntersecting ? player.source?.key : null);
    });
    observer.observe(controls.current);
    return () => { observer.disconnect(); player.setDocked(null); };
  }, [player.source?.key, player.setDocked]);

  function pick(track) {
    if (player.playable(track)) player.playQueue(queue, track, loaded ? player.source : source);
  }

  function toggle() {
    if (loaded) player.toggle();
    else if (selected && playable) player.playQueue(queue, selected, source);
  }

  return (
    <section className="explore-player" aria-labelledby="explore-player-title">
      <header className="explore-player-heading">
        <div>
          <h2 id="explore-player-title">Tu reproductor</h2>
          <p>{selected ? `${selected.title} · ${selected.artist}` : 'Elige una canción de los resultados para empezar.'}</p>
        </div>
        {loaded && player.source?.path && player.source.key !== source?.key && (
          <ActionLink to={player.source.path} icon="back">Volver a la lista</ActionLink>
        )}
      </header>
      <PlayerStage
        tracks={sceneTracks}
        selected={selected}
        playing={playing}
        reduced={reduced}
        onPick={pick}
        label={selected ? `Reproductor con ${selected.title}, de ${selected.artist}. ${playing ? 'Sonando.' : 'Detenido.'}` : 'Reproductor vacío.'}
        lcd={<div className="lcd" aria-label="Pantalla del reproductor">
          <span className="lcd-line"><span className="lcd-title">{selected?.title || 'TU PRÓXIMA CANCIÓN'}</span></span>
          <span className="lcd-line lcd-sub"><span>{state}</span><span>{formatTime(current)} / {selected ? formatTime(duration) : '--:--'}</span></span>
        </div>}
      />
      <div className="explore-transport" ref={controls} role="group" aria-label="Controles de reproducción">
        <div className="transport-buttons" data-keyboard-group="linear">
          <button type="button" className="icon" onClick={player.previous} disabled={!loaded || !previous} aria-label="Canción anterior"><Icon name="previous" /></button>
          <button type="button" className="icon primary play" onClick={toggle} disabled={!playable} aria-label={playing ? 'Pausar' : 'Reproducir'}><Icon name={playing ? 'pause' : 'play'} size={24} /></button>
          <button type="button" className="icon" onClick={player.next} disabled={!loaded || !next} aria-label="Canción siguiente"><Icon name="next" /></button>
        </div>
        <div className="transport-progress lcd-text">
          <span>{formatTime(current)}</span>
          <input type="range" min="0" max={duration} step="0.5" value={Math.min(current, duration)} disabled={!loaded || !playable}
            style={{ '--fill': `${Math.min(100, current / duration * 100)}%` }}
            onChange={event => player.seek(Number(event.target.value))} aria-label="Posición en la canción" aria-valuetext={`${formatTime(current)} de ${formatTime(duration)}`} />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="explore-player-extra">
          <label className="volume"><Icon name="volume" /><span className="visually-hidden">Volumen</span><input type="range" min="0" max="1" step="0.05" value={player.volume} style={{ '--fill': `${player.volume * 100}%` }} onChange={event => player.setVolume(Number(event.target.value))} /></label>
          {selected?.externalUrl && <ActionLink href={selected.externalUrl} icon="external">{selected.provider === 'itunes' ? 'iTunes' : selected.provider === 'lastfm' ? 'Last.fm' : 'Deezer'}</ActionLink>}
        </div>
      </div>
      {loaded && player.error && <p role="alert">{player.error}</p>}
    </section>
  );
}
