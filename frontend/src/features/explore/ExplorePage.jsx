import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
import TrackList from '../../shared/components/TrackList';
import Autocomplete from '../../shared/components/Autocomplete';
import Icon from '../../shared/components/Icon';
import { usePlayer } from '../player/PlayerProvider';
import ExplorePlayer from '../player/ExplorePlayer';

const SEARCH_IDEAS = ['Daft Punk', 'The Strokes', 'Karol G', 'Norah Jones'];

export default function ExplorePage() {
  const player = usePlayer();
  const [params, setParams] = useSearchParams();
  const term = params.get('q') || '';
  const [query, setQuery] = useState(term);
  const [, setMatchesVersion] = useState(0);
  const resource = useResource(term ? `/music/search?q=${encodeURIComponent(term)}` : null);
  const source = { key: `search:${term}`, label: `«${term}»`, path: `/explorar?q=${encodeURIComponent(term)}` };

  // Atrás y Adelante también restauran el texto del buscador.
  useEffect(() => { setQuery(term); }, [term]);

  useEffect(() => {
    if (!player.spotify.ready || !resource.data?.length) return;
    let current = true;
    player.spotify.match(resource.data).then(() => {
      if (current) setMatchesVersion(version => version + 1);
    }).catch(() => {});
    return () => { current = false; };
  }, [player.spotify.ready, player.spotify.match, resource.data]);

  function search(value) {
    const next = value.trim().slice(0, 100);
    if (next.length < 2) return;
    setQuery(next);
    setParams({ q: next });
  }

  function submit(event) {
    event.preventDefault();
    if (query.trim() === term) resource.retry();
    else search(query);
  }

  function selectSuggestion(item) {
    search(item.kind === 'artist' ? item.name : `${item.artist} ${item.name}`);
  }

  return (
    <section className="explore-page booth-room" aria-labelledby="explore-title">
      <header className="page-heading">
        <div>
          <h1 id="explore-title">La cabina</h1>
          <p className="lede">Pide por el micrófono de la cabina: esa canción que tienes en mente, o el artista que quieres volver a oír.</p>
        </div>
      </header>
      {/* La cabina: tras el cristal, su tocadiscos; debajo, la mesa del micrófono para pedir. */}
      <div className="booth">
      <div className="booth-glass">
        <ExplorePlayer player={player} tracks={resource.data || []} source={source} />
      </div>
      <form className="explore-search talkback" role="search" aria-label="Buscar música" onSubmit={submit}>
        <span className="talkback-lamp on-air-sign" aria-hidden="true">Micrófono</span>
        <div className="search">
          <Autocomplete
            label="Canción o artista"
            value={query}
            onChange={setQuery}
            endpoint="/music/suggestions"
            placeholder="¿Qué te gustaría escuchar?"
            onSelect={selectSuggestion}
          />
          <button type="submit" className="primary" disabled={query.trim().length < 2}>
            <Icon name="search" size={18} />Buscar
          </button>
        </div>
        <p className="search-help">Previews de 30 segundos cuando están disponibles.</p>
      </form>
      </div>

      <div className="explore-workspace record-bin">
        <div className="explore-results">

          {!term && (
            <section className="search-empty" aria-labelledby="search-ideas-title">
              <h2 id="search-ideas-title">¿Por dónde empezamos?</h2>
              <p>Busca por nombre o prueba con uno de estos artistas.</p>
              <ul className="search-suggestions" data-keyboard-group="linear" aria-label="Artistas para empezar">
                {SEARCH_IDEAS.map(artist => <li key={artist}><button type="button" onClick={() => search(artist)}>{artist}<Icon name="arrow-right" size={16} /></button></li>)}
              </ul>
            </section>
          )}

          <ResourceState resource={resource}>
            {resource.data && (
              <section aria-labelledby="results-title">
                <header className="search-results-header">
                  <h2 id="results-title">Resultados para «{term}»</h2>
                  <p role="status">{resource.data.length} {resource.data.length === 1 ? 'canción' : 'canciones'}</p>
                </header>
                <TrackList
                  tracks={resource.data}
                  source={source}
                />
              </section>
            )}
          </ResourceState>
        </div>
      </div>
    </section>
  );
}
