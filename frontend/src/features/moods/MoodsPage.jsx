import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
import MoodShelf from './MoodShelf';

// El estante visto de cerca: las seis cajas a tamaño completo, con la nota de cada una.
export default function MoodsPage() {
  const moods = useResource('/moods');
  return <section className="shelf-room" aria-labelledby="moods-title">
    <header className="room-wall">
      <h1 id="moods-title">El estante</h1>
      <p>Seis cajas, una por mood. Saca la que va contigo: cada sesión trae 7 canciones y puedes pedir otra toma cuando quieras.</p>
    </header>
    <ResourceState resource={moods}><MoodShelf moods={moods.data || []} /></ResourceState>
  </section>;
}
