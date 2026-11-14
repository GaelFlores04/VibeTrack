import { Link } from 'react-router-dom';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
export default function MoodsPage() {
  const resource = useResource('/moods');
  return <><h1>¿Cómo te sientes?</h1><p>Elige un estado de ánimo para consultar canciones de Last.fm.</p><ResourceState resource={resource}><ul className="moods">{resource.data?.map(mood => <li key={mood.slug}><Link to={`/recomendaciones/${mood.slug}`}>{mood.name}</Link></li>)}</ul></ResourceState></>;
}
