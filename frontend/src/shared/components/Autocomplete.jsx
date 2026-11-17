import { useEffect, useId, useRef, useState } from 'react';
import { useSuggestions } from '../hooks/useSuggestions';
export default function Autocomplete({ label, value, onChange, onSelect, endpoint, disabled = false, excluded = [], placeholder = '', inputName, selectionOnly = false }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef(null);
  const resource = useSuggestions(endpoint, value, open && !disabled);
  const nameKey = name => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const options = resource.items.filter(item => (!selectionOnly || item.kind === 'artist') && !excluded.some(name => nameKey(name) === nameKey(item.name)));
  const visible = open && Boolean(value.trim()) && !disabled;
  const choose = item => { setOpen(false); setActive(-1); onSelect(item); };
  useEffect(() => {
    if (visible && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [active, visible]);
  function keyboard(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive(index => !options.length ? -1 : index < 0 ? event.key === 'ArrowDown' ? 0 : options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Enter' && visible && active >= 0 && options[active]) { event.preventDefault(); choose(options[active]); }
    else if (event.key === 'Enter' && selectionOnly) { event.preventDefault(); if (visible && options[0]) choose(options[0]); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
  }
  return <div className="autocomplete" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
    <label htmlFor={`${id}-input`}>{label}</label>
    <input id={`${id}-input`} name={inputName} type="search" role="combobox" aria-autocomplete="list" aria-expanded={visible && options.length > 0} aria-controls={`${id}-options`} aria-activedescendant={visible && active >= 0 && options[active] ? `${id}-option-${active}` : undefined} autoComplete="off" value={value} disabled={disabled} maxLength={100} placeholder={placeholder}
      onChange={event => { setActive(-1); setOpen(true); onChange(event.target.value); }} onFocus={() => setOpen(true)} onKeyDown={keyboard} />
    {visible && <div className="suggestions-panel">
      {resource.loading && <p role="status">Buscando sugerencias…</p>}
      {resource.error && <p role="status">{resource.error}</p>}
      {!resource.loading && !resource.error && !options.length && <p role="status">Sin coincidencias. Prueba otro nombre.</p>}
      <ul ref={list} id={`${id}-options`} role="listbox" aria-label="Sugerencias">
        {options.map((item, index) => <li key={item.id} id={`${id}-option-${index}`} role="option" aria-selected={active === index} tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>
          <strong>{item.name}</strong><span>{item.kind === 'artist' ? 'Artista' : item.artist}</span>
        </li>)}
      </ul>
    </div>}
  </div>;
}
