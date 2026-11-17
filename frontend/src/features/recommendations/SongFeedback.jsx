import Icon from '../../shared/components/Icon';
import { Link } from 'react-router-dom';

export default function SongFeedback({ track, feedback }) {
  const rating = feedback.ratings[track.feedbackKey];
  const busy = !!feedback.pending[track.feedbackKey];
  return <div className="track-feedback">
  <div className="song-feedback" role="group" aria-label={`Tu valoración de ${track.title} para este mood`} aria-busy={busy} data-keyboard-group="linear">
    <button type="button" aria-pressed={rating === 'like'} aria-label={`Encaja con el mood: ${track.title}`} title="Encaja con este mood. Pulsa de nuevo para quitarlo."
      disabled={!feedback.ready || busy || !track.feedbackKey} onClick={() => feedback.rate(track, 'like')}><Icon name="like" size={17} /><span>Encaja con el mood</span></button>
    <button type="button" aria-pressed={rating === 'dislike'} aria-label={`No encaja con el mood: ${track.title}`} title="No encaja con este mood. Evita esta canción aquí; pulsa de nuevo para quitarlo."
      disabled={!feedback.ready || busy || !track.feedbackKey} onClick={() => feedback.rate(track, 'dislike')}><Icon name="dislike" size={17} /><span>No encaja</span></button>
  </div>
  <details className="song-taste"><summary>Mis gustos: canción o artista</summary>
    <p>Se aplica a todos los moods. Pulsa de nuevo para quitar el ajuste.</p>
    {['song', 'artist'].map(target => {
      const name = target === 'song' ? track.title : track.artist;
      const selected = feedback.tasteRules?.find(rule => rule.target === target && rule.name === name && (target !== 'song' || rule.artist === track.artist));
      const pending = feedback.pending[`taste:${target}:${name}:${target === 'song' ? track.artist : ''}`];
      const negative = target === 'song' ? 'exclude' : 'less';
      return <div key={target} className="song-taste-actions" role="group" aria-label={`Gusto por ${name}`}>
        <strong>{target === 'song' ? 'Esta canción' : track.artist}</strong>
        <button type="button" disabled={!feedback.tasteReady || pending} aria-pressed={selected?.action === 'more'} onClick={() => feedback.rateTaste(track, target, 'more')}><Icon name="like" size={16} />{target === 'song' ? 'Me gusta la canción' : 'Me gusta el artista'}</button>
        <button type="button" disabled={!feedback.tasteReady || pending} aria-pressed={selected?.action === negative} onClick={() => feedback.rateTaste(track, target, negative)}><Icon name="dislike" size={16} />{target === 'song' ? 'No mostrar canción' : 'Menos de este artista'}</button>
      </div>;
    })}
    {feedback.tasteError && <p role="alert">{feedback.tasteError} <button type="button" onClick={feedback.retry}>Reintentar</button></p>}
    <Link to="/preferencias">Ajustar canciones, artistas y géneros</Link>
  </details></div>;
}
