import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
import TrackList from '../../shared/components/TrackList';
export default function RecommendationsPage() {
  const { mood } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.min(100, Math.max(1, Number(params.get('page')) || 1));
  const resource = useResource(`/music/recommendations/${encodeURIComponent(mood)}?page=${page}`);
  return <><h1>Canciones para tu mood: {mood}</h1><p>Sugerencias iniciales por etiquetas. La personalización con favoritos y calificaciones se añadirá después.</p>
    <ResourceState resource={resource}>{resource.data && <><TrackList tracks={resource.data} /><button disabled={page >= 100} onClick={() => setParams({ page: String(page + 1) })}>Otra tanda</button></>}</ResourceState><p><Link to="/explorar">Buscar canciones en Explorar</Link></p></>;
}
