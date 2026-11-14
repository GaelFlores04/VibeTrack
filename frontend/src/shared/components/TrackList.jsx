import { usePlayer } from '../../features/player/PlayerProvider';
export default function TrackList({ tracks }) {
  const { selectTrack, track: current } = usePlayer();
  if (!tracks?.length) return <p>No se encontraron canciones.</p>;
  return <ul className="track-list">{tracks.map(track => <li key={track.id}><article>
    {track.artworkUrl && <img src={track.artworkUrl} alt="" width="80" height="80" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
    <div><h2>{track.title}</h2><p>{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
      {track.previewUrl ? <button onClick={() => selectTrack(track)}>{current?.id === track.id ? 'Reiniciar preview' : 'Escuchar preview'}</button> : <span>Preview no disponible. </span>}
      {' '}<a href={track.externalUrl} target="_blank" rel="noreferrer">{track.id.startsWith('itunes:') ? 'Ver en iTunes' : 'Ver en Last.fm'}</a>
    </div>
  </article></li>)}</ul>;
}
