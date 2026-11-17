import { Link } from 'react-router-dom';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';

// Cada mood es un disco con su propio color; el orificio central lo dibuja el CSS.
const discs = {
  feliz: 'radial-gradient(circle, #ffe08a 0 30%, #ffb547 31% 62%, #ff8a3d 63%)',
  relajado: 'radial-gradient(circle, #c6fff1 0 30%, #5fd6c4 31% 62%, #2b9a9a 63%)',
  motivado: 'radial-gradient(circle, #ffd0c2 0 30%, #ff7a5c 31% 62%, #e2413b 63%)',
  triste: 'radial-gradient(circle, #c9d6ff 0 30%, #6f86d9 31% 62%, #3a4aa6 63%)',
  romantico: 'radial-gradient(circle, #ffd6e6 0 30%, #ff8db8 31% 62%, #d94f8a 63%)',
  cansado: 'radial-gradient(circle, #e9e4ff 0 30%, #a99be0 31% 62%, #6c5fb0 63%)',
};

export default function MoodsPage() {
  const resource = useResource('/moods');
  return <>
    <h1>¿Cómo te sientes?</h1>
    <p className="lede">Elige un mood y te preparamos 7 canciones. Cada visita trae otras.</p>
    <ResourceState resource={resource}>
      <ul className="moods">{resource.data?.map(mood => <li key={mood.slug}>
        <Link to={`/recomendaciones/${mood.slug}`}>
          <span className="mood-disc" aria-hidden="true" style={{ background: discs[mood.slug] || discs.relajado }} />
          <span className="mood-name">{mood.name}</span>
          <span className="mood-desc">{mood.description}</span>
        </Link>
      </li>)}</ul>
    </ResourceState>
  </>;
}
