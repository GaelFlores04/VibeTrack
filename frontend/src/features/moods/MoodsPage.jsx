import { Link } from 'react-router-dom';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
export default function MoodsPage() {
  const resource = useResource('/moods');
  return <><h1>¿Cómo te sientes?</h1><p>Elige el estado que quieres acompañar con música.</p><ResourceState resource={resource}><ul className="moods">{resource.data?.map(mood => <li key={mood.slug}><Link to={`/recomendaciones/${mood.slug}`}>{mood.name}</Link><p>{mood.description}</p></li>)}</ul></ResourceState></>;
}
