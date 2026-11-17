import { useEffect, useRef } from 'react';
import { usePlayer } from '../../features/player/PlayerProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import Disc from './Disc';
import Icon from './Icon';

const statusText = { loading: 'Buscando preview…', temporary_error: 'No se pudo comprobar el preview. Reintenta más tarde.', not_found: 'Sin preview: no encontramos una coincidencia segura.', unavailable: 'Sin preview para esta canción.' };
// source: { key, label, path } identifica la lista para que el reproductor pueda volver a ella.
export default function TrackList({ tracks, source }) {
  const player = usePlayer();
  const reduced = useReducedMotion();
  const list = useRef(null);
  const playable = tracks?.filter(track => track.previewUrl) || [];
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
    <ul className="track-list" ref={list}>{tracks.map(track => {
      const current = ownsQueue && player.isCurrent(track.id);
      const { label, icon, run } = action(track);
      return <li key={track.id} data-track-id={track.id} className={current ? 'is-current' : undefined} aria-current={current ? 'true' : undefined}><article>
        <Disc track={track} size={72} />
        <div>
          <h3>{track.title}</h3>
          <p>{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
          {track.recommendationReason && <p className="reason">{track.recommendationReason}</p>}
          <div className="row-actions">
            {track.previewUrl ? <button type="button" onClick={run} aria-label={`${label}: ${track.title}`}><Icon name={icon} size={18} />{label}</button> : <span className="lcd-text track-end is-warn">{statusText[track.previewStatus] || 'Sin preview.'}</span>}
            <a href={track.externalUrl} target="_blank" rel="noreferrer">{track.provider === 'deezer' ? 'Ver en Deezer' : track.provider === 'itunes' ? 'Ver en iTunes' : 'Ver en Last.fm'}</a>
            {track.lastfmUrl && <a href={track.lastfmUrl} target="_blank" rel="noreferrer">Last.fm</a>}
          </div>
        </div>
      </article></li>;
    })}</ul>
  </>;
}
