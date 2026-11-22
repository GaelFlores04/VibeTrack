import { isBlankTrack, shortTitle } from '../../features/player/trackState';

// Vinilo en miniatura: surcos negros y la portada como etiqueta central. Si la canción no tiene
// preview confirmado, es un prensado de prueba: etiqueta blanca con el título escrito a rotulador.
export default function Disc({ track, size = 44 }) {
  const blank = isBlankTrack(track);
  return <span className={`disc${blank ? ' blank' : ''}`} style={{ '--size': `${size}px` }} aria-hidden="true">
    <span className="disc-label">
      {blank
        ? size >= 56 && <span className="marker" style={{ fontSize: `${Math.max(8, size / 9)}px` }}>{shortTitle(track?.title)}</span>
        : track?.artworkUrl && <img src={track.artworkUrl} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} />}
    </span>
  </span>;
}
