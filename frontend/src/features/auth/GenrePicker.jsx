import { useId, useState } from 'react';
import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';

const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
export default function GenrePicker({ selected, onChange, disabled }) {
  const catalog = useResource('/music/genres');
  const [query, setQuery] = useState('');
  const searchId = useId();
  const term = normalize(query.trim());
  const groups = (catalog.data || []).filter(group => normalize([group.label, group.id, ...group.children.flat()].join(' ')).includes(term));
  function option(value, label) {
    return <label className="check-option" key={value}><input type="checkbox" checked={selected.includes(value)} disabled={disabled || (!selected.includes(value) && selected.length >= 12)} onChange={event => onChange(items => event.target.checked ? [...items, value] : items.filter(item => item !== value))} />{label}</label>;
  }
  return <fieldset disabled={disabled} className="genre-picker"><legend>Géneros y subgéneros</legend>
    <p id={`${searchId}-hint`}>Elige hasta doce. Un género general abarca sus estilos; elige un subgénero si buscas algo más concreto.</p>
    <label htmlFor={searchId}>Buscar un estilo<input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Por ejemplo: shoegaze, salsa, techno…" /></label>
    <p className="genre-count" role="status">{selected.length}/12 seleccionados{selected.length >= 12 ? '. Quita uno para elegir otro.' : ''}</p>
    <ResourceState resource={catalog}>
      <div className="genre-groups" aria-describedby={`${searchId}-hint`}>
        {groups.map(group => {
          const count = [group.id, ...group.children.map(([value]) => value)].filter(value => selected.includes(value)).length;
          return <details key={group.id} open={term ? true : undefined}>
            <summary>{group.label}{count > 0 && <span>{count} seleccionado{count === 1 ? '' : 's'}</span>}</summary>
            <div className="genre-options" data-keyboard-group="grid">
              {option(group.id, `${group.label} (general)`)}
              {group.children.map(([value, label]) => option(value, label))}
            </div>
          </details>;
        })}
      </div>
      {catalog.data && !groups.length && <p role="status">No encontramos ese estilo. Prueba otro nombre o borra la búsqueda.</p>}
    </ResourceState>
  </fieldset>;
}
