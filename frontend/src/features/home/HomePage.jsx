import { Link } from 'react-router-dom';
import { usePlayer } from '../player/PlayerProvider';
import { useAuth } from '../auth/AuthProvider';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
import Icon from '../../shared/components/Icon';
import Disc from '../../shared/components/Disc';
import MoodCarousel from '../moods/MoodCarousel';

export default function HomePage() {
  const moods = useResource('/moods');
  const { user } = useAuth();
  const { track, source } = usePlayer();

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-intro">
          <h1 id="home-title">Música para<br />cómo te sientes.</h1>
          <p className="lede">Un mood, siete canciones y algo nuevo por descubrir. Encuentra lo que va contigo ahora.</p>
          <div className="actions">
            <Link className="button-link primary" to="/moods">Encuentra tu mood<Icon name="arrow-right" size={18} /></Link>
            <Link className="text-action" to="/explorar"><Icon name="search" size={18} />Buscar música</Link>
          </div>
          <p className="home-note">Escucha previews sin crear una cuenta.</p>
          {track && source?.path && (
            <Link className="resume-listening" to={source.path}>
              <Disc track={track} size={44} />
              <span><strong>Volver a tu música</strong><span>{track.title} · {track.artist}</span></span>
              <Icon name="arrow-right" />
            </Link>
          )}
        </div>
        <div className="home-selector" aria-busy={moods.loading}>
          <ResourceState resource={moods}>
            {moods.data?.length === 0 ? (
              <div className="resource-state" role="status">
                <p>No hay moods disponibles en este momento.</p>
                <button type="button" onClick={moods.retry}>Volver a intentarlo</button>
              </div>
            ) : <MoodCarousel moods={moods.data} />}
          </ResourceState>
        </div>
      </section>

      <section className="listening-guide" aria-labelledby="guide-title">
        <div className="guide-heading">
          <h2 id="guide-title">Menos buscar.<br />Más escuchar.</h2>
          <Link className="text-action" to={user ? '/preferencias' : '/registro'}>
            {user ? 'Ajustar mis gustos' : 'Hacerlo más mío'}<Icon name="arrow-right" size={18} />
          </Link>
        </div>
        <ol>
          <li><strong>Elige cómo te sientes</strong><p>Seis moods para encontrar tu punto de partida.</p></li>
          <li><strong>Dale play a tu tanda</strong><p>Siete canciones, con el motivo de cada recomendación.</p></li>
          <li><strong>Sigue descubriendo</strong><p>Pide otra tanda o guarda tus gustos con una cuenta.</p></li>
        </ol>
      </section>
    </div>
  );
}
