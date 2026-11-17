import { isBlankTrack, shortTitle } from '../../features/player/trackState';

// CD en miniatura: la portada sobre el disco o, si la canción no tiene preview,
// un CD-R virgen con el título escrito a rotulador.
export default function Disc({ track, size = 44 }) {
  const blank = isBlankTrack(track);
  if (blank) {
    return <span className="disc blank" style={{ '--size': `${size}px` }} aria-hidden="true">
      {size >= 56 && <span className="marker" style={{ fontSize: `${Math.max(9, size / 7)}px` }}>{shortTitle(track?.title)}</span>}
    </span>;
  }
  return <span className="disc" style={{ '--size': `${size}px` }} aria-hidden="true">
    {track?.artworkUrl && <img src={track.artworkUrl} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
  </span>;
}
