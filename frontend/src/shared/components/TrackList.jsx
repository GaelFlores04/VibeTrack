import { useEffect, useRef } from 'react';
import { usePlayer } from '../../features/player/PlayerProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import TrackCard from './TrackCard';
import Icon from './Icon';

// source: { key, label, path } identifica la lista para que el reproductor pueda volver a ella.
export default function TrackList({ tracks, source }) {
  const player = usePlayer();
  const reduced = useReducedMotion();
  const list = useRef(null);
  const playable = tracks?.filter(player.playable) || [];
  const ownsQueue = !!source && player.source?.key === source.key;
  const busy = player.status === 'playing' || player.status === 'loading';
  // Las previews llegan después que las tarjetas: la cola del reproductor se mantiene al día.
  useEffect(() => { if (source && tracks) player.syncQueue(source.key, tracks); }, [tracks, source?.key]);
  // Cuando la reproducción avanza sola, la lista acompaña a la canción en curso.
  useEffect(() => {
    if (!ownsQueue || player.lastChange !== 'auto' || !player.track) return;
    list.current?.querySelector(`[data-track-id="${CSS.escape(player.track.id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [player.track?.id, player.lastChange, ownsQueue]);
  if (!tracks?.length) return <p>No se encontraron canciones.</p>;
  const action = track => {
    if (!player.isCurrent(track.id) || !ownsQueue) return { label: 'Escuchar', icon: 'play', run: () => player.playQueue(tracks, track, source) };
    return busy ? { label: 'Pausar', icon: 'pause', run: player.toggle } : { label: 'Continuar', icon: 'play', run: player.toggle };
  };
  return <>
    {playable.length > 0 && <p className="list-actions"><button type="button" className="primary" onClick={() => ownsQueue && player.track ? player.toggle() : player.playQueue(tracks, playable[0], source)}>
      <Icon name={ownsQueue && busy ? 'pause' : 'play'} />{ownsQueue && busy ? 'Pausar' : ownsQueue && player.track ? 'Continuar' : `Reproducir todo (${playable.length})`}
    </button></p>}
    <ul className="track-list" ref={list} data-keyboard-group="grid" aria-label="Canciones encontradas">{tracks.map(track => {
      const current = ownsQueue && player.isCurrent(track.id);
      return <TrackCard key={track.id} track={track} current={current} action={action(track)} canPlay={player.playable(track)} />;
    })}</ul>
  </>;
}
