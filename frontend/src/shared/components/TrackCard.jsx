import Disc from './Disc';
import Icon from './Icon';
import ActionLink from './ActionLink';

const PREVIEW_STATUS = {
  loading: 'Buscando preview…',
  temporary_error: 'No se pudo comprobar el preview. Reintenta más tarde.',
  not_found: 'Sin preview: no encontramos una coincidencia segura.',
  unavailable: 'Sin preview para esta canción.',
};
const PROVIDER_NAMES = { deezer: 'Deezer', itunes: 'iTunes', lastfm: 'Last.fm' };

export default function TrackCard({ track, current, action, canPlay = Boolean(track.previewUrl) }) {
  return (
    <li data-track-id={track.id} className={current ? 'is-current' : undefined} aria-current={current ? 'true' : undefined}>
      <article aria-label={`${track.title}, de ${track.artist}`}>
        <Disc track={track} size={72} />
        <div className="track-card-content">
          <h3>{track.title}</h3>
          <p>{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
          {track.recommendationReason && <p className="reason">{track.recommendationReason}</p>}
          <div className="row-actions">
            {canPlay ? (
              <button type="button" className={current ? 'primary' : undefined} onClick={action.run} aria-label={`${action.label}: ${track.title}`}>
                <Icon name={action.icon} size={18} />{action.label}
              </button>
            ) : (
              <span className="track-end is-warn">{PREVIEW_STATUS[track.previewStatus] || 'Sin preview.'}</span>
            )}
            <ActionLink href={track.externalUrl} icon="external">{PROVIDER_NAMES[track.provider] || 'Last.fm'}</ActionLink>
            {track.lastfmUrl && <ActionLink href={track.lastfmUrl} icon="external">Last.fm</ActionLink>}
          </div>
        </div>
      </article>
    </li>
  );
}
