import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
import TrackList from '../../shared/components/TrackList';
export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const term = params.get('q') || '';
  const [query, setQuery] = useState(term);
  const resource = useResource(term ? `/music/search?q=${encodeURIComponent(term)}` : null);
  function submit(event) { event.preventDefault(); if (query.trim().length >= 2) setParams({ q: query.trim() }); }
  return <><h1>Explorar música</h1><p>Busca una canción o artista y escucha los previews disponibles en iTunes.</p>
    <form onSubmit={submit}><label htmlFor="query">Canción o artista</label><div className="search"><input id="query" type="search" value={query} onChange={event => setQuery(event.target.value)} minLength="2" maxLength="100" required /><button disabled={query.trim().length < 2}>Buscar</button></div></form>
    <ResourceState resource={resource}>{resource.data && <><p role="status">{resource.data.length} resultados para «{term}».</p><TrackList tracks={resource.data} /></>}</ResourceState>
  </>;
}
