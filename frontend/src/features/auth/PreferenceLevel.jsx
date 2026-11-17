import { useId } from 'react';

export const PREFERENCE_LEVELS = [
  { value: 1, label: 'Sorpréndeme', hint: 'Prioriza descubrimientos y deja espacio para algo familiar.' },
  { value: 2, label: 'Quiero explorar', hint: 'Descubre más artistas y estilos, con tus gustos como punto de partida.' },
  { value: 3, label: 'Equilibrado', hint: 'Combina tus favoritos, artistas cercanos y descubrimientos.' },
  { value: 4, label: 'Cerca de mis gustos', hint: 'Prioriza lo que conoces y algunas recomendaciones cercanas. Las tandas pueden tardar un poco más en prepararse.' },
  { value: 5, label: 'Sé lo que quiero escuchar', hint: 'Sólo tus artistas, géneros y canciones preferidos. Es el nivel más lento: hay que revisar más canciones para encontrar las que encajan con el mood. Si tus gustos casi no tienen canciones para ese mood, lo avisamos y añadimos artistas parecidos.' },
];
export default function PreferenceLevel({ value, onChange, disabled }) {
  const id = useId();
  return <fieldset className="preference-level" disabled={disabled} aria-describedby={`${id}-hint`}>
    <legend>Nivel de preferencia</legend>
    <p>¿Cuánto quieres acercarte a tus gustos? El mood y tus exclusiones se respetan en los cinco niveles.</p>
    <div className="preference-level-options">{PREFERENCE_LEVELS.map(option => <label key={option.value}>
      <input type="radio" name={`${id}-level`} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span><strong>{option.value}</strong>{option.label}</span>
    </label>)}</div>
    <p id={`${id}-hint`} className="hint">{PREFERENCE_LEVELS.find(option => option.value === value)?.hint}</p>
    {value >= 4 && <p className="hint level-warning" role="note">Cuanto más estricto el nivel, menos canciones encajan con cada mood y más puede tardar en cargar una tanda.</p>}
  </fieldset>;
}
