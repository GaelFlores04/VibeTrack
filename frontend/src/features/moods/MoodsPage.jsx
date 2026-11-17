import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
import Icon from '../../shared/components/Icon';
import MoodCarousel from './MoodCarousel';
import MoodDisc from './MoodDisc';
import { moodPresentation } from './moodPresentation';

export default function MoodsPage() {
  const resource = useResource('/moods');
  const [view, setView] = useState('grid');

  return (
    <section className="moods-page" aria-labelledby="moods-title">
      <header className="page-heading">
        <div>
          <h1 id="moods-title">¿Cómo te sientes?</h1>
          <p className="lede">No hace falta tener la canción. Empieza por tu mood.</p>
        </div>
        <div className="view-switch" role="group" aria-label="Vista de moods" data-keyboard-group="linear">
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="grid" size={18} />Todos</button>
          <button type="button" aria-pressed={view === 'slides'} onClick={() => setView('slides')}><Icon name="slides" size={18} />Slides</button>
        </div>
      </header>
      <ResourceState resource={resource}>
        {resource.data?.length === 0 && <p className="empty-state">No hay moods disponibles en este momento. Vuelve a intentarlo más tarde.</p>}
        {view === 'slides' ? (
          <div className="moods-slide-view"><MoodCarousel moods={resource.data} /></div>
        ) : (
          <ul className="moods" data-keyboard-group="grid" aria-label="Elige un mood">
            {resource.data?.map(mood => (
              <li key={mood.slug}>
                <Link className="mood-card" to={`/recomendaciones/${mood.slug}`} aria-describedby={`mood-${mood.slug}-description`}>
                  <MoodDisc slug={mood.slug} />
                  <div className="mood-card-copy">
                    <h2>{mood.name}</h2>
                    <p id={`mood-${mood.slug}-description`}>{moodPresentation(mood.slug).hint}</p>
                    <span className="mood-card-action">Escuchar este mood<Icon name="arrow-right" size={17} /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ResourceState>
      <p className="moods-note"><Icon name="disc" size={18} />Cada tanda tiene 7 canciones. Puedes cambiar de mood cuando quieras.</p>
    </section>
  );
}
