import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import MoodDisc from './MoodDisc';
import { moodPresentation } from './moodPresentation';

export default function MoodCarousel({ moods }) {
  const [active, setActive] = useState(0);
  const viewport = useRef(null);
  const pagination = useRef(null);
  const activeSlide = useRef(active);
  const reduced = useReducedMotion();
  const id = useId();
  const hasMoods = Boolean(moods?.length);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // Conserva el slide elegido al girar el teléfono o cambiar el zoom.
    const resize = new ResizeObserver(() => {
      element.scrollTo({ left: element.clientWidth * activeSlide.current, behavior: 'instant' });
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, [hasMoods]);

  if (!moods?.length) return null;

  function show(index, event) {
    const element = viewport.current;
    if (!element) return;
    if (index < 0 || index >= moods.length) return;
    element.scrollTo({
      left: index * element.clientWidth,
      behavior: reduced || event.detail === 0 ? 'instant' : 'smooth',
    });
  }

  function updateActive(event) {
    const element = event.currentTarget;
    if (!element.clientWidth) return;
    const next = Math.max(0, Math.min(moods.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
    if (next === activeSlide.current) return;
    // Un gesto no debe dejar el foco dentro de un slide que acaba de quedar inerte.
    if (element.children[activeSlide.current]?.contains(document.activeElement)) {
      pagination.current?.children[next]?.focus({ preventScroll: true });
    }
    activeSlide.current = next;
    setActive(next);
  }

  function keyboard(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? moods.length - 1
      : Math.max(0, Math.min(moods.length - 1, activeSlide.current + (event.key === 'ArrowRight' ? 1 : -1)));
    event.preventDefault();
    event.stopPropagation();
    pagination.current?.children[next]?.focus({ preventScroll: true });
    activeSlide.current = next;
    setActive(next);
    show(next, { detail: 0 });
  }

  return (
    <section className="mood-carousel" aria-label="Encuentra tu mood" aria-roledescription="carrusel" aria-describedby={`${id}-keyboard`} onKeyDown={keyboard}>
      <p className="visually-hidden" id={`${id}-keyboard`}>Flechas izquierda y derecha para cambiar de mood. Inicio y Fin para ir al primero o al último. Mayús + Tab para volver al enlace Escuchar; Enter para abrirlo.</p>
      <div className="carousel-viewport" ref={viewport} onScroll={updateActive} id={id}>
        {moods.map((mood, index) => (
          <article
            className="mood-slide"
            key={mood.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} de ${moods.length}: ${mood.name}`}
            inert={index !== active}
          >
            <div className="slide-art"><MoodDisc slug={mood.slug} /></div>
            <div className="slide-copy">
              <h2>{mood.name}</h2>
              <p>{moodPresentation(mood.slug).moment}</p>
              <Link className="button-link primary" to={`/recomendaciones/${mood.slug}`}>
                Escuchar {mood.name.toLocaleLowerCase('es')}<Icon name="arrow-right" size={18} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="carousel-controls">
        <button type="button" className="icon" aria-disabled={active === 0} onClick={event => show(active - 1, event)} aria-label="Mood anterior" aria-controls={id}>
          <Icon name="arrow-left" />
        </button>
        <div className="carousel-dots" ref={pagination} role="group" aria-label="Ir a un mood">
          {moods.map((mood, index) => (
            <button
              key={mood.slug}
              type="button"
              aria-label={`Ver ${mood.name}`}
              aria-pressed={index === active}
              aria-controls={id}
              onClick={event => show(index, event)}
            ><span /></button>
          ))}
        </div>
        <button type="button" className="icon" aria-disabled={active === moods.length - 1} onClick={event => show(active + 1, event)} aria-label="Mood siguiente" aria-controls={id}>
          <Icon name="arrow-right" />
        </button>
      </div>
      <p className="carousel-position" role="status">{moods[active]?.name} · {active + 1} de {moods.length}</p>
    </section>
  );
}
