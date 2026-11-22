import { Link } from 'react-router-dom';
import { usePlayer } from '../player/PlayerProvider';
import { useAuth } from '../auth/AuthProvider';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
import MoodShelf from '../moods/MoodShelf';
import { BoothArt, CoatsArt, ConsoleArt, TurntableArt } from './StudioObjects';

// El cuarto del estudio: el estante con los moods a la izquierda, el tocadiscos bajo el foco en el
// centro y las puertas a las demás salas (cabina, consola, perchero) a la derecha.
export default function HomePage() {
  const moods = useResource('/moods');
  const { user } = useAuth();
  const { track, source, status } = usePlayer();
  const playing = status === 'playing';
  return <div className="studio-room">
    <header className="room-wall">
      <h1>¿Cómo suena<br />tu momento?</h1>
      <p>Saca una caja del estante. El estudio prepara una sesión de 7 canciones que suenan a ese mood, y te dice por qué está cada una.</p>
    </header>

    <section className="room-shelf" aria-labelledby="shelf-title">
      <h2 id="shelf-title" className="room-label">El estante</h2>
      <ResourceState resource={moods}><MoodShelf moods={moods.data || []} /></ResourceState>
    </section>

    <section className="room-desk" aria-labelledby="desk-title">
      <h2 id="desk-title" className="room-label">El tocadiscos</h2>
      <div className="desk-lamp" aria-hidden="true" />
      <TurntableArt playing={playing} cover={track?.artworkUrl} />
      {track && source?.path
        ? <Link className="desk-resume" to={source.path}>
          <span>{playing ? 'Sonando ahora' : 'Sesión en pausa'}</span>
          <strong>{track.title}</strong>
          <small>{track.artist} · {source.label}</small>
          <em>Volver a la sesión</em>
        </Link>
        : <p className="desk-idle">El plato está vacío. Elige una caja del estante y el primer disco bajará aquí.</p>}
    </section>

    <nav className="room-doors" aria-label="Otras salas del estudio">
      <Link className="room-door door-booth" to="/explorar"><BoothArt /><strong>La cabina</strong><span>¿Tienes una canción en mente? Pídela por nombre o artista.</span></Link>
      <Link className="room-door door-console" to={user ? '/preferencias' : '/registro'}><ConsoleArt /><strong>La consola</strong><span>Ajusta tus artistas, géneros y cuánto quieres descubrir.</span></Link>
      <Link className="room-door door-coats" to={user ? '/cuenta' : '/login'}><CoatsArt /><strong>El perchero</strong><span>{user ? 'Tu cuenta y tu Spotify.' : 'Entra o crea tu cuenta para guardar tus gustos.'}</span></Link>
    </nav>
  </div>;
}
