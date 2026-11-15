import { usePlayer } from '../../features/player/PlayerProvider';
export default function TrackList({ tracks }) {
  const { selectTrack, track: current } = usePlayer();
  if (!tracks?.length) return <p>No se encontraron canciones.</p>;
  return <ul className="track-list">{tracks.map(track => <li key={track.id}><article>
    {track.artworkUrl && <img src={track.artworkUrl} alt="" width="80" height="80" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
    <div><h2>{track.title}</h2><p>{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
      {track.recommendationReason && <p>{track.recommendationReason}</p>}
      {track.previewUrl ? <button onClick={() => selectTrack(track, tracks)}>{current?.id === track.id ? 'Reiniciar preview' : 'Escuchar preview'}</button> : <span>{({ loading: 'Buscando preview…', temporary_error: 'No se pudo comprobar el preview. Reintenta más tarde.', not_found: 'No encontramos una coincidencia segura en Deezer ni iTunes.', unavailable: 'No hay preview disponible para esta canción.' })[track.previewStatus] || 'Preview no disponible.'} </span>}
      {' '}<a href={track.externalUrl} target="_blank" rel="noreferrer">{track.provider === 'deezer' ? 'Ver en Deezer' : track.provider === 'itunes' ? 'Ver en iTunes' : 'Ver en Last.fm'}</a>
      {track.lastfmUrl && <> · <a href={track.lastfmUrl} target="_blank" rel="noreferrer">Ver en Last.fm</a></>}
    </div>
  </article></li>)}</ul>;
}
